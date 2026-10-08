import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ASSET_DIR, readAsset, saveAsset, type ReferenceAsset } from './reference-assets';
import { inspectMedia } from './media-tools';
import { VOICEOVER_CAPABILITIES, type VoiceoverManifest, type VoiceoverImport } from './voiceover-contract';

const IMPORT_DIR = path.join(process.cwd(), 'storage', 'voiceover-imports');
export const MAX_VOICEOVER_BYTES = 15 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_REQUEST_BYTES = MAX_VOICEOVER_BYTES + MAX_MANIFEST_BYTES + 32 * 1024;
export class VoiceoverImportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function reject(message: string, status = 400): never { throw new VoiceoverImportError(message, status); }

export function assertVoiceoverRequest(req: Request, mutation = false) {
  const url = new URL(req.url);
  const host = req.headers.get('host') ?? url.host;
  let actual: URL;
  try { actual = new URL('http://' + host); } catch { reject('Invalid local request authority.', 403); }
  // Next adds matching x-forwarded-* headers even for direct local requests.
  // Require the actual Host and reject any forwarded authority that differs.
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  // Production Next may construct req.url with its internal listener hostname.
  // Validate actual HTTP Host, not the framework's rewritten URL authority.
  if (url.protocol !== 'http:' || actual.hostname !== '127.0.0.1' || actual.host !== host || actual.username || actual.password ||
      (forwardedHost !== null && forwardedHost !== host) || (forwardedProto !== null && forwardedProto !== 'http') ||
      req.headers.has('forwarded')) reject('Voiceover imports are available only on 127.0.0.1.', 403);
  const origin = req.headers.get('origin');
  if (origin && origin !== actual.origin) reject('Cross-origin voiceover access is not allowed.', 403);
  const site = req.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) reject('Cross-site voiceover access is not allowed.', 403);
  if (mutation && req.headers.get('x-voiceover-client') !== 'voiceovers-v1') reject('The Voiceovers client header is required.', 403);
  return actual.origin;
}

export function parseVoiceoverManifest(value: unknown): VoiceoverManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('Invalid voiceover manifest.');
  const raw = value as Record<string, unknown>;
  const allowed = new Set(['schemaVersion','source','sourceJobId','status','text','language','style','model','voiceId','durationSeconds','segments']);
  if (Object.keys(raw).some(key => !allowed.has(key))) reject('The manifest contains unsupported fields. Do not include credentials, paths or consent files.');
  if (raw.schemaVersion !== 1 || raw.source !== 'voiceovers' || raw.status !== 'completed') reject('Use a version 1 manifest from a completed Voiceovers export.');
  if (typeof raw.sourceJobId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(raw.sourceJobId)) reject('Invalid source job ID.');
  const field = (key: string, max: number, required = false): string | undefined => {
    const value = raw[key];
    if (value === undefined && !required) return;
    if (typeof value !== 'string' || !value.trim() || value.length > max) reject('Invalid ' + key + ' in the manifest.');
    return value.trim();
  };
  if (typeof raw.text !== 'string' || raw.text.length > 12000) reject('Invalid text in the manifest. Use an empty string when a prepared recording has no transcript.');
  const text = raw.text.trim();
  const language = field('language', 80, true)!;
  const style = field('style', 2000), model = field('model', 200), voiceId = field('voiceId', 200);
  if (typeof raw.durationSeconds !== 'number' || !Number.isFinite(raw.durationSeconds) || raw.durationSeconds < 5 || raw.durationSeconds > 30) reject('The voiceover must be 5–30 seconds long.');
  let segments: VoiceoverManifest['segments'];
  if (raw.segments !== undefined) {
    if (!Array.isArray(raw.segments) || raw.segments.length > 100) reject('Use at most 100 transcript segments.');
    let previousEnd = 0;
    segments = raw.segments.map(segment => {
      if (!segment || typeof segment !== 'object' || Array.isArray(segment) ||
        Object.keys(segment).some(key => !['text','startSeconds','endSeconds'].includes(key))) reject('Invalid transcript segment.');
      const { text, startSeconds, endSeconds } = segment;
      if (typeof text !== 'string' || !text.trim() || text.length > 12000 ||
        typeof startSeconds !== 'number' || typeof endSeconds !== 'number' || !Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) ||
        startSeconds < previousEnd || endSeconds <= startSeconds || endSeconds > (raw.durationSeconds as number) + .01) reject('Transcript segment times must be ordered and fit the recording.');
      previousEnd = endSeconds;
      return { text: text.trim(), startSeconds, endSeconds };
    });
  }
  return { schemaVersion: 1, source: 'voiceovers', sourceJobId: raw.sourceJobId, status: 'completed', text, language,
    durationSeconds: raw.durationSeconds, ...(style ? { style } : {}), ...(model ? { model } : {}), ...(voiceId ? { voiceId } : {}), ...(segments ? { segments } : {}) };
}

