# Accounts: Requirements

Every pet belongs to one repository and is kept by the people who work on it. Visitors can look but not touch, private repositories stay private, and demo pets are personal to each browser.
Builds on `../github-sync/requirements.md` (snapshot, webhook mapping, store) and `../haunted-ui/requirements.md` (badge). Design: `design.md`.

## Glossary

- **GitGotchi App**: a GitHub App registered by the deployment owner. It holds read-only repository permissions and receives webhooks for every repository it is installed on.
- **Installed repo**: a repository the GitGotchi App is installed on.
- **Keeper**: a signed-in user with push, maintain or admin permission on the pet's repository. A repo can have many keepers; they share one pet.
- **Reader**: a signed-in user with at least read permission on a private repository.
- **Visitor**: anyone else, signed in or not.
- **Session**: a server-side record behind an `httpOnly` cookie that holds the user's GitHub identity and an encrypted user access token.
- **Badge key**: a random, per-pet secret that lets a private repo's badge be fetched without signing in.
- **Hook token**: a random, per-pet secret that lets a Kiro hook or the MCP server act for a keeper.

## Requirements

### R1. Sign in with GitHub

**User story:** As a developer, I want to sign in with my GitHub account, so the app knows which pets are mine.

Acceptance criteria:
1. WHEN a user selects SIGN IN WITH GITHUB, THE SYSTEM SHALL start the GitHub App user authorization flow with a random `state` bound to the browser, and SHALL reject a callback whose `state` does not match.
2. WHEN the callback succeeds, THE SYSTEM SHALL create a session holding the GitHub user id, login, avatar URL and the user access token encrypted with AES-256-GCM, and SHALL set a session cookie that is `httpOnly`, `Secure`, `SameSite=Lax` and scoped to `/`.
3. THE SYSTEM SHALL request no OAuth scopes beyond what the GitGotchi App's permissions grant.
4. WHEN the user access token expires, THE SYSTEM SHALL refresh it with the stored refresh token. IF the refresh fails, THEN THE SYSTEM SHALL end the session and treat the user as a visitor.
5. WHEN a user selects SIGN OUT, THE SYSTEM SHALL delete the session record and clear the cookie.
6. THE SYSTEM SHALL keep tokens, refresh tokens and session ids out of every response body, log line and error message.

### R2. Who may do what

**User story:** As a keeper, I want only the people who work on my repo to move its pet, so strangers cannot feed, clean or revive it.

| | Public repo | Private repo |
|---|---|---|
| See pet page, stats, event log | everyone | readers and keepers |
| Badge | everyone | anyone holding the badge key |
| FEED, CLEAN, REVIVE, SYNC | keepers | keepers |
| Webhook, hook token, badge key settings | keepers | keepers |

Acceptance criteria:
1. WHEN a signed-in user requests a pet, THE SYSTEM SHALL determine their permission on the repository with their own user access token and cache the result in the session for 10 minutes.
2. IF a `feed`, `clean`, `revive` or `sync` action comes from someone who is not a keeper, THEN THE SYSTEM SHALL answer 403 `keepers only` and SHALL NOT change the pet.
3. IF a cookie-authenticated `POST` has an `Origin` header that is not the deployment's own origin, THEN THE SYSTEM SHALL answer 403 and SHALL NOT change the pet.
4. WHEN a visitor opens a public repo's pet, THE SYSTEM SHALL show it read-only, with the action buttons disabled and the hint `SIGN IN AS A KEEPER TO CARE FOR THIS PET`.
5. WHEN a keeper loses push permission, THE SYSTEM SHALL refuse their actions once the cached permission expires.

### R3. Private repositories

**User story:** As a developer on a private repo, I want a pet for it without anyone outside the repo learning that the repo exists.

Acceptance criteria:
1. WHEN a reader or keeper opens a private repo that is an installed repo, THE SYSTEM SHALL seed and refresh its pet with an installation access token, using the same snapshot rules as `../github-sync/requirements.md` R1.
2. IF a private repo is not an installed repo, THEN THE SYSTEM SHALL show the requester an INSTALL GITGOTCHI button and SHALL NOT create a pet.
3. IF anyone who is not a reader or keeper requests a private repo's pet, event log, diagnosis or settings, THEN THE SYSTEM SHALL answer 404 `repo not found`, the same as for a repo that does not exist.
4. THE SYSTEM SHALL keep private repo names, issue titles, run names and links out of every public response, log line and error message.
5. WHEN a repository changes from public to private, THE SYSTEM SHALL apply R3 to its pet from the next request or webhook onward.

### R4. Live updates for every installed repo

**User story:** As a keeper, I want my pet to react to pushes, CI and pull requests without copying a webhook secret around.

