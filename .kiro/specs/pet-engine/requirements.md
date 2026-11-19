# Pet Engine: Requirements

The pet engine turns repository activity into a virtual pet: four stats, four evolution stages, death and resurrection.
Code: `src/lib/state-machine.ts`, `src/lib/types.ts`. Design: `design.md`. Tests: `npm test`.

## Glossary

- **Pet**: the `PetState` of one repository (`src/lib/types.ts`).
- **Stats**: HP, Fullness, Sanity (integers 0..100) and Poop (integer 0..5).
- **Dead**: stage is `ZOMBIE_CORPSE`.
- **Resurrection triggers**: a CI success, an issue closed, or a push.

## Requirements

### R1. Stat bounds

**User story:** As a developer, I want the pet's numbers to stay readable, so the LCD never shows nonsense.

Acceptance criteria:
1. THE SYSTEM SHALL keep HP, Fullness and Sanity as integers in 0..100 after every event, action and tick.
2. THE SYSTEM SHALL keep the Poop count as an integer in 0..5.
3. THE SYSTEM SHALL keep at most the last 5 CI results in `recentCi`, newest last.

Verified by: property P1 (`stats stay in range for any event sequence`), `clamp` test in `src/lib/__tests__/state-machine.test.ts`.

### R2. Events change stats

**User story:** As a developer, I want my real work to feed the pet, so the pet mirrors the repo.

Acceptance criteria:
1. WHEN a push with n commits arrives, THE SYSTEM SHALL add `min(20, 5 x n)` to Fullness and n to `commitsTotal`.
2. WHEN a CI run succeeds, THE SYSTEM SHALL add 15 HP. WHEN it fails, THE SYSTEM SHALL subtract 25 HP.
3. WHEN a pull request is merged, THE SYSTEM SHALL add 20 Fullness, 10 HP and 10 Sanity and set mood PARTY for 1 hour.
4. WHEN an issue is opened, THE SYSTEM SHALL subtract 5 Sanity. WHEN an issue is closed, THE SYSTEM SHALL add 10 Sanity.
5. WHEN a poop event arrives, THE SYSTEM SHALL add 1 Poop (max 5) and subtract 10 Sanity.
6. WHEN an event is applied, THE SYSTEM SHALL first apply time decay for the same `now`.

Verified by: `applyEvent` tests in `src/lib/__tests__/state-machine.test.ts`.

### R3. Time decay

**User story:** As a developer, I want a neglected repo to get hungry, so inactivity is visible.

Acceptance criteria:
1. THE SYSTEM SHALL subtract 1 Fullness for every whole hour since `updatedAt`.
2. WHILE Poop is above 0, THE SYSTEM SHALL subtract 5 HP for every UTC day boundary crossed.
3. THE SYSTEM SHALL advance `updatedAt` in whole hours only, so frequent calls lose no decay.
4. WHILE the pet is dead, THE SYSTEM SHALL NOT apply decay.
5. WHEN `tick` runs twice with the same `now`, THE SYSTEM SHALL return the same state as after the first run.
6. THE SYSTEM SHALL NOT increase Fullness in `tick`.

Verified by: properties P3 (`tick is idempotent`) and P4 (`tick never raises fullness`), `tick` tests.

### R4. Evolution

**User story:** As a developer, I want the pet's form to tell me the repo's health at a glance.

Acceptance criteria (checked in this order):
1. IF HP is 0, or Fullness is 0 and the last push is 30 days old or more, THEN THE SYSTEM SHALL set stage `ZOMBIE_CORPSE`.
2. IF `commitsTotal` is below 5 and the pet was never resurrected, THEN THE SYSTEM SHALL set stage `EGG`.
3. IF HP >= 80, Sanity >= 70, Fullness >= 50 and none of the last 3 CI results failed, THEN THE SYSTEM SHALL set stage `CODE_DEMON`.
4. OTHERWISE THE SYSTEM SHALL set stage `BABY_GHOST`.

Verified by: `determineStage` tests, property P2 (`hp == 0 implies ZOMBIE_CORPSE`).

### R5. Death

**User story:** As a developer, I want a broken repo to visibly die.

Acceptance criteria:
1. WHEN the pet enters `ZOMBIE_CORPSE`, THE SYSTEM SHALL set `diedAt` and emit a `death` event.
2. WHILE the pet is dead, THE SYSTEM SHALL ignore every event except the resurrection triggers.
3. WHILE the pet is dead, THE SYSTEM SHALL refuse `feed` and `clean` with `PET_DEAD`.
4. THE SYSTEM SHALL have `diedAt` set exactly when the pet is a zombie.

Verified by: property P2, `death and resurrection` and `actions` tests.

### R6. Resurrection

**User story:** As a developer, I want to bring the pet back only by fixing the repo, so the ritual means something.

