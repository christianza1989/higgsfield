import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/db";
import { serveMedia } from '@/lib/serve-media';

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

/** Serves downloaded output from storage/media so the UI never depends on
 *  Higgsfield's URLs, which expire after about a week. */
export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;

  const target = path.resolve(MEDIA_DIR, ...segments);
  // Refuse anything that escapes the media directory.
  if (!target.startsWith(path.resolve(MEDIA_DIR) + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const ext = target.split(".").pop()?.toLowerCase() ?? "";
  return serveMedia(req, target, MIME[ext] ?? 'application/octet-stream');
}
