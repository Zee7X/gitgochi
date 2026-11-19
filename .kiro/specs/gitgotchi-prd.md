# GitGotchi: Product & Business Requirements Document

Feature specs (requirements, design, tasks) live in one folder each:

| Spec | Covers |
|---|---|
| `pet-engine/` | Stats, evolution, death, resurrection (`src/lib/state-machine.ts`) |
| `github-sync/` | GitHub snapshot, pet API, signed webhook |
| `kiro-healer/` | Kiro hooks, MCP server, Summon Kiro diagnosis |
| `haunted-ui/` | Retro handheld, pages, live README badge |
| `accounts/` | Sign in with GitHub, keepers, private repos, personal demo pets, privacy |

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
4. **One pet per repo, cared for by its own team.** Anyone can look, only the repo's collaborators can act, private repos stay private, and nobody's clicks leak into someone else's pet.

### 1.3 Success measures

- Pet state follows a real repository: a webhook event moves the pet of the repo named in the payload.
- A dead pet revives only after a real CI success (or a labelled simulation in a demo).
- A visitor cannot change a pet: actions from anyone who is not a keeper of the repo are refused.
- A private repo's pet answers 404 to anyone outside the repo, and its stored entry is ciphertext.
- Two browsers playing with the same demo pet do not see each other's changes.
- Kiroween requirements met: open source (MIT), `.kiro/` committed (specs, steering, hooks, MCP settings), demo video under 3 minutes.

No latency or PR-count targets are claimed: the app does not open pull requests (see 2.4), and latency has not been measured.

## 2. Product Requirements

### 2.1 Pet model

Four stats and a stage; full rules in `pet-engine/requirements.md`.

- **HP:** CI results (+15 success, -25 failure).
- **Fullness:** commits and merged PRs, decays 1 per hour.
- **Sanity:** open and closed issues, code smells (poop).
- **Stage:** `EGG`, `BABY_GHOST`, `CODE_DEMON`, `ZOMBIE_CORPSE` (HP 0, or starved after 30 days without a push), and the rare `NECROMANCER`: resurrected at least once, then a `CODE_DEMON` for 7 unbroken days. Each resurrection leaves a scar on the sprite.

### 2.2 Functional requirements

| Id | Requirement | Priority | Spec |
|---|---|---|---|
| FR-01 | Retro handheld shell and 4-shade LCD UI with buttons A, B, C | P0 | `haunted-ui` |
| FR-02 | Adopt a GitHub repo: pet seeded from its real CI runs, commits, issues. Public repos without signing in; private repos once the GitGotchi App is installed | P0 | `github-sync`, `accounts` |
| FR-03 | Signed GitHub webhook (`push`, `check_run`, `workflow_run`, `pull_request`, `issues`) routed per repository | P0 | `github-sync` |
| FR-04 | Summon Kiro: read-only diagnosis of real findings plus a prompt, via the app (HEAL) and via MCP (`diagnose_pet`, `/summon-healer`) | P0 | `kiro-healer` |
| FR-05 | Resurrection ritual: a dead pet revives only when the latest CI result is a success | P1 | `pet-engine` |
| FR-06 | Live SVG badge `/api/badge/{owner}/{repo}` | P1 | `haunted-ui` |
| FR-07 | Kiro hooks: poop detector on save, spec-sync on engine changes | P1 | `kiro-healer` |
| FR-08 | MCP server `gitgotchi` with seven tools, including `add_badge` (Kiro writes the badge into your README) | P1 | `kiro-healer` |
| FR-17 | ADD TO README on the pet page: copies the badge and opens the repo's README in GitHub's editor | P1 | `haunted-ui` |
| FR-18 | `NECROMANCER` rare stage and resurrection scars | P1 | `pet-engine` R4.4, R6.10 |
| FR-09 | Personal demo pets: `demo/*` state lives in each browser, never on the server | P0 | `accounts` R7 |
| FR-10 | Sign in with GitHub through the GitGotchi App (read-only permissions) | P0 | `accounts` R1 |
| FR-11 | Keepers: collaborators with push, maintain or admin share one pet per repo; everyone else is read-only | P0 | `accounts` R2 |
| FR-12 | Private repos: visible to readers and keepers only, 404 for everyone else; badge with a rotatable badge key | P0 | `accounts` R3, R5 |
| FR-13 | App webhook for every installed repo, no shared secret | P1 | `accounts` R4 |
| FR-14 | Per-pet hook tokens for the Kiro hook and MCP server | P1 | `accounts` R6 |
| FR-15 | My pets page listing the pets a user keeps or reads | P2 | `accounts` R8 |
| FR-16 | Privacy: minimal data, private entries encrypted, delete on uninstall or DELETE PET, `/privacy` page | P0 | `accounts` R9 |

