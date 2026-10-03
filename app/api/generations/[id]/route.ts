import { NextResponse } from "next/server";
import { db, deleteGeneration } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (typeof body?.favorite !== 'boolean') return NextResponse.json({ error: 'favorite must be a boolean.' }, { status: 400 });
  const result = db().prepare('UPDATE generations SET favorite = ? WHERE id = ?').run(body.favorite ? 1 : 0, id);
  if (!result.changes) return NextResponse.json({ error: 'No such result.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * Deletes one generated result and the file behind it.
 *
 * Granular on purpose: a batch of four images is one job with four outputs, and
 * removing a single tile shouldn't take the other three. The parent job row is
 * cleaned up only when its last output goes.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { removedJob } = deleteGeneration(id);
  return NextResponse.json({ ok: true, removedJob });
}