Acceptance criteria:
1. WHEN the GitGotchi App webhook delivers `push`, `check_run`, `workflow_run`, `pull_request` or `issues` for an installed repo, THE SYSTEM SHALL verify `X-Hub-Signature-256` with `GITHUB_APP_WEBHOOK_SECRET` and apply the event with the mapping of `../github-sync/requirements.md` R4.
2. IF the signature is missing or wrong, THEN THE SYSTEM SHALL answer 401 and SHALL NOT change any pet.
3. WHEN `installation` or `installation_repositories` reports that repositories were removed, THE SYSTEM SHALL stop applying webhooks to those repos and SHALL hide their private pets until the app is installed again.
4. THE SYSTEM SHALL keep `POST /api/webhook/github` with `GITHUB_WEBHOOK_SECRET` working for repos that registered a manual webhook before this feature.

### R5. Badges

**User story:** As a keeper, I want a live badge in my README, including for a private repo.

Acceptance criteria:
1. WHEN a public repo's badge is requested, THE SYSTEM SHALL serve it without a key, as today.
2. WHEN a private repo's badge is requested with the correct badge key (`?k=`), THE SYSTEM SHALL serve it. IF the key is missing or wrong, THEN THE SYSTEM SHALL answer 404.
3. WHEN a keeper opens the badge settings, THE SYSTEM SHALL show the badge markdown including the key, and SHALL let the keeper rotate the key. A rotated key SHALL stop working at once.
4. THE SYSTEM SHALL compare badge keys in constant time and SHALL store only a hash of each key.

### R6. Kiro hook and MCP per pet

**User story:** As a keeper, I want my Kiro hook and MCP server to report to my pet without a token that works for everyone's pet.

Acceptance criteria:
1. WHEN a keeper creates a hook token, THE SYSTEM SHALL show it once, store only its hash, and bind it to that pet.
2. WHEN `/api/local-poop` or a pet action receives `Authorization: Bearer <hook token>`, THE SYSTEM SHALL accept it only for the pet the token is bound to, and SHALL treat the caller as a keeper of that pet.
3. WHEN a keeper revokes a hook token, THE SYSTEM SHALL refuse it at once.
4. THE SYSTEM SHALL keep accepting `GITGOTCHI_HOOK_TOKEN` and loopback callers for local development, as today.

### R7. Demo pets are personal

**User story:** As a visitor, I want to play with the demo pets without seeing what other visitors did to them, and without my clicks reaching them.

Acceptance criteria:
1. THE SYSTEM SHALL keep each browser's `demo/*` pets in that browser's `localStorage` and SHALL NOT write demo pets to the server store.
2. WHEN a browser has no saved demo pet, THE SYSTEM SHALL start from the fixture of `../github-sync/requirements.md` R1.6.
3. WHEN a visitor uses the simulator, FEED, CLEAN, REVIVE or RESET DEMO on a demo pet, THE SYSTEM SHALL run the same engine (`src/lib/state-machine.ts`) in the browser and label simulated events `simulated`.
4. THE SYSTEM SHALL render `demo/*` badges from the fixture, so every viewer sees the same demo badge.

### R8. My pets

**User story:** As a signed-in developer, I want one place that lists the pets I keep or can read.

Acceptance criteria:
1. WHEN a signed-in user opens `/me`, THE SYSTEM SHALL list the installed repos they can access, with each pet's stage and HP, plus an INSTALL GITGOTCHI link for adding repositories.
2. THE SYSTEM SHALL label each entry `KEEPER` or `READER` and `PUBLIC` or `PRIVATE`.

### R9. Private repo data is minimal, encrypted and deletable

**User story:** As a developer on a private repo, I want GitGotchi to keep as little about my repo as it needs, protect what it keeps, and forget it when I leave.

Acceptance criteria:
1. THE SYSTEM SHALL store for a pet only its stats, stage, timestamps, counts and event log entries (type, label, deltas, source, and the file path of a Kiro hook report). It SHALL NOT store webhook payloads, commit messages, author names or emails, code, diffs, branch names, issue or pull request titles or bodies, workflow names or run links.
2. WHEN a webhook arrives, THE SYSTEM SHALL read only the fields the mapping needs (event type, action, conclusion, merged flag, commit count, repository id and name) and discard the body after the request.
3. THE SYSTEM SHALL encrypt every private repo's pet entry in the store with AES-256-GCM under a key derived from `DATA_ENCRYPTION_KEY`, so a copy of the store alone does not reveal it.
4. THE SYSTEM SHALL build the Summon Kiro diagnosis of a private repo on request with the installation token, return it only to readers and keepers, and SHALL NOT store it.
5. THE SYSTEM SHALL answer every private pet page, pet API, diagnosis and settings response with `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`, and SHALL NOT let the CDN cache a private badge.
6. WHEN the app is uninstalled from a repo, or a repo is removed from an installation, THE SYSTEM SHALL delete that repo's private pet entry, badge key and hook tokens within one webhook delivery.
7. WHEN a keeper selects DELETE PET, THE SYSTEM SHALL delete the pet entry, badge key and hook tokens of that repo at once, public or private.
8. WHEN a session ends or expires (30 days without use), THE SYSTEM SHALL delete its record, including the encrypted user token.
9. THE SYSTEM SHALL publish a `/privacy` page that lists what is stored, where (Vercel, Upstash region), for how long, who can read it (including the deployment operator) and how to delete it.
