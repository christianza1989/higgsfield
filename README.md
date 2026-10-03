# Zinho Automates

## UGC and advertising prompt library

Open **Prompts** for 16 original UGC/ad templates: hook–demo–CTA,
problem–solution, unboxing, routine, faceless demo, founder, FAQ, offer,
beauty, apparel, food and product hero shots. Fill the product, benefit,
spoken script and CTA fields. Templates use **15s, 720p, 9:16, audio on**;
spoken scripts can be Lithuanian. Review cost and attach your product image
in the studio before generating. Shorten the duration and script to reduce cost.

The library also includes 163 attributed prompts from the EvoLinkAI collection,
including its Commercial / Product category. Search by text/author, filter
categories, favorite prompts, customize text and save personal variants to SQLite.
**Watch example** plays upstream sample videos inside the app. Entries without
a direct video URL use X's official embedded tweet widget. If X or the source
blocks playback, the original source link remains available. Media is streamed
from its original host and is not copied into the repository.
See [third-party notices](THIRD_PARTY_NOTICES.md). `npm run prompts:sync`
refreshes the checked-in catalogue and license from upstream with format checks.

**Use in studio** restores a prompt without submitting it. **Save prompt** in
the composer saves text and model controls. Generated results have favorites,
copy prompt, save prompt and reuse settings actions. Reuse includes reference
URLs when present; re-upload expired references. Favorite results remain local.

Seedance 2.5 and Kling 3.0 Standard / Pro have **Compare provider prices**.
Quotes apply to one video, preserve supported shared controls, and explain
token billing/provider defaults. A lower price is not a guarantee of equal
quality. Switching providers preserves compatible controls and reference slots.

## OpenRouter video provider

Set `OPENROUTER_API_KEY` in `.env.local`, restart the server, then select
**OpenRouter** on the Video page. Seedance 2.5 and Kling 3.0 Standard / Pro are
available alongside the existing Higgsfield models. Settings shows whether the
server has loaded the key; its value is never returned to the browser.

The worker saves each provider's request ID and resumes polling after restart.
OpenRouter video downloads are authenticated server-side and saved to the local
library. Price estimates use the live video model catalogue and exclude platform
fees and taxes. Once complete, the API's reported usage cost replaces the estimate.
Unknown prices or unsupported settings block OpenRouter submission.

Images fill the first-frame and then last-frame slots. Uploading images uses
Higgsfield storage and therefore also requires a Higgsfield key; text-to-video
only needs OpenRouter. Submitted OpenRouter videos cannot be canceled here
because the public video API does not document a cancellation endpoint.

Run `npm test` for provider routing, pricing, lifecycle, and credential-boundary
checks, and `npm run build` to verify the production app. Neither command starts
a billable generation. Clicking Generate does.

Official reference: [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation).

## Seedance 2.5 SDK example

Enter `HF_CREDENTIALS=key-id:key-secret` locally in `.env.local`, then run
`npm run seedance`. This submits **one billable generation** using the official
`@higgsfield/client/v2` SDK: "A cinematic scene at sunset", 5 seconds, 720p,
16:9. The CLI waits and prints a video URL only after confirmed completion.
Credentials are loaded server-side with dotenv and are never printed.
`.env.local` is excluded by the existing `.env*` Git ignore rule.

The installed SDK poller does not recognize canceled requests, so the example
uses `subscribe` with `withPolling: false` and polls the status endpoint itself,
handling failed, canceled, and moderated requests explicitly. Submission retries
are disabled to avoid duplicate billable requests. If polling fails or times out,
check the request in the Higgsfield console before running it again.

This standalone example does not use SQLite. The web studio uses its existing
Settings credentials, `HF_API_KEY_ID` / `HF_API_KEY_SECRET`, or `HF_CREDENTIALS`.
On Windows, the studio's `better-sqlite3` dependency may require Visual Studio
C++ build tools; installing with `--ignore-scripts` can run the standalone SDK
example but does not verify the database-backed studio.

