import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('worker persists a completed OpenRouter video and actual cost, without real API calls', async () => {
  const cwd = process.cwd();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-worker-test-'));
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.chdir(temp);
  process.env.OPENROUTER_API_KEY = 'test-only';
  const { db, insertJob, getJob, committedSpendSince, spendSince, MEDIA_DIR } = await import('./db');
  const { ensureWorker } = await import('./worker');
  let posts = 0;
  let downloads = 0;
  globalThis.fetch = (async (url, init) => {
    const uri = String(url);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-only');
    if (uri.endsWith('/videos/models')) return Response.json({ data: [{
      id: 'kwaivgi/kling-v3.0-std', supported_durations: [5], supported_resolutions: ['720p'],
      supported_aspect_ratios: ['16:9'], supported_sizes: ['1280x720'], pricing_skus: { duration_seconds: '0.084' },
    }] });
    if (uri.endsWith('/videos') && init?.method === 'POST') {
      posts++; return Response.json({ id: 'test-video', status: 'completed' });
    }
    if (uri.endsWith('/videos/test-video')) return Response.json({ status: 'completed', unsigned_urls: ['ignored'], usage: { cost: 0.43 } });
    if (uri.endsWith('/videos/test-video/content?index=0')) {
      downloads++; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'video/mp4' } });
    }
    throw new Error('Unexpected URL; real network access is blocked in this test.');
  }) as typeof fetch;
  try {
    insertJob({ id: 'test-job', model_id: 'openrouter:kwaivgi/kling-v3.0-std', model_name: 'Test video',
      endpoint: 'openrouter:kwaivgi/kling-v3.0-std', kind: 'video', prompt: 'Test only', batch: 1,
      params: { prompt: 'Test only', duration: 5, resolution: '720p', aspect_ratio: '16:9', generate_audio: false }, est_usd: 0.42, est_credits: null });
    assert.equal(committedSpendSince(0), 0.42); assert.equal(spendSince(0).usd, 0);
    ensureWorker();
    const end = Date.now() + 8000;
    while (getJob('test-job')?.status !== 'completed' && Date.now() < end) await new Promise(r => setTimeout(r, 40));
    const job = getJob('test-job')!;
    assert.equal(job.status, 'completed', job.error ?? 'Worker did not finish');
    assert.equal(job.request_id, 'test-video');
    assert.equal(job.est_usd, 0.43);
    assert.equal(committedSpendSince(0), 0.43);
    assert.equal(posts, 1);
    assert.equal(downloads, 1);
    assert.equal(job.outputs[0].remote_url, null);
    assert.deepEqual([...fs.readFileSync(path.join(MEDIA_DIR, job.outputs[0].local_path!))], [1, 2, 3]);
    db().prepare('UPDATE generations SET favorite = 1 WHERE id = ?').run(job.outputs[0].id);
    assert.equal(getJob('test-job')!.outputs[0].favorite, 1);
  } finally {
    const state = (globalThis as unknown as { __hfWorker?: { timer: NodeJS.Timeout } }).__hfWorker;
    if (state) clearInterval(state.timer);
    db().close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
    process.chdir(cwd);
    if (!path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temp).startsWith('studio-worker-test-')) throw new Error('Unsafe test cleanup path.');
    await fs.promises.rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
