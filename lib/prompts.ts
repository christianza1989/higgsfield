import catalogue from './data/prompts.json';
import { db } from './db';
import { UGC_PROMPTS } from './ugc-prompts';

export interface PromptEntry {
  id: string; title: string; category: string; prompt: string;
  kind: 'image' | 'video'; favorite: boolean; personal: boolean;
  modelId?: string; params?: Record<string, unknown>; source?: string;
  author?: string; collection?: string; requiresReference?: boolean;
  videoUrl?: string;
}

export function listPrompts(): PromptEntry[] {
  const favorites = new Set((db().prepare('SELECT id FROM prompt_favorites').all() as { id: string }[]).map(r => r.id));
  const personal = (db().prepare('SELECT * FROM prompts ORDER BY created_at DESC').all() as {
    id: string; title: string; category: string; prompt: string; kind: 'image' | 'video'; model_id: string | null; params: string;
  }[]).map(r => ({ id: r.id, title: r.title, category: r.category, prompt: r.prompt, kind: r.kind,
    modelId: r.model_id ?? undefined, params: JSON.parse(r.params), personal: true, favorite: favorites.has(r.id) }));
  return [...personal, ...UGC_PROMPTS.map(r => ({ ...r, personal: false, favorite: favorites.has(r.id) })), ...catalogue.entries.map(r => ({ ...r, kind: 'video' as const, personal: false, favorite: favorites.has(r.id) }))];
}
