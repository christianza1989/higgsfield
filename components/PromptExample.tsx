"use client";
import { useEffect, useRef, useState } from 'react';

interface TwitterWidgets {
  widgets: { createTweet(id: string, target: HTMLElement, options: Record<string, unknown>): Promise<HTMLElement | undefined> };
}
let widgetPromise: Promise<TwitterWidgets> | undefined;
function loadWidgets() {
  const w = window as Window & { twttr?: TwitterWidgets };
  if (w.twttr?.widgets?.createTweet) return Promise.resolve(w.twttr);
  if (widgetPromise) return widgetPromise;
  widgetPromise = new Promise<TwitterWidgets>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js'; script.async = true;
    const timer = setTimeout(() => { widgetPromise = undefined; reject(new Error('X embed timed out')); }, 15_000);
    script.onload = () => {
      clearTimeout(timer);
      if (w.twttr?.widgets?.createTweet) resolve(w.twttr);
      else { widgetPromise = undefined; reject(new Error('X embed unavailable')); }
    };
    script.onerror = () => { clearTimeout(timer); widgetPromise = undefined; reject(new Error('X embed blocked')); };
    document.head.appendChild(script);
  });
  return widgetPromise;
}

export default function PromptExample({ videoUrl, source }: { videoUrl?: string; source?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(!videoUrl);
  let tweetId: string | undefined;
  try {
    const url = new URL(source ?? '');
    if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) tweetId = url.pathname.match(/\/status\/(\d+)/)?.[1];
  } catch { /* no source */ }
  useEffect(() => {
    if (videoUrl || !tweetId || !container.current) return;
    let canceled = false;
    const host = document.createElement('div');
    container.current.replaceChildren(host);
    setLoading(true); setError(false);
    const timer = setTimeout(() => { if (!canceled) { setLoading(false); setError(true); } }, 20_000);
    void loadWidgets().then(api => {
      if (canceled) return;
      return api.widgets.createTweet(tweetId!, host, { theme: 'dark', dnt: true, conversation: 'none', width: 360 });
    }).then(el => {
      if (canceled) return;
      clearTimeout(timer); setLoading(false); setError(!el);
    }).catch(() => { if (!canceled) { clearTimeout(timer); setLoading(false); setError(true); } });
    return () => { canceled = true; clearTimeout(timer); host.remove(); };
  }, [tweetId, videoUrl]);
  if (!videoUrl && !tweetId) return null;
  return <section className="mb-5 rounded-xl border border-edge-soft bg-bg p-3">
    <h3 className="mb-2 text-sm font-bold">Original video example</h3>
    {videoUrl ? <video controls playsInline preload="none" src={videoUrl} onError={() => setError(true)} className="max-h-96 w-full rounded-lg" /> : <div ref={container} className="min-h-24" />}
    {loading && <p className="text-xs text-faint">Loading X example…</p>}
    {error && <p role="status" className="mt-2 text-xs text-warn">The example could not load. The source may be unavailable or blocked by your browser. {source && <a href={source} target="_blank" rel="noreferrer" className="underline">Open original source ↗</a>}</p>}
    {!videoUrl && <p className="mt-2 text-2xs text-faint">Embedded from X. Playback depends on X availability.</p>}
  </section>;
}
