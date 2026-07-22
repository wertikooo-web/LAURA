# TASK: Add multi-character profiles

## Product outcome

LAURA becomes the first protected profile in a reusable companion platform. A temporary browser device identity may own up to ten private characters. Every profile carries structured identity, adult age presentation, appearance, family lore, personality, communication style, knowledge, roles, provider/voice defaults and scenarios.

## Delivered scope

- PostgreSQL and local-file character repositories behind one interface.
- Protected system LAURA plus private user-created profiles.
- Create, read, update, duplicate, archive/delete and scenario APIs.
- Character version increment and immutable session snapshots.
- Prompt composition from structured fields with user content delimited as data.
- `global_user` and `character_relationship` memory scopes.
- Realtime `character_id`/`scenario_id` selection shared by Grok and Gemini.
- Character Studio with manual creation and editable generated drafts.
- Gemini text-generation adapter, separate from the realtime provider.
- Surprise, guided and complete-missing generation modes; up to three variants at API level.
- Explicit 18+ validation, real-person clone rejection and one structured repair attempt.
- Appearance and embodiment data now; animated avatars remain step 6.

## Non-goals

- Account authentication or multi-device synchronization.
- Paid generation in the normal test suite.
- Automatic memory extraction from private transcripts.
- Avatar rendering/generation, emotional dependency mechanics or real-person cloning.
- A second realtime pipeline.

## Acceptance checks

Tests cover ownership, system protection, creation/update/versioning, duplication without relationship state, scenario overrides, prompt containment, global/relationship memory isolation, snapshots, generation preview, preservation of manual values, repair, adult validation and provider independence.
