# GitGotchi: the Repo-Necromancer

GitGotchi is a 90s-style virtual pet whose health is the health of a GitHub repository. You adopt a repo, public or private, and the pet reads its CI runs, pushes, merged pull requests and issues. Passing builds and fresh commits keep the pet well. Failing builds hurt it, and a repo that nobody pushes to starves it. A dead pet climbs out of the grave when the repo shows life again: a passing CI run, a new push or a closed issue.

**Kiroween 2026 entry, category Resurrection.** The handheld virtual pet of the late 90s returns as a live view of repo health, and the pet itself rises from the dead when its repo does.

- **Live app:** <https://gitgochi.lumelo.my.id/> (demo pet: <https://gitgochi.lumelo.my.id/pet/demo/healthy>)
- **Demo video:** not published yet. <!-- TODO(video): add the YouTube link here (video under 3 minutes) -->
- **Repository:** <https://github.com/Zee7X/gitgochi>
- **License:** MIT, see [LICENSE](LICENSE)

[![GitGotchi](https://gitgochi.lumelo.my.id/api/badge/zee7x/gitgochi)](https://gitgochi.lumelo.my.id/pet/zee7x/gitgochi)

The project was built with Kiro. The `.kiro/` folder at the repository root holds the specs, hooks, steering files and MCP settings. See [How Kiro was used](#how-kiro-was-used) and [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md).

![The GitGotchi home page: the handheld shows the demo/healthy pet as a Code Demon, next to the adopt form and the four demo pets](docs/media/hero.png)

## The problem

Failing CI runs and stale issues usually arrive as notifications, and people learn to tune them out. A repo can also go quiet for months before anyone notices that it has been abandoned.

**Who it is for:** maintainers of side projects and small teams who want one glance (or one README badge) to say whether a repo is alive, and open-source visitors who want to know if a project is still cared for before they depend on it.

GitGotchi shows that state as a pet. A sick or dead pet on the project page, or in the README badge, is harder to ignore than another email. The REVIVE button does not help either: the server answers `FIX CI FIRST` until the latest CI run is green.

## How it differs

Pets fed by commits are not new: [cli-pet](https://dev.to/depapp/i-built-a-tamagotchi-that-judges-your-github-activity-and-its-brutally-honest-oh1) lives in the terminal and eats your GitHub activity, [Repogotchi](https://github.com/peclarke/repogotchi) (a 2022 hackathon project) keeps a pet alive with commits, and [code-tamagotchi](https://github.com/davidfrid02/code-tamagotchi) and [terminal-pet](https://github.com/apoorvgarg31/terminal-pet) feed a pet from your editor or shell. GitGotchi differs in four ways:

| | Commit pets above | GitGotchi |
|---|---|---|
| Whose pet | One per developer | One per **repository**, shared by everyone with push access; visitors can only look |
| Who sees it | The developer, in a terminal or editor | **Everyone who opens the repo**, through a live README badge (animated, works through GitHub's image proxy) |
| Coming back from the dead | A commit revives it | A **ritual tied to a real fix**: REVIVE is refused while CI is red, a revived pet rises as a ghost for a day, each comeback leaves a scar, and a week of health after it earns the rare `NECROMANCER` |
| What happens when it is sick | Nothing beyond the pet | **Kiro closes the loop**: a Kiro hook reports code smells as poop, Summon Kiro hands Kiro the failing CI log and stale issues, Kiro fixes the code, CI turns green and the pet climbs out of the grave |

It also works for private repos, through a read-only GitHub App with encrypted storage.

## What it does

- **Adopt any GitHub repo.** Type `owner/repo` or paste a GitHub URL. Public repos work without signing in; private repos work once the GitGotchi App is installed on them. The pet is seeded from the recent completed CI runs on the default branch, the commit count, the last push and the number of stale issues (open issues with no update for 30 days).
- **One pet per repo, cared for by its team.** Sign in with GitHub. Collaborators with push access (keepers) share the repo's pet and can feed, clean and revive it; everyone else can only look. A private repo's pet is visible only to people with access to the repo.
- **Live updates.** Installing the GitGotchi App on a repo feeds the pet from pushes, completed check runs or workflow runs, merged pull requests and issues, with no secret to copy. Without it, the app re-reads GitHub on the first request after its 5-minute cache expires. The pet page polls every 15 seconds, slowing to 2 minutes while nothing changes, and only while the tab is visible.
- **Pixel-art handheld.** A translucent purple shell holds a 4-shade green LCD with buttons A, B and C. The pet has four everyday stages, `EGG`, `BABY_GHOST`, `CODE_DEMON` and `ZOMBIE_CORPSE`, and the rare `NECROMANCER` for a repo that died, came back and stayed healthy for a week. Every resurrection leaves a scar on the sprite. All sound is synthesized with the Web Audio API, and the repo contains no audio files.
- **Live README badge.** `/api/badge/{owner}/{repo}` returns an SVG of the pet with no scripts and no external fonts or images.
- **Kiro integration.** A hook makes the pet poop when a saved file under `src/` contains `console.log`, `debugger`, `TODO:` or `FIXME`. An MCP server answers questions about the pet from Kiro chat. **Summon Kiro** builds a read-only diagnosis of what is wrong with the repo and a prompt that Kiro can act on.
- **Labelled demo data.** Demo pets carry a `DEMO PET` tag, and every simulated event is tagged `simulated`. Each browser keeps its own demo pets, so nobody sees what others clicked. The app never opens pull requests and never claims a fix it did not make.
- **Privacy.** Only stats, counts and event labels are stored, never code, commit messages, emails or issue titles. Private pets are encrypted before they reach the store. Details on [`/privacy`](https://gitgochi.lumelo.my.id/privacy).

| Dead pet on `/pet/demo/haunted` | Summon Kiro diagnosis | Live README badges from `/api/badge` |
|---|---|---|
| ![The demo/haunted pet as a zombie on its tombstone, with stats, event log and simulator](docs/media/zombie.png) | ![The Summon Kiro modal listing a failing CI finding, a hunger finding and the Kiro prompt](docs/media/summon-kiro.png) | ![Badges for demo/healthy (Code Demon), demo/necromancer (the rare stage, with two resurrection scars) and demo/haunted (tombstone)](docs/media/badge.png) |

## Quick start

Requirements: Node.js 22 or newer.

```bash
git clone https://github.com/Zee7X/gitgochi.git
cd gitgochi
npm install
cp .env.example .env.local   # optional for the demo pets
npm run dev
```

Open `http://localhost:3000`. The handheld on the home page shows `demo/healthy`. To adopt a real repo, type `owner/repo` or paste a GitHub URL into the adopt form. The app then opens `/pet/{owner}/{repo}`.

> **Set `GITHUB_TOKEN` before adopting real repos.** Without a token, GitHub allows 60 requests per hour per IP, and one repo snapshot costs 4 requests. When the quota runs out, the API answers `github rate limit reached` (HTTP 503). A fine-grained token with read-only access to public repositories and no extra permissions raises the limit to 5000 requests per hour. Put it in `.env.local`. Demo repos never call GitHub.

### Controls

| Button | Key | Action |
|---|---|---|
| A | Left arrow | Next menu item |
| B | Enter | Run the selected item |
| C | Esc | Show or hide stats |

A living pet has the menu `FEED`, `CLEAN`, `HEAL`, `STATS`. A dead pet has `REVIVE` and `HEAL`. On a real repo, `FEED`, `CLEAN`, `REVIVE` and SYNC NOW need a keeper; visitors get a hint to sign in.

## Demo pets

Demo repos (`demo/<name>`) are built from fixtures in `src/lib/demo-fixtures.ts`. They never call GitHub, and their state lives in your browser's `localStorage`, not on the server, so your clicks never reach anyone else. The simulator panel sends labelled fake events (CI pass, CI fail, push, PR merged, issue opened, issue closed, poop) through the same rules as the server (`src/lib/pet-logic.ts` on top of `src/lib/state-machine.ts`). RESET DEMO reloads the fixture. The demo badge always shows the fixture.

| Page | Fixture | Result |
|---|---|---|
| `/pet/demo/healthy` | 5 passing CI runs, last push 2 hours ago | `CODE_DEMON`, happy |
| `/pet/demo/neglected` | 3 failing runs in a row, last push 80 hours ago, 6 stale issues | `BABY_GHOST`, sick |
| `/pet/demo/haunted` | 5 failing runs in a row, last push 9 days ago, 12 stale issues | `ZOMBIE_CORPSE` |
| `/pet/demo/necromancer` | Resurrected twice, healthy for 8 days, 5 passing runs | `NECROMANCER`, with 2 scars |

## How the pet works

The rules are in `src/lib/state-machine.ts` and specified in `.kiro/specs/pet-engine/`. HP, Fullness and Sanity are integers from 0 to 100.

| Trigger | Effect |
|---|---|
| Push | +5 Fullness per commit, at most +20 per push |
| CI run completed | `success`: +15 HP. `failure`: -25 HP |
| Pull request merged | +20 Fullness, +10 HP, +10 Sanity, party mood for 1 hour |
| Issue opened / closed | -5 / +10 Sanity |
| Code smell reported by the Kiro hook | +1 poop (at most 5), -10 Sanity |
| FEED | +10 Fullness, at most 3 times per hour |
| CLEAN | Removes all poop, +12 Sanity per poop removed |
| Time | -1 Fullness per hour. While any poop is on screen, -5 HP at each UTC midnight |

Stages:

- `EGG`: fewer than 5 commits, and the pet has never been resurrected.
- `CODE_DEMON`: HP at least 80, Sanity at least 70, Fullness at least 50, no failure in the last 3 CI results, and not rising (see below).
- `NECROMANCER` (rare): a pet that has died and come back at least once, then stayed a `CODE_DEMON` for 7 days without a break. Any break (red CI, hunger, low sanity) drops it back and the week starts over. The stats card counts down the time left.
- `BABY_GHOST`: every other living pet.
- `ZOMBIE_CORPSE`: HP 0, or Fullness 0 with the last push 30 or more days ago.

Every resurrection leaves a stitch on the sprite, up to 3, so a pet that has been through the grave looks it.

A pet back from the dead is **rising**: it stays a `BABY_GHOST`, whatever its stats, until 24 hours have passed **and** a new push or a green CI run arrived after it came back. The stats card shows what is still missing. This keeps a revived repo from jumping straight to `CODE_DEMON` on the first resync.

A dead pet ignores every event except a passing CI run, a closed issue or a push. Any of those brings it back with 50 HP, 50 Fullness and 60 Sanity. The REVIVE button does the same, but only when the latest recorded CI result is a success. Otherwise the server answers HTTP 409 and the LCD shows `FIX CI FIRST`.

When a real repo is seeded, HP starts at 100 and replays the fetched CI runs (+15 or -25 each). A repo with no runs gets 70 HP, shown as `? NO CI`: health is not measured, and since `CODE_DEMON` needs HP 80, a repo needs green CI to become a demon. Fullness is 100 minus the hours since the last push. Sanity drops by 10 per stale issue, counting at most 10 issues.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local`. All variables are optional for the demo pets.

| Variable | Used by | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | `src/lib/github.ts`, `src/lib/heal.ts` | Quota for visitors who are not signed in. Required for a deployed instance. Never used to show a private repo to an outsider |
| `GITHUB_WEBHOOK_SECRET` | `src/app/api/webhook/github/route.ts` | Manual repo webhook (older setups). When empty, unsigned requests are accepted |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET` | `src/lib/github-app.ts`, `src/lib/session.ts`, `/api/github-app/webhook` | The GitGotchi App: sign in, keepers, private repos, live webhooks. Without them, pets are public and read-only |
| `SESSION_SECRET` | `src/lib/session.ts` | Encrypts sessions and user tokens |
| `DATA_ENCRYPTION_KEY` | `src/lib/pet-store.ts` | Encrypts private pets before they reach the store |
| `APP_ORIGIN` | `src/lib/auth-flow.ts`, `src/lib/access.ts` | Public origin, for the same-origin check on writes and the end of sign in |
| `AUTH_ORIGIN` | `src/lib/auth-flow.ts`, `next.config.ts` | Optional second host where GitHub sign in runs (production: `gitgochi.vercel.app`). The OAuth callback lands there and hands the session to `APP_ORIGIN` with a one-time ticket, so the custom domain never serves an OAuth callback. Every other path on that host redirects to `APP_ORIGIN` |
| `SETUP_TOKEN` | `/setup/github-app` | Unlocks the one-time app registration page. Remove it afterwards |
| `GITGOTCHI_URL` | `scripts/poop-detector.mjs`, `mcp-server/index.mjs` | App URL for the hook and the MCP server (default `http://localhost:3000`) |
| `GITGOTCHI_PUBLIC_URL` | `mcp-server/index.mjs` (`add_badge`) | Public deployment written into README badges (default: `GITGOTCHI_URL`; localhost is refused) |
| `GITGOTCHI_REPO` | `scripts/poop-detector.mjs`, `src/app/api/local-poop/route.ts` | Repo key the hook reports to (default: the git `origin`, then `demo/healthy`) |
| `GITGOTCHI_HOOK_TOKEN` | `scripts/poop-detector.mjs`, `mcp-server/index.mjs`, `src/app/api/local-poop/route.ts` | A per-pet hook token from KEEPER TOOLS (`ggh_...`), or, on your own server, a deployment-wide token |

## Sign in, keepers and live updates

Nothing below is needed to try GitGotchi: any public repo and the demo pets work without an account.

| What you can do | Not signed in | Signed in, no push access | Keeper (push, maintain or admin) | Keeper, GitGotchi App installed |
|---|---|---|---|---|
| Open the pet of a **public** repo, stats, event log, Summon Kiro | ✅ | ✅ | ✅ | ✅ |
| Copy the README badge; it follows the repo's health | ✅ | ✅ | ✅ | ✅ |
| Play with the demo pets and the simulator (saved in your browser) | ✅ | ✅ | ✅ | ✅ |
| FEED, CLEAN, REVIVE, SYNC NOW on a real pet | ❌ | ❌ | ✅ | ✅ |
| KEEPER TOOLS: hook tokens for Kiro, DELETE PET | ❌ | ❌ | ✅ | ✅ |
| Live updates the moment you push, CI finishes or a PR merges | ❌ | ❌ | ❌ | ✅ |
| Merged-PR bonus and every issue opened or closed counted | ❌ | ❌ | ❌ | ✅ |
| **Private** repos (pet, badge with a key, diagnosis) | ❌ | ❌ | ❌ | ✅ |
| MY PETS list of your repos | ❌ | ✅ (installed repos only) | ✅ | ✅ |

Without the app, a public repo's pet is re-read from GitHub at most every 5 minutes, whenever someone opens its page or its badge: CI results, the last push, the commit count and stale issues all come through, including deaths and resurrections. The app adds speed and the events a snapshot cannot see.

1. Click **SIGN IN WITH GITHUB**. GitGotchi asks GitHub who you are; it gets no write access to anything. Sign in passes briefly through `gitgochi.vercel.app`, which receives GitHub's answer and hands you back to `gitgochi.lumelo.my.id` with a one-time ticket.
2. Open a repo's pet. If you have push, maintain or admin access, you are a **keeper**: FEED, CLEAN, REVIVE, SYNC NOW and KEEPER TOOLS work for you. Everyone else can look.
3. For live updates, and for any private repo, an admin of the repo clicks **INSTALL GITGOTCHI** (KEEPER TOOLS or **MY PETS**) and picks the repos. The app has read-only access to metadata, contents, actions, checks, issues and pull requests, and receives pushes, CI runs, pull requests and issues for those repos.
4. **MY PETS** (`/me`) lists every installed repo you can access, labelled KEEPER or READER and PUBLIC or PRIVATE.

Once you are signed in, the home page is yours: the handheld shows your first pet, **YOUR PETS** lists the others with stage and HP, and the demo pets move to a small **TRY A DEMO PET** section at the bottom. **LOOK UP ANY REPO** (the adopt form) still opens the pet of any public repo, yours or someone else's, without installing anything; you can care for it if you have push access. Visitors who are not signed in see the demo pet and **ADOPT YOUR REPO** instead.

KEEPER TOOLS on the pet page also hold:

- **Private badge:** a private repo's badge needs a key in its URL. MAKE BADGE LINK shows the markdown once; making a new one kills the old link.
- **Kiro hook and MCP token:** NEW TOKEN shows `GITGOTCHI_URL`, `GITGOTCHI_REPO` and `GITGOTCHI_HOOK_TOKEN` once. Put them in `.env.local` where Kiro runs; the token only works for that pet. Up to 5 per pet, each revocable.
- **DELETE PET:** removes stats, history, badge key and tokens.

A manual webhook (`POST /api/webhook/github`, signed with `GITHUB_WEBHOOK_SECRET`) still works for repos set up that way, but new repos should install the app.

## Badge

To show a pet in a README:

1. Open the pet page, for example `https://gitgochi.lumelo.my.id/pet/owner/repo`.
2. In **README BADGE**, press **COPY MARKDOWN**.
3. Paste it into the repo's `README.md`, commit and push. GitHub shows it through its image proxy and picks up changes within a few minutes (the pet is re-read from GitHub every 5 minutes, the badge image is cached for 2).

You only do this once. Nobody has to sign in or install anything for the badge to keep following the repo: every time the README is viewed, GitHub asks GitGotchi for the image, and GitGotchi reads the repo's latest CI, pushes and issues when its copy is older than 5 minutes. A repo nobody views is updated on the next view, with the time in between counted (hunger keeps adding up).

Full badge (360x120):

```markdown
[![GitGotchi](https://gitgochi.lumelo.my.id/api/badge/owner/repo.svg)](https://gitgochi.lumelo.my.id/pet/owner/repo)
```

Small badge (220x40), which fits next to shields.io badges in one row:

```markdown
[![GitGotchi](https://gitgochi.lumelo.my.id/api/badge/owner/repo.svg?size=small)](https://gitgochi.lumelo.my.id/pet/owner/repo)
```

`?static=1` turns off the idle bob. A dead pet is drawn as a tombstone: `R.I.P. - FIX CI TO REVIVE` when red CI killed it, `R.I.P. - PUSH CODE TO REVIVE` when it starved (no push for 30 days). Responses carry an `ETag` and are cached for 120 seconds (60 on the CDN). A private repo's badge needs `?k=<badge key>` from KEEPER TOOLS (MAKE BADGE LINK) and is never cached by the CDN; without the key it answers like a missing repo. Locally the badge is at `http://localhost:3000/api/badge/demo/healthy`.

## How Kiro was used

The `.kiro/` folder is at the repository root and is committed. The full write-up is in [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md).

| Kiro feature | Where | What it does |
|---|---|---|
| Specs | `.kiro/specs/{pet-engine,github-sync,kiro-healer,haunted-ui,accounts}/` | One `requirements.md` (EARS), `design.md` and `tasks.md` per feature. Every change after the first build was written into a spec before the code (for example accounts R1 to R9, the rising ghost R6.6 to R6.9, the NECROMANCER R4.4). `.kiro/specs/gitgotchi-prd.md` is the product document, and `.kiro/specs/kiroween-submission/` plans the remaining submission work |
| Hooks | `.kiro/hooks/poop-detector.json` | On save of a `.ts` or `.tsx` file under `src/`, runs `scripts/poop-detector.mjs`. The script scans for `console.log`, `debugger`, `TODO:` and `FIXME` and reports to `/api/local-poop`. A smell makes the pet poop. Saving the same file clean removes that file's poop only. If the app is down, the script prints one line and exits 0 |
| | `.kiro/hooks/spec-sync.json` | On save of `src/lib/state-machine.ts`, asks the agent to check the change against `.kiro/specs/pet-engine/` and run `npm test` |
| Steering | `.kiro/steering/` | `retro-aesthetic.md` (palette, pixel font, shell), `architecture.md` (stack and project layout), `kiro-integration.md` (how the pieces connect, and the rule to report only real results), `summon-healer.md` (manual, run as `/summon-healer`) |
| MCP server | `mcp-server/index.mjs`, `.kiro/settings/mcp.json` | stdio server `gitgotchi` with `get_pet_status`, `diagnose_pet`, `feed_pet`, `clean_pet`, `simulate_event` (demo repos only), `adopt_pet` and `add_badge` (writes the badge into the workspace README; you commit). The other tools call the running app over HTTP. Only the two read-only tools are auto-approved |
| Property-based tests | `src/lib/__tests__/state-machine.test.ts` | `fast-check` properties P1 to P6 run the engine over random event sequences and time gaps. The pet-engine requirements name the property that checks each rule |
| Kiro Power | `power-gitgotchi/` | The MCP server bundled as one file plus the `summon-healer` skill, so another workspace can add GitGotchi as a Power. `power.test.ts` checks the bundle lists the same tools as the source |
| Kiro IDE, then Kiro Web | git history: `Zee7X` commits (IDE), `Kiro Agent` commits and PRs #1 to #24 (Web) | In the Kiro IDE I wrote the PRD and BRD and Kiro ran the spec tasks that built the engine, handheld UI, hooks and MCP server. I moved to Kiro Web to work directly with GitHub and Vercel, with far fewer approvals. Deployment, the GitHub App, accounts and privacy, the NECROMANCER stage and the CI workflow were built in Kiro Web agent sessions: spec first, then code and tests, each change through a pull request with CI and a production check. Details in [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md) |

**Summon Kiro** runs from HEAL on the handheld, from `diagnose_pet` over MCP, or from `/summon-healer` in Kiro chat. It reports the latest completed CI run if that run failed (with its link, the failed jobs and steps, and an excerpt of the failing log), up to 3 stale issues, up to 5 code smells reported by the hook, and the days since the last push when there has been no push for 2 days or more. It returns those findings and a prompt. The prompt marks log lines, issue titles and file names as untrusted repository data, so text planted in a CI log cannot steer Kiro. Kiro then fixes the code in your workspace and runs `npm test`. GitGotchi does not open pull requests and does not edit files.

To use the hook and the MCP server, open this folder in Kiro and run `npm run dev`. Open the app once in the browser before editing. Against the deployed app, both need a per-pet hook token from KEEPER TOOLS in `GITGOTCHI_HOOK_TOKEN`. The hook script waits at most 3 seconds for the app, so a call against a cold dev server can time out.

## Architecture

```mermaid
flowchart TB
  subgraph Clients
    UI["Browser: pages + handheld"]
    DEMO["Demo pets in localStorage"]
    KIRO["Kiro: poop hook + MCP server"]
  end
  subgraph Vercel["Next.js on Vercel"]
    AUTH["Sign in: gitgochi.vercel.app/api/auth, then a one-time ticket to /api/auth/handoff"]
    ROUTES["/api/pet, /api/badge, /api/auto-heal, /api/local-poop"]
    WH["/api/github-app/webhook (signed)"]
    ACCESS["access: keeper / reader / visitor"]
    SVC["pet-service"]
    ENG["state-machine + pet-logic (pure, also run in the browser)"]
    STORE["pet-store: 30 s read cache, private pets sealed"]
  end
  subgraph GitHub
    OAUTH["OAuth"]
    REST["REST API"]
    HOOKS["App webhooks"]
  end
  KV[("Upstash Redis: pets, sessions, tickets")]

  UI --> AUTH
  AUTH <--> OAUTH
  UI --> ROUTES
  KIRO -->|hook token| ROUTES
  DEMO --> ENG
  ROUTES --> ACCESS --> SVC
  HOOKS --> WH --> SVC
  SVC --> ENG
  SVC -->|snapshots, diagnosis| REST
  SVC --> STORE --> KV
  AUTH -->|sessions, tickets| KV
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, `@modelcontextprotocol/sdk`, Vitest, fast-check and Playwright. The engine (`src/lib/state-machine.ts`) and the action rules (`src/lib/pet-logic.ts`) are pure functions shared by the server and the browser, so demo pets in `localStorage` follow exactly the same rules. `src/lib/pet-service.ts` reads GitHub snapshots and applies webhooks and actions; `src/lib/access.ts` decides who is a keeper, reader or visitor; `src/lib/pet-store.ts` seals private pets before they reach Upstash. More detail is in `.kiro/steering/architecture.md` and `.kiro/specs/accounts/design.md`.

## Security

- **Least privilege.** The GitGotchi App has read-only permissions and only on the repos it is installed on. It never writes to a repo.
- **Accounts.** Sessions and GitHub tokens are encrypted (AES-256-GCM) in Upstash; only a hash of the session id is stored; the cookie is `HttpOnly`, `Secure`, `SameSite=Lax`. Sign out revokes the GitHub token at GitHub.
- **Private repos.** Outsiders get the same answer as for a repo that does not exist, on every route including the badge. Private pets are encrypted before they are stored, and private answers are `no-store` and `noindex`.
- **Requests.** Writes need our own `Origin`; webhooks need a valid GitHub signature; hook calls need a per-pet token. Per-IP rate limits protect the free quotas.
- **Browser.** A strict Content Security Policy, no framing (`frame-ancestors 'none'`), `nosniff`, a strict referrer policy and HSTS.
- **Checked.** No secrets in the git history, `npm audit` reports 0 vulnerabilities, and the tests cover the privacy and access rules (`accounts.test.ts`, `security.test.ts`, `auth-handoff.test.ts`).

## Testing

```bash
npm test          # vitest: engine (with property-based tests), GitHub sync, accounts and privacy, webhooks, badge, heal, hook route, add_badge, Power
npx tsc --noEmit  # type check
npm run lint      # eslint on the whole repository, 0 warnings allowed
npm run build     # production build
npm run test:e2e  # Playwright: builds, starts on port 3100, checks layout at 390 px and 1280 px, keyboard use, clean console
```

`npm run test:e2e` needs Chromium once: `npx playwright install chromium`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, the type check and the unit tests on every push to `main` and every pull request. GitGotchi reads those runs for this repo's own pet, so the badge at the top shows this repository's real CI health.

## Known limits

- **Without a KV store, pets live in memory.** When neither the `UPSTASH_REDIS_REST_*` nor the `KV_REST_API_*` pair is set, `src/lib/pet-store.ts` keeps pets in a `Map` in the server process, and a restart, redeploy or serverless cold start loses poop, the resurrection count and webhook effects. Set a KV pair in production (see [docs/DEPLOY.md](docs/DEPLOY.md)).
- **Rate limits.** One IP can make about 120 pet requests, 10 diagnoses and 20 sign-in starts per minute per server instance; beyond that the API answers 429.
- **Reads are cached for 30 seconds per server instance.** To stay inside the Upstash free plan, a pet read is reused for 30 seconds. A change made on another instance (for example a webhook) can take up to 30 seconds to show.
- **Resync replaces webhook effects.** Once the 5-minute cache has expired, the next request re-seeds a real repo's stats from GitHub. Effects the snapshot does not count, such as the bonus from a merged pull request, are replaced at that point. Poop, the resurrection count, the rising state and the NECROMANCER streak are kept. Webhooks that arrive before the first snapshot are replayed once onto it.
- **Per-file poop has a window.** Cleaning a file removes only that file's poop, but only while its poop event is among the 50 logged events. Poop is capped at 5; the CLEAN button always clears everything.
- **The operator can read what is stored.** Private pets are encrypted against a leaked copy of the store, but whoever runs the deployment holds the keys and sees repo names in request logs. `/privacy` says so.
- **Installing needs a repo admin.** A collaborator with push access can keep a public repo's pet after signing in, but a private repo needs an admin to install the GitGotchi App once.
- **Read-only, always.** The app reads from GitHub and never writes to it.

## Docs

- [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md): how Kiro was used
- [docs/DEPLOY.md](docs/DEPLOY.md): Vercel, environment variables, webhook
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md): script for the demo video
- [.kiro/specs/gitgotchi-prd.md](.kiro/specs/gitgotchi-prd.md): product and business requirements
- [/privacy](https://gitgochi.lumelo.my.id/privacy): what is stored, where, for how long, and how to delete it

## License

MIT License, Copyright (c) 2026 Zee7X. See [LICENSE](LICENSE).
