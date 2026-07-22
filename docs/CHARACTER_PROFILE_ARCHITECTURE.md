# Character profile architecture

## Boundary

LAURA has one conversation platform and many data-defined characters. The browser, realtime session lifecycle, Grok/Gemini adapters, audio playback, memory storage and future avatar renderer are reusable. Character differences do not create provider-specific pipelines.

```text
character + temporary scenario + relationship preferences
          + permitted global/relationship memory
          + session language/style/privacy settings
          -> one prompt snapshot -> Grok Voice or Gemini Live
```

The current MVP has no account service. `device_id` is the temporary owner identity. Replacing it with an authenticated user ID later is a repository-layer migration, not a prompt or provider rewrite.

## Entities and persistence

Migration `002_character_profiles.sql` adds:

- `laura_characters`: identity, appearance, family, personality, communication, knowledge, behavior, settings, embodiment, provider/voice/avatar references, privacy, status and integer version;
- `laura_character_scenarios`: temporary role/tone/knowledge/appearance overrides;
- `laura_character_relationships`: preferences for one `device_id + character_id` pair;
- `laura_session_snapshots`: the exact character version, scenario, provider and voice used at session start;
- `scope` and `character_id` on `laura_memories`.

PostgreSQL is authoritative in production. Development uses `.data/characters.json`; tests use the in-memory adapter. LAURA uses stable ID `00000000-0000-4000-8000-000000000001` and is a protected system character. A user can duplicate it into an editable private profile.

Appearance is structured character continuity data, separate from `defaultAvatarId`. `embodimentMode` is one of `human_like`, `digital_explicit`, or `contextual`. Adult-oriented profiles require an explicit `apparentAge >= 18`. Step 6 can attach animated avatars without changing identity or memory.

## Validation and access

All character access requires the device owner header. A query returns only system characters or profiles owned by that device. System profiles cannot be updated/deleted. User profiles are private by default. Limits are ten user profiles, ten scenarios, twenty knowledge domains, 5,000 biography characters and 3,000 custom-instruction characters.

Personality values are normalized to `0..1` and change only through explicit profile updates. User-authored biography and custom instructions are length-limited and delimited as `<character_data>` in prompts. They are never placed above platform safety rules. Exact real-person clone requests are rejected.

## Prompt assembly

`characterPromptBuilder` emits only non-empty semantic sections:

1. non-overridable platform rules;
2. identity and explicit adult presentation;
3. biography, origin, values and contradictions;
4. personality intensities;
5. communication style;
6. roles, skills and boundaries;
7. knowledge focus and uncertainty rule;
8. embodiment and stable appearance;
9. fictional family lore;
10. active scenario;
11. relationship preferences.

Realtime then appends language, conversation/adult/expression mode, privacy and permitted memory. LAURA additionally receives its built-in detailed style prompt. This exception is allowed for the seeded system character; user profiles remain data-defined.

## Scenarios

A scenario belongs to one character and can temporarily modify role instructions, goals, tone, knowledge or appearance context. It is selected by `scenario_id` at session start and never writes changes back into the character. Scenario deletion does not alter the base profile.

## Memory scopes

- `global_user`: explicit user facts allowed for all characters, such as name, language and a pet. Existing pre-migration memories become global so they remain available.
- `character_relationship`: facts and inside context visible only to the matching `device_id + character_id`.

A session loads global facts plus relationship facts for its selected character. It never queries another character's relationship scope. No-save mode blocks storage of the current transcript and automatic inference, but does not hide facts that the user explicitly saved earlier.

## Duplication and deletion

Duplication copies structured profile data and scenarios into a new draft with a new ID. It does not copy relationship rows, memories, session snapshots or conversation history. PostgreSQL foreign keys remove character-specific relationship/scenario/memory data when a user character is deleted; global user facts remain.

## Session snapshot

At session start the server validates access, loads profile/scenario/relationship/memory, builds the final prompt and stores a snapshot containing character ID/name/version, structured persona data, scenario, selected voice/provider and prompt hash. Later edits therefore do not mutate an active or historical session definition. Secrets and raw audio are excluded.

## Automatic character generation

Profile generation is a normal text-model task configured independently with `CHARACTER_GENERATION_PROVIDER` and `CHARACTER_GENERATION_MODEL`. It never opens a paid realtime voice session.

Modes:

- `surprise_me`: minimal constraints;
- `guided`: role, traits, interests, language and creativity hints;
- `complete_missing`: preserve every non-empty manual field and fill gaps only.

The provider must return JSON matching the structured generation schema. The service validates the result with the same profile validator as manual creation and attempts one structured repair after invalid output. It supports up to three variants and section regeneration at API level. Generated results contain `saved: false`; the browser populates an editable draft and creates database records only after explicit Save. Failed generation never clears the existing form.

The initial adapter uses Gemini `gemini-2.5-flash`; tests inject a free deterministic provider. The abstraction can add another text provider without affecting Grok/Gemini realtime selection.

## Adding fields or system characters

Add a field to the normalizer, repository mapping/migration and prompt builder only if it changes behavior. Avatar-renderer-only fields stay outside the prompt. A new system character receives a stable UUID and idempotent migration seed; protected core profiles are updated by migrations, not through a user's editor.

## Current limitations

- Temporary device identity is not authentication.
- The browser editor exposes the most useful MVP fields; the API/schema already retain additional structured fields.
- Section regeneration and three-variant generation exist at API level; richer per-section UI is subsequent polish.
- Animated avatar assets and rendering are explicitly deferred to step 6.
