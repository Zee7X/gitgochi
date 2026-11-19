# Demo video script (under 3 minutes)

Target length: **2:50**. Hard limit 3:00 (judges are not required to watch further). One story, not a feature list: **a repo dies, Kiro fixes it, the pet climbs out of the grave.**

Kiroween rules for the video: show the project working on the device it was built for (browser, desktop; one mobile shot is a bonus), upload to YouTube as **Public**, and no third-party trademarks, copyrighted music or other copyrighted material. The pet's 8-bit sounds are synthesized by the app (Web Audio), so they are safe to use.

## Before recording

Browser and screen:

- [ ] Fresh Chrome profile or a guest window: no bookmarks bar, no extensions, no other tabs. Close every tab that plays audio (YouTube, Spotify): any song that leaks into the recording is copyrighted material.
- [ ] Zoom 110 to 125 % so the pixel font reads at 1080p. Record at 1920x1080 with OBS Studio.
- [ ] Turn system notifications off (Windows: Focus assist / Do not disturb).
- [ ] Sound on in the app (the SND hole on the handheld is not muted).

App state, checked the same day:

- [ ] <https://gitgochi.lumelo.my.id> loads; `/pet/demo/haunted` and `/pet/demo/necromancer` look as described below. Press RESET DEMO on each demo first so they start from the fixture.
- [ ] Signed in as Zee7X in the main window; a **second, incognito** window ready for the "outsider" shot.
- [ ] `zee7x/template-wedding` (private) listed in MY PETS.
- [ ] A README on GitHub that shows the badge (this repo, or Pocket-Flow), opened in a tab.

Kiro IDE (for 1:35 to 2:15):

- [ ] `npm run dev` on port 3000 with `GITHUB_TOKEN` in `.env.local`; `localhost:3000/pet/zee7x/gitgochi` open once.
- [ ] MCP panel shows `gitgotchi` connected; chat mode **Approve for me** (no approval pop-ups on camera).
- [ ] Editor font size up (Ctrl + =), side panels you do not need closed, `.env.local` **not** open in any tab.
- [ ] Rehearse once: add `console.log('test')` to `src/lib/heal.ts`, see the poop, run `/summon-healer`, see it removed. Then `git checkout src/lib/heal.ts`.

## Script

| Time | On screen | Voice-over (English) |
|---|---|---|
| **0:00 – 0:12** | GitHub README with the GitGotchi badge as a tombstone (`R.I.P. — FIX CI TO REVIVE`). Slow zoom on the badge | "This repo's CI has been red for a week. Nobody noticed. Its pet did." |
| **0:12 – 0:28** | Cut to the home page of GitGotchi, the handheld idling | "Failing builds and dead repos hide in notifications we have all learned to ignore. GitGotchi turns a repo's health into a 90s virtual pet: green CI keeps it alive, red builds hurt it, and silence starves it." |
| **0:28 – 0:55** | Type a public repo into **ADOPT YOUR REPO**. Pet page: `LIVE FROM GITHUB` tag, STATS card (HP from CI, fullness from pushes, sanity from stale issues). Click **ADD TO README**: the GitHub editor opens, paste, show the badge in the preview | "Adopt any public repo, no account needed. The stats come from the repo's real CI runs, pushes and stale issues. One click puts a live badge in the README, and it keeps following the repo on its own." |
| **0:55 – 1:35** | `/pet/demo/haunted`. Press **REVIVE**: the LCD says `FIX CI FIRST`. Click **CI PASS** in the simulator: resurrection animation, the pet rises as a ghost with a stitch, the stats card shows **Rising: Demon after 24h more**. Then open `/pet/demo/necromancer` | "A dead pet cannot just be revived. The server refuses until CI is green. This is a labelled simulation on a demo pet. Fix the build and it climbs out of the grave, but only as a ghost, with a scar. It has to prove itself for a day before it can be a demon again. And a repo that came back from the dead and stayed healthy for a week earns the rare stage: the Necromancer." |
| **1:35 – 2:15** | **Kiro IDE.** Agent adds `console.log('test')` to `src/lib/heal.ts` and saves: cut to `localhost:3000/pet/zee7x/gitgochi`, poop on the LCD, event `console.log in src/lib/heal.ts` tagged KIRO. Back in Kiro: `/summon-healer`, the `diagnose_pet` call, the agent removes the line, the poop disappears, `npm test` green | "Here is the part only Kiro can do. A Kiro hook watches every save: leave a console.log behind and the pet makes a mess. Summon Kiro calls GitGotchi over MCP, gets the real findings, including the failing CI log, fixes the code spec-first and runs the tests. GitGotchi never writes to your repo. Kiro does the fixing, in your workspace." |
| **2:15 – 2:35** | Signed in: home page "Welcome back", YOUR PETS with a PRIVATE repo, KEEPER TOOLS on its pet page. Switch to the incognito window, same URL: `NO GRAVE FOUND` | "Sign in with GitHub and every pet belongs to its repo's team. Collaborators care for it, everyone else can only look. Private repos work too: encrypted, read-only, and invisible to anyone outside the repo." |
| **2:35 – 2:50** | Quick pan over `.kiro/`: `specs/` (five features), `hooks/`, `steering/`, `settings/mcp.json`. End card: GitGotchi logo, `gitgochi.lumelo.my.id`, `github.com/Zee7X/gitgochi`, "Kiroween 2026 · Resurrection · MIT" | "Built spec-first with Kiro: specs, hooks, steering, MCP and a Power, all in the repo. GitGotchi. Keep your repo alive." |

The voice-over is about 290 words, which fits 2:50 at a calm pace with room for the pet sounds. If a take runs long, shorten 0:28 to 0:55 first (skip the GitHub preview) and keep the Kiro segment intact: it is what sets this project apart.

## Honesty checklist

- [ ] The resurrection in 0:55 to 1:35 is said out loud to be a **labelled simulation** on a demo pet; the `SIMULATED` tag is visible in the event log.
- [ ] The Kiro segment shows what Kiro actually did, in one take or with visible cuts; nothing is staged as a fix that did not happen.
- [ ] No claim that GitGotchi opens pull requests or edits code.
- [ ] Repo URL and MIT license visible in the end card.
- [ ] Final length under 3:00.

## Fallbacks

- **Kiro IDE misbehaves on camera** (approval pop-up, MCP not connected): record the hook and `/summon-healer` part separately and cut it in; or show the HEAL button on the website (same diagnosis) and say so.
- **Hook poop does not appear within 5 seconds:** refresh the pet page; the first save against a cold dev server can be missed, so save once more.
- **GitHub rate limit (`github rate limit reached`) on localhost:** `GITHUB_TOKEN` is missing from `.env.local` or the dev server was not restarted.
- **Chrome shows a red warning during sign in:** sign in now runs on `gitgochi.vercel.app`; if a warning still appears, skip the sign-in moment and start the 2:15 segment already signed in.

## After recording

1. Edit in CapCut or DaVinci Resolve (both free). Add English subtitles: many judges watch muted.
2. Background music only from the YouTube Audio Library, or none.
3. Upload to YouTube as **Public**. Title: `GitGotchi: the Repo-Necromancer (Kiroween 2026)`. Put the app and repo links in the description.
4. Send the link, so the "Demo video" line at the top of the README is replaced.
