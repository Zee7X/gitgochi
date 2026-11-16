# Demo video script (under 3 minutes)

Target length: 2:45. Record the screen at 1080p, voice-over in English, 8-bit sound on for the pet moments.
Every beat below uses a feature that exists in the repo. Rehearse once so no step waits on a network call.

## Before recording

- [ ] Deployed app (or `npm run dev`) running, `GITHUB_TOKEN` set, so a real repo loads (`docs/DEPLOY.md`)
- [ ] A throwaway demo repo on GitHub with a workflow that runs `npm test`, the webhook pointing at `/api/webhook/github` (`README.md`, Webhook setup), `GITHUB_WEBHOOK_SECRET` set
- [ ] Kiro IDE open on this project, `gitgotchi` MCP server connected (`.kiro/settings/mcp.json`), app opened once in the browser
- [ ] The demo repo has one failing test ready to push, and its fix ready
- [ ] The demo repo README contains the badge snippet; the README tab is open
- [ ] Browser zoom so the handheld fills the screen; volume checked

## Script

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:15 | Hook: the zombie pet on the tombstone, then cut to a failing CI list | "Your CI has been red for a week. Nobody noticed. This pet did. Meet GitGotchi, a 90s virtual pet whose health is your repo's health." |
| 0:15 to 0:35 | Home page `/`, type the demo repo as `owner/repo` in the adopt form, land on `/pet/{owner}/{repo}`. Point at the `LIVE FROM GITHUB` tag | "Adopt any public repo. The pet is seeded from its real CI runs, commits and issues. No fake data: demo pets and simulated events are labelled." |
| 0:35 to 0:55 | Push a commit to the repo. The pet page refreshes (webhook, or press SYNC NOW) and shows `PUSH` in the event log; Fullness goes up. Pet looks happy | "A signed webhook feeds it. Every push is food; every green build is health." |
| 0:55 to 1:20 | Push the failing test. CI fails, the pet loses 25 HP per failed run. Repeat until HP hits 0: die animation, tombstone | "Red CI hurts it. Enough red and it dies. This is the Resurrection category: the pet is only coming back if the repo does." |
| 1:20 to 1:35 | Switch to the repo README tab: the live badge now shows the tombstone with `R.I.P. - FIX CI TO REVIVE`. Back to the app, press REVIVE: the ticker says `FIX CI FIRST` | "The README badge shows it to everyone who opens the repo. And you cannot just press revive: the repo has to be fixed first." |
| 1:35 to 2:15 | In Kiro: show the specs panel for a second, then type `/summon-healer` (or ask for `diagnose_pet`). The MCP call returns the real findings: failing CI run with its link. Kiro fixes the test, runs `npm test`, shows it green | "Inside Kiro, the GitGotchi MCP server diagnoses the repo: which run failed, which issues are stale, what smells the hook found. Kiro works from the spec, fixes the code and runs the tests. GitGotchi never opens PRs on its own, and it never claims a fix it did not make." |
| 2:15 to 2:25 | While Kiro edits a file, show the poop-detector hook: add a `console.log`, save, the pet poops on the LCD; remove it, save, the poop is gone | "A Kiro hook watches every save. Leave a console.log behind and the pet makes a mess." |
| 2:25 to 2:40 | Push the fix. CI goes green, webhook fires, the pet revives with the resurrection animation, `BABY_GHOST` on screen. Badge refreshes | "Push the fix, CI goes green, and it climbs out of the grave." |
| 2:40 to 2:50 | Title card: GitGotchi, repo URL, "Kiroween 2026: Resurrection". Flash `.kiro/` tree: specs, hooks, steering, MCP | "Specs, hooks, steering and an MCP server, all in `.kiro/`. GitGotchi: keep your repo alive." |

## Fallbacks

- **No time for a real CI round trip:** use `demo/haunted` (dead pet) and the simulator panel (`CI PASS`, then REVIVE) for the resurrection beat, and say on camera that it is a labelled simulation. Do not present it as a real repo.
- **Webhook not arriving:** press SYNC NOW on the pet page, which re-reads GitHub, and do not claim it was the webhook.
- **GitHub rate limit:** `github rate limit reached` means `GITHUB_TOKEN` is missing or exhausted. Fix before recording.
- **MCP not connected:** run `npm run dev` first and check the MCP panel; the app must be reachable at `GITGOTCHI_URL`.

## Honesty checklist for the final cut

- [ ] Nothing shown as real that is simulated (labels visible on screen)
- [ ] No claim of an automatic PR or an automatic fix
- [ ] The Kiro segment shows what Kiro actually did, including any failure
- [ ] Length under 3:00 (Kiroween limit)
- [ ] Repo link and license (MIT) visible in the end card
