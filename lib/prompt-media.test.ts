import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import catalogue from './data/prompts.json';
import { resolvePromptMedia } from './prompt-media';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('unknown example IDs never fetch a user-supplied URL', async () => {
  globalThis.fetch = (async () => { throw new Error('Must not fetch'); }) as typeof fetch;
  assert.equal(await resolvePromptMedia('https://example.com/private'), undefined);
});

test('public metadata selects an efficient MP4, validates hosts and deduplicates lookups', async () => {
  const entry = catalogue.entries[0];
  const tweetId = entry.source.match(/\/status\/(\d+)/)![1];
  let calls = 0;
  globalThis.fetch = (async (input, options) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, 'cdn.syndication.twimg.com');
    assert.equal(url.searchParams.get('id'), tweetId);
    assert.equal(options?.headers, undefined);
    return Response.json({ id_str: tweetId, mediaDetails: [{ type: 'video',
      media_url_https: 'https://untrusted.example/poster.jpg', video_info: { variants: [
        { content_type: 'video/mp4', bitrate: 2_000_000, url: 'https://untrusted.example/video.mp4' },
        { content_type: 'video/mp4', bitrate: 10_000_000, url: 'https://video.twimg.com/large.mp4' },
        { content_type: 'video/mp4', bitrate: 2_176_000, url: 'https://video.twimg.com/preview.mp4' },
      ] } }] });
  }) as typeof fetch;
  const [a, b] = await Promise.all([resolvePromptMedia(entry.id), resolvePromptMedia(entry.id)]);
  assert.deepEqual(a, { videoUrl: 'https://video.twimg.com/preview.mp4', poster: undefined });
  assert.deepEqual(b, a);
  assert.deepEqual(await resolvePromptMedia(entry.id), a);
  assert.equal(calls, 1);
});

test('missing or restricted public video metadata never produces a post embed', async () => {
  const entry = catalogue.entries[1];
  globalThis.fetch = (async () => Response.json({})) as typeof fetch;
  assert.deepEqual(await resolvePromptMedia(entry.id), { videoUrl: entry.videoUrl });
});
