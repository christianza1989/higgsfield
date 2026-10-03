"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptFor,
  refKindOf,
  defaultParams,
  getModel,
  maxRefs,
  modelsByKind,
  supportsAttachment,
  type ModelDef,
} from "@/lib/models";
import { formatUsd } from "@/lib/shared";
import Link from 'next/link';
import { type ComposerDraft } from '@/lib/composer';
import { providerPeer, transferParams } from '@/lib/provider-pairs';
import ComparePrices from './ComparePrices';
import ParamPill from "./ParamPill";
import Popover from "./Popover";

/**
 * The floating bottom-centre composer.
 *
 * Controls are derived from the model registry rather than hardcoded, because
 * Higgsfield's models disagree about nearly everything — Soul takes
 * `num_images` and 2K/4K, Soul Reference takes `batch_size` and 720p/1080p.
 */

interface Ref {
  url: string;
  name: string;
  preview: string;
  kind: "image" | "video" | "audio";
}

export default function PromptBar({
  kind,
  onSubmitted,
}: {
  kind: "image" | "video";
  onSubmitted: () => void;
}) {
  const [provider, setProvider] = useState<"higgsfield" | "openrouter">("higgsfield");
  const available = useMemo(() => modelsByKind(kind).filter((m) => (m.provider ?? "higgsfield") === provider), [kind, provider]);
  const [modelId, setModelId] = useState(available[0].id);
  const model = getModel(modelId) ?? available[0];

  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>(() => defaultParams(model));
  const [batch, setBatch] = useState(1);
  const [refs, setRefs] = useState<Ref[]>([]);

  const [estimate, setEstimate] = useState<number | null>(null);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  // Model id -> why it can't be used. Filled in as estimates come back, so the
  // picker reflects whatever plan this particular key is on.
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const [estimating, setEstimating] = useState(false);
  // Token-metered models (Seedance 2.5) quote prose, not a figure.
  const [metered, setMetered] = useState<string | null>(null);
  // Set when attaching forces a model change, so the switch is explained
  // rather than silently happening under the user.
  const [switchedNote, setSwitchedNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const restoring = useRef<ComposerDraft | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);

  // Reset per-model state when the model changes; parameters are not portable
  // between models (a 2K value is meaningless to a model expecting 720p).
  useEffect(() => {
    const draft = restoring.current?.modelId === model.id ? restoring.current : null;
    setParams({ ...defaultParams(model), ...draft?.params });
    setBatch(draft?.batch ?? model.batchOptions?.[0] ?? 1);
    if (draft) restoring.current = null;
    if (!supportsAttachment(model)) setRefs([]);
    setEstimate(null);
    setPriceNote(null);
  }, [model]);

  useEffect(() => {
    function restore() {
      try {
        const raw = sessionStorage.getItem('studio:draft');
        if (!raw) return;
        const draft = JSON.parse(raw) as ComposerDraft;
        if (draft.kind !== kind || typeof draft.prompt !== 'string') return;
        sessionStorage.removeItem('studio:draft');
        const target = getModel(draft.modelId ?? '') ?? modelsByKind(kind)[0];
        setPrompt(draft.prompt); setSavedPrompt(false); setError(null);
        setRefs((draft.refUrls ?? []).slice(0, maxRefs(target)).map((url, i) => ({ url, preview: url, name: `Reference ${i + 1}`, kind: refKindOf(target) })));
        if (target.id === model.id) {
          setParams({ ...defaultParams(target), ...draft.params }); setBatch(draft.batch ?? 1);
        } else {
          restoring.current = { ...draft, modelId: target.id };
          setProvider(target.provider ?? 'higgsfield'); setModelId(target.id);
        }
        setSwitchedNote(draft.refUrls?.length ? 'Settings restored. Re-upload reference files if their URLs have expired.' : 'Prompt restored. Review settings before generating.');
      } catch { setError('Could not restore the saved prompt.'); }
    }
    restore();
    window.addEventListener('studio:draft', restore);
    return () => window.removeEventListener('studio:draft', restore);
  }, [kind, model.id]);

  async function savePrompt() {
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: prompt.trim().slice(0, 80), prompt, kind, modelId: model.id, params }) });
      if (!res.ok) { setError((await res.json()).error); return; }
      setSavedPrompt(true);
    } catch { setError('Could not save prompt.'); } finally { setSavingPrompt(false); }
  }

  // Grow the textarea with its content, up to a few lines.
  //
  // Re-fitted whenever the box's width changes, not just on input: at first
  // paint the textarea is still at its default ~20-column width, so the
  // placeholder wraps over many lines and measures far too tall. Watching for
  // the width to settle is deterministic, where waiting on fonts or a frame is
  // not.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;

    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
    };
    fit();

    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return; // ignore our own height change
      lastWidth = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [prompt]);

  const blocked = unavailable[model.id];

  // Params flagged required with no default (a character ID, say) must be
  // filled before the request is worth sending.
  const missing = model.params.filter(
    (d) => d.required && d.default === undefined && !params[d.key],
  );

  const canSubmit =
    prompt.trim().length > 0 &&
    !busy &&
    !uploading &&
    !blocked &&
    missing.length === 0 &&
    (!model.refRequired || refs.length > 0);

  const payload = useCallback(
    () => ({
      modelId: model.id,
      prompt: prompt.trim() || "placeholder",
      params,
      batch,
      refUrls: refs.map((r) => r.url),
    }),
    [model.id, prompt, params, batch, refs],
  );

  // Debounced pricing. Deliberately keyed off everything except prompt text —
  // cost depends on the model and its settings, not on what you typed.
  const estimateKey = JSON.stringify({
    m: model.id,
    p: params,
    b: batch,
    r: refs.length,
  });

  useEffect(() => {
    if (model.refRequired && refs.length === 0) return;
    let cancelled = false;
    setEstimating(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.available === false) {
            setEstimate(null);
            setMetered(null);
            setUnavailable((prev) => ({ ...prev, [model.id]: data.reason }));
          } else if (data.metered) {
            setEstimate(null);
            setMetered(data.note ?? "Token-metered pricing.");
            setUnavailable((prev) => {
              if (!(model.id in prev)) return prev;
              const next = { ...prev };
              delete next[model.id];
              return next;
            });
          } else {
            setMetered(null);
            setPriceNote(data.note ?? null);
            setEstimate(Number.isFinite(data.usd) ? data.usd : null);
            setUnavailable((prev) => {
              if (!(model.id in prev)) return prev;
              const next = { ...prev };
              delete next[model.id];
              return next;
            });
          }
        } else {
          setEstimate(null);
          setMetered(null);
          const data = await res.json();
          setPriceNote(data.error ?? "Could not estimate the generation price.");
        }
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
      setEstimating(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateKey]);

  /**
   * Take images from the file picker, a drop, or a paste.
   *
   * If the current model can't use a reference image, this switches to one that
   * can rather than refusing — attaching a picture is a clear statement of
   * intent, and silently doing nothing was what people read as "attachments
   * aren't supported".
   */
  async function attach(files: FileList | File[] | null) {
    const all = Array.from(files ?? []);
    // Pick the kind from the first usable file, then keep only files of that
    // kind — mixing an image and a clip in one drop has no sensible meaning.
    const first = all.find((f) => /^(image|video|audio)\//.test(f.type));
    if (!first) return;
    const dropped = (first.type.split("/")[0] as "image" | "video" | "audio");
    const incoming = all.filter((f) => f.type.startsWith(dropped + "/"));
    setError(null);

    let target = model;
    if (!supportsAttachment(target) || refKindOf(target) !== dropped) {
      const fallback = available.find((m) => supportsAttachment(m) && refKindOf(m) === dropped);
      if (!fallback) {
        setError(`No ${kind} model accepts a ${dropped} attachment.`);
        return;
      }
      target = fallback;
      setModelId(fallback.id);
      setSwitchedNote(
        `${model.name} can't take ${dropped === "audio" ? "an" : "a"} ${dropped} attachment, so this switched to ${fallback.name}.`,
      );
    } else {
      setSwitchedNote(null);
    }

    const limit = maxRefs(target);
    const room = limit === 1 ? 1 : Math.max(0, limit - refs.length);
    const chosen = incoming.slice(0, room || 1);
    if (incoming.length > chosen.length) {
      setError(`${target.name} takes at most ${limit} image${limit === 1 ? "" : "s"}.`);
    }

    setUploading(true);
    try {
      for (const file of chosen) {
        const form = new FormData();
        form.append("file", file);
        form.append("provider", provider);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        const added = {
          url: data.url,
          name: file.name,
          preview: URL.createObjectURL(file),
          kind: (data.kind ?? dropped) as "image" | "video" | "audio",
        };
        setRefs((prev) => (limit === 1 ? [added] : [...prev, added].slice(0, limit)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function generate() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the generation.");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the generation.");
    } finally {
      setBusy(false);
    }
  }

  // Images can arrive by drop or paste anywhere on the page, not just through
  // the file picker — the picker alone made attachments easy to miss entirely.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth += 1; setDragging(true); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth -= 1;
      if (depth <= 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void attach(e.dataTransfer?.files ?? null);
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => /^(image|video|audio)\//.test(f.type))) {
        e.preventDefault();
        void attach(files);
      }
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, refs.length, kind, provider, available]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;

    // While an IME candidate window is open, Enter is confirming a character,
    // not submitting. Ignoring this would make the composer unusable for
    // anyone typing Japanese, Chinese or Korean.
    if (e.nativeEvent.isComposing) return;

    // Shift+Enter inserts a line break; plain Enter sends. Cmd/Ctrl+Enter also
    // sends, since that was the old binding and the muscle memory is harmless.
    if (e.shiftKey) return;

    e.preventDefault();
    void generate();
  }

  // The endpoint silently changes when a reference image is attached; say so,
  // rather than letting the user wonder why the cost jumped.
  const switched = refs.length > 0 && model.imageEndpoint;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
      {dragging && (
        <div className="fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-accent/60 bg-panel/80 px-10 py-8 text-center">
            <p className="text-lg font-bold tracking-tight">Drop to attach</p>
            <p className="mt-1 text-sm text-faint">
              {supportsAttachment(model)
                ? `${model.name} takes ${refKindOf(model) === "audio" ? "a WAV" : refKindOf(model) === "video" ? "an MP4" : "an image"}`
                : "Drop an image, MP4 or WAV — the model switches to match"}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-edge bg-panel/95 shadow-2xl shadow-black/70 backdrop-blur-xl">
        {error && (
          <div className="flex items-start gap-2 border-b border-edge-soft px-4 py-2.5 text-sm text-danger">
            <span className="mt-px">⚠</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-faint hover:text-text">
              ✕
            </button>
          </div>
        )}

        {switchedNote && (
          <div className="flex items-start gap-2 border-b border-edge-soft px-4 py-2.5 text-xs text-warn">
            <span className="flex-1">{switchedNote}</span>
            <button onClick={() => setSwitchedNote(null)} className="text-faint hover:text-text">✕</button>
          </div>
        )}

        {blocked && (
          <div className="border-b border-edge-soft px-4 py-2.5 text-xs text-warn">
              {model.name} is not available — {blocked.toLowerCase()}.
          </div>
        )}

        {!blocked && metered && (
          <p className="border-b border-edge-soft px-4 py-2.5 text-xs leading-relaxed text-faint">
            {model.meteredNote ??
              `${model.name} bills per token rather than per generation, so there is no fixed price up front.`}{" "}
            Higgsfield reconciles the exact charge after the request runs.
          </p>
        )}

        {!blocked && missing.length > 0 && prompt.trim().length > 0 && (
          <div className="border-b border-edge-soft px-4 py-2.5 text-xs text-warn">
            {model.name} needs {missing.map((d) => d.label.toLowerCase()).join(" and ")} set before
            it can run.
          </div>
        )}

        {refs.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-edge-soft px-4 py-3">
            {refs.map((r, i) => (
              <div key={r.url} className="group relative size-14 overflow-hidden rounded-lg border border-edge">
                {r.kind === "video" ? (
                  <video src={r.preview} muted playsInline className="size-full object-cover" />
                ) : r.kind === "audio" ? (
                  <span className="flex size-full flex-col items-center justify-center gap-1 bg-panel-2 px-1">
                    <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="6.5" cy="18" r="2.5" />
                      <circle cx="16.5" cy="16" r="2.5" />
                    </svg>
                    <span className="w-full truncate text-center text-2xs text-faint">{r.name}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.preview} alt={r.name} className="size-full object-cover" />
                )}
                <button
                  onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
            {switched && (
              <p className="self-center pl-1 text-xs text-faint">
                Using {model.name}&apos;s image-to-{kind === "video" ? "video" : "image"} endpoint.
              </p>
            )}
          </div>
        )}

        {priceNote && <p className="border-b border-edge-soft px-4 py-2 text-xs text-faint">{priceNote}</p>}
        {kind === 'video' && <ComparePrices model={model} params={params} refUrls={refs.map(r => r.url)} />}
        {provider === "openrouter" && <p className="border-b border-edge-soft px-4 py-2 text-xs text-faint">Image uploads use your Higgsfield storage key. Images fill the first frame, then the last frame. Submitted OpenRouter videos cannot be canceled here.</p>}

        <div className="flex items-start gap-3 px-4 pt-3.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            title={
              supportsAttachment(model)
                ? "Attach an image — or drop one anywhere, or paste"
                : `Attach an image (switches away from ${model.name}, which can't use one)`
            }
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-edge-soft bg-panel-2 text-muted transition-colors hover:border-edge hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
          >
            {uploading ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-edge border-t-accent" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={acceptFor(refKindOf(model))}
            multiple={maxRefs(model) > 1}
            className="hidden"
            onChange={(e) => attach(e.target.files)}
          />

          <textarea
            ref={textarea}
            rows={1}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setSavedPrompt(false); }}
            onKeyDown={onKeyDown}
            placeholder="Describe the scene you imagine"
            className="mt-1 max-h-[132px] min-h-6 flex-1 resize-none bg-transparent text-base leading-6 text-text outline-none placeholder:text-faint"
          />

          <button
            onClick={generate}
            disabled={!canSubmit}
            className="mt-0.5 shrink-0 rounded-xl bg-accent px-5 py-2.5 text-base font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {busy ? (
              "Starting…"
            ) : blocked ? (
              "Unavailable"
            ) : (
              <>
                Generate
                <span className="ml-2 font-mono text-xs opacity-70">
                  {estimating ? "···" : metered ? "metered" : `${provider === "openrouter" && estimate !== null ? "~" : ""}${formatUsd(estimate)}`}
                </span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3.5">
          <Link href="/prompts" className="rounded-full border border-edge px-3 py-1.5 text-xs hover:text-accent">Prompt library</Link>
          <button onClick={() => void savePrompt()} disabled={!prompt.trim() || savingPrompt} className="rounded-full border border-edge px-3 py-1.5 text-xs hover:text-accent disabled:opacity-40">{savedPrompt ? 'Saved ✓' : savingPrompt ? 'Saving…' : 'Save prompt'}</button>
          {kind === "video" && (
            <select aria-label="Video provider" value={provider}
              disabled={busy || uploading}
              onChange={(e) => {
                const next = e.target.value as "higgsfield" | "openrouter";
                const choices = modelsByKind(kind).filter((m) => (m.provider ?? "higgsfield") === next);
                const selected = providerPeer(model.id) ?? choices.find((m) => m.family === model.family && m.name === model.name) ??
                  (next === "openrouter" ? choices.find((m) => m.family === "Seedance") : undefined) ?? choices[0];
                const nextParams = transferParams(selected, params);
                restoring.current = { kind, prompt, modelId: selected.id, params: nextParams };
                setProvider(next); setModelId(selected.id);
                setRefs(prev => prev.slice(0, maxRefs(selected)).filter(r => r.kind === refKindOf(selected)));
                setError(null); setSwitchedNote('Provider changed. Shared settings were kept; review provider-specific controls and reference slots.'); setEstimate(null); setPriceNote(null);
              }}
              className="rounded-full border border-edge bg-panel-2 px-3 py-1.5 text-sm text-text">
              <option value="higgsfield">Higgsfield</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          )}
          <ModelPicker
            key={provider}
            models={available}
            current={model}
            onPick={setModelId}
            unavailable={unavailable}
            kind={kind}
          />

          {model.params.map((def) => (
            <ParamPill
              key={def.key}
              def={def}
              value={params[def.key]}
              onChange={(v) => setParams((p) => ({ ...p, [def.key]: v }))}
            />
          ))}

          {model.batchOptions && model.batchOptions.length > 1 && (
            <BatchStepper options={model.batchOptions} value={batch} onChange={setBatch} />
          )}

          <span className="ml-auto hidden items-center gap-1.5 text-2xs text-faint sm:flex">
            <kbd className="rounded border border-edge-soft bg-panel-2 px-1.5 py-0.5 font-sans">↵</kbd>
            <span>send</span>
            <span className="text-edge">·</span>
            <kbd className="rounded border border-edge-soft bg-panel-2 px-1.5 py-0.5 font-sans">⇧↵</kbd>
            <span>new line</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  models,
  current,
  onPick,
  unavailable,
  kind,
}: {
  models: ModelDef[];
  current: ModelDef;
  onPick: (id: string) => void;
  unavailable: Record<string, string>;
  kind: "image" | "video";
}) {
  // Two levels: pick a family, then a variant. With ~57 models a flat list is
  // unusable, and the families map onto how people actually think about them
  // ("I want Kling" long before "I want Kling 3.0 Pro at 1080p").
  const [family, setFamily] = useState<string | null>(null);
  const families = useMemo(() => [...new Set(models.map((m) => m.family ?? m.vendor))], [models]);
  const currentFamily = current.family ?? current.vendor;

  function price(m: ModelDef) {
    if (unavailable[m.id]) return "unavailable";
    if (m.metered) return "metered";
    return m.fromUsd ? `from ${formatUsd(m.fromUsd)}` : "—";
  }

  return (
    <Popover label="" value={`${currentFamily} · ${current.name}`}>
      {(close) => (
        <div className="w-80">
          {family === null ? (
            <>
              <p className="px-3 pt-1.5 pb-2 text-2xs font-semibold tracking-[0.08em] text-faint uppercase">
                {models.length} {kind} models
              </p>
              <div className="max-h-[22rem] overflow-y-auto">
                {families.map((f) => {
                  const inFamily = models.filter((m) => (m.family ?? m.vendor) === f);
                  const cheapest = inFamily.reduce(
                    (a, b) => ((b.fromUsd || Infinity) < (a.fromUsd || Infinity) ? b : a),
                    inFamily[0],
                  );
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFamily(f)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        f === currentFamily ? "bg-panel-3" : "hover:bg-panel-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-text">{f}</span>
                        <span className="block text-xs text-faint">
                          {inFamily.length} {inFamily.length === 1 ? "option" : "options"}
                          {cheapest?.fromUsd ? ` · from ${formatUsd(cheapest.fromUsd)}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-faint">›</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFamily(null)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-panel-2 hover:text-text"
              >
                <span>‹</span>
                <span className="font-semibold">{family}</span>
                <span className="text-faint">— all models</span>
              </button>
              <div className="max-h-[22rem] overflow-y-auto border-t border-edge-soft pt-1">
                {models.filter((m) => (m.family ?? m.vendor) === family).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onPick(m.id);
                      setFamily(null);
                      close();
                    }}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      m.id === current.id ? "bg-panel-3" : "hover:bg-panel-2"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          unavailable[m.id] ? "text-faint line-through" : "text-text"
                        }`}
                      >
                        {m.name}
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-faint">{price(m)}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-faint">
                      {unavailable[m.id] ?? m.blurb}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

function BatchStepper({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  const index = Math.max(0, options.indexOf(value));
  const max = options[options.length - 1];

  return (
    <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-panel-2/60 px-1.5 py-1">
      <button
        type="button"
        onClick={() => onChange(options[Math.max(0, index - 1)])}
        disabled={index === 0}
        className="grid size-6 place-items-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-text disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-9 text-center font-mono text-xs text-text">
        {value}/{max}
      </span>
      <button
        type="button"
        onClick={() => onChange(options[Math.min(options.length - 1, index + 1)])}
        disabled={index === options.length - 1}
        className="grid size-6 place-items-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-text disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
