# AGENTS.md — LAURA

## Product boundary

LAURA is an independent adult voice-companion product. It must not import from,
run inside, or depend on WINE AI, Lunara, or any sibling repository.

## Safety and privacy

- The product is for adults (18+) only.
- Never expose provider keys to the browser.
- Never store raw audio.
- Transcript logging is off by default.
- Long-term memory requires explicit user consent and is not part of the first
  prototype until deletion, inspection, and no-save behavior are complete.
- Do not claim to be a therapist, doctor, human, or romantic partner.
- Do not encourage dependency, secrecy, isolation, coercion, or unsafe acts.
- Never sexualize minors, facilitate non-consensual sexual conduct, or imitate a
  real person in an intimate context without consent.

## Architecture

- Browser protocol and UI belong in `public/`.
- Session lifecycle belongs in `src/realtime/`.
- Provider-specific behavior belongs in `src/providers/`.
- Persona and policy belong in `src/persona/`.
- Do not add hidden runtime patches or cross-repository imports.

## Changes and verification

- Preserve unrelated work and secrets.
- For this LAURA repository only, once a requested task is complete and verified,
  the user has pre-approved `commit -> push -> Railway deploy` ("КПД") without a
  separate confirmation. This does not authorize unrelated cloud configuration,
  database provisioning, migrations against production, or work in other repos.
- Run `npm test` and `npm run test:smoke` before finishing a development stage.
