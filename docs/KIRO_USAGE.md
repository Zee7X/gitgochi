# How Kiro was used

Write-up skeleton for the Devpost "How did you use Kiro?" section. Each answer points at files in this repo. Lines starting with `> TODO(user):` are for first-hand experience from the Kiro IDE stage; they are deliberately empty. Do not submit with a TODO left in.

Status of this document: everything below the TODO lines was verified by reading the repository. Nothing was run inside the Kiro IDE by the author of this text. What was run outside the IDE is stated where it matters.

## Spec-driven development vs vibe coding

**What is in the repo.** Four feature specs in the layout Kiro's spec workflow uses (`requirements.md`, `design.md`, `tasks.md` per folder), plus the product document:

| Spec | Requirements | Design | Tasks |
|---|---|---|---|
| Pet engine | `.kiro/specs/pet-engine/requirements.md` | `.kiro/specs/pet-engine/design.md` | `.kiro/specs/pet-engine/tasks.md` |
| GitHub sync | `.kiro/specs/github-sync/requirements.md` | `.kiro/specs/github-sync/design.md` | `.kiro/specs/github-sync/tasks.md` |
| Kiro healer | `.kiro/specs/kiro-healer/requirements.md` | `.kiro/specs/kiro-healer/design.md` | `.kiro/specs/kiro-healer/tasks.md` |
| Haunted UI | `.kiro/specs/haunted-ui/requirements.md` | `.kiro/specs/haunted-ui/design.md` | `.kiro/specs/haunted-ui/tasks.md` |

`.kiro/specs/gitgotchi-prd.md` is the product and business document.

**How the specs steer the code.** Requirements are written in EARS ("WHEN ... THE SYSTEM SHALL ...") and each one names the test that verifies it, for example `pet-engine/requirements.md` R6 points to properties P5 and P6 in `src/lib/__tests__/state-machine.test.ts`. The `spec-sync` hook (`.kiro/hooks/spec-sync.json`) asks Kiro to compare `src/lib/state-machine.ts` with `.kiro/specs/pet-engine/` every time the engine is saved, and `.kiro/steering/kiro-integration.md` tells the agent to change the spec first, then the code.

**A concrete case where the spec changed the product.** The first PRD promised an "Auto-Heal" button that would open a draft pull request. That had no honest implementation (the first version faked the result), so the PRD now says it is out of scope (`gitgotchi-prd.md` section 2.4) and the feature became Summon Kiro: a read-only diagnosis that hands Kiro a prompt (`kiro-healer/requirements.md` R5).

> TODO(user): Describe, in your own words, how you actually ran the spec workflow in the Kiro IDE: Requirements-First or Design-First, what you changed after the first draft, and what Kiro got wrong that the review step caught.

> TODO(user): Compare with vibe coding on this project. Which parts did you build conversationally (for example the pixel sprites in `src/components/lcd/pixel-maps.ts`, the badge), which parts needed a spec (the state machine), and what the difference felt like. Give one concrete example each.

> TODO(user): Add a screenshot of the Specs panel with the four specs and the task progress, saved as `docs/media/kiro-specs.png`.

## Agent hooks

