import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseAgentBrief, compileAgentBrief, assertAgentRequest, AgentError } from './agent-plans';
import { agentJobId, parseAgentAuthorization } from './agent-generation';
import { ASSET_DIR, saveAsset } from './reference-assets';
import { speechLanguageEvidence } from './seedance-speech';
const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'agent-brief.example.json'), 'utf8'));

test('agent packet identifies missing real location references; silent invented settings can be ready without a voice', () => {
  const brief = parseAgentBrief(example);
  assert.match(compileAgentBrief(brief).blockers.join(' '), /at least 3/);
  brief.location = { name: 'An invented clay world', viewpoint: 'Eye level', minimumReferences: 0 };
  brief.request = 'A clay animation, with no advertising.'; brief.audio.mode = 'silent';
  const pkg = compileAgentBrief(brief);
  assert.equal(pkg.status, 'ready'); assert.equal(pkg.generationStarted, false);
  assert.equal(pkg.generationRequest?.modelId, 'openrouter:bytedance/seedance-2.5');
  assert.equal((pkg.generationRequest?.params as Record<string,unknown>).generate_audio, false);
  assert.ok(!pkg.prompt.includes('product advertisement'));
});
test('agent packet rejects secret fields, unknown modes, missing authorization basis and unsupported durations', () => {
  for (const invalid of [{ ...example, apiKey: 'dummy' }, { ...example, subject: { kind: 'authorized', description: 'Actor' } },
    { ...example, audio: { mode: 'guaranteed-lipsync' } }, { ...example, scenes: [{ duration: 45, action: 'Action', camera: 'Still' }] }]) {
    assert.throws(() => parseAgentBrief(invalid), AgentError);
  }
  const brief = parseAgentBrief(example); brief.audio.mode = 'reference'; brief.location.minimumReferences = 0;
  assert.match(compileAgentBrief(brief).blockers.join(' '), /Voiceovers import/);
});
test('reviews follow actual distinct image bytes and do not count product references as geography', () => {
  fs.mkdirSync(ASSET_DIR, { recursive: true }); const ids = [randomUUID(), randomUUID()];
  const bytes = Buffer.from('synthetic structural test, never a real vision review');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  for (const id of ids) { fs.writeFileSync(path.join(ASSET_DIR, id + '.jpg'), bytes); saveAsset({ assetId: id, filename: id + '.jpg', kind: 'image', mime: 'image/jpeg', url: 'https://example.com/' + id + '.jpg', localUrl: '/api/reference-assets/' + id, width: 1200, height: 800, bytes: bytes.length }); }
  try {
    const brief = parseAgentBrief(example); brief.location.minimumReferences = 1;
    brief.references = [{ assetId: ids[0], usage: 'location', sourceUrl: 'https://example.com/source', rights: 'Technical test', role: 'Background',
      review: { sha256, method: 'vision', reviewer: 'unit-fixture', usable: true, locationMatch: true, viewpointMatch: true, observations: 'Technical fixture only.' } }];
    const pkg = compileAgentBrief(brief); assert.equal(pkg.status, 'ready'); assert.match(pkg.prompt, /@Image1: Background/);
    brief.references.push({ ...brief.references[0], assetId: ids[1] }); brief.location.minimumReferences = 2;
    assert.match(compileAgentBrief(brief).blockers.join(' '), /Duplicate image/);
    brief.references.pop(); brief.references[0].usage = 'product'; brief.location.minimumReferences = 1;
    assert.match(compileAgentBrief(brief).blockers.join(' '), /at least 1/);
    brief.references[0].usage = 'location'; brief.references[0].review.viewpointMatch = false;
    assert.match(compileAgentBrief(brief).blockers.join(' '), /camera viewpoint/);
    fs.writeFileSync(path.join(ASSET_DIR, ids[0] + '.jpg'), 'changed');
    assert.match(compileAgentBrief(brief).blockers.join(' '), /changed after/);
  } finally { for (const id of ids) { fs.unlinkSync(path.join(ASSET_DIR, id + '.jpg')); fs.unlinkSync(path.join(ASSET_DIR, id + '.json')); } }
});
test('agent authority checks accept Next internal hostname with actual loopback Host; job IDs and billable authorization are stable', () => {
  assert.equal(assertAgentRequest(new Request('http://localhost:3000', { headers: { Host: '127.0.0.1:3000', 'X-Video-Agent': 'studio-v1' } }), true), 'http://127.0.0.1:3000');
  assert.throws(() => assertAgentRequest(new Request('http://127.0.0.1:3000'), true));
  const a = agentJobId('a'.repeat(64)); assert.equal(a, agentJobId('a'.repeat(64))); assert.notEqual(a, agentJobId('b'.repeat(64)));
  assert.match(a, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
  for (const auth of [null, {}, { authorized: true, maximumUsd: NaN, humanRequest: 'Generate' }, { authorized: true, maximumUsd: 2, humanRequest: '' }]) assert.throws(() => parseAgentAuthorization(auth), AgentError);
});
test('multilingual text keeps its script and never claims universal documented language support', () => {
  for (const [language, text] of [['Arabic','مرحبا بالعالم'], ['Japanese','こんにちは世界'], ['Lithuanian','Sveikas, pasauli.']]) {
    const brief = parseAgentBrief({ ...example, location: { name: 'An invented setting', viewpoint: 'Medium shot', minimumReferences: 0 }, dialogue: { text, language, delivery: 'Clear' } });
    const pkg = compileAgentBrief(brief); assert.equal(pkg.brief.dialogue.text, text); assert.ok(pkg.prompt.includes(text));
    assert.equal(pkg.capabilities.exactLipSync, false);
    if (language === 'Lithuanian') assert.match(pkg.warnings.join(' '), /unverified attempt/);
  }
  assert.equal(speechLanguageEvidence('en-US').documented, true);
  assert.equal(speechLanguageEvidence('lt-LT').documented, false);
});
test('genre instructions support silent footage, custom soundscape and editing captions without imposing advertising or a music ban', () => {
  const brief = parseAgentBrief({ ...example, request: 'A stylized musical scene', location: { name: 'Invented world', viewpoint: 'Wide', minimumReferences: 0 },
    audio: { mode: 'native', soundscape: 'Soft instrumental piano under the dialogue.' }, finishing: 'Stop-motion clay animation, muted color palette.',
    scenes: [{ duration: 8, action: 'Two clay characters exchange the scripted greeting.', camera: 'Locked wide shot.', caption: 'An animated greeting' }] });
  const pkg = compileAgentBrief(brief);
  assert.equal(pkg.status, 'ready'); assert.match(pkg.prompt, /Soft instrumental piano/); assert.match(pkg.prompt, /Stop-motion clay animation/);
  assert.ok(!pkg.prompt.includes('No translation, extra words, competing voices or music'));
  assert.equal(pkg.adPlan.scenes[0].caption, 'An animated greeting');
  assert.ok(!pkg.prompt.includes('An animated greeting'));
});
test('native sound-only scenes do not require speech or invent a language warning', () => {
  const brief = parseAgentBrief({ ...example, request: 'An atmospheric forest scene without speech',
    location: { name: 'An invented forest', viewpoint: 'Wide shot', minimumReferences: 0 },
    dialogue: { text: '', language: 'Lithuanian', delivery: 'No speech' },
    audio: { mode: 'native', soundscape: 'Birdsong, leaves moving in a light breeze, no music.' },
    scenes: [{ duration: 8, action: 'Sunlight moves across a forest floor.', camera: 'Slow forward dolly.' }] });
  const pkg = compileAgentBrief(brief);
  assert.equal(pkg.status, 'ready'); assert.equal(pkg.warnings.length, 0);
  assert.match(pkg.prompt, /No intelligible dialogue or invented narration/);
  assert.ok(!pkg.prompt.includes('Synchronize mouth'));
  assert.equal((pkg.generationRequest?.params as Record<string, unknown>).generate_audio, true);
  brief.audio.soundscape = undefined;
  assert.match(compileAgentBrief(brief).blockers.join(' '), /non-speaking soundscape/);
});
