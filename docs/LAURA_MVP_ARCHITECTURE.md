# LAURA MVP Architecture

The current MVP remains a small Node.js application. The browser owns UI and audio capture, `src/realtime` owns session lifecycle, providers own xAI protocol details, and `src/memory` owns long-term-memory policy and persistence.

Memory is a logical service boundary inside the current process, not a separate Railway service. The adapters are in-memory for tests, a private file for local development, and PostgreSQL for production. Redis, embeddings, pgvector, a monorepo, and framework migration are intentionally deferred.

`LAURA MVP Architecture.docx` is a useful target architecture. Authentication, multi-device identity, retrieval ranking, automatic extraction, relationship profiles, vector search, and separate services are later stages.
