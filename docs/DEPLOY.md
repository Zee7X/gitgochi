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
| `SESSION_SECRET`, `DATA_ENCRYPTION_KEY` | Yes, sensitive | 32 random bytes each. Sessions and private pets are encrypted with them. Losing `DATA_ENCRYPTION_KEY` makes stored private pets unreadable (they re-seed from GitHub) |
| `APP_ORIGIN` | Yes | `https://gitgochi.lumelo.my.id`. Same-origin check, end of sign in |
| `AUTH_ORIGIN` | Optional | `https://gitgochi.vercel.app`. Sign in runs there; needs `https://gitgochi.vercel.app/api/auth/callback` as the GitHub App's callback URL and no Vercel domain redirect on that host (the app redirects every other path itself, `next.config.ts`). Set it before the build, because `next.config.ts` reads it |
| `GITHUB_APP_*` (6 variables) | Yes, after [registering the app](#github-app) | Sign in, keepers, private repos, live webhooks |
| `SETUP_TOKEN` | Only while registering the app | Unlocks `/setup/github-app`; delete it afterwards |
| `GITHUB_WEBHOOK_SECRET` | Only for manual webhooks | Random string, same value in the GitHub webhook. When unset, anyone can post events |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Yes, injected by the Upstash integration | Persistent pet store. See [Persistent store](#persistent-store-upstash-redis) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Only when setting the store by hand | Same store; this pair wins over the `KV_REST_API_*` pair when both are set |
| `GITGOTCHI_HOOK_TOKEN` | Only if you want the Kiro hook to report to the deployed app | Bearer token for `/api/local-poop`. Without it only localhost callers are accepted. Set the same value locally for the hook script |
| `GITGOTCHI_URL`, `GITGOTCHI_REPO` | No | Local only: used by the hook script and the MCP server on your machine (`.env.example`) |

Create the token at GitHub, Settings, Developer settings, Fine-grained tokens: resource owner yourself, repository access "Public repositories (read-only)", no extra permissions. Do not commit it; `.gitignore` excludes `.env*` except `.env.example`.

## GitHub App

GitGotchi signs people in and receives webhooks through one GitHub App with read-only permissions. Register it once per deployment:

1. Set `APP_ORIGIN` and a random `SETUP_TOKEN` in Vercel, deploy.
2. Open `https://<your-deployment>/setup/github-app?token=<SETUP_TOKEN>` and press CREATE GITHUB APP. GitHub creates the app from a manifest: permissions metadata, contents, actions, checks, issues and pull requests (all read), events push, check run, workflow run, pull request, issues and repository, callback `/api/auth/callback`, webhook `/api/github-app/webhook`, public so anyone can install it.
3. GitHub returns to `/setup/github-app/done` with a one-time code (valid one hour). Exchange it: `curl -X POST https://api.github.com/app-manifests/<code>/conversions`. The answer holds `id`, `slug`, `client_id`, `client_secret`, `webhook_secret` and `pem`.
4. Put them in Vercel as `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` (sensitive), `GITHUB_APP_WEBHOOK_SECRET` (sensitive) and `GITHUB_APP_PRIVATE_KEY` (sensitive, the PEM). Delete `SETUP_TOKEN`, redeploy.
5. `GET /api/auth/me` now answers `signInAvailable: true` and an `installUrl`.

The production app is `gitgotchi-pet` (<https://github.com/apps/gitgotchi-pet>).

## Manual webhook (older setups)

On each repository whose pet should update live: Settings, Webhooks, Add webhook.

- Payload URL: `https://<your-deployment>/api/webhook/github`
- Content type: `application/json`
- Secret: the value of `GITHUB_WEBHOOK_SECRET`
- Events: pushes, check runs (or workflow runs), pull requests, issues

After saving, GitHub sends a `ping`; the route answers `200 {"ok":true}`. Check "Recent Deliveries" on GitHub for the response. `GET /api/webhook/github` returns a short help JSON.

## Persistent store (Upstash Redis)

`src/lib/pet-store.ts` keeps each pet as JSON under `gitgotchi:pet:<owner/repo>` in Upstash Redis, called over its REST API with plain `fetch` (no extra package). Every serverless instance reads and writes the same store, so pets survive cold starts and redeploys.

**Option A, Vercel Marketplace (recommended).** In the Vercel project open Storage (or Integrations), add **Upstash for Redis**, create a database and connect it to this project for every environment you deploy. The integration injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Redeploy so the new variables take effect.

**Option B, by hand.** Create a Redis database at <https://console.upstash.com>, copy the REST URL and the REST token (not the read-only token) and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Project Settings, Environment Variables. This pair wins when both pairs are set.

If neither pair is complete, the app falls back to a `Map` in the server process, which is what local development uses. Without KV on Vercel, every cold start, redeploy and separate serverless instance starts empty:

- Real repos re-seed from GitHub on the next request, so CI state, commit count and stale issues come back.
- Poop reported by the Kiro hook, the resurrection count and webhook effects are lost.
- A webhook can land on an instance that is not the one serving the page.
- Demo pets are rebuilt from fixtures, so they are unaffected.

When the store is configured but unreachable (network error, non-2xx answer, an `error` reply or no answer within 5 seconds), the pet API, `/api/auto-heal` and `/api/local-poop` answer `503 {"error":"store unavailable"}`, the webhook answers `503 {"success":false,"error":"store unavailable"}`, and the badge shows `SIGNAL LOST`. The KV URL and token never appear in these responses.

Still true with KV: writes are read-then-write, not transactions, so two events for the same repo that land at the same instant can overwrite each other. A webhook for a repo nobody has opened yet is stored as a placeholder; its PR and issue events are replayed once onto the first snapshot (github-sync R4.8).

## After deploy checklist

Production is <https://gitgochi.lumelo.my.id> (checked 2026-11-19).

- [x] `/` loads and the demo handheld animates
- [x] `/pet/demo/haunted` shows the dead pet and `/api/badge/demo/haunted` returns an SVG
- [x] A real repo loads with `LIVE FROM GITHUB`
- [x] Webhook ping returns 200; a push shows in the event log
- [x] `/api/auth/me` answers `signInAvailable: true`
- [ ] Sign in, keeper actions, a private repo and its badge checked on the deployment (`.kiro/specs/accounts/tasks.md` task 20)
- [x] Badge renders in a real GitHub README through the camo proxy, with the CSS bob