### 2.3 Non-functional requirements

- No fabricated data: simulated events are labelled, demo pets are labelled, no invented PR numbers or fix lists.
- Keyboard accessible, no horizontal overflow at 390 px.
- Badge must survive GitHub's image proxy (no scripts, no external assets).
- Unauthenticated GitHub quota is 60 requests per hour per IP: a deployed instance needs `GITHUB_TOKEN`. Signed-in requests use the user's or the installation's own quota.
- Least privilege: the GitGotchi App holds read-only repository permissions and never writes to a repo.
- Private data: only stats, counts and event labels are stored; webhook bodies, commit messages, emails, code and issue titles are never stored. Private pet entries are encrypted with AES-256-GCM in the app before they reach Upstash, because Upstash's own encryption at rest is a paid add-on and the free plan is in use. Upstash always uses TLS in transit.
- Private responses carry `Cache-Control: private, no-store` and `noindex`.
- Tokens, session ids, badge keys and hook tokens never appear in responses, logs or error messages; only hashes of badge keys and hook tokens are stored.

### 2.4 Out of scope (decided)

- **Automatic pull requests.** Earlier drafts promised an "Auto-Heal" that opens a draft PR. That was removed: the app diagnoses and Kiro fixes. No code path opens a PR.
- **Write access to repositories.** The GitGotchi App is read-only; GitGotchi never pushes, comments or opens PRs.
- **OAuth App with the `repo` scope.** Rejected for private repos: it grants write access to every private repo the user can reach. A GitHub App limits access to the chosen repos, read-only.
- **One pet per user account.** Considered and dropped: the pet stays tied to one repository, so the README badge shows one shared state.
- **Hiding repo names from the operator.** The operator can see private repo names in request logs and store keys; `/privacy` says so. Keying entries by repo id is optional (`accounts/tasks.md` task 21).

### 2.5 Open work

Tracked as unchecked tasks in each spec's `tasks.md`: accounts (phases 1 to 4 in `accounts/tasks.md`), demo video, blog post, Kiro IDE verification. Production runs at <https://gitgochi.lumelo.my.id> with Upstash Redis.

Submission checklist (the code-level items are in each spec's `tasks.md`):

- [x] Deploy to Vercel with `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` (`docs/DEPLOY.md`), custom domain `gitgochi.lumelo.my.id`
- [x] Persistent store (KV) so pets survive cold starts (`github-sync/tasks.md` task 7)
- [x] Capture `docs/media/*.png` for the README
- [x] Ship accounts (`accounts/tasks.md`), README and `docs/DEPLOY.md` updated; GitHub App `gitgotchi-pet` live, sign-in and app webhook checked on production
- [ ] Check a private repo on production (404 for outsiders, badge with key)
- [ ] Record the demo video, under 3 minutes (`docs/DEMO_SCRIPT.md`), after accounts so it shows sign-in and a private repo
- [ ] Write the first-hand Kiro notes in `docs/KIRO_USAGE.md` (every `TODO(user)`)
- [ ] Publish the blog post / Devpost write-up
- [ ] Submit on Devpost before 4 December 2026