// Inspect the actual RIFF chunks rather than trusting MIME, the filename or manifest duration.
export function inspectVoiceoverWav(bytes: Buffer) {
  if (bytes.length < 44 || bytes.length > MAX_VOICEOVER_BYTES || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) reject('Use a valid PCM16 mono 24 kHz WAV, up to 15 MiB.');
  let format = false, dataBytes: number | undefined;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) reject('The WAV is truncated.');
    const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + length;
    if (end > bytes.length) reject('The WAV is truncated.');
    if (kind === 'fmt ') {
      if (format || length < 16 || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 ||
        bytes.readUInt32LE(start + 4) !== 24000 || bytes.readUInt32LE(start + 8) !== 48000 ||
        bytes.readUInt16LE(start + 12) !== 2 || bytes.readUInt16LE(start + 14) !== 16) reject('Export PCM16 mono 24 kHz WAV from Voiceovers.');
      format = true;
    }
    if (kind === 'data') {
      if (dataBytes !== undefined || length % 2) reject('Invalid WAV audio data.');
      dataBytes = length;
    }
    offset = end + length % 2;
    if (offset > bytes.length) reject('Invalid WAV chunk padding.');
  }
  const duration = (dataBytes ?? 0) / 48000;
  if (!format || duration < 5 || duration > 30) reject('The actual recording must be 5–30 seconds long.');
  return duration;
}

interface StoredImport { importId: string; assetId: string; audioSha256: string; manifest: VoiceoverManifest }
function readStored(id: string): StoredImport {
  if (!/^[a-f0-9]{64}$/.test(id)) reject('Voiceover import not found.', 404);
  try { const stored = JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, id + '.json'), 'utf8')) as StoredImport;
    if (stored.importId !== id) throw new Error();
    return stored;
  } catch { return reject('Voiceover import not found.', 404); }
}
function response(stored: StoredImport, origin: string): VoiceoverImport {
  const asset = readAsset(stored.assetId);
  return { schemaVersion: 1, importId: stored.importId, asset: { assetId: asset.assetId, localUrl: asset.localUrl,
    kind: 'audio', mime: 'audio/wav', duration: asset.duration!, bytes: asset.bytes! }, manifest: stored.manifest,
    compositionUrl: origin + '/ads?voiceoverImport=' + stored.importId, generationStarted: false, capabilities: VOICEOVER_CAPABILITIES };
}
export function readVoiceoverImport(id: string, origin: string) { return response(readStored(id), origin); }

async function boundedForm(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data;')) reject('Use multipart/form-data.');
  if (Number(req.headers.get('content-length')) > MAX_REQUEST_BYTES) reject('Voiceover import is too large.', 413);
  const reader = req.body?.getReader();
  if (!reader) reject('A voiceover file and manifest are required.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_REQUEST_BYTES) { await reader.cancel(); reject('Voiceover import is too large.', 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers.get('content-type')! } }).formData(); }
  catch { return reject('Invalid multipart request.'); }
}

export async function importVoiceover(req: Request) {
  const origin = assertVoiceoverRequest(req, true), form = await boundedForm(req);
  if ([...form.keys()].some(key => !['file','manifest'].includes(key)) || form.getAll('file').length !== 1 || form.getAll('manifest').length !== 1) reject('Send exactly one file and one manifest.');
  const file = form.get('file'), manifestText = form.get('manifest');
  if (!(file instanceof File) || !['audio/wav','audio/x-wav'].includes(file.type) || !file.size || file.size > MAX_VOICEOVER_BYTES) reject('Choose a WAV file, up to 15 MiB.');
  if (typeof manifestText !== 'string' || Buffer.byteLength(manifestText, 'utf8') > MAX_MANIFEST_BYTES) reject('Send the JSON manifest as a text field, up to 64 KiB.');
  let value: unknown;
  try { value = JSON.parse(manifestText); } catch { reject('Invalid JSON manifest.'); }
  const manifest = parseVoiceoverManifest(value), bytes = Buffer.from(await file.arrayBuffer());
  const duration = inspectVoiceoverWav(bytes);
  if (Math.abs(duration - manifest.durationSeconds) > .05) reject('The manifest duration does not match the recording.');
  const id = createHash('sha256').update('voiceovers:' + manifest.sourceJobId).digest('hex');
  const audioSha256 = createHash('sha256').update(bytes).digest('hex');
  const metadataPath = path.join(IMPORT_DIR, id + '.json');
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  if (fs.existsSync(metadataPath)) {
    const stored = readStored(id);
    if (stored.audioSha256 !== audioSha256 || JSON.stringify(stored.manifest) !== JSON.stringify(manifest)) reject('This source job was imported with different content. Use a new source job ID.', 409);
    return { data: response(stored, origin), created: false };
  }
  const lock = path.join(IMPORT_DIR, id + '.lock');
  try { fs.writeFileSync(lock, '', { flag: 'wx' }); } catch { reject('This import is being processed. Retry the same export shortly.', 409); }
  const assetId = randomUUID(), filename = assetId + '.wav', target = path.join(ASSET_DIR, filename);
  try {
    fs.mkdirSync(ASSET_DIR, { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
    const inspected = await inspectMedia(target);
    if (!inspected.hasAudio || inspected.hasVideo || !inspected.duration || Math.abs(inspected.duration - duration) > .01) reject('The recording could not be verified.');
    const asset: ReferenceAsset = { assetId, filename, url: '', localUrl: '/api/reference-assets/' + assetId,
      mime: 'audio/wav', kind: 'audio', name: 'Voiceovers · ' + manifest.sourceJobId, bytes: bytes.length, duration,
      hasAudio: true };
    saveAsset(asset);
    const stored: StoredImport = { importId: id, assetId, audioSha256, manifest };
    fs.writeFileSync(metadataPath, JSON.stringify(stored), { flag: 'wx' });
    return { data: response(stored, origin), created: true };
  } catch (error) {
    for (const file of [target, path.join(ASSET_DIR, assetId + '.json')]) { try { fs.unlinkSync(file); } catch {} }
    throw error;
  } finally { fs.unlinkSync(lock); }
}
