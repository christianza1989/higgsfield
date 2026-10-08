import { importVoiceover, VoiceoverImportError } from '@/lib/voiceover-import';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(req: Request) {
  try { const result = await importVoiceover(req); return Response.json(result.data, { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof VoiceoverImportError ? error.message : 'The voiceover could not be imported.' }, { status: error instanceof VoiceoverImportError ? error.status : 500 }); }
}
