# LAURA MVP Architecture

The current MVP remains a small Node.js application. The browser owns UI and audio capture, `src/realtime` owns session lifecycle, providers own external protocols, `src/memory` owns long-term-memory policy, and `src/characters` owns structured character profiles.

Memory is a logical service boundary inside the current process, not a separate Railway service. The adapters are in-memory for tests, a private file for local development, and PostgreSQL for production. Redis, embeddings, pgvector, a monorepo, and framework migration are intentionally deferred.

LAURA is now the first protected built-in profile inside the general character platform. User characters, scenarios and relationship preferences reuse the same Grok/Gemini realtime path. Character generation uses a separate text-model adapter and returns an unsaved draft. See `CHARACTER_PROFILE_ARCHITECTURE.md`.

`LAURA MVP Architecture.docx` remains a useful target architecture. Authentication, multi-device identity, retrieval ranking, automatic extraction, vector search, animated avatars and separate services are later stages.
