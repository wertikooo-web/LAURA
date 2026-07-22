# LAURA Memory API Contracts

Memory requests use `X-LAURA-DEVICE-ID: <uuid>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/memory/status` | Storage availability |
| `GET/PATCH` | `/api/memory/settings` | Read or set `{ enabled }` |
| `GET/POST/DELETE` | `/api/memory` | List, explicitly create, or clear items |
| `PATCH/DELETE` | `/api/memory/:id` | Edit or delete one item |

Creation requires `{ content, explicit_consent: true, scope }`, where scope is `global_user` or `character_relationship`. Character-scoped requests also send `X-LAURA-CHARACTER-ID`. `session.start` accepts `device_id`, `character_id` and optional `scenario_id`. No-save blocks transcript retention, not explicitly saved facts.

# Character API contracts

Character requests use `X-LAURA-DEVICE-ID: <uuid>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/characters` | List accessible or create private character |
| `GET/PATCH/DELETE` | `/api/characters/:id` | Read, update or delete owned character |
| `POST` | `/api/characters/:id/duplicate` | Copy profile and scenarios, never memory/history |
| `GET/POST` | `/api/characters/:id/scenarios` | List or create scenarios |
| `PATCH/DELETE` | `/api/characters/:id/scenarios/:scenarioId` | Update or delete a scenario |
| `GET/PATCH` | `/api/characters/:id/relationship` | Character-specific relationship preferences |
| `POST` | `/api/characters/generate` | Return one to three unsaved draft variants |
| `POST` | `/api/characters/generate/section` | Regenerate one section while preserving others |
