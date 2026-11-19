# GitHub Sync: Design

Implements `requirements.md`.

## Data flow

```mermaid
flowchart LR
  GH[GitHub REST API] -->|snapshot: repo, runs, commits, stale issues| GHL[src/lib/github.ts]
  GHL --> SVC[src/lib/pet-service.ts]
  WH[GitHub webhook] -->|POST /api/webhook/github| WR[webhook route]
  WR -->|ingestEvent| SVC
  SVC <--> STORE[src/lib/pet-store.ts]
  STORE <-->|REST, when configured| KV[(Upstash Redis)]
  SVC --> ENG[src/lib/state-machine.ts]
  SVC --> API[GET /api/pet/owner/repo<br/>POST .../action]
  API --> UI[usePet hook + PetConsole]
  API --> BADGE[/api/badge/owner/repo]
  API --> MCP[mcp-server/index.mjs]
```

## Snapshot (`src/lib/github.ts`)

`fetchRepoSnapshot(owner, repo)` makes one required call and three optional ones in parallel:

| Call | Gives | On failure |
|---|---|---|
| `GET /repos/{o}/{r}` | created, pushed, open issues, default branch, description, stars | 404 `RepoNotFoundError`, rate limit `RateLimitError`, else `GitHubError` |
| `GET /repos/{o}/{r}/actions/runs?status=completed&branch=<default>&per_page=10` | `recentRuns` (success, failure/timed_out; others dropped; oldest first) | `[]` |
| `GET /repos/{o}/{r}/commits?per_page=1` | `commitsTotal` from the `Link: rel="last"` page number | `0` |
| `GET /search/issues?q=repo:{o}/{r} is:issue is:open updated:<30 days ago` | `staleIssues` (`total_count`) | `0` |

Requests use `AbortSignal.timeout(8000)` and `cache: 'no-store'`. `GITHUB_TOKEN` is sent as `Authorization: Bearer` when set. Unauthenticated quota is 60 requests/hour per IP and one adoption costs about 3 core calls plus 1 search call, so a deployed instance needs the token (5000/hour). Demo repos work without it.

## Store (`src/lib/pet-store.ts`)

`getEntry(key)`, `setEntry(key, entry)` and `appendEvent(key, event)` return Promises; `normalizeRepoKey` stays sync. `setEntry` caps `events` at `MAX_EVENTS` (50), newest first, before writing.

| Backend | When | How |
|---|---|---|
| Upstash Redis | `kvConfig()` finds `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, else `KV_REST_API_URL` + `KV_REST_API_TOKEN` | `POST <url>` with body `["GET", k]` or `["SET", k, json]`, `Authorization: Bearer <token>`, `AbortSignal.timeout(5000)`, `cache: 'no-store'`. `k` is `gitgotchi:pet:<repo key>` |
| Memory | neither pair is complete | `Map` on `globalThis` (shared across Next dev HMR and route modules) |

A KV value that is not a string, does not parse, or lacks an object `pet` and an array `events` counts as no entry. A fetch rejection, a non-2xx status, a body that is not JSON or has an `error` field throws `StoreError` with one of `store timed out`, `store unreachable` or `store responded <status>`; the URL and token are never part of the message.

`StoreError` mapping:

| Caller | Answer |
|---|---|
| `petErrorResponse` (pet GET, pet action, `/api/auto-heal`) and `/api/local-poop` | 503 `{ "error": "store unavailable" }`, `Cache-Control: no-store` |
| Webhook | 503 `{ "success": false, "error": "store unavailable" }` |
| Badge | `SIGNAL LOST` status badge |

`refresh` writes outside its GitHub `try`, so a store failure is not recorded as a GitHub error or put into backoff. Writes are read-then-write without a transaction; two writes for the same repo at the same instant can overwrite each other.

## Service (`src/lib/pet-service.ts`)

- `getPet(key, now, force?)`: demo keys come from `DEMOS` fixtures (relative to `now`). Real keys use the stored entry for 5 minutes (`SNAPSHOT_TTL`), then `refresh`.
- `refresh`: re-seeds from the snapshot but keeps `poopCount` and `resurrections` of the prior pet (they only exist locally) and prepends a `SYNCED WITH GITHUB` event. Errors go to a per-repo backoff map, then `onGitHubError` returns the stored pet as `source: 'fallback'` or rethrows.
- `ingestEvent(key, event, now)`: webhook entry point; applies the event to the stored pet or to a placeholder, in one write.
- Placeholder replay (R4.8): `refresh` checks `prior.snapshotAt === 0 && prior.source === 'github'` and passes the seeded pet through `replayWebhookEvents(seeded, prior.events, now)` in `state-machine.ts`. It applies the logged `github`, non-simulated `pr_merged` / `issue_opened` / `issue_closed` events oldest first at `now` (so `tick` never runs backwards), sets `partyUntil = event.at + 1h` after each replayed merge, and ends with `tick`. The written entry has `snapshotAt = now`, so a later resync replays nothing.
- `act(key, action, payload, now)`: `sync` forces a refetch; `simulate` is limited to demo repos or non-production; `feed` is limited to 3 per hour; `revive` errors map to 409.
- `petErrorResponse(e)`: `StoreError` to 503 `store unavailable`, `RepoNotFoundError` to 404, `RateLimitError` to 503 + `Retry-After`, else 500.

## Routes

| Route | File | Notes |
|---|---|---|
| `GET /api/pet/{owner}/{repo}` | `src/app/api/pet/[owner]/[repo]/route.ts` | `Cache-Control: no-store` |
| `POST /api/pet/{owner}/{repo}/action` | `src/app/api/pet/[owner]/[repo]/action/route.ts` | body `{ action, event? }` |
| `POST /api/webhook/github` | `src/app/api/webhook/github/route.ts` | `GET` returns a help JSON |

## Webhook mapping

| GitHub event | Condition | Pet event |
|---|---|---|
| `push` | commits > 0 | `push` (n commits) |
| `check_run`, `workflow_run` | `action: completed`, conclusion `success` or `failure` | `ci` |
| `pull_request` | `action: closed`, `merged: true` | `pr_merged` |
| `issues` | `opened` / `closed` | `issue_opened` / `issue_closed` |
| `ping` | | `200 {"ok":true}` before the body is read |

Signature: `sha256=` + HMAC-SHA256(raw body, `GITHUB_WEBHOOK_SECRET`), compared with `timingSafeEqual`.

Response shapes:

```json
{ "success": true, "eventType": "push", "repo": "owner/repo", "petState": { "hp": 90, "stage": "CODE_DEMON", "...": "full PetState" } }
```

Ignored events add `"ignored": true`. Errors: `{ "success": false, "error": "..." }` with 400 (bad JSON, missing event header, missing or invalid repository), 401 (signature) or 503 (`store unavailable`).

## Environment

| Var | Used in | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | `src/lib/github.ts`, `src/lib/heal.ts` | Raises the API quota; required for deployed instances |
| `GITHUB_WEBHOOK_SECRET` | webhook route | Signature check |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `src/lib/pet-store.ts` | Persistent store; wins over the `KV_REST_API_*` pair |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | `src/lib/pet-store.ts` | Same store, names injected by the Vercel Marketplace Upstash integration |

## Known limits

- A webhook for a repo nobody has opened yet is not carried over into the first snapshot.
