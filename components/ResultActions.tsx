"use client";
import { useState } from 'react';
import { draftFromJob, openComposer } from '@/lib/composer';
import type { Generation, Job } from '@/lib/shared';

export default function ResultActions({ job, gen, onChanged }: { job: Job; gen?: Generation; onChanged?: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMessage('');
    try {
      const draft = draftFromJob(job);
      const res = await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, title: job.prompt.slice(0, 80) }) });
      if (!res.ok) throw new Error();
      setMessage('Saved to Prompts.');
    } catch { setMessage('Could not save prompt.'); } finally { setBusy(false); }
  }
  async function favorite() {
    if (!gen) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/generations/${gen.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: !gen.favorite }) });
      if (!res.ok) throw new Error();
      onChanged?.();
    } catch { setMessage('Could not change favorite.'); } finally { setBusy(false); }
  }
  const cls = 'rounded-lg border border-edge bg-panel-2 px-3 py-2 text-xs hover:border-accent/50 disabled:opacity-40';
  return <div className="flex flex-wrap gap-2">
    {gen && <button className={`${cls} ${gen.favorite ? 'text-accent' : ''}`} disabled={busy} onClick={() => void favorite()}>{gen.favorite ? '★ Favorited' : '☆ Favorite'}</button>}
    <button className={cls} onClick={() => openComposer(draftFromJob(job))}>Reuse settings</button>
    <button className={cls} disabled={busy} onClick={() => void save()}>Save prompt</button>
    <button className={cls} onClick={async () => { try { await navigator.clipboard.writeText(job.prompt); setMessage('Prompt copied.'); } catch { setMessage('Could not copy prompt.'); } }}>Copy prompt</button>
    {message && <p role="status" className="w-full text-xs text-muted">{message}</p>}
  </div>;
}
