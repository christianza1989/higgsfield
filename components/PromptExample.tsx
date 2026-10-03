"use client";
import { useEffect, useRef, useState } from 'react';
import type { PromptMedia } from '@/lib/prompt-media';

export default function PromptExample({ id, videoUrl, source, hovered }: { id: string; videoUrl?: string; source?: string; hovered: boolean }) {
  const preview = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [media, setMedia] = useState<PromptMedia | null>(source ? null : { videoUrl });
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [manualPlayback, setManualPlayback] = useState(false);
  const [loading, setLoading] = useState(Boolean(videoUrl || source));
  const available = Boolean(videoUrl || source);

  useEffect(() => {
    const video = player.current;
    if (!video) return;
    if (hovered) {
      video.muted = true;
      void video.play().catch(() => {});
    } else video.pause();
  }, [hovered, media?.videoUrl, visible]);

  useEffect(() => {
    const el = preview.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
      else player.current?.pause();
    }, { rootMargin: '150px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !source) return;
    let canceled = false;
    void fetch(`/api/prompt-video?id=${encodeURIComponent(id)}`).then(async res => {
      if (!res.ok) throw new Error('Preview unavailable');
      return await res.json() as PromptMedia;
    }).then(result => {
      if (canceled) return;
      setMedia(result); setError(!result.videoUrl);
      if (!result.videoUrl) setLoading(false);
    }).catch(() => {
      if (canceled) return;
      setMedia({ videoUrl }); setError(!videoUrl);
      if (!videoUrl) setLoading(false);
    });
    return () => { canceled = true; };
  }, [visible, source, id, videoUrl]);

  return <div ref={preview} className="relative aspect-video overflow-hidden border-b border-edge-soft bg-black">
    {media?.videoUrl && visible ? <>
      <video ref={player} controls={manualPlayback || hovered} muted loop playsInline preload="metadata" poster={media.poster}
        src={`${media.videoUrl}#t=0.1`} aria-label="Prompt video preview"
        onLoadedData={() => { setLoading(false); if (hovered) void player.current?.play().catch(() => {}); }} onError={() => { setError(true); setLoading(false); }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        className="h-full w-full object-contain" />
      {!playing && !loading && !error && <button aria-label="Play video preview" onClick={() => { setManualPlayback(true); void player.current?.play().catch(() => {}); }}
        className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-sky-500 text-white shadow-lg hover:bg-sky-400">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-1 size-8 fill-current"><path d="M7 3v18l16-9z" /></svg>
      </button>}
    </> : !available || error ? <div className="flex h-full flex-col items-center justify-center gap-2 bg-panel-2 px-4 text-center">
      <svg viewBox="0 0 24 24" className="size-8 text-faint" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 8 6 4-6 4z" /></svg>
      <p role={error ? 'status' : undefined} className="text-xs text-muted">{error ? 'Video example unavailable' : 'No video example yet'}</p>
      <p className="text-2xs text-faint">{error ? 'The original host did not provide a playable video.' : 'Editable prompt template'}</p>
    </div> : null}
    {error && media?.videoUrl && <p role="status" className="absolute inset-x-0 bottom-0 bg-black/80 p-3 text-center text-xs text-muted">Video example unavailable</p>}
    {available && loading && !error && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted">Loading video…</p>}
  </div>;
}
