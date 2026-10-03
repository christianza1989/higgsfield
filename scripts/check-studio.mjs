import assert from 'node:assert/strict';

const base = process.env.STUDIO_URL || 'http://127.0.0.1:3000';
async function call(route, method = 'GET', body) {
  const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  return { status: res.status, data };
}
const prompts = await call('/api/prompts');
assert.equal(prompts.status, 200);
assert.equal(prompts.data.prompts.filter(p => p.id.startsWith('evolink-')).length, 163);
assert.equal(prompts.data.prompts.filter(p => p.id.startsWith('starter-')).length, 40);
assert.equal((await call('/api/prompts', 'POST', { title: 'Invalid', kind: 'video' })).status, 400);
const created = await call('/api/prompts', 'POST', { title: 'Disposable API smoke check', prompt: 'Test prompt', kind: 'video', modelId: 'openrouter:bytedance/seedance-2.5', params: { duration: 15, aspect_ratio: '9:16', generate_audio: true } });
assert.equal(created.status, 201);
const id = created.data.id;
try {
  assert.equal((await call('/api/prompts', 'PATCH', { id, favorite: true })).status, 200);
  const saved = (await call('/api/prompts')).data.prompts.find(p => p.id === id);
  assert.equal(saved.favorite, true);
  assert.equal(saved.params.duration, 15);
  assert.equal(saved.params.generate_audio, true);
  assert.equal((await call('/api/jobs?favorites=1')).status, 200);
  console.log('Prompt catalogue, personal save, persistent favorite, settings and favorites API: OK');
} finally {
  assert.equal((await call(`/api/prompts?id=${encodeURIComponent(id)}`, 'DELETE')).status, 200);
}
const settings = await call('/api/settings');
assert.equal(settings.status, 200);
assert.equal(settings.data.openRouterConfigured, true);
for (const modelId of ['openrouter:bytedance/seedance-2.5', 'openrouter:kwaivgi/kling-v3.0-std', 'openrouter:kwaivgi/kling-v3.0-pro']) {
  const q = await call('/api/estimate', 'POST', { modelId, prompt: 'Price check only', params: { duration: 5, resolution: '720p', aspect_ratio: '16:9', generate_audio: false }, batch: 1 });
  assert.equal(q.status, 200);
  assert.equal(q.data.available, true);
  assert.ok(q.data.usd > 0);
  console.log(`${modelId}: live estimate $${q.data.usd.toFixed(4)}`);
}
console.log('No generation was submitted by this check.');
