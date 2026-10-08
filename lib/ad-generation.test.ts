import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { adGenerationRequest } from './ad-generation';
import { newAdPlan } from './ad-plan';
import { parseGenerationRequest } from './payload';
import { buildOpenRouterBody } from './openrouter';
import { ASSET_DIR, saveAsset } from './reference-assets';

test('published voice audio reaches OpenRouter only in the talking-reference workflow', () => {
  const id = randomUUID(), filename = `${id}.wav`;
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  fs.writeFileSync(path.join(ASSET_DIR, filename), 'test fixture, never submitted');
  saveAsset({ assetId: id, filename, url: 'https://example.com/voice.wav', localUrl: `/api/reference-assets/${id}`, mime: 'audio/wav', kind: 'audio', duration: 5.25, bytes: 100 });
  try {
    const plan = newAdPlan();
    Object.assign(plan, { product: 'A test product', audioMode: 'reference', voiceAssetId: id, voiceReferenceAssetId: id, voiceDuration: 5.25 });
    plan.scenes = [{ ...plan.scenes[0], duration: 5.25, visual: 'One invented presenter speaks.', narration: 'Hello there.' }];
    plan.references = [{ kind: 'image', url: 'https://example.com/scene.jpg' }, { kind: 'audio', url: 'https://example.com/voice.wav', assetId: id }];
    const parsed = parseGenerationRequest(adGenerationRequest(plan));
    const body = buildOpenRouterBody(parsed.endpoint, parsed.body);
    assert.equal(body.generate_audio, true);
    assert.equal(body.duration, 6);
    assert.deepEqual(body.input_references, [{ type: 'image_url', image_url: { url: 'https://example.com/scene.jpg' } }, { type: 'audio_url', audio_url: { url: 'https://example.com/voice.wav' } }]);
    assert.equal(body.frame_images, undefined);
    plan.audioMode = 'original';
    const silent = parseGenerationRequest(adGenerationRequest(plan));
    assert.equal(silent.body.generate_audio, false);
    assert.equal((silent.body.input_references as unknown[]).length, 1);
    plan.audioMode = 'reference'; plan.scenes.push({ ...plan.scenes[0], id: 'second', duration: 1 }); plan.voiceDuration = 6.25;
    assert.throws(() => adGenerationRequest(plan, 0), /complete voiceover/);
  } finally {
    fs.unlinkSync(path.join(ASSET_DIR, filename)); fs.unlinkSync(path.join(ASSET_DIR, `${id}.json`));
  }
});
