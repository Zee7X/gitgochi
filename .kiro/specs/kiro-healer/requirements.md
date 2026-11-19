# Kiro Healer: Requirements

How Kiro touches GitGotchi: hooks that report code smells, an MCP server that exposes the pet, and a read-only "Summon Kiro" diagnosis that hands a prompt to the agent.
Code: `.kiro/hooks/`, `scripts/poop-detector.mjs`, `mcp-server/index.mjs`, `.kiro/settings/mcp.json`, `.kiro/steering/summon-healer.md`, `src/lib/heal.ts`, `src/app/api/auto-heal/route.ts`, `src/app/api/local-poop/route.ts`. Design: `design.md`.

## Glossary

- **Hook**: a Kiro v1 hook (`version: "v1"`, trigger `PostFileSave`) in `.kiro/hooks/*.json`.
- **Poop**: a code smell reported by the hook: `console.log`, `debugger`, `TODO:` or `FIXME`.
- **Diagnosis**: `HealDiagnosis` (`src/lib/types.ts`), a list of real findings plus a prompt for Kiro.

## Requirements

### R1. Poop detector hook

**User story:** As a developer, I want my pet to get dirty when I leave debugging code behind, so I clean up before committing.

Acceptance criteria:
1. WHEN Kiro's agent saves a `.ts` or `.tsx` file under `src/`, THE SYSTEM SHALL run `node scripts/poop-detector.mjs` with the file path.
2. WHEN the file contains `console.log(`, a `debugger` statement, `TODO:` or `FIXME`, THE SYSTEM SHALL POST the smell flags to `POST /api/local-poop`.
3. WHEN the saved file has no smell, THE SYSTEM SHALL POST `clean: true`, which removes that file's poop only (pet-engine R9).
4. WHEN the file was deleted, THE SYSTEM SHALL treat it as clean.
5. IF the app is not reachable, THEN THE SYSTEM SHALL print one line and exit 0, so the hook never blocks Kiro.
6. THE SYSTEM SHALL read the file path from argv (`{{filePath}}`), then `KIRO_HOOK_FILE`, then stdin JSON.

Verified by: `src/lib/__tests__/local-poop.test.ts` (route); the script itself was run by hand against a live dev server (see `docs/KIRO_USAGE.md`).

### R2. Local poop endpoint

**User story:** As a maintainer, I want only my own editor to be able to dirty the pet.

Acceptance criteria:
1. WHEN `POST /api/local-poop` receives a smell for a file with no outstanding poop, THE SYSTEM SHALL add one poop event with source `kiro-hook` and label `<smell> in <file>`.
2. WHEN the same dirty file is saved again, THE SYSTEM SHALL NOT add a second poop.
3. WHEN a clean file that had an outstanding poop is reported, THE SYSTEM SHALL remove that file's poop with the per-file rule of pet-engine R9 (Poop -1, Sanity +12, a `clean` event labelled `clean after <file>`) and leave other files' poop in place.
4. IF the caller is not on localhost and has no valid `Authorization: Bearer $GITGOTCHI_HOOK_TOKEN`, THEN THE SYSTEM SHALL answer 403.
5. IF `filePath` is missing or the repo key is invalid, THEN THE SYSTEM SHALL answer 400.
6. THE SYSTEM SHALL strip control characters from `filePath` and cap it at 200 characters.
7. WHEN `repo` is not given, THE SYSTEM SHALL use `GITGOTCHI_REPO`, then `demo/healthy`.

Verified by: `src/lib/__tests__/local-poop.test.ts`.

### R3. Spec-sync hook

**User story:** As a maintainer, I want Kiro to check the engine against its spec whenever I change it.

Acceptance criteria:
1. WHEN `src/lib/state-machine.ts` is saved, THE SYSTEM SHALL start an agent hook that compares the change with `.kiro/specs/pet-engine/` and runs `npm test`.
2. THE SYSTEM SHALL tell the agent to report the real test result and never claim a pass it did not run.

