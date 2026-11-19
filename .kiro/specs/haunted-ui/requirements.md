# Haunted UI: Requirements

The retro handheld, the pages around it, and the live README badge.
Code: `src/components/` (`RetroShell.tsx`, `LcdScreen.tsx`, `PixelSprites.tsx`, `lcd/pixel-maps.ts`, `app/`), `src/app/page.tsx`, `src/app/pet/[owner]/[repo]/page.tsx`, `src/hooks/usePet.ts`, `src/lib/audio-synth.ts`, `src/lib/badge-svg.ts`, `src/app/api/badge/[owner]/[repo]/route.ts`. Steering: `.kiro/steering/retro-aesthetic.md`. Design: `design.md`.

## Requirements

### R1. Handheld and LCD

**User story:** As a user, I want the repo to look like a 90s virtual pet, so the status is fun to read.

Acceptance criteria:
1. THE SYSTEM SHALL render a translucent purple handheld with a 4-shade green LCD (`#0f380f #306230 #8bac0f #9bbc0f`) and three buttons A, B and C.
2. THE SYSTEM SHALL draw each stage (`EGG`, `BABY_GHOST`, `CODE_DEMON`, `ZOMBIE_CORPSE`) from pixel maps in `src/components/lcd/pixel-maps.ts`.
3. THE SYSTEM SHALL show HP, Fullness and Sanity, poop, the stage and a status line on the LCD.
4. WHEN A, B or C is pressed (or Left / Enter / Esc), THE SYSTEM SHALL cycle the menu, run the selected item, or toggle stats.
5. THE SYSTEM SHALL synthesize all sound with the Web Audio API (`src/lib/audio-synth.ts`) and ship no audio files.
6. THE SYSTEM SHALL serve a favicon through the App Router `icon` file convention (`src/app/icon.svg`): the `BABY_GHOST` frame 0 matrix drawn pixel for pixel in the 4 LCD shades on a `#9bbc0f` tile, with `shape-rendering="crispEdges"`, and no `metadata.icons` entry that overrides it.

### R2. Live pet console

**User story:** As a user, I want the device to reflect the real repo and react to what I do.

Acceptance criteria:
1. WHEN `/pet/{owner}/{repo}` loads, THE SYSTEM SHALL fetch `GET /api/pet/{owner}/{repo}` and poll it every 15 seconds while the tab is visible, and refetch when the tab becomes visible again.
2. WHILE data is loading, THE SYSTEM SHALL show an LCD with `LOADING...`.
3. IF the request fails (400, 404, 503, 500 or network), THEN THE SYSTEM SHALL show an error card with a link back, a retry and demo repo links.
4. WHEN the API answers `source: 'fallback'`, THE SYSTEM SHALL show an `OFFLINE CACHE` tag.
5. WHEN the stage changes to `ZOMBIE_CORPSE`, THE SYSTEM SHALL play the die animation. WHEN it changes back, THE SYSTEM SHALL play the revive animation.
6. WHILE the pet is alive, THE SYSTEM SHALL offer FEED, CLEAN, HEAL and STATS. WHILE it is dead, THE SYSTEM SHALL offer REVIVE and HEAL.
7. IF REVIVE answers 409, THEN THE SYSTEM SHALL tell the user to fix CI first.
8. WHEN HEAL is chosen, THE SYSTEM SHALL call `POST /api/auto-heal` and open the SUMMON KIRO modal with the real findings and a COPY PROMPT button. It SHALL NOT change the pet's stats.
9. THE SYSTEM SHALL show the simulator panel only for `demo/*` repos, or when `NODE_ENV` is not `production`.

### R3. Landing and adoption

**User story:** As a visitor, I want to try a demo pet immediately and adopt my own repo.

Acceptance criteria:
1. THE SYSTEM SHALL serve `/` with a live `demo/healthy` handheld, an adopt form and demo chips.
2. WHEN the user enters `owner/repo` or a GitHub URL, THE SYSTEM SHALL normalize it (`src/components/app/parse-repo.ts`) and navigate to `/pet/{owner}/{repo}`.
3. IF the input is neither, THEN THE SYSTEM SHALL show a validation message.
4. THE SYSTEM SHALL show the badge embed (live image and a markdown snippet using the page origin) and the webhook setup instructions on the pet page.

Verified by: `src/components/app/__tests__/parse-repo.test.ts`.

### R4. Accessibility and layout

**User story:** As any user, I want the page to work with a keyboard and on a phone.

Acceptance criteria:
1. THE SYSTEM SHALL keep a visible focus indicator on every interactive element.
2. WHILE the heal modal is open, THE SYSTEM SHALL trap focus, close on Esc and restore focus on close.
3. THE SYSTEM SHALL fit a 390 px wide viewport without horizontal overflow (the shell is 340 px wide).
4. THE SYSTEM SHALL keep text at 4.5:1 or more and UI states, borders and focus indicators at 3:1 or more against their background (WCAG 2.1 AA), except the known limits listed under Contrast in `design.md`.

Verified by: `src/lib/__tests__/contrast.test.ts` (R4.4).

### R5. Live badge

**User story:** As a repo owner, I want a badge in my README that shows my pet, so the repo's health is public.

Acceptance criteria:
1. WHEN `GET /api/badge/{owner}/{repo}` (or `repo.svg`) is requested, THE SYSTEM SHALL answer an `image/svg+xml` card (360x120) of the real pet from `getPet`, with the stage sprite, HP, FUL and SAN bars and the repo name (truncated to 25 characters).
2. WHEN `?size=small` is given, THE SYSTEM SHALL answer a 220x40 variant. WHEN `?static=1` is given, THE SYSTEM SHALL omit the animation.
3. WHILE the pet is dead, THE SYSTEM SHALL draw the tombstone sprite in an inverted palette with `R.I.P. - FIX CI TO REVIVE` and no animation.
4. THE SYSTEM SHALL work inside GitHub's image proxy: no scripts, no external fonts or images, no JavaScript; only inline SVG and CSS.
5. THE SYSTEM SHALL escape every interpolated string.
6. IF the repo key is invalid, THEN THE SYSTEM SHALL answer 400 `INVALID REPO`. IF the repo does not exist, THEN 200 `REPO NOT FOUND`. IF GitHub fails and nothing is cached, THEN 200 `SIGNAL LOST`.
7. THE SYSTEM SHALL send `Cache-Control: max-age=120, s-maxage=60, stale-while-revalidate=60` (short, so a README badge follows the pet within minutes) and an `ETag`, and answer 304 on a matching `If-None-Match`.

Verified by: `src/lib/__tests__/badge.test.ts`.

### R6. Honest content

**User story:** As a judge, I want nothing on screen to be made up.

Acceptance criteria:
1. THE SYSTEM SHALL NOT show invented numbers, avatars or testimonials.
2. THE SYSTEM SHALL label demo pets (`DEMO PET`) and simulated events (`simulated`).
