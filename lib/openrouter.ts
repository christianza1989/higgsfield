import { OPENROUTER_PREFIX } from "./openrouter-models";
import { HiggsfieldError, type Estimate, type StatusResponse, type SubmitResponse } from "./higgsfield";

const BASE = "https://openrouter.ai/api/v1";
export const isOpenRouter = (endpoint: string) => endpoint.startsWith(OPENROUTER_PREFIX);
export const hasOpenRouterCredentials = () => Boolean(process.env.OPENROUTER_API_KEY?.trim());

function headers(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new HiggsfieldError("Set OPENROUTER_API_KEY in .env.local and restart the server.", 401);
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers: headers(), signal: AbortSignal.timeout(60_000), cache: "no-store" });
  } catch (error) {
    if (error instanceof HiggsfieldError) throw error;
    throw new HiggsfieldError("OpenRouter connection failed. Check the dashboard before resubmitting a generation.", 502);
  }
  if (!res.ok) {
    const messages: Record<number, string> = {
      400: "OpenRouter rejected the generation parameters.",
      401: "OpenRouter API key is invalid or missing.",
      402: "OpenRouter credits or key spending limit exhausted.",
      403: "OpenRouter access denied. Check key permissions and video/ZDR settings.",
      404: "OpenRouter model or request not found.",
      429: "OpenRouter rate limit reached; waiting before retrying.",
    };
    // Never forward raw upstream errors: they can contain request metadata.
    throw new HiggsfieldError(messages[res.status] ?? `OpenRouter request failed (HTTP ${res.status}).`, res.status, res.status === 429,
      Math.max(1, Number(res.headers.get("retry-after")) || 30) * 1000);
  }
  return res.json() as Promise<T>;
}

export interface VideoModel {
  id: string;
  supported_durations: number[];
  supported_resolutions: string[];
  supported_aspect_ratios: string[];
  supported_sizes: string[];
  supported_frame_images?: string[];
  pricing_skus: Record<string, string>;
}
let catalog: { expires: number; models: VideoModel[] } | undefined;
export async function videoModels(): Promise<VideoModel[]> {
  if (catalog && catalog.expires > Date.now()) return catalog.models;
  const data = await call<{ data: VideoModel[] }>("/videos/models");
  catalog = { expires: Date.now() + 5 * 60_000, models: data.data };
  return data.data;
}

export function buildOpenRouterBody(endpoint: string, input: Record<string, unknown>): Record<string, unknown> {
  const { first_frame_url, last_frame_url, ...body } = input;
  const frames = [first_frame_url, last_frame_url].flatMap((url, i) => {
    if (!url) return [];
    if (typeof url !== "string" || !url.startsWith("https://")) throw new HiggsfieldError("Reference images need a public HTTPS URL.", 400);
    return [{ type: "image_url", image_url: { url }, frame_type: i === 0 ? "first_frame" : "last_frame" }];
  });
  return { ...body, model: endpoint.slice(OPENROUTER_PREFIX.length), ...(frames.length ? { frame_images: frames } : {}) };
}

async function validate(endpoint: string, input: Record<string, unknown>): Promise<VideoModel> {
  const model = (await videoModels()).find((m) => m.id === endpoint.slice(OPENROUTER_PREFIX.length));
  if (!model) throw new HiggsfieldError("This model is not currently available on OpenRouter.", 404);
  if (!model.supported_durations.includes(Number(input.duration)) ||
      !model.supported_resolutions.includes(String(input.resolution)) ||
      !model.supported_aspect_ratios.includes(String(input.aspect_ratio))) {
    throw new HiggsfieldError("The selected duration, resolution or ratio is not supported by OpenRouter.", 400);
  }
  for (const [key, frame] of [["first_frame_url", "first_frame"], ["last_frame_url", "last_frame"]]) {
    if (input[key] && !model.supported_frame_images?.includes(frame)) throw new HiggsfieldError("The selected frame type is not supported.", 400);
  }
  return model;
}

export function calculateVideoPrice(model: VideoModel, input: Record<string, unknown>): number | null {
  const rates = model.pricing_skus;
  const seconds = Number(input.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (rates.video_tokens) {
    const [rw, rh] = String(input.aspect_ratio).split(":").map(Number);
    const targetArea = input.resolution === "720p" ? 1280 * 720 : 854 * 480;
    const candidates = model.supported_sizes.map((s) => s.split("x").map(Number))
      .filter(([w, h]) => Math.abs(w / h - rw / rh) < 0.03);
    candidates.sort((a, b) => Math.abs(a[0] * a[1] - targetArea) - Math.abs(b[0] * b[1] - targetArea));
    const dims = candidates[0];
    if (!dims || Math.abs(dims[0] / dims[1] - rw / rh) > 0.03) return null;
    const rate = Number(input.generate_audio === false ? rates.video_tokens_without_audio ?? rates.video_tokens : rates.video_tokens);
    return Number.isFinite(rate) ? Math.ceil(dims[0] * dims[1] * seconds * 24 / 1024) * rate : null;
  }
  const rate = Number(input.generate_audio ? rates.duration_seconds_with_audio : rates.duration_seconds);
  return Number.isFinite(rate) ? rate * seconds : null;
}

export async function estimateOpenRouter(endpoint: string, input: Record<string, unknown>): Promise<Estimate> {
  const model = await validate(endpoint, input);
  const usd = calculateVideoPrice(model, input);
  if (usd === null) throw new HiggsfieldError("No reliable price is available for these OpenRouter settings.", 503);
  return { usd: String(usd), credits: "0" };
}

export async function submitOpenRouter(endpoint: string, input: Record<string, unknown>): Promise<SubmitResponse> {
  await validate(endpoint, input);
  const result = await call<{ id: string; status: string }>("/videos", { method: "POST", body: JSON.stringify(buildOpenRouterBody(endpoint, input)) });
  if (!result.id) throw new HiggsfieldError("OpenRouter did not return a request ID. Check the dashboard before retrying.", 502);
  return { request_id: result.id, status: result.status === "pending" ? "queued" : result.status };
}

export async function statusOpenRouter(id: string): Promise<StatusResponse> {
  const result = await call<{ status: string; unsigned_urls?: string[]; error?: unknown; usage?: { cost?: number } }>(`/videos/${encodeURIComponent(id)}`);
  const status = result.status === "pending" ? "queued" : result.status === "expired" ? "failed" : result.status;
  const cost = result.usage?.cost;
  return {
    request_id: id, status,
    error: ["failed", "expired"].includes(result.status) ? "OpenRouter generation failed or expired. See the OpenRouter dashboard for details." : undefined,
    videos: status === "completed" ? (result.unsigned_urls?.length ? result.unsigned_urls : [""]).map((_, index) => ({ url: `${BASE}/videos/${encodeURIComponent(id)}/content?index=${index}` })) : undefined,
    cost: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : undefined,
  };
}

export function openRouterDownloadHeaders(url: string): Record<string, string> {
  const parsed = new URL(url);
  if (parsed.origin !== "https://openrouter.ai" || !/^\/api\/v1\/videos\/[^/]+\/content$/.test(parsed.pathname)) {
    throw new Error("Invalid OpenRouter content URL.");
  }
  return headers();
}
