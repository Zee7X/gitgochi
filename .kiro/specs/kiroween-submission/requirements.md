# Requirements Document

## Introduction

This spec takes GitGotchi from "works on my machine" to a Kiroween 2026 submission in the Resurrection category. It covers five areas:

1. **Repository and publishing.** Connect the local repo to `https://github.com/Zee7X/gitgochi`, merge the unrelated remote history, push without force.
2. **Open code tasks** from the four feature specs: a persistent Upstash Redis store behind `src/lib/pet-store.ts` (github-sync 7, pet-engine 8), webhook events that arrive before the first snapshot (github-sync 8), the `SLEEPING` decision (pet-engine 10), the `adopt_pet` URL bug (kiro-healer 8), per-file poop removal (kiro-healer 13), a Kiro Power package (kiro-healer 12), a Playwright browser pass (haunted-ui 11), a contrast measurement (haunted-ui 12), media re-capture (haunted-ui 13) and a Resurrection theme review (haunted-ui 14, formerly "Costume Contest polish").
3. **Deployment and live checks**: Vercel production deploy, a GitHub webhook on a real repo, and the badge through GitHub's image proxy (github-sync 9 and 10, haunted-ui 10).
4. **Kiro verification** that only the IDE or the User can confirm: hooks, MCP panel, `/summon-healer`, Correctness view, Power import (kiro-healer 9, 10, 11, pet-engine 9).
5. **Documentation in English**: README rewritten for Kiroween judges, `docs/KIRO_USAGE.md` completed with observed facts and the User's own answers, Indonesian steering text translated, "Costume Contest" removed.

Steps that need the User (Vercel login, `gh auth login`, credentials, IDE panels, Correctness view, Power import, demo video URL, first-hand answers) are modelled as explicit gates. Any task whose gate the User does not pass stays unchecked and is reported as blocked. Nothing is recorded that a tool, test, command or the User did not actually return.

Sources: Kiroween 2026 rules on <https://kiroween.devpost.com/> (submission period 30 October to 4 December 2026, demo video under 3 minutes, public repo with an OSI license, `.kiro/` at the repo root); Kiro Powers format on <https://kiro.dev/docs/powers/create/>; Upstash REST API on <https://upstash.com/docs/redis/features/restapi>.

Out of scope: a GitHub Actions workflow for this repository, accounts or OAuth, automatic pull requests (`gitgotchi-prd.md` section 2.4), and atomic multi-writer updates in the store.

## Glossary

- **Agent**: the Kiro agent that executes this spec in the workspace `c:\laragon\www\gitgotchi`.
- **User**: the project owner (GitHub account `Zee7X`) who performs the gated steps and answers questions, in English or Indonesian.
- **Repository**: the local git repository at the workspace root, branch `main`.
- **Origin**: the git remote named `origin` with URL `https://github.com/Zee7X/gitgochi.git`.
- **Observed_Result**: output returned in this session by a tool, test, command or HTTP request, or an answer the User gave in chat.
- **Pet_Engine**: the pure engine in `src/lib/state-machine.ts` with the types in `src/lib/types.ts`.
- **Pet_Store**: `src/lib/pet-store.ts`, the functions `getEntry`, `setEntry`, `appendEvent` and `normalizeRepoKey`.
- **KV_Backend**: the Pet_Store mode that keeps entries in Upstash Redis through its REST API, called with the global `fetch`.
- **Memory_Backend**: the Pet_Store mode that keeps entries in a `Map` on `globalThis`, as today.
- **Store_Error**: the error the Pet_Store raises when a KV_Backend request fails.
- **Pet_Service**: `src/lib/pet-service.ts` (`getPet`, `ingestEvent`, `act` and their helpers).
- **Pet_API**: the routes `GET /api/pet/{owner}/{repo}`, `POST /api/pet/{owner}/{repo}/action` and `POST /api/auto-heal`.
- **Webhook_Route**: `POST /api/webhook/github` (`src/app/api/webhook/github/route.ts`).
- **Local_Poop_Endpoint**: `POST /api/local-poop` (`src/app/api/local-poop/route.ts`).
- **Badge_Route**: `GET /api/badge/{owner}/{repo}` (`src/app/api/badge/[owner]/[repo]/route.ts`).
- **Diagnosis**: the `HealDiagnosis` built by `src/lib/heal.ts`.
- **Placeholder_Entry**: a Pet_Store entry for a real (non-`demo/`) repo that the Webhook_Route created before any snapshot was read; its `snapshotAt` is 0.
- **Outstanding_Poop**: a `poop` event with source `kiro-hook` for one file path, with no later per-file clean of that path, no later user CLEAN action and no later resurrection.
- **Pet_Console**: `src/components/app/PetConsole.tsx`.
- **LCD_Screen**: `src/components/LcdScreen.tsx`.
- **MCP_Server**: the stdio MCP server `gitgotchi` in `mcp-server/index.mjs`.
- **Hook_Script**: `scripts/poop-detector.mjs`, run by the `poop-detector` hook.
- **Power**: the Kiro Power folder `power-gitgotchi/` at the repository root.
- **Production_Server**: the app started locally with `next build` followed by `next start`.
- **Deployment**: the Vercel production deployment of the Repository.
- **Production_Domain**: the domain Vercel assigns to the Deployment.
- **Camo**: GitHub's image proxy (`camo.githubusercontent.com`) that serves images embedded in a rendered README.
- **E2E_Suite**: the Playwright tests run by `npm run test:e2e`.
- **Contrast_Test**: a vitest test that measures WCAG contrast ratios of the color pairs used in the UI and the badge.
- **Media_Capture**: the committed command that captures `docs/media/*.png`.
- **README**: `README.md` at the repository root.
- **Kiro_Usage_Doc**: `docs/KIRO_USAGE.md`.
- **Feature_Specs**: `.kiro/specs/{pet-engine,github-sync,kiro-healer,haunted-ui}/` and `.kiro/specs/gitgotchi-prd.md`.
- **Validation_Suite**: the commands `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm run test:e2e`.

