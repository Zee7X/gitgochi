# Deploy to Vercel

GitGotchi is a standard Next.js app (App Router). No `next.config` or `vercel.json` is needed. Routes that read live state declare `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.

## Steps

1. Push the repository to GitHub.
2. On <https://vercel.com/new> import the repository. Framework preset: Next.js. Build command `npm run build`, install `npm install` (the defaults).
3. Add the environment variables below (Project Settings, Environment Variables), then deploy.
4. Open `https://<your-deployment>/` and `https://<your-deployment>/pet/demo/healthy` to check the demos, then adopt a real repo.
5. Replace `YOUR-DEPLOYMENT` in `README.md` with the real domain so the badge renders.

Before pushing, run `npm run build` locally once to catch type or build errors.

## Environment variables

| Variable | Set on Vercel? | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | **Yes, required** | Fine-grained token, public repositories read-only, no scopes. Unauthenticated GitHub allows 60 requests per hour per IP; one adoption costs about 4. Vercel shares IPs, so without a token real repos fail with `github rate limit reached` (503). With it the limit is 5000 per hour. Demo repos work without it |
| `GITHUB_WEBHOOK_SECRET` | Yes | Random string, same value in the GitHub webhook. When unset, anyone can post events |
| `GITGOTCHI_HOOK_TOKEN` | Only if you want the Kiro hook to report to the deployed app | Bearer token for `/api/local-poop`. Without it only localhost callers are accepted. Set the same value locally for the hook script |
| `GITGOTCHI_URL`, `GITGOTCHI_REPO` | No | Local only: used by the hook script and the MCP server on your machine (`.env.example`) |

Create the token at GitHub, Settings, Developer settings, Fine-grained tokens: resource owner yourself, repository access "Public repositories (read-only)", no extra permissions. Do not commit it; `.gitignore` excludes `.env*` except `.env.example`.

## Webhook

On each repository whose pet should update live: Settings, Webhooks, Add webhook.

- Payload URL: `https://<your-deployment>/api/webhook/github`
- Content type: `application/json`
- Secret: the value of `GITHUB_WEBHOOK_SECRET`
- Events: pushes, check runs (or workflow runs), pull requests, issues

After saving, GitHub sends a `ping`; the route answers `200 {"ok":true}`. Check "Recent Deliveries" on GitHub for the response. `GET /api/webhook/github` returns a short help JSON.

## Limitation: the store is in memory

`src/lib/pet-store.ts` keeps pets in a `Map` in the server process. On Vercel every cold start, redeploy and (potentially) separate serverless instance starts with an empty store. Consequences, stated plainly:

- Real repos re-seed from GitHub on the next request, so CI state, commit count and stale issues come back.
- What exists only in memory is lost: poop reported by the Kiro hook, the resurrection count, and webhook events that arrived before the next snapshot.
- Webhook events for a repo may land on an instance that is not the one serving the page.
- Demo pets are rebuilt from fixtures, so they are unaffected.

For a demo recorded in one sitting this is acceptable, but do not claim persistence. **Next step:** a KV store (for example Vercel KV or Upstash Redis) behind the four functions in `src/lib/pet-store.ts`. It is an open task in `.kiro/specs/github-sync/tasks.md` (task 7).

## After deploy checklist

- [ ] `/` loads and the demo handheld animates
- [ ] `/pet/demo/haunted` shows the dead pet and `/api/badge/demo/haunted` returns an SVG
- [ ] A real repo loads with `LIVE FROM GITHUB`
- [ ] Webhook ping returns 200; a push shows in the event log
- [ ] Badge renders in a real GitHub README (not verified yet; `.kiro/specs/haunted-ui/tasks.md` task 10)
