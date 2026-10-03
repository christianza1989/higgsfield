import { getModel } from './models';
import type { Job } from './shared';

export interface ComposerDraft {
  kind: 'image' | 'video';
  prompt: string;
  modelId?: string;
  params?: Record<string, unknown>;
  batch?: number;
  refUrls?: string[];
}

export function draftFromJob(job: Job): ComposerDraft {
  const model = getModel(job.model_id);
  const raw = model?.refKeys?.map(key => job.params[key]) ??
    (model?.refImageKey ? [job.params[model.refImageKey]] : []);
  const refUrls = raw.flatMap(v => Array.isArray(v) ? v : [v]).filter((v): v is string => typeof v === 'string' && /^https:\/\//.test(v));
  const params = Object.fromEntries((model?.params ?? []).filter(p => job.params[p.key] !== undefined).map(p => [p.key, job.params[p.key]]));
  return { kind: job.kind, prompt: job.prompt, modelId: job.model_id, params, batch: job.batch, refUrls };
}

export function openComposer(draft: ComposerDraft) {
  // Transient local transfer only. Restoring a draft never submits a request.
  sessionStorage.setItem('studio:draft', JSON.stringify(draft));
  if (window.location.pathname === `/${draft.kind}`) window.dispatchEvent(new Event('studio:draft'));
  else window.location.assign(`/${draft.kind}`);
}
