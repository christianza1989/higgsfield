"use client";
import { useEffect, useState } from 'react';
import { providerPeer, transferParams } from '@/lib/provider-pairs';
import { formatUsd } from '@/lib/shared';
import type { ModelDef } from '@/lib/models';

export default function ComparePrices({ model, params, refUrls }: { model: ModelDef; params: Record<string, unknown>; refUrls: string[] }) {
  const peer = providerPeer(model.id);
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<{ name: string; text: string; detail?: string }[]>([]);
  const key = JSON.stringify({ id: model.id, params, refUrls });
  useEffect(() => {
    if (!open || !peer) return;
    const abort = new AbortController();
    setQuotes([]);
    const timer = setTimeout(async () => {
      const rows = await Promise.all([model, peer].map(async m => {
        const name = m.provider === 'openrouter' ? 'OpenRouter' : 'Higgsfield';
        const target = transferParams(m, params);
        const shared = ['duration', 'aspect_ratio', 'resolution', 'generate_audio'].filter(k => m.params.some(p => p.key === k) && model.params.some(p => p.key === k));
        if (shared.some(k => target[k] !== params[k]) || refUrls.length > (m.refKeys?.length ?? 1)) return { name, text: 'These settings are unsupported.' };
        try {
          const res = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
            body: JSON.stringify({ modelId: m.id, prompt: 'Price comparison', params: target, refUrls, batch: 1 }) });
          const q = await res.json();
          if (!res.ok || q.available === false) return { name, text: q.error ?? q.reason ?? 'Unavailable' };
          return { name, text: q.metered ? 'Token billing' : `${q.approximate ? '~' : ''}${formatUsd(q.usd)}`, detail: q.note };
        } catch { return { name, text: 'Could not fetch a price.' }; }
      }));
      if (!abort.signal.aborted) setQuotes(rows);
    }, 400);
    return () => { abort.abort(); clearTimeout(timer); };
    // The key captures all inputs including the reference URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);
  if (!peer) return null;
  return <div className="border-b border-edge-soft px-4 py-2 text-xs">
    <button className="text-accent" onClick={() => setOpen(!open)}>{open ? 'Hide comparison' : 'Compare provider prices'}</button>
    {open && <div className="mt-2 space-y-2">
      {!quotes.length && <p className="text-faint">Checking prices…</p>}
      {quotes.map(q => <div key={q.name}><p><span className="font-bold">{q.name}</span> · {q.text}</p>{q.detail && <p className="mt-1 text-faint">{q.detail}</p>}</div>)}
      <p className="text-faint">One video per quote, using shared settings. Provider-specific controls use defaults. Kling audio/quality defaults can differ. Fees and taxes excluded; matching model names do not guarantee identical results.</p>
    </div>}
  </div>;
}
