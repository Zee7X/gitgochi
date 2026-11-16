# GitHub Sync: Design

Implements `requirements.md`.

## Data flow

```mermaid
flowchart LR
  GH[GitHub REST API] -->|snapshot: repo, runs, commits, stale issues| GHL[src/lib/github.ts]
  GHL --> SVC[src/lib/pet-service.ts]
  WH[GitHub webhook] -->|POST /api/webhook/github| WR[webhook route]
  WR -->|ingestEvent| SVC
  SVC <--> STORE[src/lib/pet-store.ts<br/>in-memory Map]
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

## Service (`src/lib/pet-service.ts`)

- `getPet(key, now, force?)`: demo keys come from `DEMOS` fixtures (relative to `now`). Real keys use the stored entry for 5 minutes (`SNAPSHOT_TTL`), then `refresh`.
- `refresh`: re-seeds from the snapshot but keeps `poopCount` and `resurrections` of the prior pet (they only exist locally) and prepends a `SYNCED WITH GITHUB` event. Errors go to a per-repo backoff map, then `onGitHubError` returns the stored pet as `source: 'fallback'` or rethrows.
- `ingestEvent(key, event, now)`: webhook entry point; applies the event to the stored pet or to a placeholder.
- `act(key, action, payload, now)`: `sync` forces a refetch; `simulate` is limited to demo repos or non-production; `feed` is limited to 3 per hour; `revive` errors map to 409.
- `petErrorResponse(e)`: `RepoNotFoundError` to 404, `RateLimitError` to 503 + `Retry-After`, else 500.

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

Ignored events add `"ignored": true`. Errors: `{ "success": false, "error": "..." }` with 400 (bad JSON, missing event header, missing or invalid repository) or 401 (signature).

## Environment

| Var | Used in | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | `src/lib/github.ts`, `src/lib/heal.ts` | Raises the API quota; required for deployed instances |
| `GITHUB_WEBHOOK_SECRET` | webhook route | Signature check |

## Known limits

- The store is in memory (`pet-store.ts`, on `globalThis`). A restart or a serverless cold start loses pets and events; the next GET re-seeds from GitHub, but local poop, resurrection counts and webhook effects are lost. Next step: task 7 in `tasks.md`.
- A webhook for a repo nobody has opened yet is not carried over into the first snapshot.
