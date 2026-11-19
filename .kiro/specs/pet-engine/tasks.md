# Pet Engine: Tasks

- [x] 1. Shared types in `src/lib/types.ts` (R1)
- [x] 2. Pure engine in `src/lib/state-machine.ts`
  - [x] 2.1 `clamp`, `createPet`, bounds for HP, Fullness, Sanity, Poop (R1)
  - [x] 2.2 `applyEvent` for push, ci, pr_merged, issue_opened, issue_closed, poop (R2)
  - [x] 2.3 `tick` time decay, idempotent and whole-hour based (R3)
  - [x] 2.4 `determineStage` including abandoned-repo starvation (R4)
  - [x] 2.5 Death, resurrection and the guarded `revive` action (R5, R6)
  - [x] 2.6 `feed` and `clean` actions (R5)
  - [x] 2.7 Mood derivation (R7)
  - [x] 2.8 `seedFromSnapshot` (R8)
- [x] 3. In-memory store `src/lib/pet-store.ts` (events newest first, capped at 50)
- [x] 4. Service layer `src/lib/pet-service.ts` (demo fixtures, feed limit, 409 mapping)
- [x] 5. Example tests per rule in `src/lib/__tests__/state-machine.test.ts`
- [x] 6. Property-based tests P1..P6 with `fast-check`
- [x] 7. `spec-sync` hook so Kiro checks code against this spec on save
- [x] 8. Persist pets across restarts and serverless cold starts (KV store behind the four `pet-store.ts` functions; see `../github-sync/tasks.md` task 7)
- [ ] 9. Run this spec through Kiro's Correctness view (property-based testing) and add any property Kiro proposes
- [x] 10. Decide whether `SLEEPING` should ever be set (for example after N idle days) or removed from `PetMood`
- [x] 11. Rising ghost after resurrection (R4.3, R6.6 to R6.9): `revivedAt` and `activitySinceRevival` on `PetState`, kept across resyncs; tests in `state-machine.test.ts` and `pet-service.test.ts`

Notes:
- Task 9: blocked, needs Kiro's Correctness view in the IDE.
