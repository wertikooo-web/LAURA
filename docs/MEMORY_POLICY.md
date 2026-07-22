# LAURA Memory Policy (MVP)

- Long-term memory is disabled by default for every device and requires explicit opt-in.
- `Do not save conversation` prevents retaining the current transcript; it does not hide facts the user explicitly saved and consented to use.
- Raw audio and full conversation transcripts are never stored by memory.
- The MVP stores only user-approved text facts (maximum 500 characters, 100 items per device).
- The user can inspect, edit, delete individual items, or delete all items.
- `global_user` facts may be used by every accessible character; `character_relationship` facts require the same device and selected character ID.
- Relationship memories are never injected into another character. Existing facts created before character support are treated as global so names and basic profile facts continue to work.

The browser creates one random UUID and keeps it in `localStorage` as `laura_device_id`. The server uses it as a temporary device-scoped user identifier. Memory text is server-side only. Clearing browser storage creates a new identity and does not delete the old server record; account authentication must replace this before a multi-device or public release.

Local development uses `.data/memory.json`. Production uses PostgreSQL through `DATABASE_URL`. Production memory becomes unavailable, rather than silently using ephemeral container storage, when PostgreSQL is not configured. The application never runs database migrations implicitly at startup.
