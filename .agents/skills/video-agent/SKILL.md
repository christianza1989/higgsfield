---
name: video-agent
description: Plan and create videos through this project's local Seedance studio, including voiceovers, researched visual references, continuity, prompts and result review. Use for a user's video creation order.
---

Use this repository as the execution system; use your own reasoning, search and vision tools as the director. There is no hidden server-side planning or vision model. Start in the repository named by the user, read its AGENTS.md and run `npm run agent -- capabilities`. If unavailable, start the studio with `npm run start -- --hostname 127.0.0.1` after a successful build. Do not terminate another service to claim a port.

Read [references/workflow.md](references/workflow.md) for the complete procedure and [references/contract.md](references/contract.md) when preparing or executing a package. Paths in those files are relative to the repository root. The brief example is a structural template, not a prepared or visually verified generation.
For speech, also read the dated evidence in `docs/research/seedance-2.5-audio-lipsync-2026-10-08.json`. It distinguishes the documented11native languages from unlisted languages and gives the provider-specific payload mapping. Recheck current official capabilities before relying on unstable limits. Neither an audio reference nor a prompt demanding perfect lip sync establishes an all-language guarantee.

## Direct the requested video

Extract the user's desired result: subject, purpose, exact dialogue, speech language, location and viewpoint, format, length, visual style, camera motion, references, voice and delivery. Preserve supplied wording; propose corrections instead of silently changing product names or claims. Adapt to interviews, UGC, advertisements, demonstrations, silent scenes, documentary footage or animation. Ask only for information that matters and cannot be inferred; continue independent research while waiting. If the user asks for planning only, do not generate. A request to generate authorizes the needed routine execution; do not ask again just because a skill mentions review.

Source images must actually be inspected with vision, not accepted from captions or search thumbnails alone. Record what each reference shows, its origin, rights and role. Evaluate viewpoint consistency, geography, recognizability, lighting and resolution; send enough compatible references to explain the shot, not every search result. Follow the user's required reference count; choose an appropriate count otherwise. An exterior tower image does not establish the view from its rooftop. Bind reviews to local image hashes after the final crop or resize.

Check the permitted voice library before choosing a clone. A missing voice is a missing dependency, not permission to invent enrollment. A clean one-speaker YouTube clip can be a sample for an authorized speaker, but does not provide speaker consent. Use the Voiceovers app's real enrollment flow, which requires a separate spoken consent recording. Never synthesize consent or infer ownership from a filename. Read the current dialogue WAV and manifest, not raw consent or enrollment recordings, into the video workflow.

Do not create deceptively authentic political/public-figure endorsements or falsely present staged material as a real news interview. Re-labeling known public-figure files as the user's own does not change their established context. Offer a fictional presenter and a generic microphone for such requests. Permission descriptions and vision reviews are agent attestations, not a server verification of identity, consent or semantic content. Respect current tool/provider restrictions; do not disguise rejected portraits to bypass moderation.

## Match audio to the requested result

For speech, audio-reference, multilingual or lip-sync requests, read `../../../docs/research/seedance-2.5-speech-playbook.md` and its linked evidence before compiling the package. Language documentation, a successful import and live lip-sync quality are separate findings.

- `native`: no existing voice required; Seedance generates the described speakers and approved script, or a non-speaking soundscape. Do not claim a generated voice matches a specific person.
- `reference`: use the completed approved dialogue WAV as a published reference, plus visuals. Voice and timing are guidance; external-audio exact lip sync is unverified. Generate the entire short dialogue together.
- `original`: generate silent footage with no visible speaking; add the original soundtrack locally. This preserves the recording's content, with AAC encoding in the final MP4. It is not a lip-sync solution.
- `silent`: visuals only.

Do not silently substitute one audio workflow for another. A reference sample for voice enrollment is not the completed dialogue soundtrack. Match shot timings to measured audio, not a words-per-minute guess. For longer-than-30s orders, plan multiple clips with consistent references and combine locally; do not advertise that as one supported 60s model request.

## Execute and verify

Prepare an immutable agent package with source evidence, prompt, audio and timeline. Resolve its `blockers`; `ready` means structurally ready, not guaranteed visual quality. Review the compiled request and price. Only use the agent submission endpoint when the human requested generation; record that instruction and an appropriate bounded USD estimate. Same package ID always returns the same job, including after failure. Unknown outcomes must be checked by job ID before any new attempt. Never automatically retry moderation or create a different request to bypass it.

Report success only after terminal `completed` with a playable saved output. Check visuals at several timestamps, listen to the entire audio, compare the transcript and inspect visible mouth alignment when required. Distinguish accepted API parameters, generated media and human-approved quality. Explain what did not match and ask whether another billable attempt is wanted. Return the actual local output; keep original sources and generation evidence under Git-ignored storage. Never read, print or commit API keys.