Acceptance criteria:
1. WHEN a dead pet receives a CI success, an issue closed, or a push, THE SYSTEM SHALL set stage `BABY_GHOST`, HP 50, Fullness 50, Sanity 60, Poop 0, add 1 to `resurrections` and clear `diedAt`.
2. WHEN the `revive` action is requested on a dead pet whose latest CI result is a success, THE SYSTEM SHALL resurrect it.
3. IF the `revive` action is requested on a dead pet whose latest CI result is not a success, THEN THE SYSTEM SHALL answer `REPO_STILL_BROKEN` and change nothing.
4. IF the `revive` action is requested on a living pet, THEN THE SYSTEM SHALL answer `NOT_DEAD` and change nothing.
5. THE SYSTEM SHALL grow `resurrections` only by 1 and only when the pet was dead before the event.

Verified by: properties P5 (`resurrections only grow, by one, when the pet was dead`) and P6 (`the revive action never changes a living pet`), `revive action` tests.

### R7. Mood

**User story:** As a developer, I want the pet's face to match its numbers.

Acceptance criteria (first match wins):
1. WHILE the pet is dead, THE SYSTEM SHALL show mood DEAD.
2. WHILE less than 1 hour has passed since a merged PR, THE SYSTEM SHALL show mood PARTY.
3. WHILE HP < 40, THE SYSTEM SHALL show SICK. WHILE Fullness < 30, HUNGRY. WHILE Poop >= 2, DIRTY. OTHERWISE HAPPY.
4. THE SYSTEM SHALL NOT set mood SLEEPING, which is reserved for the UI loading state (the loading LCD in `PetConsole` passes it to `LcdScreen`, which shows `ZZZ`). `PetState` has no `isSleeping` field.

Verified by: `mood` test, property P7 (`the engine never sets SLEEPING and the state has no isSleeping key`).

### R8. Seeding from GitHub

**User story:** As a developer, I want a freshly adopted repo to start with a pet that matches its real state.

Acceptance criteria:
1. WHEN a pet is seeded from a repo snapshot, THE SYSTEM SHALL start HP at 100 and replay `recentRuns` oldest to newest (+15 success, -25 failure, clamped at each step). IF there are no runs, THEN HP SHALL be 85.
2. THE SYSTEM SHALL set Fullness to 100 minus the whole hours since `pushedAt` (min 0), or 50 when there is no push date.
3. THE SYSTEM SHALL set Sanity to `100 - 10 x min(staleIssues, 10)`.

Verified by: `seedFromSnapshot` tests.

### R9. Per-file poop from the Kiro hook

**User story:** As a developer, I want cleaning one file to remove only that file's poop, so the pet still shows the smells I left elsewhere.

Acceptance criteria:
1. A file has an outstanding poop WHEN the log holds a `poop` event with source `kiro-hook` for it, with no later per-file `clean` of that file, no later `clean` without a file (the user CLEAN action) and no later `revive`.
2. WHEN a dirty report arrives for a file with no outstanding poop and the pet is alive, THE SYSTEM SHALL apply a `poop` event with `file` set and label `<smell> in <file>`. WHEN the file already has an outstanding poop, THE SYSTEM SHALL change nothing.
3. WHEN a clean report arrives for a file with an outstanding poop and the pet is alive, THE SYSTEM SHALL lower Poop by 1 (min 0), raise Sanity by 12 (max 100) and record a `clean` event with source `kiro-hook`, `file` set and label `clean after <file>`. Other files' poop SHALL stay.
4. IF a clean report arrives while the pet is dead, or for a file with no outstanding poop, THEN THE SYSTEM SHALL change neither the pet nor the log.
5. Poop events written before `file` existed are matched by their `<smell> in <file>` label.

Verified by: `per-file poop` tests and the set-model property in `state-machine.test.ts`; `local-poop.test.ts` (route).

## Property-based tests

`fast-check` properties in `src/lib/__tests__/state-machine.test.ts` (`describe('properties')`), run by `npm test` over random event sequences with random time gaps:

| Id | Property | Requirement |
|---|---|---|
| P1 | Range: stats are integers in range, poop 0..5, `recentCi` <= 5 | R1 |
| P2 | HP 0 implies zombie; a zombie with HP > 0 starved (Fullness 0); `diedAt` set iff zombie | R4, R5 |
| P3 | `tick(tick(s, t), t)` equals `tick(s, t)` | R3 |
| P4 | `tick` never increases Fullness | R3 |
| P5 | `resurrections` grows only by 1, only from dead | R6 |
| P6 | `revive` on a living pet changes nothing and returns `NOT_DEAD` | R6 |
| P7 | Over random events and actions (`feed`, `clean`, `revive`), mood is never SLEEPING (always DEAD, PARTY, SICK, HUNGRY, DIRTY or HAPPY) and the state has no `isSleeping` key | R7 |