## Requirements

### Requirement 1: Publish the repository to GitHub

**User Story:** As the User, I want my local work on `Zee7X/gitgochi` without losing either history, so that judges can read the code.

#### Acceptance Criteria

1. THE Agent SHALL add the remote `origin` with URL `https://github.com/Zee7X/gitgochi.git` to the Repository.
2. WHEN `origin/main` has been fetched, THE Agent SHALL merge `origin/main` into local `main` with `--allow-unrelated-histories`.
3. WHEN the merge conflicts on `README.md`, THE Agent SHALL keep the local version of `README.md`.
4. WHEN the merge conflicts on `LICENSE`, THE Agent SHALL keep the remote version of `LICENSE` (MIT License, "Copyright (c) 2026 Zee7X").
5. WHEN the Agent prepares a push, THE Agent SHALL confirm that `git ls-files .kiro` lists the Feature_Specs, the steering files, the hook files and `.kiro/settings/mcp.json`, and that `.env.example` is the only tracked file whose name starts with `.env`.
6. WHEN the merge commit exists, THE Agent SHALL push `main` to Origin with `git push origin main` and no force option.
7. IF Origin rejects a push, THEN THE Agent SHALL stop pushing and report the rejection message to the User.
8. WHEN all other requirements in this spec are complete or reported as blocked, THE Agent SHALL push the final commit so that `origin/main` and local `main` point to the same commit.

### Requirement 2: English-only project text

**User Story:** As a Kiroween judge, I want every file in the repository in English, so that I can read all of it.

#### Acceptance Criteria

1. THE Agent SHALL rewrite `.kiro/steering/retro-aesthetic.md` in English and keep every rule in the file: the four hex colors and their roles, the `"Press Start 2P"` font, `image-rendering: pixelated`, the translucent purple shell, the roles of buttons A, B and C, integer pixel scaling and the dot-matrix overlay.
2. THE Agent SHALL rewrite the "Guiding Principles" section of `.kiro/steering/architecture.md` in English and keep its three principles (Ponytail Rule, Zero Audio Lag, Spec Alignment).
3. THE Agent SHALL delete the section "Ringkasan (Bahasa Indonesia)" from the README.
4. WHEN the User answers a question in Indonesian, THE Agent SHALL write the content of that answer in English in every repository file.
5. WHEN the translation work is done, THE Agent SHALL run a case-insensitive whole-word search for `yang|untuk|dengan|harus|gunakan|tombol|layar|warna|ringkasan|adalah` over tracked files, excluding `package-lock.json` and `.kiro/specs/kiroween-submission/`, and confirm zero matches.

