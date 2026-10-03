import { config as loadEnv } from "dotenv";
import {
  APIError,
  AuthenticationError,
  NotEnoughCreditsError,
  TimeoutError,
  config,
  higgsfield,
} from "@higgsfield/client/v2";
import { fileURLToPath } from "node:url";

async function main(): Promise<void> {
  // Server-only CLI. Never print the environment, config, or raw SDK errors.
  loadEnv({ path: fileURLToPath(new URL("./.env.local", import.meta.url)), quiet: true });
  const credentials = process.env.HF_CREDENTIALS?.trim();
  if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    console.error("Set HF_CREDENTIALS=key-id:key-secret locally in .env.local before running.");
    process.exitCode = 1;
    return;
  }

  config({ credentials, maxRetries: 0, timeout: 60_000, maxPollTime: 45 * 60_000 });
  console.error("Submitting one billable Seedance 2.5 generation; waiting for completion...");

  // The current SDK's built-in poller does not stop on canceled/cancelled.
  // Subscribe submits once; explicit status polling handles every terminal state.
  let result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: false,
  });
  const deadline = Date.now() + 45 * 60_000;
  let delay = 2000;
  for (;;) {
    const status: string = result.status;
    if (status === "completed") {
      const url = result.video?.url;
      if (!url || !/^https?:\/\//.test(url)) {
        console.error("Request completed but did not return a valid video URL.");
        process.exitCode = 1;
        return;
      }
      console.log(url);
      return;
    }
    if (["failed", "canceled", "cancelled", "nsfw", "moderated", "blocked"].includes(status)) {
      console.error(`Generation ended without a video: ${status}.`);
      process.exitCode = 1;
      return;
    }
    if (!["queued", "in_progress", "pending"].includes(status) || !result.request_id) {
      throw new Error("Unexpected generation response");
    }
    if (Date.now() >= deadline) throw new TimeoutError("Polling deadline reached");
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10_000);
    const response = await fetch(
      `https://api.higgsfield.ai/requests/${encodeURIComponent(result.request_id)}/status`,
      {
        headers: { Authorization: `Key ${credentials}`, "User-Agent": "higgsfield-studio/1.0" },
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (response.status === 429 || response.status >= 500) continue;
    if (!response.ok) throw new APIError("Status request failed", response.status);
    result = await response.json();
  }
}

main().catch((error: unknown) => {
  // Raw HTTP errors can contain Authorization headers; only emit fixed messages.
  if (error instanceof AuthenticationError) {
    console.error("Authentication failed. Check HF_CREDENTIALS locally.");
  } else if (error instanceof NotEnoughCreditsError) {
    console.error("Higgsfield rejected the request: insufficient credits or access denied.");
  } else if (error instanceof TimeoutError) {
    console.error("Timed out waiting for completion. The remote request may still be active; check the console before retrying.");
  } else if (error instanceof APIError) {
    console.error(`Higgsfield API request failed (HTTP ${error.statusCode ?? "unknown"}). Check the console for details.`);
  } else {
    console.error("Generation could not be verified. Check connectivity and the Higgsfield console before retrying.");
  }
  process.exitCode = 1;
});
