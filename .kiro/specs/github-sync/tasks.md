# GitHub Sync: Tasks

- [x] 1. GitHub snapshot fetcher `src/lib/github.ts` with rate-limit and 404 errors (R1, R2)
- [x] 2. Pet service `src/lib/pet-service.ts`: cache TTL, backoff, fallback, demo fixtures (R1, R2)
- [x] 3. Pet API routes: `GET /api/pet/{owner}/{repo}`, `POST .../action` (R1, R5)
- [x] 4. Signed webhook `POST /api/webhook/github` routed per repository (R3, R4)
- [x] 5. Tests: `github.test.ts`, `pet-service.test.ts`, `pet-store.test.ts`, `webhook.test.ts`
- [x] 6. Webhook setup panel in the UI (`src/components/app/WebhookSetup.tsx`)
- [x] 7. Persistent store: replace the four functions in `src/lib/pet-store.ts` (`getEntry`, `setEntry`, `appendEvent`, `normalizeRepoKey` stays) with a KV backend (for example Vercel KV / Upstash Redis) so pets survive cold starts. Keep callers unchanged; the service is async-ready except `ingestEvent` and `getEntry` callers, which must become async.
- [x] 8. Carry a webhook that arrived before the first snapshot into the seeded pet (needs task 7)
- [ ] 9. Register the webhook on a real repo, push a commit and confirm the pet reacts (needs a deployed URL; see `docs/DEPLOY.md`)
- [x] 10. Set `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` in the deployment and re-run the demo against a real repo

Notes:
- Task 9: deployed at `https://gitgochi.vercel.app`. The route checks signatures in production (signed `ping` answers 200, unsigned or wrong signature answers 401). Webhook 713846624 registered on `Zee7X/gitgochi` (push, check_run, workflow_run, pull_request, issues); GitHub's `ping` delivery answered 200.
- Task 10: both variables set on the Vercel production target (2026-11-19). `/api/pet/Zee7X/gitgochi` answers with `source: "github"`.
