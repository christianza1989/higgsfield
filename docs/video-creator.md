# Local video creator

Open `/create` in the running studio. Choose an available ElevenLabs voice or upload a finished 5–30 second MP3/WAV and its exact transcript. A finished recording is used in full; it is not a cloning sample. Runtime voice-library credentials stay in server memory and must be reconnected after a server restart.

Upload appearance, location, wardrobe and object references, assigning each image its role. Session-uploaded photos are not sent to the planning model for identity or visual analysis. Geometry normalization preserves the whole frame.

With automatic references enabled, missing described face/wardrobe/prop references are generated before video submission. Fictional locations are generated. Real locations are researched on Wikimedia Commons: default three distinct images, reusable licenses and AI checks for place/viewpoint. Sources and attribution are visible before generation. Reference images, planning, TTS and video review use paid APIs; the review pane quotes video generation separately.

Describe season, weather, surroundings, environmental sound and camera movement. Lithuanian clone TTS receives corrected text and the `lt` language code. Dry TTS may receive quiet explicitly requested environmental sound; finished recordings retain their existing ambience without a duplicate layer.

Preparation attempts, image attempts and deterministic generation submissions are saved under `storage/director`. Unknown billable responses are never automatically retried. The form can check the saved preparation status without submitting new paid work. Generation uses the prepared package and its measured audio duration; local MP4 export retains generated model audio.

Optional AI result review processes the complete generated video, including audio. It records observed transcript, continuity, sound and coarse lip-sync observations. This is not certification of cloned identity or precise phoneme alignment.

## Real test, 2026-10-08

- Uploaded original fictional 3D presenter; generated navy coat/beige sweater and knitted cap through the automatic missing-reference flow.
- Researched three Gediminas Tower references with CC BY-SA licenses.
- ElevenLabs Lithuanian dialogue measured 11.44 seconds; submitted 12-second 9:16 / 720p Seedance 2.5 generation. Video quote: USD 2.77, excluding preparation.
- Job `2de29d96-f29f-42fd-a1cd-5f12fbe6b4a1` completed. Final export `b84a56f8-be6d-46e0-ad9c-ef73d38623d9` is playable H.264/AAC, 720×1280, 11.458333 seconds of video and 11.44 seconds of audio (frame quantization).
- Direct start/middle/end frame review found consistent presenter, coat/cap, recognizable tower, autumn leaves, overcast light and gestures.
- Independent Gemini video/audio review transcribed the full expected Lithuanian dialogue, reported outdoor wind, no indoor echo/music/extra voices and no issues. Its coarse assessment reported plausible lip sync. The coding agent cannot directly listen to audio in this session; exact voice likeness and phoneme alignment remain for human playback review.
- Evidence: `storage/agent-work/creator-test-20261008`, package and cached AI review in `storage/director`.

Validation: 48 tests passed, TypeScript passed, production build passed. The optional `STUDIO_VERIFY_BUILD=1` build uses `.next-verify` to preserve the running development studio.