References: [official SDK documentation](https://docs.higgsfield.ai/docs/how-to/sdk)
and [Seedance 2.5 API reference](https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference).

A self-hosted front end for the [Higgsfield API](https://docs.higgsfield.ai/docs). The same
composer-driven workflow as Higgsfield's own app, but billed per generation through your own
API key instead of a subscription.

70 models across image and video (16 image, 54 video), each verified against the live API.

## Setup

You need **Node.js 20 or newer**. Check with `node -v`; if it's older, get the current
release from <https://nodejs.org>.

```bash
npm install
npm run build
npm start
```

Then open <http://localhost:3000>.

### Add your API key

The app ships without a key — you use your own, and you're billed only for what you generate.

1. Create an account at the **[Higgsfield Console](https://higgsfield.ai/?fpr=zinho-automates)**.
   The home page has a **Grab Your API Keys** link that goes straight there.
2. Create an API key. It comes in **two parts** — a key ID and a key secret. Copy both.
3. In the app, open **Settings** and paste them into the two fields. Save.

That's a one-time step. The key is stored in a local SQLite database on your own machine, and
the secret is never sent to the browser.

If you'd rather keep the key out of the database, copy `.env.example` to `.env.local` and put
it there instead. The app checks the database first and falls back to the environment file.

### Running it day to day

`npm start` serves the production build and is what you want normally. Use `npm run dev` only
if you're changing code — it recompiles on every edit and is slower to load.

The first `npm install` compiles a native SQLite module, so it takes a minute and needs a
working C++ toolchain. On macOS that means Xcode Command Line Tools
(`xcode-select --install`); most Linux distros need `build-essential`.

## The model registry

**`lib/catalog.ts` is generated, not hand-written.** Two commands rebuild it:

```bash
HF_API_KEY_ID=... HF_API_KEY_SECRET=... npm run discover
npm run build:registry
```

`discover` reads the live `GET /models` catalogue, then probes each model's `/estimate`
endpoint — which costs nothing — to learn:

- whether your key can reach it (`200` works · `404` not on your plan · `423` blocked ·
  `503` disabled by Higgsfield)
- its price, or that it's token-metered
- which fields are **required**, by submitting an empty body and following the errors
- each optional field's real enum values and type, by submitting deliberately invalid values
  and reading what the validator rejects

`build:registry` turns that into TypeScript, merging each model's text-to-X and image-to-X
endpoints into a single entry, so "Kling V3.0 Pro" is one model that swaps endpoint when you
attach an image rather than two near-identical rows.

Run both after Higgsfield adds models, or if your plan changes.

### Why it's generated

The published OpenAPI spec is wrong and incomplete. It misstates paths (`/veo3.1` is really
`/veo3.1/text-to-video`), enum values (Soul's resolution is `720p`/`1080p`, not `2K`/`4K`) and
types (it declares numeric enums as strings; the live API rejects `"8"` where it wants `8`).
It also omits most of the catalogue outright.

The critical part: **the API ignores unknown fields rather than rejecting them**, so a guessed
parameter name fails *silently* — you get a generation, just not the one you asked for. That's
why every parameter here comes from a live probe rather than documentation.

**13 models are hand-maintained** in `EXTRAS` inside `lib/models.ts`, because `GET /models`
doesn't list them even though they work — Soul Cinema, Popcorn, Soul Reference, Soul
Character, DoP, Veo and a few others. The catalogue is authoritative for what it contains, but
it is not exhaustive.

**Video and audio attachments are supported.** Models can declare `refKind: "video"` or
`"audio"`, and the composer accepts MP4 and WAV alongside images — by picker, drop or paste.
Attaching a clip to a model that wants a still (or vice versa) switches you to one that
matches. Higgsfield's storage only issues upload URLs for images, `video/mp4` and
`audio/wav`, so MOV, WebM and MP3 are rejected up front rather than failing mid-upload.

**Excluded:** six models (`motion-control`, `o3/video-edit`, `omni/video-edit`) return a
**500** from Higgsfield's own estimate endpoint, so they aren't usable by anyone right now.

Models needing **two keyframes** are supported: a model can declare `refKeys`, and successive
attachments fill each key in turn. Kling's First–Last Frame models use this.

## Typography

Every size in the app resolves through the scale at the top of `app/globals.css` — there are
no hardcoded pixel sizes left in any component. Adjusting the app's type means editing that
one block: 2xs 12 · xs 13 · sm 14 · base 16 · lg 20 · xl 24 · 2xl 30.

## Layout

Results are laid out as **justified rows**: items flow left-to-right and wrap, each row
scaled so it spans the full width with every aspect ratio intact and nothing cropped. The
newest result is top-left and the next one sits beside it.

This replaced column masonry, which reads top-to-bottom — in a newest-first library that put
the second-newest *underneath* the newest, which is confusing. No image measuring is needed,
because each tile's ratio comes from the parameters its job was submitted with, falling back
to the model's own default when a job didn't record one.

## Viewing results

Click any result to open it. **←** and **→** step through your library in the order it's laid
out, with a position counter and on-screen arrows; **Esc** closes. The arrows clamp at each
end rather than wrapping, so holding one doesn't silently loop back to the start.

Deleting from the viewer stays put and lets the next result slide into place, rather than
kicking you back to the grid.

## Deleting results

Every result has a delete control on hover, and a Delete button in the lightbox. Deletion is
per-result, not per-job: a batch of four images is one job with four outputs, so removing one
tile keeps the other three. The job row is cleaned up once its last output goes, and the file
is removed from `storage/media` at the same time.

Failed, blocked and cancelled jobs can be cleared in one action from the Library header.
Nothing of value is lost — Higgsfield doesn't charge for `failed` or `nsfw` requests, so they
never contributed to the spend history.

## Choosing a model

The picker is two levels: pick a family (Kling, Seedance, MiniMax…), then a variant. With ~54
models a flat list is unusable, and families match how people actually choose. Each row shows
its live price and a capability summary derived from what the API accepts.

Models your key can't reach are greyed out with the reason rather than failing at generation
time. Availability is detected live, so if Higgsfield enables or disables something the app
reflects it without a code change.

## Attachments

Click **+**, **drop a file anywhere on the page**, or **paste** one. Images upload to
Higgsfield's storage and are passed to the model by URL.

Attaching an image on a model that can't use one switches you to a model that can, and says
so. Video models switch to their image-to-video endpoint automatically. A few models take
several images at once; most take exactly one.

## Metered models

Seedance and a few others bill per token rather than per generation, so there's no price to
quote up front. Those show `metered` instead of a figure, with an explanation, and Higgsfield
reconciles the exact charge afterwards. Metered jobs don't contribute to the dashboard's spend
totals or count against the spend cap, since there's no number to count.

## How it works

- **`lib/models.ts`** — types, helpers, and the hand-maintained `EXTRAS`. Composes with the
  generated `lib/catalog.ts` to form the registry the UI reads.
- **`lib/worker.ts`** — a server-side job engine. All Higgsfield generation is asynchronous,
  so jobs are submitted, polled (2s backing off to 10s, as the docs recommend) and downloaded
  here rather than in the browser. Generations survive closing the tab and, because state
  lives in SQLite, restarting the server.
- **`storage/`** — the database and a local copy of every generated file.

## Why files are downloaded

Higgsfield deletes generated output after about seven days. Every result is copied into
`storage/media/` and served from `/api/media/...`, so the library keeps working indefinitely.

Everything local lives in `storage/` — gitignored, and excluded from any archive of this
project, so it never travels with the code. Back it up if the generations matter; delete it to
start clean.

## Concurrency

Higgsfield applies back-pressure two different ways, and the worker treats both as "wait",
not "fail":

- **Concurrency** — a `400` whose text mentions "maximum number of concurrent requests"
  (4 on most accounts). Adjust the local limit in Settings.
- **Account queue** — a structured `{"code":"account_queue_full","retryable":true,
  "limit":10,"retry_after_seconds":30}`. This counts *all* queued generations on the
  account, including ones started from Higgsfield's own web app, so you can hit it even
  when this app is idle.

The worker keeps the job `pending` and waits out `retry_after_seconds` before trying again.
Genuine errors — a bad duration, a blocked model — still fail immediately rather than
looping.

## Cost

The Generate button shows a live USD estimate from Higgsfield's `/estimate` endpoint, which
prices a request without running it. Spend is tracked on the Home dashboard, and an optional
30-day spend cap in Settings blocks new generations once reached. Only completed jobs count —
Higgsfield doesn't charge for `failed` or `nsfw` requests.

Prices vary by plan, and some keys carry a percentage discount the API applies automatically.

## Branding and the referral link

`lib/brand.ts` holds the product name and the referral link on the home page.

The home-page banner links to `higgsfield.ai/?fpr=zinho-automates`, verified to resolve.

The palette lives at the top of `app/globals.css`. `--accent` (blue) is the action colour;
`--accent-2` (pink) is the secondary and marks video. Both are bright with near-black ink
rather than white — on a dark UI a colour dark enough to carry white text reads muted, whereas
a bright chip with dark text keeps its punch and still clears 7:1 contrast.

## Clip length

Where a model accepts a **contiguous** range of durations, the Length control is a slider
covering every second it allows — Kling 3.0 runs 3–15s, Seedance 2.5 goes to 16s, PixVerse
starts at 1s. Where the API only accepts specific values (Kling 2.5 Turbo is 5 or 10, LTX is
6/8/10), it stays a fixed choice, because a slider there would let you pick a duration the
API rejects.

`npm run discover` works this out by probing every value from 1 to 16 and checking whether
the accepted set is contiguous. An earlier version sampled only `[3,4,5,6,8,10,12]`, never
saw 7/9/11/13-16, and so capped several models far below their real limit.

## Keyboard

**Enter** sends the prompt. **Shift+Enter** inserts a line break. **⌘/Ctrl+Enter** also sends,
since that was the previous binding.

Enter is ignored while an IME candidate window is open (`isComposing`), so the composer stays
usable for anyone typing Japanese, Chinese or Korean — there, Enter is confirming a character
rather than submitting.
