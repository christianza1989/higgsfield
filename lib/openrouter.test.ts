import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { buildOpenRouterBody, calculateVideoPrice, estimateOpenRouter, openRouterDownloadHeaders, statusOpenRouter, submitOpenRouter, type VideoModel } from "./openrouter";
import { parseGenerationRequest } from "./payload";
import { defaultParams, getModel } from "./models";
import { HiggsfieldError } from "./higgsfield";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-only"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
});

const endpoint = "openrouter:bytedance/seedance-2.5";
const input = { prompt: "A sunset", duration: 5, resolution: "720p", aspect_ratio: "16:9", generate_audio: false };
const seedance: VideoModel = {
  id: "bytedance/seedance-2.5", supported_durations: [4, 5, 30], supported_resolutions: ["480p", "720p"],
  supported_aspect_ratios: ["16:9", "1:1", "9:16"], supported_frame_images: ["first_frame", "last_frame"],
  supported_sizes: ["854x480", "640x640", "480x854", "1280x720", "960x960", "720x1280"],
  pricing_skus: { video_tokens: "0.0000107", video_tokens_without_audio: "0.0000107" },
};

test("pricing matches 720p token billing and selects the correct square/portrait resolution", () => {
  assert.equal(calculateVideoPrice(seedance, input), 1.1556);
  assert.equal(calculateVideoPrice(seedance, { ...input, aspect_ratio: "9:16" }), 1.1556);
  assert.equal(calculateVideoPrice(seedance, { ...input, aspect_ratio: "1:1" }), 1.1556);
  assert.equal(calculateVideoPrice(seedance, { ...input, resolution: "480p", aspect_ratio: "1:1" }), 0.5136);
  const kling = { ...seedance, pricing_skus: { duration_seconds: "0.084", duration_seconds_with_audio: "0.126" } };
  assert.ok(Math.abs(calculateVideoPrice(kling, input)! - 0.42) < 1e-10);
  assert.equal(calculateVideoPrice(kling, { ...input, generate_audio: true }), 0.63);
  assert.equal(calculateVideoPrice({ ...seedance, pricing_skus: {} }, input), null);
});

test("references become ordered frame_images, while normal parameters are preserved", () => {
  const body = buildOpenRouterBody(endpoint, { ...input, first_frame_url: "https://example.com/a.png", last_frame_url: "https://example.com/b.png" });
  assert.equal(body.model, seedance.id);
  assert.equal(body.prompt, input.prompt);
  assert.equal(body.first_frame_url, undefined);
  assert.deepEqual((body.frame_images as { frame_type: string }[]).map((f) => f.frame_type), ["first_frame", "last_frame"]);
  assert.throws(() => buildOpenRouterBody(endpoint, { ...input, first_frame_url: "file:///private" }));
});

test("catalog validation blocks unsupported settings before any billable POST", async () => {
  let posts = 0;
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "POST") posts++;
    return Response.json({ data: [seedance] });
  }) as typeof fetch;
  assert.equal((await estimateOpenRouter(endpoint, input) as { usd: string }).usd, "1.1556");
  await assert.rejects(submitOpenRouter(endpoint, { ...input, duration: 90 }), /not supported/);
  assert.equal(posts, 0);
});

test("submit routes one request to OpenRouter and preserves its ID", async () => {
  let posts = 0;
  globalThis.fetch = (async (url, init) => {
    if (String(url).endsWith("/videos/models")) return Response.json({ data: [seedance] });
    assert.equal(String(url), "https://openrouter.ai/api/v1/videos");
    assert.equal(init?.method, "POST");
    assert.equal(JSON.parse(String(init?.body)).model, seedance.id);
    posts++;
    return Response.json({ id: "job-123", status: "pending" });
  }) as typeof fetch;
  assert.deepEqual(await submitOpenRouter(endpoint, input), { request_id: "job-123", status: "queued" });
  assert.equal(posts, 1);
});

test("failed, expired, and cancelled jobs do not produce outputs; completion records cost", async () => {
  for (const state of ["failed", "expired", "cancelled", "nsfw", "in_progress", "completed"]) {
    globalThis.fetch = (async () => Response.json({ status: state, unsigned_urls: ["https://untrusted.example/video"], usage: { cost: 1.2 }, error: "private metadata" })) as typeof fetch;
    const result = await statusOpenRouter("job-123");
    assert.equal(result.status, state === "expired" ? "failed" : state);
    assert.equal(result.cost, 1.2);
    if (state === "completed") assert.equal(result.videos?.[0].url, "https://openrouter.ai/api/v1/videos/job-123/content?index=0");
    else assert.equal(result.videos, undefined);
    assert.ok(!JSON.stringify(result).includes("private metadata"));
  }
});

test("download credentials are only attached to the exact OpenRouter content origin/path", () => {
  assert.ok(openRouterDownloadHeaders("https://openrouter.ai/api/v1/videos/job-123/content?index=0").Authorization);
  for (const url of ["https://openrouter.ai.evil.example/api/v1/videos/id/content", "http://openrouter.ai/api/v1/videos/id/content", "https://openrouter.ai/api/v1/key"]) {
    assert.throws(() => openRouterDownloadHeaders(url));
  }
});

test("upstream error payloads are not exposed and ambiguous errors are not automatically retried", async () => {
  for (const status of [401, 402, 429, 500]) {
    globalThis.fetch = (async () => Response.json({ error: { message: "private metadata" } }, { status })) as typeof fetch;
    await assert.rejects(statusOpenRouter("job-123"), (error: unknown) => {
      assert.ok(error instanceof HiggsfieldError);
      assert.equal(error.status, status);
      assert.equal(error.retryable, status === 429);
      assert.ok(!error.message.includes("private metadata"));
      return true;
    });
  }
});

test("Higgsfield requests retain their endpoint and OpenRouter IDs remain distinct", () => {
  const hf = getModel("bytedance-seedance-2-5-text-to-video")!;
  const or = getModel(endpoint)!;
  assert.equal(parseGenerationRequest({ modelId: hf.id, prompt: "sunset", params: defaultParams(hf) }).endpoint, "/bytedance/seedance-2.5/text-to-video");
  assert.equal(parseGenerationRequest({ modelId: or.id, prompt: "sunset", params: defaultParams(or) }).endpoint, endpoint);
});
