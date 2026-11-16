# Pet Engine: Design

Implements `requirements.md` (R1..R8).

## Modules

| File | Role |
|---|---|
| `src/lib/types.ts` | Shared contract: `PetState`, `PetEvent`, `RepoSnapshot`, `SimulatedEvent`, `PetResponse`, `HealDiagnosis` |
| `src/lib/state-machine.ts` | Pure engine. Every function takes `now: number`; no clock, no I/O |
| `src/lib/pet-store.ts` | In-memory `Map` of `PetEntry` (pet + events, newest first, max 50) on `globalThis`; `normalizeRepoKey` |
| `src/lib/pet-service.ts` | `getPet`, `act`, `ingestEvent`, demo fixtures, feed rate limit |
| `src/components/lcd/pixel-maps.ts` | `deriveMood` and sprites (shared with the badge) |

The engine functions: `createPet`, `seedFromSnapshot`, `tick`, `applyEvent`, `applyAction`, `determineStage`, `canRevive`, `clamp`.

## Attributes

All stats are integers clamped to 0..100; Poop is clamped to 0..5.

| Attribute | Default | Effect |
|---|---|---|
| HP | 100 | CI success +15, CI failure -25, PR merged +10, poop for a full day -5 |
| Fullness | 80 | Push +5 per commit (max +20 per push), PR merged +20, feed +10, decay -1 per hour |
| Sanity | 100 | Issue opened -5, issue closed +10, PR merged +10, poop -10, clean +12 per poop removed |
| Poop | 0 | Poop event +1, cleared by the Clean action |

Other state: `commitsTotal`, `recentCi`, `lastPushAt`, `diedAt`, `resurrections`, `updatedAt` (decay is accounted up to here), `mood`, `partyUntil`.

## Seeding (`seedFromSnapshot`)

- HP: 100, replay `recentRuns` oldest to newest. No runs: 85.
- Fullness: `100 - hours since pushedAt`, min 0. No push date: 50.
- Sanity: `100 - 10 x min(staleIssues, 10)`.

## Events (`applyEvent`)

`applyEvent(state, event, now, { source, simulated })` runs `tick`, then the event, and returns `{ state, event }` where `event` is a `PetEvent` with `deltas` and an LCD-sized label (max 18 chars, uppercase).

| Event | Effect |
|---|---|
| `push` | Fullness += min(20, 5 x n), `commitsTotal` += n, `lastPushAt` = now (the cap is anti-spam) |
| `ci` | HP +15 / -25, result appended to `recentCi` |
| `pr_merged` | Fullness +20, HP +10, Sanity +10, mood PARTY for 1 hour |
| `issue_opened` / `issue_closed` | Sanity -5 / +10 |
| `poop` | Poop +1 (max 5), Sanity -10 |

## Actions (`applyAction`)

`feed` (+10 Fullness), `clean` (removes poop, +12 Sanity per poop), `revive`. Errors: `PET_DEAD`, `NOT_DEAD`, `REPO_STILL_BROKEN`.
`pet-service.act` adds a limit of 3 user feeds per hour (`TOO FULL!`) and maps errors to HTTP 409 (`FIX CI FIRST`, `STILL ALIVE`).

## Time decay (`tick`)

- Fullness -1 per whole hour since `updatedAt`.
- While Poop > 0, each UTC day boundary crossed costs 5 HP.
- `updatedAt` moves by whole hours only. A dead pet does not decay. PARTY clears 1 hour after the merge.

## Stage (`determineStage`)

Order: ZOMBIE_CORPSE, EGG, CODE_DEMON, BABY_GHOST (see requirements R4).

## Death and resurrection

Entering ZOMBIE_CORPSE sets `diedAt` and emits `death`. A dead pet resurrects on CI success, issue closed or push: BABY_GHOST, HP 50, Fullness 50, Sanity 60, Poop 0, `resurrections` + 1. The `revive` action needs `canRevive(state)`: the latest CI result is a success.
The ritual means "fix your repo", not a free button.

## Mood

`deriveMood` priority: DEAD, PARTY, SICK (HP < 40), HUNGRY (Fullness < 30), DIRTY (Poop >= 2), HAPPY. `SLEEPING` exists in the type; the engine never sets it.

## Testing strategy

`vitest` + `fast-check` in `src/lib/__tests__/state-machine.test.ts`: example tests per rule plus six properties (see `requirements.md`). Change the spec first, then the code; the `spec-sync` hook (`.kiro/hooks/spec-sync.json`) asks Kiro to compare the two on every save of `state-machine.ts`.
