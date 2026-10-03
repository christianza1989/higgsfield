import { NextResponse } from "next/server";
import { listJobs } from "@/lib/db";
import { ensureWorker } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Any page load revives the worker, so pending jobs resume after a restart.
  ensureWorker();

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "image" || kindParam === "video" ? kindParam : undefined;
  const limit = Number(url.searchParams.get("limit") ?? 60);

  return NextResponse.json({
    jobs: listJobs({ kind, favorites: url.searchParams.get('favorites') === '1', limit: Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.floor(limit))) : 60 }),
  });
}
