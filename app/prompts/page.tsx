"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PromptEntry } from '@/lib/prompts';
import { openComposer } from '@/lib/composer';
import PromptExample from '@/components/PromptExample';

const field = 'w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent/50';
const button = 'rounded-lg border border-edge px-3 py-1.5 text-xs hover:border-accent/50 disabled:opacity-40';

export default function PromptsPage() {
  const [entries, setEntries] = useState<PromptEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('UGC / Ads');
  const [favorites, setFavorites] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [selected, setSelected] = useState<PromptEntry | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<'image' | 'video'>('video');
  const [provider, setProvider] = useState('higgsfield');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const slots = useMemo(() => [...new Set([...prompt.matchAll(/\[([a-z_]+)\]/g)].map(m => m[1]))], [prompt]);
  const resolvedPrompt = prompt.replace(/\[([a-z_]+)\]/g, (match, key: string) => variables[key]?.trim() || match);
  const missingSlots = slots.filter(s => !variables[s]?.trim());

  async function refresh() {
    try {
      const res = await fetch('/api/prompts');
      if (!res.ok) throw new Error('Could not load prompts.');
      setEntries((await res.json()).prompts); setLoaded(true);
    } catch { setMessage('Could not load prompts. Refresh to retry.'); }
  }
  useEffect(() => { void refresh(); }, []);
  const categories = useMemo(() => [...new Set(entries.map(e => e.category))].sort(), [entries]);
  const shown = useMemo(() => entries.filter(e =>
    (category === 'all' || e.category === category) && (!favorites || e.favorite) && (!personal || e.personal) &&
    `${e.title} ${e.prompt} ${e.author ?? ''}`.toLowerCase().includes(query.toLowerCase())), [entries, query, category, favorites, personal]);

  function select(e: PromptEntry) { setSelected(e); setTitle(e.title); setPrompt(e.prompt); setKind(e.kind); setVariables({}); setMessage(''); }
  async function favorite(e: PromptEntry) {
    const res = await fetch('/api/prompts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, favorite: !e.favorite }) });
    if (!res.ok) { setMessage('Could not change favorite.'); return; }
    await refresh();
    if (selected?.id === e.id) setSelected({ ...e, favorite: !e.favorite });
  }
  async function save() {
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt: resolvedPrompt, kind, modelId: chosenModelId(), params: selected?.params }) });
      if (!res.ok) { setMessage((await res.json()).error); return; }
      await refresh(); setMessage('Saved to My prompts.');
    } catch { setMessage('Could not save prompt.'); } finally { setBusy(false); }
  }
  function chosenModelId() {
    return selected?.personal && selected.kind === kind ? selected.modelId : kind === 'video' ?
      (provider === 'openrouter' ? 'openrouter:bytedance/seedance-2.5' : 'bytedance-seedance-2-5-text-to-video') : undefined;
  }
  function usePrompt() {
    openComposer({ kind, prompt: resolvedPrompt, modelId: chosenModelId(), params: selected?.params });
  }

  return <div className="flex h-full flex-col">
    <header className="flex min-h-[68px] flex-wrap items-center gap-3 border-b border-edge-soft px-7 py-4">
      <h1 className="text-xl font-bold">UGC & ad prompts</h1>
      <input aria-label="Search prompt library" placeholder="Search scenes, camera moves, authors…" value={query} onChange={e => setQuery(e.target.value)} className={`${field} max-w-sm`} />
      <select aria-label="Prompt category" value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-edge bg-panel-2 px-3 py-2 text-xs">
        <option value="all">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}
      </select>
      <button className={`${button} ${favorites ? 'text-accent' : ''}`} onClick={() => setFavorites(!favorites)}>★ Favorites</button>
      <button className={`${button} ${personal ? 'text-accent' : ''}`} onClick={() => { setPersonal(!personal); setCategory('all'); }}>My prompts</button>
      <button className={button} onClick={() => { setCategory('Commercial / Product'); setPersonal(false); }}>Product ads</button>
      <button className={button} onClick={() => { setCategory('UGC / Ads'); setPersonal(false); }}>UGC templates</button>
      <button className={button} onClick={() => { setSelected(null); setTitle(''); setPrompt(''); setVariables({}); setMessage(''); }}>New prompt</button>
    </header>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
      <section className="min-w-0 flex-1 p-7 lg:overflow-y-auto">
        <p className="mb-4 text-xs leading-relaxed text-faint">{shown.length} prompts shown · 16 original UGC/ad templates plus the <a href="https://github.com/EvoLinkAI/awesome-seedance-2.5-prompts" target="_blank" rel="noreferrer" className="text-accent">EvoLinkAI collection</a>, with original author attribution. UGC presets use 15s, 9:16 and audio. Attach your product image and check the estimated cost. <Link href="/video" className="text-accent">Open video studio →</Link></p>
        {!loaded && <p className="text-faint">Loading prompts…</p>}
        <div className="grid gap-3 xl:grid-cols-2">
          {shown.map(e => <article key={e.id} className={`rounded-2xl border bg-panel p-4 ${selected?.id === e.id ? 'border-accent/60' : 'border-edge-soft'}`}>
            <div className="flex items-start justify-between gap-2"><button onClick={() => select(e)} className="text-left text-sm font-bold hover:text-accent">{e.title}</button>
              <button aria-label={e.favorite ? 'Unfavorite prompt' : 'Favorite prompt'} onClick={() => void favorite(e)} className={e.favorite ? 'text-accent' : 'text-faint'}>{e.favorite ? '★' : '☆'}</button></div>
            <p className="mt-2 text-2xs text-faint">{e.category} · {e.personal ? 'My prompt' : e.author}{e.requiresReference ? ' · Reference suggested' : ''}</p>
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">{e.prompt}</p>
            <div className="mt-4 flex gap-2"><button className={button} onClick={() => select(e)}>Customize & use</button>
              {e.source && <button onClick={() => select(e)} className={button}>Watch example ▶</button>}</div>
          </article>)}
        </div>
        {loaded && !shown.length && <p className="py-10 text-center text-faint">No matching prompts.</p>}
      </section>
      <aside className="w-full shrink-0 border-t border-edge-soft bg-panel/60 p-6 lg:w-[420px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <h2 className="mb-4 text-lg font-bold">{selected ? 'Customize prompt' : 'Create a prompt'}</h2>
        {selected?.source && <PromptExample key={selected.id} videoUrl={selected.videoUrl} source={selected.source} />}
        <label className="text-xs text-faint">Title<input className={`${field} mt-1 mb-4`} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></label>
        <label className="text-xs text-faint">Prompt<textarea className={`${field} mt-1 min-h-80 resize-y`} value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={50000} /></label>
        {slots.length > 0 && <div className="mt-4 space-y-3"><h3 className="text-sm font-bold">Fill in your ad</h3>{slots.map(s => <label key={s} className="block text-xs text-faint capitalize">{s.replace(/_/g, ' ')}<textarea rows={s === 'spoken_script' ? 3 : 1} aria-label={s.replace(/_/g, ' ')} className={`${field} mt-1 resize-y`} value={variables[s] ?? ''} onChange={e => setVariables(v => ({ ...v, [s]: e.target.value }))} /></label>)}<p className="text-xs text-faint">Aim for a short script of about 25–30 words including the CTA. Fill every field or replace the brackets directly in the prompt.</p></div>}
        <div className="my-4 flex gap-2">
          <select aria-label="Prompt media type" className={field} value={kind} onChange={e => setKind(e.target.value as 'image' | 'video')}><option value="video">Video</option><option value="image">Image</option></select>
          {kind === 'video' && !selected?.modelId && <select aria-label="Prompt video provider" className={field} value={provider} onChange={e => setProvider(e.target.value)}><option value="higgsfield">Higgsfield</option><option value="openrouter">OpenRouter</option></select>}
        </div>
        {selected?.source && <p className="mb-4 text-xs text-faint">By {selected.author}. <a className="text-accent" href={selected.source} target="_blank" rel="noreferrer">Source ↗</a></p>}
        <p className="mb-4 text-xs text-faint">Replace subjects and references in the text. “Use in studio” fills the composer; review duration, audio and attachments before generating.</p>
        <div className="flex flex-wrap gap-2"><button className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-ink disabled:opacity-40" disabled={!prompt.trim() || missingSlots.length > 0} onClick={usePrompt}>Use in studio</button>
          <button className={button} disabled={busy || !title.trim() || !prompt.trim()} onClick={() => void save()}>{busy ? 'Saving…' : 'Save as my prompt'}</button>
          {selected?.personal && <button className={`${button} text-danger`} onClick={async () => { const res = await fetch(`/api/prompts?id=${encodeURIComponent(selected.id)}`, { method: 'DELETE' }); if (!res.ok) { setMessage('Could not delete prompt.'); return; } setSelected(null); setPrompt(''); setTitle(''); await refresh(); }}>Delete</button>}
        </div>
        {message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}
      </aside>
    </div>
  </div>;
}
