# Haunted UI: Design

Implements `requirements.md`.

## Pages

| Route | File | Content |
|---|---|---|
| `/` | `src/app/page.tsx` | Hero, live `demo/healthy` device, `AdoptForm`, `DemoChips`, `HowItWorks` |
| `/pet/[owner]/[repo]` | `src/app/pet/[owner]/[repo]/page.tsx` | `PetConsole`, `StatsCard`, `EventLog`, `SimulatorPanel`, `BadgeEmbed`, `WebhookSetup` |

## Components (`src/components/`)

| File | Role |
|---|---|
| `RetroShell.tsx` | The handheld case, buttons A/B/C, `haunted` flag while dead |
| `LcdScreen.tsx` | LCD: sprite, stat bars, menu icons, ticker, animations (`die`, `revive`, `eat`, `clean`, `heal`) |
| `PixelSprites.tsx`, `lcd/pixel-maps.ts` | Sprite matrices per stage, poop, icons, `deriveMood`, `composeSprite`, `spriteRuns` |
| `app/PetConsole.tsx` | Wires `usePet` to the shell: menus, effects and sounds, heal modal |
| `app/HealModal.tsx` | SUMMON KIRO modal: findings, COPY PROMPT, focus trap |
| `app/AdoptForm.tsx`, `app/parse-repo.ts` | Input to `/pet/{owner}/{repo}` |
| `app/ErrorCard.tsx`, `app/DemoChips.tsx` | Error states and demo links |
| `app/SimulatorPanel.tsx` | Simulated events (`demo/*` or non-production) |
| `app/BadgeEmbed.tsx`, `app/WebhookSetup.tsx` | Copyable badge markdown and webhook settings |

`src/hooks/usePet.ts`: `GET` on mount, 15 s polling while visible, `POST .../action` (returns the pet even on 409/403), `onStageChange` callback.
`src/lib/audio-synth.ts`: `soundSynth`, square and triangle waves only.

## Badge pipeline

```mermaid
flowchart LR
  R[GET /api/badge/owner/repo.svg] --> N[normalizeRepoKey]
  N --> G[getPet]
  G --> B[renderBadge: pet, key, size, animate]
  B --> S[composeSprite + spriteRuns -> one path per shade]
  S --> X[SVG + ETag + Cache-Control]
```

- `src/lib/badge-svg.ts`: `renderBadge`, `renderStatusBadge`, `escapeXml`, `truncate`. One `<path>` per shade, 10-segment bars, monospace text with letter-spacing. The bob uses a `steps(1)` keyframe and respects `prefers-reduced-motion`.
- Why SVG paths and CSS only: GitHub serves README images through a proxy that strips scripts and external resources.
- Why `ETag` from the SVG (a hash of the stats only): unchanged pets answer 304.

## Steering

`.kiro/steering/retro-aesthetic.md` holds the palette, the pixel font (Press Start 2P), the shell and the pixel grid rules; it has no front matter, so Kiro includes it in every request (default inclusion).

## Favicon

`src/app/icon.svg` is the `BABY_GHOST` frame 0 matrix from `lcd/pixel-maps.ts`, drawn as one `<rect>` per horizontal run, with identical runs on consecutive rows merged into taller rects (68 rects, about 3 KB). Rects are grouped in one `<g fill>` per LCD shade over a `#9bbc0f` tile (`rx="4"`); `viewBox="0 1 32 32"` leaves a 1 px margin above and below the sprite. `next build` lists it as the static route `/icon.svg` (served as `image/svg+xml`), and the prerendered `/` head carries `<link rel="icon" href="/icon.svg?icon.<hash>.svg" sizes="any" type="image/svg+xml"/>`. `layout.tsx` sets no `metadata.icons`.

Not added, on purpose (leanest native option):
- `favicon.ico`: browsers that read `<link rel="icon">` never ask for `/favicon.ico`. Only tools that probe the path directly get a 404.
- `apple-icon`: the convention takes only `.png`/`.jpg` or an `ImageResponse` route. iOS "Add to Home Screen" falls back to a page screenshot.
- SVG favicons need Safari 26 or later. Safari 18 and older show the default tab icon.

## Resurrection theme review

The theme is the Kiroween Resurrection category: a 90s virtual pet brought back as a live view of repo health. Checked against `.kiro/steering/retro-aesthetic.md` and the engine:

- Landing (`src/app/page.tsx`): "fed by your commits and killed by red builds. Green CI brings it back from the dead." This matches pet-engine R6: a CI success, a push or a closed issue revives a dead pet, and REVIVE needs the latest CI run to be green. No change.
- Shell (`RetroShell.tsx`): translucent purple egg case, buttons A SELECT / B EXEC / C STATS, `GITGOTCHI` and `KIRO-2026 EDITION` printed on it. It matches the steering. No change.
- Dead LCD: the `lcd-dead` class swaps the 4 shades (still the steering palette), the tombstone sprite is shown, the HUD reads `DEAD`, the menu becomes REVIVE / HEAL, and the shell glows (`gg-shell-haunted`). No change.
- Revive flow: a 409 on REVIVE shows a "fix the build, push, then try again" hint, a successful revive plays the `revive` animation (rising ghost and sparkles), and `resurrections` is counted in `StatsCard`. No change.
- Changed: the `metadata.description` in `layout.tsx` said "an MCP auto-heal resurrects it". HEAL only diagnoses and writes a prompt (R2.8), so the description now says a green build brings the pet back.
- Added: `src/app/icon.svg` (R1.6), above.

## Known limits

- The badge's CSS bob is not verified inside GitHub's proxy yet (`tasks.md` task 6).
- Real-device layout at 390 px was measured on the shell only (340 px wide), not on every page.
