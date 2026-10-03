import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { referenceLabel, referenceInputs, validateReferences, withReferenceRoles, type VideoReference } from './video-references';
import { parseGenerationRequest } from './payload';
import { buildOpenRouterBody, calculateVideoPrice } from './openrouter';
import { ASSET_DIR, saveAsset } from './reference-assets';
import { mapStatus } from './worker';

const image: VideoReference = { kind: 'image', url: 'https://example.com/product.png', width: 720, height: 1280, purpose: 'Packaging only.' };
const audio: VideoReference = { kind: 'audio', url: 'https://example.com/voice.wav', duration: 15, bytes: 1000 };
const request = { modelId: 'openrouter:bytedance/seedance-2.5', prompt: 'Show the product.', params: { duration: 15, resolution: '720p', aspect_ratio: '9:16', generate_audio: false } };

test('moderated, canceled and expired jobs are terminal rather than successful or indefinitely generating', () => {
  assert.equal(mapStatus('moderated'), 'nsfw'); assert.equal(mapStatus('blocked'), 'nsfw');
  assert.equal(mapStatus('cancelled'), 'canceled'); assert.equal(mapStatus('expired'), 'failed');
});

test('reference roles use per-type ordering and are not duplicated when reusing a prompt', () => {
  const refs = [image, audio, { ...image, url: 'https://example.com/style.png', purpose: 'Lighting only.' }];
  assert.deepEqual(refs.map((_, i) => referenceLabel(refs, i, 'references')), ['@Image1', '@Audio1', '@Image2']);
  assert.deepEqual(referenceInputs(refs).map(r => r.type), ['image_url', 'audio_url', 'image_url']);
  const prompt = withReferenceRoles('Show the product.', refs);
  assert.equal(withReferenceRoles(prompt, refs), prompt);
});
test('reference validation enforces durations, aggregate limits, image dimensions and frame semantics', () => {
  validateReferences([image, audio], 'references');
  assert.throws(() => validateReferences([{ ...audio, duration: 31 }], 'references'), /2–30/);
  assert.throws(() => validateReferences([audio, { ...audio, duration: 16 }], 'references'), /Combined/);
  assert.throws(() => validateReferences([{ ...image, width: 0 }], 'references'), /300–6000/);
  assert.throws(() => validateReferences([audio], 'frames'), /two images/);
  assert.throws(() => validateReferences([image, { ...image, width: 1280, height: 720 }], 'frames'), /same aspect/);
  assert.throws(() => validateReferences([{ ...image, url: 'file:///private' }], 'references'), /HTTPS/);
  assert.throws(() => validateReferences(Array.from({ length: 31 }, () => image), 'references'), /Too many/);
});
test('product references and exact frames are separate upstream payloads; local metadata never reaches OpenRouter', () => {
  const refs = parseGenerationRequest({ ...request, references: [image], referenceMode: 'references' });
  const body = buildOpenRouterBody(refs.endpoint, refs.body);
  assert.equal(body.frame_images, undefined);
  assert.deepEqual(body.input_references, [{ type: 'image_url', image_url: { url: image.url } }]);
  assert.equal(body._studio_references, undefined);
  assert.match(String(body.prompt), /@Image1: Packaging only/);
  const frames = parseGenerationRequest({ ...request, references: [image], referenceMode: 'frames' });
  assert.equal((buildOpenRouterBody(frames.endpoint, frames.body).frame_images as unknown[]).length, 1);
  assert.throws(() => parseGenerationRequest({ ...request, params: { ...request.params, aspect_ratio: '16:9' }, references: [image], referenceMode: 'frames' }), /matching the first frame/);
  assert.throws(() => parseGenerationRequest({ ...request, references: [image], refUrls: [image.url] }), /one reference mode/);
  assert.throws(() => parseGenerationRequest({ ...request, params: { ...request.params, duration: 90 } }), /supported range/);
  const hf = { ...request, modelId: 'bytedance-seedance-2-5-text-to-video', references: [image] };
  const product = parseGenerationRequest({ ...hf, referenceMode: 'references' });
  assert.equal(product.endpoint, '/bytedance/seedance-2.5/reference-to-video');
  assert.deepEqual(product.body.image_urls, [image.url]); assert.equal(product.body.image_url, undefined);
  const first = parseGenerationRequest({ ...hf, referenceMode: 'frames' });
  assert.equal(first.endpoint, '/bytedance/seedance-2.5/image-to-video'); assert.equal(first.body.image_url, image.url);
  assert.throws(() => parseGenerationRequest({ ...hf, referenceMode: 'frames', references: [image, image] }), /only a first-frame/);
});
test('uploaded audio metadata is trusted over browser claims; local-only assets cannot be sent to a provider', () => {
  const id = randomUUID(); const filename = `${id}.wav`;
  fs.mkdirSync(ASSET_DIR, { recursive: true }); fs.writeFileSync(path.join(ASSET_DIR, filename), 'test fixture');
  try {
    saveAsset({ ...audio, duration: 31, assetId: id, filename, mime: 'audio/wav', localUrl: `/api/reference-assets/${id}` });
    assert.throws(() => parseGenerationRequest({ ...request, references: [{ ...audio, duration: 5, assetId: id }] }), /2–30/);
    saveAsset({ ...audio, url: '', assetId: id, filename, mime: 'audio/wav', localUrl: `/api/reference-assets/${id}` });
    assert.throws(() => parseGenerationRequest({ ...request, references: [{ ...audio, assetId: id }] }), /no longer matches/);
    assert.throws(() => parseGenerationRequest({ ...request, references: [audio] }), /Upload audio/);
  } finally { fs.unlinkSync(path.join(ASSET_DIR, filename)); fs.unlinkSync(path.join(ASSET_DIR, `${id}.json`)); }
});
test('video-reference pricing cannot claim an output-only estimate', () => {
  const model = { id: 'bytedance/seedance-2.5', supported_durations: [15], supported_resolutions: ['720p'], supported_aspect_ratios: ['9:16'], supported_sizes: ['720x1280'], pricing_skus: { video_tokens: '0.0000107' } };
  assert.equal(calculateVideoPrice(model, { ...request.params, input_references: [{ type: 'video_url', video_url: { url: 'https://example.com/clip.mp4' } }] }), null);
});
