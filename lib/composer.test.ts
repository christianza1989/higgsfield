import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftFromJob } from './composer';
import { providerPeer, transferParams } from './provider-pairs';
import type { Job } from './shared';

test('reuse restores ordered references and only declared model controls', () => {
  const draft = draftFromJob({ model_id: 'openrouter:bytedance/seedance-2.5', kind: 'video', prompt: 'Shot', batch: 1,
    params: { duration: 8, aspect_ratio: '9:16', first_frame_url: 'https://example.com/a.png', last_frame_url: 'https://example.com/b.png', internal: 'not a control' } } as unknown as Job);
  assert.deepEqual(draft.references?.map(r => r.url), ['https://example.com/a.png', 'https://example.com/b.png']);
  assert.equal(draft.referenceMode, 'frames');
  assert.equal(draft.params?.duration, 8);
  assert.equal(draft.params?.internal, undefined);
});
test('mixed-reference reuse retains roles and the original editable prompt', () => {
  const references = [{ url: 'https://example.com/product.png', kind: 'image', purpose: 'Packaging only.' }];
  const draft = draftFromJob({ model_id: 'openrouter:bytedance/seedance-2.5', kind: 'video', prompt: 'REFERENCE ROLES\n@Image1: Packaging only.\n\nShow product.', batch: 1,
    params: { duration: 15, _studio_references: references, _studio_reference_mode: 'references' } } as unknown as Job);
  assert.equal(draft.prompt, 'Show product.'); assert.deepEqual(draft.references, references);
  assert.equal(draft.referenceMode, 'references'); assert.deepEqual(draft.refUrls, []);
});
test('provider pairs retain model variants and reject settings beyond peer capabilities', () => {
  const peer = providerPeer('openrouter:kwaivgi/kling-v3.0-pro')!;
  assert.equal(peer.id, 'kling-video-v3-0-pro-text-to-video');
  const seedance = providerPeer('openrouter:bytedance/seedance-2.5')!;
  assert.equal(transferParams(seedance, { duration: 30, aspect_ratio: '9:16' }).duration, 5);
  assert.equal(transferParams(seedance, { duration: 8, aspect_ratio: '9:16' }).duration, 8);
  assert.equal(transferParams(seedance, { duration: 8, aspect_ratio: '9:16' }).aspect_ratio, '9:16');
});