Verified by: `.kiro/hooks/spec-sync.json` (read by Kiro; no automated test).

### R4. MCP server

**User story:** As a developer working in Kiro, I want to ask my pet questions from chat without leaving the editor.

Acceptance criteria:
1. THE SYSTEM SHALL provide a stdio MCP server `gitgotchi` (`mcp-server/index.mjs`, `npm run mcp`), registered in `.kiro/settings/mcp.json`.
2. THE SYSTEM SHALL expose the tools `get_pet_status`, `diagnose_pet`, `feed_pet`, `clean_pet`, `simulate_event`, `adopt_pet` and `add_badge`.
3. THE SYSTEM SHALL implement every tool except `add_badge` as a call to the running app over `GITGOTCHI_URL` (default `http://localhost:3000`) and compute nothing itself.
4. IF the app is not reachable, THEN THE SYSTEM SHALL return a tool error that says how to start it.
5. WHEN `simulate_event` targets a repo that is not `demo/*`, THE SYSTEM SHALL refuse.
6. THE SYSTEM SHALL auto-approve only the read-only tools `get_pet_status` and `diagnose_pet`.
7. WHEN `add_badge` is called, THE SYSTEM SHALL write the badge markdown into the README of the current workspace (joining the first badge row near the top, else below the first `# ` title, else at the top), keep the file's line endings, and SHALL NOT commit.
8. IF the README already has a GitGotchi badge for that repo, THEN `add_badge` SHALL change nothing. IF the README path is outside the workspace, or the badge URL would point at localhost, THEN it SHALL refuse with a message saying what to set.

Verified by: MCP `initialize` and `tools/list` smoke run by hand (see `docs/KIRO_USAGE.md`). No automated test.

### R5. Summon Kiro (diagnosis)

**User story:** As a developer with a dead pet, I want one click to find out what is wrong and get a prompt that makes Kiro fix it.

Acceptance criteria:
1. WHEN `POST /api/auto-heal` receives `{ repo }`, THE SYSTEM SHALL answer `{ success: true, diagnosis }` built from live GitHub data and what the pet already recorded.
2. THE SYSTEM SHALL report only findings backed by data: a failing latest CI run (with the run URL), up to 3 open issues idle for over 30 days (with URLs), up to 5 code smells that are still on screen, and a hunger finding after 2 days without a push.
3. WHEN GitHub is unreachable, THE SYSTEM SHALL fall back to the pet's own data. WHEN the repo is `demo/*`, THE SYSTEM SHALL NOT call GitHub.
4. WHEN there is nothing to fix, THE SYSTEM SHALL say so and the prompt SHALL tell Kiro not to change files.
5. THE SYSTEM SHALL NOT open pull requests, edit the repository or change pet stats. The prompt SHALL ask for a spec-first fix, `npm test`, and an honest report.
6. IF `repo` is not `owner/repo`, THEN THE SYSTEM SHALL answer 400.

Verified by: `src/lib/__tests__/heal.test.ts`.

### R6. On-demand healing in Kiro

**User story:** As a developer, I want to start the heal from Kiro chat.

Acceptance criteria:
1. WHEN the user types `/summon-healer`, THE SYSTEM SHALL load `.kiro/steering/summon-healer.md` (`inclusion: manual`), which tells Kiro to call `diagnose_pet`, check the matching spec, fix, run `npm test` and report only what it ran.
2. Rationale: Kiro v1 hooks have no manual trigger, so a manual steering file is the on-demand entry point.

### R7. Resurrection stays honest

**User story:** As a judge, I want the resurrection to be earned, not faked.

Acceptance criteria:
1. THE SYSTEM SHALL revive a dead pet only through a real or labelled-simulated CI success (see `../pet-engine/requirements.md` R6).
2. THE SYSTEM SHALL label simulated events `simulated`.
