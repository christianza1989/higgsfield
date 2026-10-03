import catalogue from './data/prompts.json';

export interface PromptMedia { videoUrl?: string; poster?: string }
const cache = new Map<string, { until: number; result: PromptMedia }>();
const pending = new Map<string, Promise<PromptMedia>>();

function hostedUrl(value: unknown, host: string) {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host ? url.href : undefined; }
  catch { return undefined; }
}

// Only resolve sources already in the curated catalogue, never arbitrary URLs.
// Read public embed metadata; stream the video from its original host in the browser.
export async function resolvePromptMedia(id: string): Promise<PromptMedia | undefined> {
  const entry = catalogue.entries.find(e => e.id === id);
  if (!entry) return undefined;
  const tweetId = new URL(entry.source).pathname.match(/\/status\/(\d+)/)?.[1];
  if (!tweetId) return { videoUrl: entry.videoUrl };
  const saved = cache.get(tweetId);
  if (saved && saved.until > Date.now()) return saved.result;
  const existing = pending.get(tweetId);
  if (existing) return existing;
  const request = (async (): Promise<PromptMedia> => {
    try {
      const url = new URL('https://cdn.syndication.twimg.com/tweet-result');
      url.searchParams.set('id', tweetId); url.searchParams.set('lang', 'en'); url.searchParams.set('token', '0');
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
      if (!response.ok) throw new Error('Public video metadata unavailable');
      const data = await response.json();
      if (data.id_str !== tweetId) throw new Error('Unexpected source');
      const media = data.mediaDetails?.find((m: { type?: string }) => m.type === 'video' || m.type === 'animated_gif');
      const variants = (media?.video_info?.variants ?? []).filter((v: { content_type?: string; url?: string }) =>
        v.content_type === 'video/mp4' && hostedUrl(v.url, 'video.twimg.com')) as { bitrate?: number; url: string }[];
      // Prefer an efficient preview rendition over a 4K download for each card.
      variants.sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0));
      const variant = variants.find(v => (v.bitrate ?? 0) >= 2_000_000) ?? variants.at(-1);
      const result = { videoUrl: variant?.url ?? entry.videoUrl, poster: hostedUrl(media?.media_url_https, 'pbs.twimg.com') };
      cache.set(tweetId, { until: Date.now() + 6 * 60 * 60 * 1000, result });
      return result;
    } catch {
      const result = { videoUrl: entry.videoUrl };
      cache.set(tweetId, { until: Date.now() + 60_000, result });
      return result;
    } finally { pending.delete(tweetId); }
  })();
  pending.set(tweetId, request);
  return request;
}
