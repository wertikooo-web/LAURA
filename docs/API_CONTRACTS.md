# LAURA Memory API Contracts

Memory requests use `X-LAURA-DEVICE-ID: <uuid>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/memory/status` | Storage availability |
| `GET/PATCH` | `/api/memory/settings` | Read or set `{ enabled }` |
| `GET/POST/DELETE` | `/api/memory` | List, explicitly create, or clear items |
| `PATCH/DELETE` | `/api/memory/:id` | Edit or delete one item |

Creation requires `{ content, explicit_consent: true }`. `session.start` accepts `device_id`. Memory enters the realtime prompt only when storage is available, device ID is valid, memory is enabled, and `no_save` is `false`.