### Requirement 3: Resurrection is the only category

**User Story:** As the User, I want the submission to name one category, so that the entry matches what I submit on Devpost.

#### Acceptance Criteria

1. THE README SHALL name Resurrection as the only Kiroween category of the project.
2. THE Agent SHALL remove the line "Bonus category: Costume Contest" from `.kiro/specs/gitgotchi-prd.md`.
3. THE Agent SHALL change the end card in `docs/DEMO_SCRIPT.md` from "Kiroween 2026: Resurrection + Costume Contest" to "Kiroween 2026: Resurrection".
4. THE Agent SHALL rename haunted-ui task 14 to a review of the handheld against the Resurrection theme.
5. WHEN the category edits are done, THE Agent SHALL run a search for `Costume` over tracked files, excluding `.kiro/specs/kiroween-submission/`, and confirm zero matches.

### Requirement 4: Persistent pet store

**User Story:** As a repo owner using the deployed app, I want my pet's poop, resurrections and webhook effects to survive cold starts, so that the pet reflects everything that happened.

#### Acceptance Criteria

1. WHERE `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both set, THE Pet_Store SHALL use the KV_Backend with those two values.
2. WHERE the Upstash pair is incomplete and `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set, THE Pet_Store SHALL use the KV_Backend with the `KV_REST_API_*` pair.
3. WHERE neither pair is complete, THE Pet_Store SHALL use the Memory_Backend.
4. THE Pet_Store SHALL expose `getEntry`, `setEntry` and `appendEvent` as functions that return a Promise, and SHALL keep `normalizeRepoKey` synchronous.
5. WHEN `setEntry` stores an entry, THE Pet_Store SHALL keep at most 50 events, newest first, in both backends.
6. WHEN `appendEvent` is called for a repo key with no entry, THE Pet_Store SHALL resolve to `undefined` and store nothing.
7. WHEN an entry was written through the KV_Backend and a fresh module instance with an empty Memory_Backend reads the same repo key, THE Pet_Store SHALL return an entry equal to the written entry.
8. THE Pet_Store SHALL send the KV token only in an `Authorization: Bearer` header to the configured REST URL.
9. IF a value read from the KV_Backend cannot be parsed as an entry, THEN THE Pet_Store SHALL treat the repo key as having no entry.
10. THE Pet_Store SHALL implement the KV_Backend with the global `fetch` and add no npm dependency.

### Requirement 5: Store failures are reported

**User Story:** As a repo owner, I want a clear error when the store is down, so that no route claims success for a change that was not saved.

#### Acceptance Criteria

1. IF a KV_Backend request fails with a network error, a non-2xx status, an `error` field in the response body, or no answer within 5 seconds, THEN THE Pet_Store SHALL reject with a Store_Error.
2. IF a Store_Error reaches the Pet_API, THEN THE Pet_API SHALL answer HTTP 503 with `{ "error": "store unavailable" }` and `Cache-Control: no-store`.
3. IF a Store_Error reaches the Webhook_Route, THEN THE Webhook_Route SHALL answer HTTP 503 with `success: false`.
4. IF a Store_Error reaches the Local_Poop_Endpoint, THEN THE Local_Poop_Endpoint SHALL answer HTTP 503 with `{ "error": "store unavailable" }`.
5. IF a Store_Error reaches the Badge_Route, THEN THE Badge_Route SHALL answer the `SIGNAL LOST` status card.
6. THE Pet_Store SHALL keep the KV token and the KV URL out of Store_Error messages and route responses.

### Requirement 6: Async callers keep the API contract

**User Story:** As a developer, I want the store change to leave every route's behaviour unchanged, so that the UI, badge and MCP server keep working.

#### Acceptance Criteria

1. THE Pet_Service SHALL await every Pet_Store call in `getPet`, `ingestEvent`, `act`, `seedDemo`, `refresh` and `commit`.
2. THE Webhook_Route and the Local_Poop_Endpoint SHALL await every Pet_Store and Pet_Service call.
3. THE Pet_API SHALL keep the response shape `{ pet, events, source, fetchedAt, error? }` defined in `.kiro/steering/kiro-integration.md`.
4. WHEN `npm test` runs with the Memory_Backend, THE Agent SHALL confirm that `webhook.test.ts`, `pet-store.test.ts`, `local-poop.test.ts` and every other existing suite pass after being updated to await the async functions.
5. THE Agent SHALL add Pet_Store tests that run the KV_Backend against a mocked `fetch` and check the request URL, the `Authorization` header, a write followed by a read, and a rejection on a failed request.

