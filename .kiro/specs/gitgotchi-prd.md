# GitGotchi: Product & Business Requirements Document

Feature specs (requirements, design, tasks) live in one folder each:

| Spec | Covers |
|---|---|
| `pet-engine/` | Stats, evolution, death, resurrection (`src/lib/state-machine.ts`) |
| `github-sync/` | GitHub snapshot, pet API, signed webhook |
| `kiro-healer/` | Kiro hooks, MCP server, Summon Kiro diagnosis |
| `haunted-ui/` | Retro handheld, pages, live README badge |

## 1. Business Requirements

- **Project:** GitGotchi (The Repo-Necromancer)
- **Hackathon:** Kiroween 2026, deadline 4 December 2026
- **Category:** Resurrection (revives the 90s virtual pet as a live view of repository health)

### 1.1 Problem

1. **Alert fatigue.** Developers ignore linter errors, failing CI and stale issues because a wall of text or email is easy to tune out.
2. **Abandoned repositories.** Code quality drops without anyone noticing until the repo is dead.

### 1.2 Objectives

1. **Make maintenance visible and a little fun.** A pet whose health is the repo's health: green CI feeds it, red CI hurts it, neglect kills it.
2. **Shorten the path from "something is wrong" to "Kiro is fixing it".** The Summon Kiro diagnosis lists the real findings and hands Kiro a prompt; Kiro does the fix in the workspace, with tests.
3. **Spread through the README.** A live SVG badge shows the pet in any GitHub README.

### 1.3 Success measures

- Pet state follows a real repository: a webhook event moves the pet of the repo named in the payload.
- A dead pet revives only after a real CI success (or a labelled simulation in a demo).
- Kiroween requirements met: open source (MIT), `.kiro/` committed (specs, steering, hooks, MCP settings), demo video under 3 minutes.

No latency or PR-count targets are claimed: the app does not open pull requests (see 2.4), and latency has not been measured.

## 2. Product Requirements

### 2.1 Pet model

Four stats and a stage; full rules in `pet-engine/requirements.md`.

- **HP:** CI results (+15 success, -25 failure).
- **Fullness:** commits and merged PRs, decays 1 per hour.
- **Sanity:** open and closed issues, code smells (poop).
- **Stage:** `EGG`, `BABY_GHOST`, `CODE_DEMON`, `ZOMBIE_CORPSE` (HP 0, or starved after 30 days without a push).

### 2.2 Functional requirements

| Id | Requirement | Priority | Spec |
|---|---|---|---|
| FR-01 | Retro handheld shell and 4-shade LCD UI with buttons A, B, C | P0 | `haunted-ui` |
| FR-02 | Adopt any public GitHub repo: pet seeded from its real CI runs, commits, issues; demo pets for `demo/*` | P0 | `github-sync` |
| FR-03 | Signed GitHub webhook (`push`, `check_run`, `workflow_run`, `pull_request`, `issues`) routed per repository | P0 | `github-sync` |
| FR-04 | Summon Kiro: read-only diagnosis of real findings plus a prompt, via the app (HEAL) and via MCP (`diagnose_pet`, `/summon-healer`) | P0 | `kiro-healer` |
| FR-05 | Resurrection ritual: a dead pet revives only when the latest CI result is a success | P1 | `pet-engine` |
| FR-06 | Live SVG badge `/api/badge/{owner}/{repo}` | P1 | `haunted-ui` |
| FR-07 | Kiro hooks: poop detector on save, spec-sync on engine changes | P1 | `kiro-healer` |
| FR-08 | MCP server `gitgotchi` with six tools | P1 | `kiro-healer` |

### 2.3 Non-functional requirements

- No fabricated data: simulated events are labelled, demo pets are labelled, no invented PR numbers or fix lists.
- Keyboard accessible, no horizontal overflow at 390 px.
- Badge must survive GitHub's image proxy (no scripts, no external assets).
- Unauthenticated GitHub quota is 60 requests per hour per IP: a deployed instance needs `GITHUB_TOKEN`.

### 2.4 Out of scope (decided)

- **Automatic pull requests.** Earlier drafts promised an "Auto-Heal" that opens a draft PR. That was removed: the app diagnoses and Kiro fixes. No code path opens a PR.
- **Accounts and OAuth.** Public repos only.

### 2.5 Open work

Tracked as unchecked tasks in each spec's `tasks.md`: persistent storage (KV), deploy, demo video, blog post, Kiro IDE verification.

Submission checklist (the code-level items are in each spec's `tasks.md`):

- [ ] Deploy to Vercel with `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` (`docs/DEPLOY.md`)
- [ ] Persistent store (KV) so pets survive cold starts (`github-sync/tasks.md` task 7)
- [ ] Capture `docs/media/*.png` for the README
- [ ] Record the demo video, under 3 minutes (`docs/DEMO_SCRIPT.md`)
- [ ] Write the first-hand Kiro notes in `docs/KIRO_USAGE.md` (every `TODO(user)`)
- [ ] Publish the blog post / Devpost write-up
- [ ] Submit on Devpost before 4 December 2026
