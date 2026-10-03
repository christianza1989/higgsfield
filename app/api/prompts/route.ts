import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { listPrompts } from '@/lib/prompts';
import { getModel } from '@/lib/models';
import { validateReferences, type ReferenceMode } from '@/lib/video-references';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ prompts: listPrompts() }); }

export async function POST(req: Request) {
  let raw;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (typeof raw?.prompt !== 'string' || !raw.prompt.trim() || raw.prompt.length > 50_000 ||
    typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 200 || !['image', 'video'].includes(raw.kind)) {
    return NextResponse.json({ error: 'Provide a title, prompt and image/video kind.' }, { status: 400 });
  }
  const model = getModel(raw.modelId);
  if (raw.modelId && (!model || model.kind !== raw.kind)) return NextResponse.json({ error: 'Invalid model.' }, { status: 400 });
  const params: Record<string, unknown> = Object.fromEntries((model?.params ?? []).filter(p => ['string', 'number', 'boolean'].includes(typeof raw.params?.[p.key])).map(p => [p.key, raw.params[p.key]]));
  const references = raw.references ?? raw.params?._studio_references;
  const mode = (raw.referenceMode ?? raw.params?._studio_reference_mode ?? 'references') as ReferenceMode;
  if (references !== undefined) {
    try {
      if (!model?.referenceModes?.includes(mode)) throw new Error('This model does not support the saved reference mode.');
      validateReferences(references, mode);
      params._studio_references = references; params._studio_reference_mode = mode;
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid references.' }, { status: 400 }); }
  }
  const id = randomUUID();
  db().prepare('INSERT INTO prompts (id,title,category,prompt,kind,model_id,params,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, raw.title.trim(), String(raw.category || 'My prompts').slice(0, 100), raw.prompt.trim(), raw.kind, model?.id ?? null, JSON.stringify(params), Date.now());
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  let raw;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (typeof raw?.id !== 'string' || typeof raw.favorite !== 'boolean') return NextResponse.json({ error: 'Invalid favorite.' }, { status: 400 });
  if (!listPrompts().some(p => p.id === raw.id)) return NextResponse.json({ error: 'No such prompt.' }, { status: 404 });
  if (raw.favorite) db().prepare('INSERT OR IGNORE INTO prompt_favorites (id) VALUES (?)').run(raw.id);
  else db().prepare('DELETE FROM prompt_favorites WHERE id = ?').run(raw.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const result = db().prepare('DELETE FROM prompts WHERE id = ?').run(id);
  if (!result.changes) return NextResponse.json({ error: 'Only personal prompts can be deleted.' }, { status: 404 });
  db().prepare('DELETE FROM prompt_favorites WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
