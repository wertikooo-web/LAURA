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
- Russian and English session preferences;
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
server-side.

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
