import { resolvePromptMedia } from '@/lib/prompt-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const media = await resolvePromptMedia(new URL(request.url).searchParams.get('id') ?? '');
  if (!media) return Response.json({ error: 'Unknown example.' }, { status: 404 });
  return Response.json(media, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
