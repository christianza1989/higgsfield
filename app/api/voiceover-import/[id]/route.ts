import { assertVoiceoverRequest, readVoiceoverImport, VoiceoverImportError } from '@/lib/voiceover-import';
export const runtime = 'nodejs';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const origin = assertVoiceoverRequest(req); return Response.json(readVoiceoverImport((await ctx.params).id, origin), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof VoiceoverImportError ? error.message : 'The voiceover import is unavailable.' }, { status: error instanceof VoiceoverImportError ? error.status : 500 }); }
}