### Requirement 7: Webhook events before the first snapshot

**User Story:** As a repo owner who registers the webhook before anyone opens the pet page, I want those early events to count, so that the first pet I see matches what happened.

#### Acceptance Criteria

1. WHEN the Webhook_Route receives a pet-affecting event for a real repo with no stored entry, THE Pet_Service SHALL store a Placeholder_Entry with that event in its event log and source `github`.
2. WHEN `getPet` seeds a real repo whose stored entry is a Placeholder_Entry, THE Pet_Service SHALL apply the logged `pr_merged`, `issue_opened` and `issue_closed` events to the seeded pet, oldest first, with the Pet_Engine rules.
3. WHEN `getPet` seeds a real repo whose stored entry is a Placeholder_Entry, THE Pet_Service SHALL skip the logged `push` and `ci` events, because the snapshot already counts them through `pushedAt`, `commitsTotal` and `recentRuns`.
4. WHEN a replayed `pr_merged` event is applied, THE Pet_Service SHALL end the PARTY mood 1 hour after that event's original arrival time.
5. WHEN `getPet` seeds over a Placeholder_Entry, THE Pet_Service SHALL keep the original webhook events in the event log and add one `SYNCED WITH GITHUB` event, with no extra log entry per replayed event.
6. THE Pet_Service SHALL replay each logged webhook event at most once, so a later resync of a seeded entry replays nothing.
7. THE Agent SHALL update github-sync requirement R4.8 to describe the replay.

### Requirement 8: SLEEPING is a UI-only mood

**User Story:** As a maintainer, I want no dead fields in the pet state, so that the engine and the spec say the same thing.

#### Acceptance Criteria

1. THE Pet_Engine SHALL set `mood` to one of `DEAD`, `PARTY`, `SICK`, `HUNGRY`, `DIRTY` or `HAPPY` after every event, action and tick.
2. THE Agent SHALL remove the `isSleeping` field from `PetState` in `src/lib/types.ts` and every read or write of `isSleeping` in `src/lib/state-machine.ts` and the LCD_Screen.
3. WHILE the Pet_Console shows the loading LCD, THE Pet_Console SHALL pass mood `SLEEPING` to the LCD_Screen.
4. WHILE the LCD_Screen receives mood `SLEEPING`, THE LCD_Screen SHALL show `ZZZ` in the HUD and the closed-eye sprite frame.
5. THE Agent SHALL add a fast-check property to `src/lib/__tests__/state-machine.test.ts` that checks criterion 1 over random event sequences, and list the property in pet-engine requirement R7 and the properties table.
6. THE Agent SHALL state in the pet-engine requirements and design that `SLEEPING` is set only by the UI for the loading screen.

### Requirement 9: adopt_pet returns the real page URL

**User Story:** As a developer in Kiro chat, I want `adopt_pet` to give me a link that opens my pet, so that I can share it.

#### Acceptance Criteria

1. WHEN `adopt_pet` is called with a repo, THE MCP_Server SHALL return the page URL `{GITGOTCHI_URL}/pet/{owner}/{repo}`.
2. WHEN `adopt_pet` is called with a repo, THE MCP_Server SHALL return badge markdown whose image is `{GITGOTCHI_URL}/api/badge/{owner}/{repo}` and whose link target is `{GITGOTCHI_URL}/pet/{owner}/{repo}`.
3. WHEN the fix is in place and the app is running, THE Agent SHALL call `adopt_pet` and request the returned page URL, and record both Observed_Results.

### Requirement 10: Per-file poop removal

**User Story:** As a developer, I want cleaning one file to remove only that file's poop, so that the pet still shows the smells I left elsewhere.

#### Acceptance Criteria

