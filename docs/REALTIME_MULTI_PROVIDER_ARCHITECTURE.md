# Realtime multi-provider architecture

## Decision

LAURA has one realtime application pipeline. `realtimeServer.js` owns browser
WebSocket state, push-to-talk, resampling, interruption, transcript delivery,
prompt assembly, memory loading, and session lifetime. A provider registry
resolves exactly one transport adapter at `session.start`.

```text
Browser -> realtimeServer -> RealtimeProviderRegistry -> GrokVoiceAdapter
                                                \-----> GeminiLiveAdapter
```

There is deliberately no second Gemini-specific browser or orchestration path.

## Shared adapter contract

An adapter creates a session with the already assembled system instruction and
implements `connect`, `startInput`, `sendAudio`, `endInput`, `sendText`,
`interrupt`, and `close`. Optional live instruction/delivery updates return
`false` when the upstream protocol requires session recreation.

Both adapters emit the same internal events: user/model transcript events,
24 kHz PCM `audio.chunk`, `audio.end`, and normalized `provider.error`.

Grok uses its existing WebSocket transport. Gemini uses the official
`@google/genai` Live client, PCM16 mono input at 16 kHz, PCM output at 24 kHz,
explicit activity start/end signals, audio response modality, and input/output
transcription. Gemini automatic activity detection is explicitly disabled when
the application sends those manual turn-boundary signals; mixing both modes is
invalid and can leave a voice turn connected but unanswered.
The adapter also waits for Gemini's `setupComplete` event before exposing
`session.ready`; an open WebSocket alone is not a ready model session.

## Switching and lifetime

The environment chooses the default provider. The dashboard may override it in
`session.start`. When the selection changes, the browser stops playback, closes
the application WebSocket (which closes its sole provider session), waits for
that close, and opens a fresh application session. Two upstream provider
connections are never intentionally active for one browser session.

Grok supports live prompt and speed updates. Gemini session setup is immutable
for this integration, so a mode, style, expression, or speed change triggers the
same close-then-reconnect sequence.

## Configuration and secrets

Keys remain server-side. A provider without a key is listed as unconfigured and
the resolver rejects attempts to use it. The legacy xAI variable names remain
aliases for a zero-downtime migration.

## Metrics and cost

`/api/realtime-metrics` exposes bounded in-memory aggregates by provider:
session count/duration, input/output audio duration, first-audio latency,
interruptions/failures, and connection errors. Estimated cost stays `null`
until current provider pricing is explicitly configured; the application does
not silently hard-code unstable commercial rates. Metrics contain no transcript
or raw audio.

## Verification boundary

Standard tests inject fake adapters and a fake Gemini Live client, so they make
no paid calls. A real Gemini acceptance test requires `GEMINI_API_KEY` and must
be run deliberately outside the standard suite.
