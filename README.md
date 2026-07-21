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
- Russian, Romanian, English, and French interface and response preferences;
- selectable built-in female xAI voices with short server-side previews;
- amplitude-driven talking-lips animation during LAURA's audio playback;
- in-page transcript clearing and a fixed, no-page-scroll layout;
- privacy-first no-save mode (enabled by default);
- provider boundary with `mock` and xAI Grok Voice Realtime implementations;
- server-side provider authentication, so API keys never reach the browser;
- no raw-audio storage and no transcript logging by default.

This stage validates voice, latency, turn-taking, personality, and willingness
to start a second conversation. It does not pretend that hardware sensors,
durable memory, a native mobile app, or production age verification already
exist.

## Local start

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Open `http://127.0.0.1:3000`. The default `mock` provider works without an API
key and supports text testing of the session and UI.

## Enable Grok Voice

Set the following in the local `.env` file:

```text
REALTIME_PROVIDER=xai
XAI_API_KEY=your_server_side_key
XAI_MODEL=grok-voice-latest
XAI_VOICE=eve
```

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

Voice previews use xAI's paid TTS endpoint with a fixed short phrase. The
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
- durable memory is deferred until users can inspect and delete every saved
  fact and the implementation can prove that no-save is respected.

## Tests

```powershell
npm test
npm run test:smoke
```

The smoke test starts the server in mock mode, checks health/config endpoints,
and verifies that an under-age WebSocket session is rejected.
