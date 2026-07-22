# LAURA

**LAURA — голос, который живёт рядом.**

Independent phone-first prototype of a privacy-first realtime voice companion
for adults. The repository intentionally contains no dependency on WINE AI or
any other project.

## What the first prototype includes

- mobile-first browser interface;
- explicit 18+ confirmation;
- push-to-start voice session with interruption support;
- Talk, Evening, and Quiet modes;
- live Warm, Flirty, Sensual, and Direct adult conversation styles;
- live Calm, Alive, and Passionate voice-expression styles;
- native xAI speech-speed control with a slower `0.8` default;
- Russian, Romanian, English, and French interface and response preferences;
- selectable built-in female xAI voices with short server-side previews;
- amplitude-driven talking-lips animation during LAURA's audio playback;
- in-page transcript clearing and a fixed, no-page-scroll layout;
- privacy-first no-save mode (enabled by default);
- one provider-independent realtime pipeline with `mock`, Grok Voice, and Gemini Live adapters;
- server-side provider authentication, so API keys never reach the browser;
- no raw-audio storage and no transcript logging by default.
- multiple structured characters with independent scenarios and relationship memory;
- manual character creation and optional Gemini text generation through an editable unsaved draft.

This stage validates voice, latency, turn-taking, personality, and willingness
to start a second conversation. Memory is now an explicit, inspectable MVP;
hardware sensors, a native mobile app, account identity, and production age
verification do not yet exist.

## Local start

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Open `http://127.0.0.1:3000`. The default `mock` provider works without an API
key and supports text testing of the session and UI.

## Realtime providers

The dashboard can select **Grok Voice** or **Gemini Live** per session. A switch
first closes the current provider session and then opens the replacement; the
prompt, memory context, transcript events, interruption controls, browser audio
pipeline, and lip sync remain shared. Providers that have no server-side key are
shown as unavailable and cannot be selected.

Enable Grok Voice with:

Set the following in the local `.env` file:

```text
REALTIME_VOICE_PROVIDER=grok
GROK_API_KEY=your_server_side_key
GROK_VOICE_MODEL=grok-voice-latest
GROK_VOICE_ID=eve
```

Enable Gemini Live with:

```text
REALTIME_VOICE_PROVIDER=gemini
GEMINI_API_KEY=your_server_side_key
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_VOICE_ID=Aoede
```

`REALTIME_PROVIDER=xai`, `XAI_API_KEY`, `XAI_MODEL`, and `XAI_VOICE` remain
compatible aliases, so an existing Railway Grok deployment does not require an
immediate variable migration. Never put either provider key in browser code.

Restart the server. The browser sends microphone PCM frames only to this
application's WebSocket; the backend proxies the session to xAI. The key stays
server-side. Language and voice selectors are locked while a realtime session
is connected; disconnect before changing either setting.

The `Adult style` selector remains live while connected. `Warm` is personal
but does not initiate intimate topics; `Flirty` adds teasing and attraction;
`Sensual` adds a slower, more expressive and suggestive tone; `Direct` permits
plain adult vocabulary and detailed practical discussion of desires, sexual
practices, anatomy, body responses, consent, comfort, and boundaries. These
styles do not enable sexual roleplay by LAURA or pornographic scene narration.

`Speed` and `Expression` also remain live while connected. Speed is sent to
xAI as the documented `audio.output.speed` setting (supported range `0.7` to
`1.5`), rather than changing playback speed in the browser. `Calm`, `Alive`,
and `Passionate` add progressively stronger delivery instructions for pacing,
pauses, warmth, laughter, breath, and emotional intensity. Expression is
model-guided rather than a deterministic audio effect, so its exact strength
still varies by voice. LAURA's Russian name pronunciation is fixed server-side
to `ЛА́ура`, with first-syllable stress, using xAI pronunciation replacement.

Voice previews use xAI's paid TTS endpoint with a fixed short phrase and the
currently selected speed. The
server validates the requested female voice and language, rate-limits clients,
and caches generated previews in memory. xAI currently documents Russian,
English, and French TTS language codes. For Romanian preview the server uses
automatic language detection; Romanian remains explicitly enforced in the
realtime system instruction.

## Privacy behavior

- microphone access begins only after an explicit user action;
- raw audio is streamed and never written to disk;
- no-save is enabled by default;
- transcript text is not written to application logs unless
  `ALLOW_TRANSCRIPT_LOGGING=true` is deliberately configured;
- long-term memory is opt-in, inspectable, editable, and deletable;
- the temporary identity is one browser-local device UUID;
- no-save prevents retention of the current transcript; explicitly saved facts remain available;
- facts can be global for all characters or private to the selected character relationship.

## Memory storage

Local development stores approved memory in `.data/memory.json`. Production
requires PostgreSQL through `DATABASE_URL`; run `npm run db:migrate` once before
enabling memory and character profiles. Without PostgreSQL, production reports memory as unavailable
instead of using Railway's ephemeral filesystem. See `docs/MEMORY_POLICY.md`.

## Characters

Open Settings → Characters to switch, create, edit, duplicate or delete profiles. LAURA is protected; duplicate it to create an editable variation. Generation uses the same `GEMINI_API_KEY` but a separate text model setting:

```text
CHARACTER_GENERATION_PROVIDER=gemini
CHARACTER_GENERATION_MODEL=gemini-2.5-flash
```

This does not change `REALTIME_VOICE_PROVIDER`. Generated profiles remain browser drafts until Save is pressed. Architecture and memory isolation are documented in `docs/CHARACTER_PROFILE_ARCHITECTURE.md`.

## Tests

```powershell
npm test
npm run test:smoke
```

The smoke test starts the server in mock mode, checks health/config endpoints,
and verifies that an under-age WebSocket session is rejected.
