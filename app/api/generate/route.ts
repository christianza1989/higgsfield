import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { BadRequest, parseGenerationRequest } from "@/lib/payload";
import { db, insertJob, committedSpendSince, getSetting } from "@/lib/db";
import { HiggsfieldError, isMetered } from "@/lib/higgsfield";
import { estimate, hasCredentials, providerName } from "@/lib/providers";
import { isOpenRouter } from "@/lib/openrouter";
import { ensureWorker } from "@/lib/worker";

export const runtime = "nodejs";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { model, endpoint, body, prompt, batch } = parseGenerationRequest(await req.json());
    if (!hasCredentials(endpoint)) {
      return NextResponse.json(
        { error: `${providerName(endpoint)} API key not set. Check Settings and .env.local.` },
        { status: 401 },
      );
    }


    // Price the job before committing to it, so the cost recorded against the
    // job is the real quote rather than whatever the UI last displayed.
    let usd: number | null = null;
    let credits: number | null = null;
    try {
      const q = await estimate(endpoint, body);
      if (!isMetered(q)) {
        // Token-metered models have no up-front figure; leave the cost null so
        // spend tracking simply doesn't count them rather than recording NaN.
        usd = Number.isFinite(Number(q.usd)) ? Number(q.usd) : null;
        credits = Number.isFinite(Number(q.credits)) ? Number(q.credits) : null;
      }
    } catch (error) {
      if (isOpenRouter(endpoint)) throw error;
      // Estimation is best-effort; never block a generation on it.
    }

    const id = randomUUID();
    const budgetError = db().transaction(() => {
      const cap = Number(getSetting('spend_cap') ?? '');
      if (Number.isFinite(cap) && cap > 0) {
        if (usd === null) return 'This request has no reliable up-front price. The active spend cap blocks unpriced requests.';
        const committed = committedSpendSince(Date.now() - MONTH_MS);
        if (committed + usd > cap) return `Spend cap reached: $${committed.toFixed(2)} of $${cap.toFixed(2)} spent or reserved in the last 30 days. Raise or clear the cap in Settings.`;
      }
      insertJob({
        id,
        model_id: model.id,
        model_name: `${model.name} · ${providerName(endpoint)}`,
        endpoint,
        kind: model.kind,
        prompt,
        params: body,
        batch,
        est_usd: usd,
        est_credits: credits,
      });
      return null;
    }).immediate();
    if (budgetError) return NextResponse.json({ error: budgetError }, { status: 402 });

    // The worker picks it up on the next tick, honouring the concurrency cap.
    ensureWorker();

    return NextResponse.json({ id, estUsd: usd });
  } catch (err) {
    if (err instanceof HiggsfieldError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof BadRequest) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not start the generation." }, { status: 500 });
  }
}