1. WHEN the Local_Poop_Endpoint receives a clean report for a file with an Outstanding_Poop, THE Local_Poop_Endpoint SHALL lower Poop by 1 (minimum 0) and raise Sanity by 12 (maximum 100).
2. WHEN the Local_Poop_Endpoint removes one file's poop, THE Local_Poop_Endpoint SHALL leave the Outstanding_Poop of every other file in place.
3. WHEN the Local_Poop_Endpoint removes one file's poop, THE Local_Poop_Endpoint SHALL record a `clean` event with source `kiro-hook` and label `clean after {filePath}`.
4. WHEN a user CLEAN action or a resurrection happens, THE Pet_Service SHALL end every Outstanding_Poop of that pet.
5. IF a clean report arrives while the pet is dead, THEN THE Local_Poop_Endpoint SHALL leave the pet and the event log unchanged.
6. WHEN the same dirty file is reported again while its poop is outstanding, THE Local_Poop_Endpoint SHALL keep the Poop count unchanged.
7. THE Diagnosis SHALL list as code-smell findings only files with an Outstanding_Poop, at most 5.
8. THE Agent SHALL define the per-file removal rule in `.kiro/specs/pet-engine/requirements.md`, implement the rule in the Pet_Engine, and update kiro-healer requirements R1.3 and R2.3 and `.kiro/steering/kiro-integration.md`.

### Requirement 11: Kiro Power package

**User Story:** As another Kiro user, I want to install GitGotchi's healer as a Power, so that I get the MCP tools and the summon-healer skill in one step.

#### Acceptance Criteria

1. THE Power SHALL contain `plugin.json`, `mcp.json` and `skills/summon-healer/SKILL.md`.
2. THE Power SHALL declare in `plugin.json` the `$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, the kebab-case `name` `gitgotchi`, a semantic `version`, a `description`, an `author` object with `name`, and a `keywords` array.
3. THE Power SHALL start the MCP_Server from `mcp.json` as a `stdio` server with `GITGOTCHI_URL` defaulting to `http://localhost:3000`, under the `$schema` `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`.
4. THE Power SHALL carry in `SKILL.md` frontmatter with `name: summon-healer` and a `description`, and a body with the steps of `.kiro/steering/summon-healer.md`.
5. THE Agent SHALL keep the hooks in `.kiro/hooks/` and state in the Kiro_Usage_Doc that hooks are not part of the Power format.
6. WHEN the User imports the Power through Powers panel, Add Custom Power, Import power from a folder, THE Agent SHALL record in the Kiro_Usage_Doc the result the User reports.

### Requirement 12: Vercel deployment

**User Story:** As a Kiroween judge, I want a working app URL, so that I can try the pet without installing anything.

#### Acceptance Criteria

1. WHEN the Agent runs the Vercel CLI (`npx vercel`) and the CLI asks for a login, THE Agent SHALL ask the User to complete the login and wait for the User's confirmation.
2. WHEN the User supplies `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET` and the Upstash credentials, THE Agent SHALL make them Production environment variables of the Vercel project.
3. THE Agent SHALL keep secret values out of committed files, chat replies and command text.
4. WHEN the production deployment finishes, THE Agent SHALL record the Production_Domain and the Observed_Results of `GET /` (expect 200), `GET /pet/demo/haunted` (expect 200), `GET /api/badge/demo/haunted` (expect 200 `image/svg+xml`) and `GET /api/pet/zee7x/gitgochi` (expect `source: "github"` and no `error`).
5. WHEN a new production deployment replaces the previous one, THE Agent SHALL confirm that an event recorded before the redeploy is still returned by `GET /api/pet/{owner}/{repo}`.
6. THE Agent SHALL replace every `YOUR-DEPLOYMENT` placeholder in the README and in `docs/DEPLOY.md` with the Production_Domain.
7. THE Agent SHALL document the four KV variables in `.env.example`, the README environment table and `docs/DEPLOY.md`, and rewrite the in-memory limitation section of `docs/DEPLOY.md` to apply only when no KV pair is set.
8. IF the User does not complete the login or does not supply a credential, THEN THE Agent SHALL leave github-sync tasks 9 and 10 and haunted-ui task 10 unchecked and report them as blocked with the missing item.

### Requirement 13: Live webhook on a real repository

**User Story:** As the User, I want proof that a real push moves the deployed pet, so that the demo video shows real behaviour.

#### Acceptance Criteria

