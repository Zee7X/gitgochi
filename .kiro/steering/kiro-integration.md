---
inclusion: always
---

# Kiro integration

How Kiro is wired into GitGotchi. Keep this true; if you change a hook, tool or route, update this file.

## Pieces

- Specs (`.kiro/specs/`) define behaviour. Change the spec first, then the code.
- Hooks (`.kiro/hooks/*.json`, schema `version: "v1"`):
  - `poop-detector`: `PostFileSave` on `src/**/*.ts(x)` runs `node scripts/poop-detector.mjs`. It scans for `console.log`, `debugger`, `TODO:` and `FIXME`, then POSTs to `/api/local-poop`. A clean file POSTs `clean: true`, which removes that file's poop only (Poop -1, Sanity +12); other files keep theirs, and the CLEAN button still clears everything. If the app is down it prints one line and exits 0.
  - `spec-sync`: `PostFileSave` on `src/lib/state-machine.ts` asks the agent to check the change against `.kiro/specs/pet-engine/` and run `npm test`.
  - On-demand healing is the manual steering file `summon-healer.md` (type `/summon-healer`), because v1 hooks have no manual trigger.
- MCP (`.kiro/settings/mcp.json`): server `gitgotchi` (`mcp-server/index.mjs`, stdio). Tools: `get_pet_status`, `diagnose_pet`, `feed_pet`, `clean_pet`, `simulate_event` (demo repos only), `adopt_pet`. All of them call the running app over `GITGOTCHI_URL` (default `http://localhost:3000`), so start `npm run dev` first.
- Power (`power-gitgotchi/`): the same MCP server as a bundled file plus the `summon-healer` skill. Rebuild the bundle with `npm run build:power` after editing `mcp-server/index.mjs`; `power.test.ts` fails when the bundle is stale.

## Never fabricate

- Report only what a tool, test or command actually returned. No invented PR numbers, URLs, fix lists or "tests pass".
- Anything simulated is labelled `simulated` (events carry `simulated: true`).
- "Summon Kiro" diagnoses and writes a prompt. It does not open PRs or edit the repo by itself; the fix is done by you, in this workspace, with tests.

## Pet API contract

- Repo key: lowercase `owner/repo`; `demo/<name>` repos never call GitHub.
- `GET /api/pet/{owner}/{repo}` and `POST /api/pet/{owner}/{repo}/action` (`feed | clean | revive | sync | simulate`) return `{ pet, events, source, fetchedAt, error? }`.
- `POST /api/local-poop` takes `{ filePath, hasConsoleLog, hasTodo, hasDebugger, repo?, clean? }`. Accepted from localhost, or with `Authorization: Bearer $GITGOTCHI_HOOK_TOKEN` when that variable is set.
- `POST /api/auto-heal` takes `{ repo }` and returns `{ success, diagnosis }`.

## Environment

`GITGOTCHI_URL`, `GITGOTCHI_REPO` (repo key the hook reports to; falls back to the git `origin`, then `demo/healthy` on the server), `GITGOTCHI_HOOK_TOKEN`, `GITHUB_TOKEN`.
