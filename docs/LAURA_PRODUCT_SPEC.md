# LAURA Product Spec — Memory Stage

The memory stage lets one temporarily identified browser decide what LAURA may remember between sessions.

- memory is opt-in and current-session no-save overrides it;
- the user can inspect, create, edit, delete, and clear memories;
- no raw audio or full transcript is stored;
- approved items can be injected into a later realtime session;
- local development survives restart through a private JSON file;
- production requires PostgreSQL and never pretends ephemeral storage is durable;
- operations are device-scoped and validated;
- the UI reports unavailable production storage.