1. WHEN the User confirms `gh auth login`, THE Agent SHALL create a webhook on `Zee7X/gitgochi` with `gh api`, with payload URL `https://{Production_Domain}/api/webhook/github`, content type `json`, the value of `GITHUB_WEBHOOK_SECRET` as secret, and the events `push`, `check_run`, `workflow_run`, `pull_request` and `issues`.
2. THE Agent SHALL pass the webhook secret to `gh api` without writing the value in command text or repository files.
3. WHEN the webhook exists, THE Agent SHALL read the webhook's deliveries with `gh api` and record the status code of the `ping` delivery.
4. WHEN the Agent pushes a commit to Origin after the webhook exists, THE Agent SHALL record the status code of the `push` delivery and whether `GET https://{Production_Domain}/api/pet/zee7x/gitgochi` lists a `push` event with source `github`.
5. IF a delivery answers a status other than 200, THEN THE Agent SHALL record the status code and response body and leave github-sync task 9 unchecked.
6. WHEN criteria 3 and 4 show status 200 and the `push` event, THE Agent SHALL check github-sync tasks 9 and 10.

### Requirement 14: Badge through GitHub's image proxy

**User Story:** As a repo owner, I want to know the badge works in a real README, so that I can embed it with confidence.

#### Acceptance Criteria

1. WHEN the README on `origin/main` contains the badge URL on the Production_Domain, THE Agent SHALL read the Camo URL of the badge from GitHub's rendered README HTML (`gh api` with `Accept: application/vnd.github.html`).
2. WHEN the Camo URL is known, THE Agent SHALL request the Camo URL and record the status code, the `Content-Type` and whether the body contains the `@keyframes` rule of the bob animation.
3. WHEN the User has viewed the repository page on GitHub, THE Agent SHALL record whether the User saw the badge pet move.
4. IF Camo answers a status other than 200 or a `Content-Type` other than `image/svg+xml`, THEN THE Agent SHALL record the Observed_Result and leave haunted-ui task 10 unchecked.

### Requirement 15: Browser pass with Playwright

**User Story:** As any visitor, I want the pages to work on a phone and with a keyboard, so that I can use the pet on any device.

#### Acceptance Criteria

1. THE Agent SHALL add `@playwright/test` as a devDependency and an `npm run test:e2e` script that runs the E2E_Suite against the Production_Server.
2. THE E2E_Suite SHALL assert, on the pages `/` and `/pet/demo/haunted` at the viewports 390x844 and 1280x800, that `document.documentElement.scrollWidth` is at most the viewport width.
3. WHEN the E2E_Suite moves focus with the Tab key only, THE E2E_Suite SHALL reach the handheld buttons A, B and C and assert that each focused button has a computed `outline-style` other than `none` or a computed `box-shadow` other than `none`.
4. WHEN the E2E_Suite presses Left, Enter and Esc on `/pet/demo/haunted`, THE E2E_Suite SHALL assert that the LCD menu selection moves, the selected item runs, and the stats view toggles.
5. WHEN the E2E_Suite opens the SUMMON KIRO modal with the keyboard on `/pet/demo/haunted`, THE E2E_Suite SHALL assert that Tab keeps focus inside the modal, Esc closes the modal, and focus returns to the element that opened the modal.
6. IF a page logs a console message of type `error` or `warning`, or throws an uncaught exception, during an E2E_Suite test, THEN THE E2E_Suite SHALL fail that test.
7. THE Agent SHALL keep the E2E_Suite out of `npm test`, and add the Playwright output folders to `.gitignore`.
8. IF the E2E_Suite finds a defect, THEN THE Agent SHALL fix the app and re-run the E2E_Suite with the assertion unchanged.

### Requirement 16: Contrast measurement

**User Story:** As a user with low vision, I want the LCD and the page text to be readable, so that I can see the pet's state.

#### Acceptance Criteria

1. THE Contrast_Test SHALL compute the WCAG 2.2 contrast ratio of every foreground and background color pair used for text or for non-text UI in `src/app/globals.css`, `src/lib/badge-svg.ts`, `src/components/app/HealModal.tsx` and the other components the design lists.
2. THE Contrast_Test SHALL require at least 4.5:1 for text smaller than 24 px (or 18.66 px bold), and at least 3:1 for larger text and for non-text UI such as focus indicators, stat bars and button borders.
3. THE Contrast_Test SHALL assert that each measured hex value appears in the source file named for that pair.
4. IF a pair is below its threshold, THEN THE Agent SHALL change the color in the source file to a value that meets the threshold, inside the four LCD shades for LCD elements, and re-run the Contrast_Test.
5. WHEN the Contrast_Test passes, THE Agent SHALL record the measured ratios from the test output in `.kiro/specs/haunted-ui/design.md`.
6. THE Agent SHALL run the Contrast_Test as part of `npm test`.

