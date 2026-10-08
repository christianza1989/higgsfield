import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ASSET_DIR, readAsset } from './reference-assets';
import { assertVoiceoverRequest, importVoiceover, inspectVoiceoverWav, MAX_VOICEOVER_BYTES, parseVoiceoverManifest, readVoiceoverImport, VoiceoverImportError } from './voiceover-import';
import type { VoiceoverManifest } from './voiceover-contract';

function wav(seconds: number, sampleRate = 24000) {
  const samples = Math.round(seconds * sampleRate), bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(i * Math.PI * 2 * 440 / sampleRate) * 2000), 44 + i * 2);
  return bytes;
}
function manifest(durationSeconds = 5.25): VoiceoverManifest {
  return { schemaVersion: 1, source: 'voiceovers', sourceJobId: 'test-' + randomUUID(), status: 'completed', text: 'Test recording for local transport.', language: 'English', durationSeconds,
    segments: [{ text: 'Test recording for local transport.', startSeconds: 0, endSeconds: durationSeconds }] };
}
function request(data: VoiceoverManifest, bytes = wav(data.durationSeconds)) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), 'voiceover.wav');
  form.append('manifest', JSON.stringify(data));
  return new Request('http://127.0.0.1:3000/api/voiceover-import', { method: 'POST', headers: { 'X-Voiceover-Client': 'voiceovers-v1' }, body: form });
}

test('local handoff rejects foreign origins, proxy hosts and missing client headers', () => {
  assert.equal(assertVoiceoverRequest(new Request('http://localhost:3000/api/voiceover-import', { headers: { Host: '127.0.0.1:3000', 'X-Forwarded-Host': '127.0.0.1:3000', 'X-Forwarded-Proto': 'http', 'X-Voiceover-Client': 'voiceovers-v1', Origin: 'http://127.0.0.1:3000' } }), true), 'http://127.0.0.1:3000');
  assert.equal(assertVoiceoverRequest(new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { Host: '127.0.0.1:3000', 'X-Forwarded-Host': '127.0.0.1:3000', 'X-Forwarded-Proto': 'http', 'X-Voiceover-Client': 'voiceovers-v1' } }), true), 'http://127.0.0.1:3000');
  assert.equal(assertVoiceoverRequest(new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { 'X-Voiceover-Client': 'voiceovers-v1' } }), true), 'http://127.0.0.1:3000');
  for (const req of [new Request('http://localhost:3000/api/voiceover-import'),
    new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { Origin: 'https://foreign.example' } }),
    new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { 'Sec-Fetch-Site': 'cross-site' } }),
    new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { Host: 'foreign.example' } }),
    new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { 'X-Forwarded-Host': 'foreign.example', 'X-Voiceover-Client': 'voiceovers-v1' } }),
    new Request('http://127.0.0.1:3000/api/voiceover-import', { headers: { 'X-Forwarded-Proto': 'https', 'X-Voiceover-Client': 'voiceovers-v1' } }),
    new Request('http://127.0.0.1:3000/api/voiceover-import')]) {
    assert.throws(() => assertVoiceoverRequest(req, true), (error: unknown) => error instanceof VoiceoverImportError && error.status === 403);
  }
});

test('completed manifests enforce ordered timing and reject partial exports and private metadata fields', () => {
  const good = manifest(); assert.equal(parseVoiceoverManifest(good).text, good.text);
  assert.equal(parseVoiceoverManifest({ ...good, text: '', segments: [] }).text, '');
  for (const invalid of [{ ...good, text: undefined }, { ...good, status: 'partial' }, { ...good, schemaVersion: 2 }, { ...good, durationSeconds: 31 },
    { ...good, sourceJobId: '../outside' }, { ...good, apiKey: 'dummy-never-persist' }, { ...good, consentPath: 'private.wav' },
    { ...good, segments: [{ text: 'Wrong timing', startSeconds: 2, endSeconds: 7 }] },
    { ...good, segments: [{ text: 'First', startSeconds: 0, endSeconds: 3 }, { text: 'Second', startSeconds: 2, endSeconds: 5 }] }]) {
    assert.throws(() => parseVoiceoverManifest(invalid), VoiceoverImportError);
  }
});

test('actual PCM frames determine duration and wrong sample rates or truncated WAVs are rejected', () => {
  assert.equal(inspectVoiceoverWav(wav(5.25)), 5.25);
  for (const invalid of [wav(4.99), wav(30.01), wav(5.25, 48000), wav(5.25).subarray(0, 100), Buffer.from('RIFF-not-a-WAV')]) {
    assert.throws(() => inspectVoiceoverWav(invalid), VoiceoverImportError);
  }
});

test('import preserves audio bytes locally, is idempotent, rejects conflicts and makes no network or generation request', async () => {
  const data = manifest(), bytes = wav(data.durationSeconds);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('Network and provider calls are forbidden during local import.'); }) as typeof fetch;
  let assetId: string | undefined;
  const id = createHash('sha256').update('voiceovers:' + data.sourceJobId).digest('hex');
  try {
    const first = await importVoiceover(request(data, bytes)); assetId = first.data.asset.assetId;
    assert.equal(first.created, true); assert.equal(first.data.generationStarted, false);
    assert.equal(first.data.capabilities.exactLipSync, false); assert.equal(first.data.capabilities.referenceAudio.liveVerified, false);
    assert.equal(first.data.asset.duration, 5.25); assert.match(first.data.compositionUrl, /^http:\/\/127\.0\.0\.1:3000\/ads\?voiceoverImport=/);
    const asset = readAsset(assetId);
    assert.equal(asset.url, ''); assert.deepEqual(fs.readFileSync(path.join(ASSET_DIR, asset.filename)), bytes);
    const second = await importVoiceover(request(data, bytes));
    assert.equal(second.created, false); assert.equal(second.data.asset.assetId, assetId);
    assert.equal(readVoiceoverImport(id, 'http://127.0.0.1:3000').manifest.text, data.text);
    await assert.rejects(importVoiceover(request({ ...data, text: 'Different transcript' }, bytes)), (error: unknown) => error instanceof VoiceoverImportError && error.status === 409);
    const changed = Buffer.from(bytes); changed.writeInt16LE(1000, 44);
    await assert.rejects(importVoiceover(request(data, changed)), (error: unknown) => error instanceof VoiceoverImportError && error.status === 409);
  } finally {
    globalThis.fetch = originalFetch;
    for (const file of [path.join(process.cwd(), 'storage', 'voiceover-imports', id + '.json'),
      ...(assetId ? [path.join(ASSET_DIR, assetId + '.json'), path.join(ASSET_DIR, assetId + '.wav')] : [])]) {
      try { fs.unlinkSync(file); } catch {}
    }
  }
});

test('size and duration mismatches fail before creating an asset', async () => {
  const data = manifest();
  await assert.rejects(importVoiceover(request({ ...data, durationSeconds: 6 }, wav(5.25))), /does not match/);
  const oversized = new Request('http://127.0.0.1:3000/api/voiceover-import', { method: 'POST',
    headers: { 'X-Voiceover-Client': 'voiceovers-v1', 'Content-Type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(MAX_VOICEOVER_BYTES + 200000) });
  await assert.rejects(importVoiceover(oversized), (error: unknown) => error instanceof VoiceoverImportError && error.status === 413);
});
