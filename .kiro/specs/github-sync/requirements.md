# GitHub Sync: Requirements

How real repository activity reaches the pet: a snapshot read on adoption, a signed webhook for live events, and the pet API the UI, badge and MCP server share.
Code: `src/lib/github.ts`, `src/lib/pet-store.ts`, `src/lib/pet-service.ts`, `src/app/api/pet/`, `src/app/api/webhook/github/route.ts`. Design: `design.md`.

## Glossary

- **Repo key**: lowercase `owner/repo`. `demo/<name>` keys never call GitHub.
- **Snapshot**: a `RepoSnapshot` read from the GitHub REST API.
- **Webhook**: `POST /api/webhook/github`.

## Requirements

### R1. Adopt a real repository

**User story:** As a developer, I want to type my repo name and get its pet, so I can adopt it in seconds.

Acceptance criteria:
1. WHEN `GET /api/pet/{owner}/{repo}` is called for a repo with no pet, THE SYSTEM SHALL fetch a snapshot from GitHub, seed a pet from it and answer `{ pet, events, source: 'github', fetchedAt }`.
2. WHEN the same repo is requested again within 5 minutes, THE SYSTEM SHALL answer from the stored pet without calling GitHub.
3. IF the repo does not exist, THEN THE SYSTEM SHALL answer 404 `repo not found`.
4. IF the repo key is invalid, THEN THE SYSTEM SHALL answer 400 `invalid repo`.
5. WHEN `GITHUB_TOKEN` is set, THE SYSTEM SHALL send it as a bearer token. WHEN it is not set, THE SYSTEM SHALL call GitHub unauthenticated.
6. WHEN a repo key starts with `demo/`, THE SYSTEM SHALL build the pet from a built-in fixture (`healthy`, `neglected`, `haunted`) and SHALL NOT call GitHub.

Verified by: `src/lib/__tests__/github.test.ts`, `src/lib/__tests__/pet-service.test.ts`.

### R2. Rate limits degrade gracefully

**User story:** As a user of a deployed instance, I want a clear message instead of a crash when GitHub throttles us.

Acceptance criteria:
1. IF GitHub answers a rate limit (429, or 403 with no quota left) and no pet is stored, THEN THE SYSTEM SHALL answer 503 `github rate limit reached` with a `Retry-After` header.
2. IF GitHub fails and a pet is stored, THEN THE SYSTEM SHALL answer the stored pet with `source: 'fallback'` and an `error` message.
3. WHEN a GitHub call failed, THE SYSTEM SHALL NOT retry that repo until the rate-limit reset time, or for 15 seconds on other errors.
4. IF a secondary call (runs, commit count, stale issues) fails, THEN THE SYSTEM SHALL still return the snapshot with fallback values.

Verified by: `github.test.ts` (`RateLimitError` cases), `pet-service.test.ts`.

### R3. Webhook authenticity

**User story:** As a repo owner, I want only GitHub to be able to move my pet.

Acceptance criteria:
1. WHEN `GITHUB_WEBHOOK_SECRET` is set, THE SYSTEM SHALL verify `X-Hub-Signature-256` (HMAC-SHA256 of the raw body, constant-time compare). IF it is missing or wrong, THEN THE SYSTEM SHALL answer 401.
2. WHEN `GITHUB_WEBHOOK_SECRET` is not set, THE SYSTEM SHALL accept unsigned requests.
3. IF `X-GitHub-Event` is missing, THEN THE SYSTEM SHALL answer 400.
4. WHEN the event is `ping`, THE SYSTEM SHALL answer `200 {"ok":true}`.

Verified by: `src/lib/__tests__/webhook.test.ts` (`webhook signature`).

### R4. Webhook routing and mapping

**User story:** As a repo owner, I want CI, pushes, merges and issues to move the pet the same way the engine specifies.