### Requirement 17: Media from the production build

**User Story:** As a judge, I want README screenshots that show the real app, so that I see what I will get.

#### Acceptance Criteria

1. THE Media_Capture SHALL capture `docs/media/hero.png` (`/` with the `demo/healthy` handheld), `docs/media/zombie.png` (`/pet/demo/haunted`) and `docs/media/summon-kiro.png` (the SUMMON KIRO modal open on `/pet/demo/haunted`) from the Production_Server with Playwright.
2. WHEN Requirement 14 has produced a Camo Observed_Result with status 200, THE Media_Capture SHALL capture `docs/media/badge.png` from the badge as rendered on the GitHub repository page.
3. IF Requirement 14 is blocked, THEN THE Media_Capture SHALL capture `docs/media/badge.png` from `/api/badge/demo/healthy` on the Production_Server, and the README caption SHALL say so.
4. THE Media_Capture SHALL produce images without the Next.js development indicator.
5. THE Agent SHALL commit the Media_Capture as an npm script so the images can be captured again.

### Requirement 18: Resurrection theme review

**User Story:** As the User, I want the handheld to read as a 90s virtual pet brought back from the dead, so that the entry fits its category.

#### Acceptance Criteria

1. THE Agent SHALL review the shell, the LCD, the four stage sprites, the die and revive animations and the tombstone badge against the Resurrection theme and `.kiro/steering/retro-aesthetic.md`, and record each checked item and its finding in `.kiro/specs/haunted-ui/design.md`.
2. WHEN the review finds a mismatch with `.kiro/steering/retro-aesthetic.md`, THE Agent SHALL fix the mismatch and re-run `npm test` and the E2E_Suite.
3. WHEN the review finds no mismatch, THE Agent SHALL record "no change" with the list of checked items.

### Requirement 19: Kiro verification in this session

**User Story:** As a judge, I want the Kiro integration claims to be backed by what really happened, so that I can trust the write-up.

#### Acceptance Criteria

1. WHILE `npm run dev` runs, WHEN the Agent saves a `.ts` or `.tsx` file under `src/`, THE Agent SHALL record whether hook output appeared, the line the Hook_Script printed, the repo key it reported to, and the Poop count before and after from `GET /api/pet/{owner}/{repo}`.
2. WHEN the Agent adds a code smell to check the hook, THE Agent SHALL remove the smell, save the file again, and record whether the poop was removed.
3. WHILE `npm run dev` runs, THE Agent SHALL call each MCP_Server tool (`get_pet_status`, `diagnose_pet`, `feed_pet`, `clean_pet`, `simulate_event` on a `demo/*` repo, `adopt_pet`) and record each Observed_Result or error.
4. THE Agent SHALL ask the User whether the `gitgotchi` server shows as connected in Kiro's MCP panel and whether both hooks are listed in the hooks panel, and record the answers.
5. WHEN a repo has a real finding, THE Agent SHALL run the `/summon-healer` steps (either the User types `/summon-healer` or the Agent follows the same steps through the MCP_Server), and record which path ran, the findings returned, the change made and the `npm test` result.
6. WHEN the User reports the result of running `.kiro/specs/pet-engine/` through Kiro's Correctness view, THE Agent SHALL record the report and add each proposed property that agrees with the pet-engine requirements to `src/lib/__tests__/state-machine.test.ts` and the properties table.
7. IF a check in this requirement cannot run, THEN THE Agent SHALL record the check as "not verified" with the reason and leave the matching task unchecked.

### Requirement 20: Kiro usage write-up

**User Story:** As a judge, I want a Kiro usage document with first-hand detail and no filler, so that I can score how Kiro was used.

#### Acceptance Criteria

1. THE Agent SHALL replace each `TODO(user)` block in the Kiro_Usage_Doc with Observed_Results labelled with the session date, with the User's answers in English, or with a sentence stating that the item was not done.
2. THE Agent SHALL ask the User the first-hand questions (spec workflow used, vibe coding versus specs, the most useful steering file, how the hooks felt, advice for other builders, screenshots) in one chat message.
3. IF the User supplies no screenshot for an item, THEN THE Agent SHALL remove the reference to that screenshot from the Kiro_Usage_Doc.
4. THE Kiro_Usage_Doc SHALL describe the KV store, the Power, the fixed `adopt_pet`, per-file poop removal and the Playwright pass as they exist in the Repository.
5. WHEN the write-up is done, THE Agent SHALL confirm that `TODO(user)` occurs zero times in the Kiro_Usage_Doc.

