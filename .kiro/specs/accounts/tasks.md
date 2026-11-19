# Accounts: Tasks

Phase 1 can ship on its own and fixes shared demo pets right away.

## Phase 1: personal demo pets (R7)

- [x] 1. `src/lib/demo-local.ts`: load, save and reset `demo/*` pets in `localStorage`, seeded from the fixtures; run `applyEvent` and the feed, clean and revive rules in the browser
- [x] 2. `usePet` and `PetConsole`: use `demo-local` for `demo/*`; simulator and RESET DEMO stay labelled `simulated`
- [x] 3. Server: stop writing `demo/*` to the store; badge for `demo/*` renders from the fixture (R7.4); delete `gitgotchi:pet:demo/*` keys
- [x] 4. Tests: `demo-local.test.ts`; E2E with two browser contexts (R7.1)

## Phase 2: sign in and roles (R1, R2)

- [x] 5. Owner: register the GitGotchi GitHub App (permissions, events, callback `https://gitgochi.lumelo.my.id/api/auth/callback`, webhook `https://gitgochi.lumelo.my.id/api/github-app/webhook`) and generate a private key
- [x] 6. Set the new environment variables on Vercel production and preview (`design.md`, Environment variables)
- [x] 7. `session.ts`, `/api/auth/{login,callback,logout}`, SIGN IN / SIGN OUT in `SiteChrome`
- [x] 8. `access.ts` and the `ctx` argument in `pet-service`; keeper-only actions with the `Origin` check (R2.2, R2.3)
- [x] 9. Read-only pet UI for visitors (R2.4)
- [x] 10. Tests: `session.test.ts`, `access.test.ts`

## Phase 3: GitHub App webhooks and private repos (R3, R4, R5)

- [x] 11. `github-app.ts`: app JWT, installation tokens, repo to installation lookup
- [x] 12. `/api/github-app/webhook` with `installation` and `installation_repositories` handling; move `toPetEvent` to `src/lib/webhook-map.ts`
- [x] 13. Private snapshot path with the installation token; 404 for visitors (R3.3); no private names in logs (R3.4)
- [x] 14. Badge keys: settings route, rotate, private badge check (R5)
- [x] 15. INSTALL GITGOTCHI button for repos without the app (R3.2)
- [x] 16. Tests: `github-app-webhook.test.ts`, private cases in `badge.test.ts` and `pet-service.test.ts`

## Phase 4: hook tokens, My pets, docs (R6, R8)

- [x] 17. Per-pet hook tokens: create, show once, revoke; `/api/local-poop` and MCP accept them (R6)
- [x] 18. `/me` page (R8)
- [x] 19. README, `docs/DEPLOY.md`, `.kiro/steering/kiro-integration.md` and `architecture.md` updated
- [ ] 20. Manual check on the deployment (`design.md`, Testing), then remove the manual webhook on `Zee7X/gitgochi`

## Privacy (R9), done alongside Phase 3

- [x] 22. Encrypt private pet entries in `pet-store.ts` with `DATA_ENCRYPTION_KEY`; webhook parser keeps only the mapped fields (R9.1 to R9.3)
- [x] 23. `private, no-store` and `noindex` headers on private responses; private badge not cached by the CDN (R9.5)
- [x] 24. Delete on uninstall, on repo removal and on DELETE PET; session cleanup (R9.6 to R9.8)
- [x] 25. `/privacy` page (R9.9)
- [x] 26. Tests: a private entry read straight from the store is ciphertext; a webhook body with commit messages leaves no trace in the stored entry; uninstall removes the keys
- [ ] 21. Optional: key private entries by `repoId` so repo names stay out of the store key list

Notes:
- Task 3: stale `gitgotchi:pet:demo/*` keys from before this feature are never read again; they can be removed in the Upstash data browser.
- Task 5: registered 2026-11-19 as `gitgotchi-pet` (app id 5828145) through `/setup/github-app`.
- Task 20: Zee7X signed in on production, `/me` lists `zee7x/gitgochi` as KEEPER / PUBLIC, KEEPER TOOLS shows on its pet. App installed on `Zee7X/gitgochi` (`installation created` delivered 200); manual webhook 713846624 removed so events are not counted twice.