Acceptance criteria:
1. WHEN a webhook arrives, THE SYSTEM SHALL apply it to the pet of `repository.full_name`, lowercased and validated. IF `repository` is missing or invalid, THEN THE SYSTEM SHALL answer 400.
2. WHEN a `push` has at least one commit, THE SYSTEM SHALL apply a `push` event with that commit count.
3. WHEN a `check_run` or `workflow_run` has `action: completed` and conclusion `success` or `failure`, THE SYSTEM SHALL apply a `ci` event. Other conclusions and actions SHALL be ignored.
4. WHEN a `pull_request` is closed with `merged: true`, THE SYSTEM SHALL apply `pr_merged`. An unmerged close SHALL be ignored.
5. WHEN an `issues` event is `opened` or `closed`, THE SYSTEM SHALL apply `issue_opened` or `issue_closed`.
6. WHEN an event does not affect the pet, THE SYSTEM SHALL answer `{ success: true, ignored: true, petState }` (`petState` is `null` when the repo has no pet yet).
7. WHEN an event is applied, THE SYSTEM SHALL answer `{ success: true, eventType, repo, petState }`.
8. IF the repo had no pet, THEN THE SYSTEM SHALL create a placeholder (`snapshotAt` 0, source `github`) with the event in its log. WHEN the next `GET /api/pet/{owner}/{repo}` seeds the pet from a real snapshot, THE SYSTEM SHALL replay the logged `pr_merged`, `issue_opened` and `issue_closed` events onto the seeded pet once, oldest first, skip the logged `push` and `ci` events (the snapshot already counts them), end a replayed PARTY one hour after the event's arrival, and keep the webhook events in the log with one `SYNCED WITH GITHUB` event added.

Verified by: `webhook.test.ts` (`webhook routing`); R4.8 by `replay.test.ts` and `state-machine.test.ts` (`replayWebhookEvents`).

### R5. Actions and simulation

**User story:** As a user, I want to feed, clean, revive and sync from the UI, and to simulate events in a demo without a real repo.

Acceptance criteria:
1. WHEN `POST /api/pet/{owner}/{repo}/action` gets `feed`, `clean`, `revive`, `sync` or `simulate`, THE SYSTEM SHALL answer the updated `{ pet, events, source, fetchedAt }`. Any other action SHALL give 400.
2. WHEN more than 3 user feeds happen within an hour, THE SYSTEM SHALL refuse the extra feed with status message `TOO FULL!`.
3. IF `revive` is requested while the repo is still broken, THEN THE SYSTEM SHALL answer 409 with status message `FIX CI FIRST`.
4. WHEN `simulate` targets a `demo/*` repo, THE SYSTEM SHALL apply the event and mark it `simulated: true`.
5. IF `simulate` targets a real repo while `NODE_ENV` is `production`, THEN THE SYSTEM SHALL answer 403.
6. THE SYSTEM SHALL NOT fabricate events: every event has a real source (`github`, `kiro-hook`, `user`, `system`) and simulated ones are labelled.

Verified by: `pet-service.test.ts` (`act`, `parseSimulatedEvent`).

### R6. Badge reflects the stored pet

**User story:** As a repo owner, I want the README badge to show the same pet as the app.

Acceptance criteria:
1. THE SYSTEM SHALL render the badge from `getPet`, so badge and app never disagree. See `../haunted-ui/requirements.md` for the badge rules.

### R7. Pets persist, store failures are reported

**User story:** As a repo owner using the deployed app, I want poop, resurrections and webhook effects to survive cold starts, and a clear error when the store is down.

Acceptance criteria:
1. WHERE `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both set, THE SYSTEM SHALL store pets in Upstash Redis through its REST API with that pair.
2. WHERE the `UPSTASH_*` pair is incomplete and `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set, THE SYSTEM SHALL use the `KV_REST_API_*` pair.
3. WHERE neither pair is complete, THE SYSTEM SHALL keep pets in server memory.
4. THE SYSTEM SHALL store each entry as JSON under `gitgotchi:pet:<repo key>`, keep at most 50 events, newest first, and treat a stored value that does not parse as no entry.
5. IF a store request fails with a network error, a non-2xx status, an `error` field or no answer within 5 seconds, THEN THE SYSTEM SHALL answer 503 `{ error: 'store unavailable' }` on the pet API, `/api/auto-heal` and `/api/local-poop`, 503 `{ success: false, error: 'store unavailable' }` on the webhook, and the `SIGNAL LOST` badge on the badge route.
6. THE SYSTEM SHALL keep the store URL and token out of every error message, log and response.

Verified by: `pet-store.test.ts` (`KV store`), `webhook.test.ts`, `pet-service.test.ts` (`store errors`), `local-poop.test.ts`, `badge.test.ts` (`with KV down`).