### Requirement 21: README for Kiroween judges

**User Story:** As a Kiroween judge, I want a plain README that answers my questions in order, so that I can judge the entry in a few minutes.

#### Acceptance Criteria

1. THE README SHALL state, near the top, the project name, a one-paragraph description, the category Resurrection with one sentence on why the project fits, the problem the project addresses, the app URL on the Production_Domain, the demo video link, the repository URL `https://github.com/Zee7X/gitgochi` and the MIT license with a link to `LICENSE`.
2. WHILE the User has not supplied the demo video URL, THE README SHALL show the visible text "Demo video: not published yet" next to an HTML comment containing `TODO(video)`.
3. IF the Deployment is blocked, THEN THE README SHALL show a placeholder marked `TODO(deploy)` in place of the app URL.
4. THE README SHALL give install and run instructions (Node.js version, `git clone https://github.com/Zee7X/gitgochi`, `npm install`, `.env.local`, `npm run dev`) and the test commands of the Validation_Suite.
5. THE README SHALL state that `.kiro/` is at the repository root and tracked, list what it holds (specs, hooks, steering, MCP settings), name the property-based tests and the Power, and link to the Kiro_Usage_Doc.
6. THE README SHALL keep the environment table (with the four KV variables), the webhook table, the badge snippet, the architecture diagram (showing the KV_Backend and Memory_Backend), the testing section and a known-limits section that states the remaining limits, including last-write-wins in the Pet_Store.
7. THE README SHALL contain no em dash character (U+2014), no emoji, and none of the words `delve`, `leverage`, `robust`, `seamless`, `landscape`, `pivotal`, `foster`, `unleash`, `elevate`, `empower`, `cutting-edge`, `game-changer`, `supercharge`, `revolutionize`, `testament` or `tapestry`.
8. THE README SHALL contain no sentence of the form "not just X, but Y" or "it's not X, it's Y".
9. THE README SHALL state only numbers that appear in the source code, tests, specs or a linked external document.
10. WHEN the README is final, THE Agent SHALL confirm that every relative link points to an existing file and every external link answers HTTP 200 or a redirect.

### Requirement 22: Specs and steering stay true

**User Story:** As a maintainer, I want specs, steering and docs to match the code, so that Kiro and humans read the same truth.

#### Acceptance Criteria

1. WHEN behaviour changes under Requirements 4 to 11, THE Agent SHALL update the matching Feature_Specs `requirements.md` and `design.md` before or in the same commit as the code.
2. WHEN a task in a Feature_Specs `tasks.md` is done and its verification is an Observed_Result, THE Agent SHALL check the task's box.
3. IF a task's verification needs a User step that did not happen, THEN THE Agent SHALL leave the task unchecked and add a one-line note naming the missing step.
4. THE Agent SHALL update `.kiro/steering/kiro-integration.md` for the KV environment variables, the Power, per-file poop removal and the HTTP 503 `store unavailable` answer.
5. THE Agent SHALL update `.kiro/steering/architecture.md` for the KV_Backend, the Power folder and the E2E_Suite folder.
6. THE Agent SHALL update the open-work checklist in `.kiro/specs/gitgotchi-prd.md` section 2.5 to the status shown by the Observed_Results.

### Requirement 23: Validation before every push

**User Story:** As the User, I want each push to build and pass its tests, so that judges never clone a broken commit.

#### Acceptance Criteria

1. WHEN the Agent writes or changes Next.js code, THE Agent SHALL first read the relevant guide in `node_modules/next/dist/docs/`.
2. WHEN a commit that changes files under `src/`, `mcp-server/`, `scripts/`, `e2e/` or `power-gitgotchi/` is ready to push, THE Agent SHALL run every Validation_Suite command that exists in that commit and report each result as returned.
3. IF a Validation_Suite command fails, THEN THE Agent SHALL fix the cause and re-run that command before pushing.
4. THE Agent SHALL report a command as passed only when the Agent ran the command in this session and the command exited with code 0.
