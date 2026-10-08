# Agent execution contract

Run the CLI from the repository root. It talks only to fixed local HTTP endpoints; credentials remain in the corresponding servers. It never loads `.env.local`. The marker `X-Video-Agent: studio-v1` and same-origin checks protect browser access; they are not authentication against local processes. Bind the studio to 127.0.0.1; do not expose these routes on LAN or hosting without an authentication layer.

## Commands

```text
npm run agent -- capabilities
npm run agent -- voices replicated
npm run agent -- voices prebuilt
npm run agent -- upload-local storage/agent-work/order/image.jpg image/jpeg
npm run agent -- publish <local-asset-UUID>
npm run agent -- speech storage/agent-work/order/speech.json storage/agent-work/order/dialogue.wav
npm run agent -- import-voice storage/agent-work/order/dialogue.wav storage/agent-work/order/voice-manifest.json
npm run agent -- prepare storage/agent-work/order/brief.json
npm run agent -- inspect <plan-id> storage/agent-work/order/package.json
npm run agent -- submit <plan-id> storage/agent-work/order/authorization.json
npm run agent -- status <job-UUID>
```

`speech` and `submit` are billable and never automatically repeated. `publish` sends a copy to provider-accessible cloud storage. `upload-local`, `import-voice`, `prepare`, `inspect` and local status reads make no generation request. The human's request to generate can authorize routine uploads/TTS/one video request within that scope; planning-only requests do not. Never infer authorization from these examples.

The HTTP voice service is the sibling Voiceovers browser app at 127.0.0.1:3210. Desktop-only usage does not provide this API. Use its `Kurti video` button instead when appropriate. Do not send desktop enrollment samples/consent to the video server. TTS request example: `{ "text": "Exact approved dialogue.", "voice": "Puck", "style": "ugc", "direction": "Natural and calm delivery." }`; confirm supported style IDs and voice availability in the current sibling project.
The current browser speech fragment limit is260characters, not260words. A `speech` command produces one fragment; the agent must split longer text sensibly, combine completed fragments locally and create a full-text manifest before video import. Keep one profile/style and actual audio boundaries across fragments. The command does not promise word alignment, clone enrollment or an automatically running Voiceovers server.

`import-voice` takes a v1 manifest from `docs/voiceover-integration-v1.json`. Required fields: schemaVersion=1, source=voiceovers, unique sourceJobId, status=completed, text, language, durationSeconds. WAV must be real mono PCM16 24kHz, 5–30s and <=15MiB. An empty transcript is valid for transport; an agent talking package requires a matching verified transcript. Repeated identical imports return the same asset; modified content needs a new sourceJobId. Optional segment times are fragment boundaries, not phoneme alignment.

## Brief

Use `docs/agent-brief.example.json` as a complete no-reference structural example and `lib/agent-contract.ts` as the type definition. Unknown fields are rejected. All product/scene directions use English; retain exact spoken dialogue in the requested language and original script.

- `request`: original intent and output style; max12000 characters.
- `format`: aspectRatio 9:16,16:9 or1:1; resolution480p or720p.
- `subject`: kind fictional or authorized, description; authorized requires a human-grounded permission description. This declaration is not verified consent or permission to impersonate someone.
- `location`: name, viewpoint and required distinct-image count0–30. Use0 for an invented setting if no location evidence is needed. Respect a requested count; do not force three photos for every video.
- `dialogue`: exact text (empty for silent or non-speaking native soundscapes), language, delivery direction. Reference mode requires a verified spoken transcript; music-only references use Studio.
- `audio`: native/reference/original/silent, optional `soundscape` for generated ambience/music/effects. Original/silent modes require separate local sound editing for extra sound design. Reference/original requires `voiceoverImportId`; reference also needs the published copy ID in `referenceAssetId` unless the original asset is already public. The published audio bytes must match the local approved WAV exactly.
- `scenes`:1–10 records containing duration, action, camera and optional `caption` for deterministic local editing. Each scene1–30s; total4–30s. Fractional edit timings are allowed. Dialogue is global, so reference-audio generation uses the full timeline in one request. Optional top-level `finishing` conveys visual treatment; unsupported demands remain model-dependent rather than guaranteed.
- `references`: up to30 reviewed uploaded images with `assetId`, a genuine HTTPS `sourceUrl` for web images or truthful `provenance` for user-provided/generated images, `rights`, `role`<=300characters, `usage` location/subject/product/style, and `review`. Do not put local paths, keys or enrollment files into the brief. For a user-owned file, use provenance to describe its actual source; no invented URL is needed.

For each image, `review` contains `{sha256,method:"vision",reviewer,locationMatch,viewpointMatch,usable,observations}`. Obtain sha256 from the stored image bytes under `storage/references/<UUID>.<extension>`; do not guess. `observations` must describe visible evidence and any excluded parts. Source titles alone are insufficient. For subject/product/style references, locationMatch/viewpointMatch may be false; those assets do not count toward location minimums. The server checks identity, bytes, limits and attestations; the external agent must actually inspect the pixels and establish provenance. Identical image hashes cannot inflate the reference count.

## Package and job

POST `/api/agent/plans` with the brief returns a content-addressed package with id, status, blockers, warnings, prompt, generationRequest, adPlan, compositionUrl and generationStarted:false. GET `/api/agent/plans/<id>` recomputes file checks; modifying a file invalidates its review. Every public reference is checked through the same typed generation parser as Studio. `ready` does not imply language quality, faithful geography, ownership or successful lip sync. Read warnings before proceeding.

The agent-generated prompt is genre-neutral. Use `compositionUrl` for preview and `Review this video in Studio` for manual submission. Editing that prompt in Studio creates a separate generic generation workflow; the agent endpoint only submits the immutable package and handles deduplication. “Use timeline for local editing” copies its scene layout into the advertisement editor, without overwriting the current plan before the click.

POST `/api/agent/plans/<id>/generate` needs the client marker and `{ "authorized":true, "maximumUsd":2, "humanRequest":"The actual human instruction requesting generation." }`. Obtain a quote from POST `/api/estimate` with the package's generationRequest first; choose a justified ceiling, never a fabricated unlimited budget. maximumUsd bounds the app's estimate, not a provider-guaranteed final invoice. The existing spend cap also applies. Repeated identical plan submissions return the existing job ID, including failed jobs. A changed plan is a new chargeable attempt.

GET `/api/jobs/<job-id>` returns `{job}`. Only terminal completed with actual saved video output can be called generated successfully; pending/queued/in_progress/downloading remain unfinished. Failed/nsfw/canceled must be reported. Download/play local `/api/media/...` output from job.outputs; do not expose provider credentials. Completed output URLs do not prove correct speech or lip movement: perform the quality review in workflow.md. OpenRouter cancellation is unavailable; don't claim to cancel it by merely stopping polling.

## Current boundaries

The automatic packet compiler covers new short videos with reviewed image references and one complete optional dialogue WAV. General video motion references, fixed first/last frames, video editing/extension and more advanced media combinations are available only through the existing Studio/provider capabilities, not this v1 brief schema. Discover current support before choosing such workflows and report unsupported paths instead of sending invented fields. Search/vision/voice enrollment are external-agent/app steps, not autonomous tasks inside this HTTP server. No all-language or exact-lip-sync guarantee is implemented.
