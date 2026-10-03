import { getModel } from './models';
import type { Job } from './shared';
import type { VideoReference, ReferenceMode } from './video-references';
import { stripReferenceRoles } from './video-references';

export interface ComposerDraft {
  kind: 'image' | 'video';
  prompt: string;
  modelId?: string;
  params?: Record<string, unknown>;
  batch?: number;
  refUrls?: string[];
  references?: VideoReference[];
  referenceMode?: ReferenceMode;
}

export function draftFromJob(job: Job): ComposerDraft {
  const model = getModel(job.model_id);
  const raw = model?.refKeys?.map(key => job.params[key]) ??
    (model?.refImageKey ? [job.params[model.refImageKey]] : []);
  const refUrls = raw.flatMap(v => Array.isArray(v) ? v : [v]).filter((v): v is string => typeof v === 'string' && /^https:\/\//.test(v));
  const params = Object.fromEntries((model?.params ?? []).filter(p => job.params[p.key] !== undefined).map(p => [p.key, job.params[p.key]]));
  let references = job.params._studio_references as VideoReference[] | undefined;
  let referenceMode = job.params._studio_reference_mode as ReferenceMode | undefined;
  if (!references && refUrls.length && model?.referenceModes?.includes('frames')) {
    references = refUrls.map((url, i) => ({ url, kind: 'image', name: i === 0 ? 'First frame' : 'Last frame' }));
    referenceMode = 'frames';
  }
  return { kind: job.kind, prompt: references ? stripReferenceRoles(job.prompt) : job.prompt, modelId: job.model_id, params, batch: job.batch, refUrls: references ? [] : refUrls, references, referenceMode };
}

export function openComposer(draft: ComposerDraft) {
  if (!draft.references && Array.isArray(draft.params?._studio_references)) {
    draft = { ...draft, references: draft.params._studio_references as VideoReference[], referenceMode: draft.params._studio_reference_mode as ReferenceMode };
  }
  // Transient local transfer only. Restoring a draft never submits a request.
  sessionStorage.setItem('studio:draft', JSON.stringify(draft));
  if (window.location.pathname === `/${draft.kind}`) window.dispatchEvent(new Event('studio:draft'));
  else window.location.assign(`/${draft.kind}`);
}
