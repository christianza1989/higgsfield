import { readAsset, assetPath } from '@/lib/reference-assets';
import { serveMedia } from '@/lib/serve-media';
export const runtime = 'nodejs';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const asset = readAsset((await ctx.params).id); return serveMedia(req, assetPath(asset), asset.mime); }
  catch { return Response.json({ error: 'Reference file not found.' }, { status: 404 }); }
}