**Hooks in the repo** (schema `version: "v1"`, trigger `PostFileSave`, per <https://kiro.dev/docs/hooks/>):

- `.kiro/hooks/poop-detector.json`: on save of a `.ts`/`.tsx` file under `src/` runs `node scripts/poop-detector.mjs "{{filePath}}"`. The script scans for `console.log(`, `debugger`, `TODO:` and `FIXME`, then POSTs to `/api/local-poop` (`src/app/api/local-poop/route.ts`). A smell adds a poop to the pet (event source `kiro-hook`, label like `console.log in src/x.ts`); saving the file clean removes it. If the app is down the script prints one line and exits 0, so it never blocks Kiro.
- `.kiro/hooks/spec-sync.json`: an agent hook that checks the engine against its spec and runs `npm test`.

**What was verified outside the IDE.** The script was run by hand against a local dev server: a dirty file gave poop 1 with the label `console.log in src/...` and source `kiro-hook`, saving the same dirty file again did not count twice, a clean save returned 200, and a request with a spoofed `x-forwarded-for` got 403. The route is also covered by `src/lib/__tests__/local-poop.test.ts`.

**What was not verified.** That Kiro substitutes `{{filePath}}` as expected and which key the stdin JSON uses are not named in Kiro's docs; the script falls back to `KIRO_HOOK_FILE` and several stdin keys (`scripts/poop-detector.mjs`). The script gives up after 3 seconds, so the first save against a cold `next dev` is skipped: open the app once before editing.

**Design note.** Kiro v1 hooks have no manual trigger, so the on-demand "summon" entry point is a manual steering file (`.kiro/steering/summon-healer.md`, run as `/summon-healer`), not a hook.

> TODO(user): Say what the hooks felt like in the IDE: did the poop appear within a second of the agent saving? Did the hook fire on your own manual saves or only on the agent's? Did `{{filePath}}` work? What did the hooks catch that you would have missed?

> TODO(user): Add a short screen recording or screenshot of the hook making the pet poop (for example `docs/media/hook-poop.png`).

## Steering strategy

| File | Inclusion | Why |
|---|---|---|
| `.kiro/steering/retro-aesthetic.md` | default (always) | Keeps every UI change inside the 4-shade green LCD palette, the pixel font and the purple shell |
| `.kiro/steering/architecture.md` | default (always) | Keeps the stack lean (native first, no new dependencies) and documents the project tree |
| `.kiro/steering/kiro-integration.md` | `inclusion: always` | Documents how hooks, MCP and the API fit together and forbids fabricated results ("report only what a tool, test or command actually returned") |
| `.kiro/steering/summon-healer.md` | `inclusion: manual` | The `/summon-healer` workflow: diagnose, spec first, fix, `npm test`, report honestly |

The "never fabricate" rule exists because an early version of the heal feature invented PR numbers and fix lists. It is in steering so any agent working in the repo inherits it.

> TODO(user): Describe which steering file changed Kiro's behaviour most, with one before/after example, and whether you would split or merge any of these files.

## MCP

- Server: `mcp-server/index.mjs` (stdio, `@modelcontextprotocol/sdk`), started with `node mcp-server/index.mjs` or `npm run mcp`.
- Registered in `.kiro/settings/mcp.json` as `gitgotchi`, with `GITGOTCHI_URL` and `autoApprove` limited to the two read-only tools `get_pet_status` and `diagnose_pet`.
- Tools: `get_pet_status` (ASCII LCD of the pet), `diagnose_pet` (real findings plus a Kiro prompt), `feed_pet`, `clean_pet`, `simulate_event` (refuses anything but `demo/*`), `adopt_pet`.
- Every tool is a thin HTTP call to the running app; the server computes nothing.

**What was verified outside the IDE.** `initialize` and `tools/list` returned the six tools against a dev server, and `get_pet_status` rendered the ASCII LCD. `diagnose_pet` and the GitHub calls behind it are covered by `src/lib/__tests__/heal.test.ts` with a mocked `fetch`; they were not run against live GitHub (the unauthenticated quota was exhausted during development).

> TODO(user): Confirm `gitgotchi` shows as connected in Kiro's MCP panel. Describe the Summon Kiro flow as you ran it: break CI or add a `console.log`, run `/summon-healer` (or ask for `diagnose_pet`), what Kiro found, what it changed, and whether `npm test` passed. Record only what really happened.

> TODO(user): Add a screenshot of the MCP tool call and the diagnosis in Kiro chat (`docs/media/kiro-mcp.png`).

## Property-based testing

The pet engine is tested with `fast-check` (`src/lib/__tests__/state-machine.test.ts`, `describe('properties')`) over random event sequences and random time gaps:

| Id | Property |
|---|---|
| P1 | HP, Fullness, Sanity stay integers in 0..100, poop in 0..5, at most 5 CI results kept |
| P2 | HP 0 implies zombie; a zombie with HP above 0 starved; `diedAt` is set exactly when zombie |
| P3 | `tick` is idempotent for the same `now` |
| P4 | `tick` never raises Fullness |
| P5 | `resurrections` grows only by 1 and only when the pet was dead |
| P6 | the `revive` action never changes a living pet |

These are referenced from `.kiro/specs/pet-engine/requirements.md` so each requirement names the property that checks it. Run them with `npm test`.

> TODO(user): Open `.kiro/specs/pet-engine/` in Kiro's Correctness view (property-based testing, IDE only) and report what it extracted from the EARS requirements, any property it proposed that is missing here, and any counterexample it found. If you did not use it, delete this paragraph and say so.

## Powers

`power-gitgotchi/` packages the MCP server and the `summon-healer` skill as a Kiro Power in the Agent Plugins 1.0.0 format (`plugin.json`, `mcp.json`, `skills/summon-healer/SKILL.md`). The server is a single-file bundle (`npm run build:power`) because an imported Power has no `node_modules` and `mcp.json` may only use a `cwd` inside the Power folder. Hooks are not part of the Power format, so the poop-detector and spec-sync hooks stay in `.kiro/hooks/`.

Checked on 19 November 2026 outside the IDE: `power.test.ts` validates both manifests against the schema fields and starts the bundle over stdio, which lists the same six tools as `mcp-server/index.mjs`.

> TODO(user): Import it in Kiro (Powers panel, Add Custom Power, Import power from a folder, `power-gitgotchi/`) and describe the result: did the server connect, and did the keywords activate it?

## What I would tell another builder

> TODO(user): Three to five lines of honest advice from the Kiro stage: what to spec, what not to, which Kiro feature paid off most for this project and which did not.

## Checklist before submitting

- [ ] Every `TODO(user)` above is answered or deleted
- [ ] Screenshots added under `docs/media/` and linked
- [ ] Claims re-checked against the repo (`npm test` green, hooks fire in the IDE)
