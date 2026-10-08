# Photos supplied in Codex sessions

Do not automatically analyze, describe, or visually review photos supplied directly
by the user in a Codex session. Use the user's accompanying text and assigned
reference roles; attaching a photo or asking to use it in a video does not request
photo analysis. Analyze these photos only when the user explicitly asks for it.
Do not invoke vision tools, reopen the photos, or generate visual-review notes just
because they were attached. This rule takes precedence over the video-agent skill's
source-image review instructions. Never claim an unreviewed photo was reviewed.

# Voice samples supplied in Codex sessions

For a requested voice clone, use the uploaded MP3's first 30 seconds as the
reference sample. Do not require a separate spoken statement or an English script
as a general project rule. Check the selected provider's actual requirements;
when upload-only cloning is unsupported, explain the provider limitation and
propose a compatible provider rather than repeatedly requesting the same recording.
Do not fabricate required provider inputs or silently change the chosen provider.
The owner selected upload-only cloning; the sibling Voiceovers native studio now
defaults to ElevenLabs IVC and Eleven v3 Lithuanian TTS. Use that path for new MP3
clones when an ElevenLabs runtime key is available. A Google key is not compatible.

# Lithuanian voiceover text

For YouTube audio requests use the sibling Voiceovers CLI from its workspace:
`.venv-desktop/Scripts/python.exe -m desktop.youtube_cli URL --start 0:10 --end 0:40`.
When the user gives both times, extract exactly that interval; never replace it
with an automatically ranked segment. Without an end, use automatic selection
(`--target 30`, `60` or `120`). The CLI returns playable WAV/MP3 and selection
evidence. `--diarize` opts into paid Scribe and requires a runtime ElevenLabs key;
when several speakers are found, use the requested speaker rather than guessing.
Audio extraction does not authorize a voice clone: add `--clone` only when
cloning is requested. Never claim unverified speaker identity or exact mannerism
transfer. Lithuanian Voice Changer remains an explicit experimental mode.

Before sending Lithuanian dialogue to ElevenLabs, Codex must proofread it:
restore ą, č, ę, ė, į, š, ų, ū, ž; correct spelling, grammar, capitalization
and punctuation while preserving meaning, facts and brand/domain identities.
The owner authorizes these routine corrections without another confirmation.
Do not send the raw uncorrected chat text. Use `language_code: "lt"` with
`eleven_v3` and Unicode text. Save both the original and corrected script in
generation evidence. Do not guess an ambiguous brand's official spelling.
This proofreading is the agent's responsibility; ElevenLabs is the speech
provider, not a grammar correction service.

# Video creation requests

For an uploaded MP3 that is the finished voiceover, use the Seedance 2.5 speech
playbook below before preparing the generation. A talking-video request uses
`reference` audio with the complete approved dialogue, measured timing, exact
transcript and explicit speaker/asset roles. Do not substitute `original` silent
footage for visible speech. Preserve breathing and pauses, keep the mouth readable,
and check actual lip alignment throughout the completed clip. Reference audio is
guidance, not a guarantee of unchanged audio or exact Lithuanian lip sync.
Read [docs/research/seedance-2.5-speech-playbook.md](docs/research/seedance-2.5-speech-playbook.md).

For a request to create or plan a video through this project, read
[.agents/skills/video-agent/SKILL.md](.agents/skills/video-agent/SKILL.md) before acting.
It explains the local agent API, Voiceovers handoff, reference research and visual review,
audio modes, generation authorization and result verification. Do not treat a previous
session's successful native speech generation as proof of external-audio lip sync.
API keys are runtime server inputs: never read or print environment files.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
