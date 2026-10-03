// Local-only integration check. No credentials or model endpoints are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMediaTool, inspectMedia } from '../lib/media-tools';
import { ASSET_DIR } from '../lib/reference-assets';

async function main() {
  const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
  if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('This check only uses a local app server.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ad-api-test-'));
  const ids: string[] = []; let jobId: string | undefined;
  try {
    const clip = path.join(temp, 'clip.mp4'); const voice = path.join(temp, 'voice.mp3');
    await runMediaTool('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=6', '-c:v', 'libx264', '-y', clip]);
    await runMediaTool('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=16', '-c:a', 'libmp3lame', '-y', voice]);
    async function upload(file: string, mime: string) {
      const form = new FormData(); form.append('localOnly', '1'); form.append('file', new Blob([fs.readFileSync(file)], { type: mime }), path.basename(file));
      const res = await fetch(origin + '/api/upload', { method: 'POST', body: form }); const data = await res.json();
      assert.equal(res.status, 200, data.error); assert.equal(data.url, ''); assert.ok(data.assetId); ids.push(data.assetId); return data;
    }
    const video = await upload(clip, 'video/mp4'); const audio = await upload(voice, 'audio/mpeg');
    assert.equal(audio.mime, 'audio/wav'); assert.ok(audio.duration >= 15);
    const range = await fetch(origin + audio.localUrl, { headers: { range: 'bytes=0-99' } }); assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 100);
    const invalid = new FormData(); invalid.append('localOnly', '1'); invalid.append('file', new Blob(['not a video'], { type: 'video/mp4' }), 'fake.mp4');
    assert.equal((await fetch(origin + '/api/upload', { method: 'POST', body: invalid })).status, 400);
    async function exportVideo(clips: unknown[]) {
      return fetch(origin + '/api/ads/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clips, audioMode: 'original', voiceAssetId: audio.assetId, aspectRatio: '9:16', cta: 'Atrask daugiau' }) });
    }
    assert.equal((await exportVideo([{ source: { type: 'asset', id: video.assetId }, start: 2, duration: 5 }])).status, 400);
    const clips = Array.from({ length: 3 }, () => ({ source: { type: 'asset', id: video.assetId }, start: 0, duration: 5, caption: 'Ąžuolas ir kokybė' }));
    const res = await exportVideo(clips); const result = await res.json(); assert.equal(res.status, 200, result.error); jobId = result.jobId;
    assert.ok(Math.abs(result.duration - 15) < .1);
    const media = await fetch(origin + result.url, { headers: { range: 'bytes=0-1023' } }); assert.equal(media.status, 206); assert.equal((await media.arrayBuffer()).byteLength, 1024);
    const job = await (await fetch(origin + '/api/jobs/' + jobId)).json(); assert.equal(job.job.status, 'completed'); assert.equal(job.job.est_usd, 0);
    const output = path.join(process.cwd(), 'storage', 'media', path.basename(result.url)); const info = await inspectMedia(output);
    assert.equal(info.hasAudio, true); assert.equal(info.frameRate, 24);
    fs.mkdirSync(path.join(process.cwd(), 'storage', 'verification'), { recursive: true });
    await runMediaTool('ffmpeg', ['-v', 'error', '-ss', '13', '-i', output, '-frames:v', '1', '-y', path.join(process.cwd(), 'storage', 'verification', 'ad-export-frame.png')]);
    console.log('Local API check passed: MP3→WAV, clip upload, validation, 15s MP4 with captions/voice, Library record, and media seeking. No billable requests.');
  } finally {
    if (jobId) { const deletion = await fetch(origin + '/api/jobs/' + jobId, { method: 'DELETE' }); assert.ok(deletion.ok, 'Test export cleanup failed.'); }
    for (const id of ids) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Unsafe asset cleanup ID.');
      const metadata = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, `${id}.json`), 'utf8'));
      if (!new RegExp(`^${id}\\.(mp4|wav)$`).test(metadata.filename)) throw new Error('Unsafe asset cleanup filename.');
      fs.unlinkSync(path.join(ASSET_DIR, metadata.filename)); fs.unlinkSync(path.join(ASSET_DIR, `${id}.json`));
    }
    if (!path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temp).startsWith('studio-ad-api-test-')) throw new Error('Unsafe test cleanup path.');
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
main().catch(() => { console.error('Local ad API verification failed. Review the validation and media tools without accessing credential files.'); process.exitCode = 1; });
