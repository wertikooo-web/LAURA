# TASK: Add Gemini Live and Grok Voice as interchangeable realtime providers

Status: implemented.

## Acceptance criteria

- [x] Existing Grok transport is behind the common provider registry.
- [x] Gemini Live is a second adapter, not a second realtime pipeline.
- [x] Environment default and per-session dashboard override are supported.
- [x] Old provider session closes before a replacement opens.
- [x] Prompt assembly, memory, browser audio, lips, transcripts, and interruption are shared.
- [x] Provider errors and events use a common internal contract.
- [x] Unconfigured providers fail clearly without exposing keys.
- [x] Mocked lifecycle, Gemini event/configuration, validation, and error tests make no paid calls.
- [x] Bounded privacy-safe comparison metrics are available.

## Non-goals

No production secret creation, Railway variable mutation, provider billing
automation, duplicated browser pipeline, or TypeScript migration of the existing
CommonJS application was introduced in this task.
