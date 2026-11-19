import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyAction,
  applyEvent,
  canRevive,
  clamp,
  createPet,
  determineStage,
  isDead,
  applyHookReport,
  outstandingPoops,
  replayWebhookEvents,
  seedFromSnapshot,
  tick,
  type HookSmell,
  type PetActionName,
} from '../state-machine';
import type { PetEvent, PetMood, PetState, RepoSnapshot, SimulatedEvent } from '../types';

const H = 3_600_000;
const D = 24 * H;
const T0 = Date.UTC(2026, 10, 1, 12, 0, 0);

const pet = (o: Partial<PetState> = {}) =>
  createPet('o/r', T0, { commitsTotal: 20, lastPushAt: T0, ...o });

const snap = (o: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  fullName: 'o/r',
  createdAt: new Date(T0 - 100 * D).toISOString(),
  pushedAt: new Date(T0).toISOString(),
  commitsTotal: 50,
  openIssues: 0,
  staleIssues: 0,
  recentRuns: [],
  defaultBranch: 'main',
  ...o,
});

const ev = (p: PetState, e: SimulatedEvent, now = T0) => applyEvent(p, e, now);

describe('clamp', () => {
  it('rounds and bounds to 0..100', () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(140)).toBe(100);
    expect(clamp(49.6)).toBe(50);
  });
});

describe('seedFromSnapshot', () => {
  it('replays runs oldest to newest', () => {
    expect(seedFromSnapshot(snap({ recentRuns: ['failure', 'success'] }), T0).hp).toBe(90);
    expect(seedFromSnapshot(snap({ recentRuns: ['success', 'failure'] }), T0).hp).toBe(75);
  });
  it('clamps at each replay step', () => {
    const runs = Array(5).fill('failure').concat('success') as RepoSnapshot['recentRuns'];
    expect(seedFromSnapshot(snap({ recentRuns: runs }), T0).hp).toBe(15);
  });
  it('defaults hp to 85 without runs', () => {
    expect(seedFromSnapshot(snap(), T0).hp).toBe(85);
  });
  it('derives fullness from hours since last push', () => {
    const s = seedFromSnapshot(snap({ pushedAt: new Date(T0 - 30 * H).toISOString() }), T0);
    expect(s.fullness).toBe(70);
    expect(seedFromSnapshot(snap({ pushedAt: new Date(T0 - 500 * H).toISOString() }), T0).fullness).toBe(0);
    expect(seedFromSnapshot(snap({ pushedAt: null }), T0).fullness).toBe(50);
  });
  it('derives sanity from stale issues, capped at 10', () => {
    expect(seedFromSnapshot(snap({ staleIssues: 3 }), T0).sanity).toBe(70);
    expect(seedFromSnapshot(snap({ staleIssues: 40 }), T0).sanity).toBe(0);
  });
  it('keeps commitsTotal and the last 5 runs', () => {
    const runs = Array(8).fill('success') as RepoSnapshot['recentRuns'];
    const s = seedFromSnapshot(snap({ recentRuns: runs, commitsTotal: 7 }), T0);
    expect(s.commitsTotal).toBe(7);
    expect(s.recentCi).toHaveLength(5);
  });
});

describe('applyEvent', () => {
  it('push feeds 5 per commit and counts commits', () => {
    const r = ev(pet({ fullness: 40 }), { type: 'push', commits: 2 });
    expect(r.state.fullness).toBe(50);
    expect(r.state.commitsTotal).toBe(22);
    expect(r.state.lastPushAt).toBe(T0);
    expect(r.event.deltas).toEqual({ fullness: 10 });
  });
  it('push gain is capped at 20 per push (anti-spam)', () => {
    expect(ev(pet({ fullness: 10 }), { type: 'push', commits: 500 }).state.fullness).toBe(30);
    expect(ev(pet({ fullness: 10 }), { type: 'push', commits: 500 }).state.commitsTotal).toBe(520);
  });
  it('ci success +15 hp, failure -25 hp, tracked newest last', () => {
    let s = pet({ hp: 50 });
    s = ev(s, { type: 'ci', success: true }).state;
    expect(s.hp).toBe(65);
    s = ev(s, { type: 'ci', success: false }).state;
    expect(s.hp).toBe(40);
    expect(s.recentCi).toEqual(['success', 'failure']);
  });
  it('keeps only the last 5 ci results', () => {
    let s = pet();
    for (let i = 0; i < 8; i++) s = ev(s, { type: 'ci', success: i % 2 === 0 }).state;
    expect(s.recentCi).toHaveLength(5);
  });
  it('pr_merged gives +20 fullness, +10 hp, +10 sanity and a party', () => {
    const r = ev(pet({ hp: 50, fullness: 50, sanity: 50 }), { type: 'pr_merged' });
    expect(r.state).toMatchObject({ hp: 60, fullness: 70, sanity: 60, mood: 'PARTY' });
  });
  it('issue_opened -5 sanity, issue_closed +10 sanity', () => {
    const s = pet({ sanity: 50 });
    expect(ev(s, { type: 'issue_opened' }).state.sanity).toBe(45);
    expect(ev(s, { type: 'issue_closed' }).state.sanity).toBe(60);
  });
  it('poop adds 1 (max 5) and costs 10 sanity', () => {
    const r = ev(pet(), { type: 'poop', reason: 'console.log' });
    expect(r.state.poopCount).toBe(1);
    expect(r.state.sanity).toBe(90);
    let s = pet({ poopCount: 5 });
    s = ev(s, { type: 'poop', reason: 'x' }).state;
    expect(s.poopCount).toBe(5);
  });
  it('labels fit the LCD (<= 18 chars, uppercase) and flag simulated events', () => {
    const e = applyEvent(pet(), { type: 'poop', reason: 'a very long code smell reason' }, T0, {
      simulated: true,
      source: 'kiro-hook',
    });
    expect(e.event.label.length).toBeLessThanOrEqual(18);
    expect(e.event.label).toBe(e.event.label.toUpperCase());
    expect(e.event.simulated).toBe(true);
    expect(e.event.source).toBe('kiro-hook');
    expect(e.state.statusMessage).toBe(e.event.label);
  });
});

describe('tick', () => {
  it('decays fullness 1 per hour', () => {
    expect(tick(pet({ fullness: 80 }), T0 + 5 * H).fullness).toBe(75);
  });
  it('costs 5 hp per day boundary while poop is present', () => {
    const start = Date.UTC(2026, 10, 1, 0, 0, 0);
    const p = createPet('o/r', start, { commitsTotal: 20, poopCount: 1, lastPushAt: start });
    expect(tick(p, start + 3 * D).hp).toBe(85);
    expect(tick({ ...p, poopCount: 0 }, start + 3 * D).hp).toBe(100);
  });
  it('does not lose partial hours when called often', () => {
    let s = pet({ fullness: 80 });
    for (let m = 30; m <= 180; m += 30) s = tick(s, T0 + m * 60_000);
    expect(s.fullness).toBe(77);
  });
  it('clears the party after 1h', () => {
    const s = ev(pet(), { type: 'pr_merged' }).state;
    expect(tick(s, T0 + 30 * 60_000).mood).toBe('PARTY');
    expect(tick(s, T0 + H).mood).toBe('HAPPY');
  });
});

describe('determineStage', () => {
  const base: Parameters<typeof determineStage>[0] = {
    hp: 90,
    sanity: 90,
    fullness: 90,
    commitsTotal: 20,
    recentCi: [],
    lastPushAt: T0,
    resurrections: 0,
  };
  it('EGG below 5 commits', () => {
    expect(determineStage({ ...base, commitsTotal: 4 }, T0)).toBe('EGG');
  });
  it('CODE_DEMON needs hp, sanity, fullness and no failure in last 3 runs', () => {
    expect(determineStage(base, T0)).toBe('CODE_DEMON');
    expect(determineStage({ ...base, hp: 79 }, T0)).toBe('BABY_GHOST');
    expect(determineStage({ ...base, sanity: 69 }, T0)).toBe('BABY_GHOST');
    expect(determineStage({ ...base, fullness: 49 }, T0)).toBe('BABY_GHOST');
    expect(determineStage({ ...base, recentCi: ['failure', 'success', 'success'] }, T0)).toBe('BABY_GHOST');
    expect(determineStage({ ...base, recentCi: ['failure', 'success', 'success', 'success'] }, T0)).toBe('CODE_DEMON');
  });
  it('ZOMBIE_CORPSE at 0 hp', () => {
    expect(determineStage({ ...base, hp: 0 }, T0)).toBe('ZOMBIE_CORPSE');
  });
  it('abandoned repo: 0 fullness and no push for 30 days', () => {
    const starving = { ...base, fullness: 0 };
    expect(determineStage({ ...starving, lastPushAt: T0 - 29 * D }, T0)).toBe('BABY_GHOST');
    expect(determineStage({ ...starving, lastPushAt: T0 - 30 * D }, T0)).toBe('ZOMBIE_CORPSE');
    expect(determineStage({ ...base, lastPushAt: T0 - 90 * D }, T0)).toBe('CODE_DEMON');
  });
});

describe('death and resurrection', () => {
  const dying = () => pet({ hp: 20 });
  const dead = () => ev(dying(), { type: 'ci', success: false }).state;

  it('hp 0 kills the pet and records diedAt', () => {
    const r = ev(dying(), { type: 'ci', success: false });
    expect(r.state.stage).toBe('ZOMBIE_CORPSE');
    expect(r.state.mood).toBe('DEAD');
    expect(r.state.diedAt).toBe(T0);
    expect(r.event.type).toBe('death');
  });
  it('ignores everything but revive conditions while dead', () => {
    for (const e of [
      { type: 'ci', success: false },
      { type: 'pr_merged' },
      { type: 'issue_opened' },
      { type: 'poop', reason: 'x' },
    ] as SimulatedEvent[]) {
      const r = ev(dead(), e, T0 + 1000);
      expect(r.state.stage).toBe('ZOMBIE_CORPSE');
      expect(r.state.hp).toBe(0);
      expect(r.event.deltas).toEqual({});
    }
  });
  it.each<[string, SimulatedEvent, string]>([
    ['ci success', { type: 'ci', success: true }, 'CI PASSED'],
    ['issue closed', { type: 'issue_closed' }, 'ISSUE CLOSED'],
    ['push', { type: 'push', commits: 1 }, 'PUSH'],
  ])('%s resurrects a dead pet', (_n, e, trigger) => {
    const r = ev(dead(), e, T0 + 1000);
    expect(r.event.label).toBe(`${trigger} \u2192 RESURRECTED!`);
    expect(r.state.statusMessage).toBe('RESURRECTED!');
    expect(r.state).toMatchObject({
      stage: 'BABY_GHOST',
      hp: 50,
      fullness: 50,
      sanity: 60,
      poopCount: 0,
      resurrections: 1,
      diedAt: null,
    });
    expect(r.event.type).toBe('revive');
  });
  it('a resurrected young repo is not an egg', () => {
    const r = ev(pet({ hp: 20, commitsTotal: 1 }), { type: 'ci', success: false });
    expect(ev(r.state, { type: 'issue_closed' }).state.stage).toBe('BABY_GHOST');
  });
  it('revive action needs a dead pet and a green latest run', () => {
    const d = dead();
    expect(canRevive(d)).toBe(false);
    expect(applyAction(d, 'revive', T0).error).toBe('REPO_STILL_BROKEN');
    const greenDead = { ...d, recentCi: ['failure', 'success'] as PetState['recentCi'] };
    const r = applyAction(greenDead, 'revive', T0);
    expect(r.error).toBeUndefined();
    expect(r.state.stage).toBe('BABY_GHOST');
    expect(r.state.resurrections).toBe(1);
  });
  it('revive action refuses a living pet', () => {
    const p = pet({ recentCi: ['success'] });
    const r = applyAction(p, 'revive', T0);
    expect(r.error).toBe('NOT_DEAD');
    expect(r.state.resurrections).toBe(0);
  });
  it('starvation death after 30 days without a push, push revives', () => {
    const p = pet({ fullness: 5, lastPushAt: T0 });
    const later = tick(p, T0 + 31 * D);
    expect(later).toMatchObject({ stage: 'ZOMBIE_CORPSE', fullness: 0 });
    expect(later.hp).toBeGreaterThan(0);
    expect(later.diedAt).not.toBeNull();
    expect(applyEvent(later, { type: 'push', commits: 1 }, T0 + 31 * D).state.stage).not.toBe('ZOMBIE_CORPSE');
  });
});

describe('actions', () => {
  it('feed adds 10 fullness, clean converts poop to sanity', () => {
    expect(applyAction(pet({ fullness: 40 }), 'feed', T0).state.fullness).toBe(50);
    const c = applyAction(pet({ poopCount: 3, sanity: 40 }), 'clean', T0).state;
    expect(c).toMatchObject({ poopCount: 0, sanity: 76 });
  });
  it('feed and clean are refused while dead', () => {
    const d = pet({ hp: 0 });
    expect(applyAction(d, 'feed', T0).error).toBe('PET_DEAD');
    expect(applyAction(d, 'clean', T0).error).toBe('PET_DEAD');
  });
});

describe('mood', () => {
  it('SICK < HUNGRY < DIRTY priority, else HAPPY', () => {
    expect(pet().mood).toBe('HAPPY');
    expect(tick(pet({ hp: 39 }), T0).mood).toBe('SICK');
    expect(tick(pet({ fullness: 29 }), T0).mood).toBe('HUNGRY');
    expect(tick(pet({ poopCount: 2 }), T0).mood).toBe('DIRTY');
    expect(tick(pet({ hp: 30, fullness: 10, poopCount: 3 }), T0).mood).toBe('SICK');
  });
});

describe('properties', () => {
  const simEvent: fc.Arbitrary<SimulatedEvent> = fc.oneof(
    fc.record({ type: fc.constant('push' as const), commits: fc.integer({ min: -3, max: 1000 }) }),
    fc.record({ type: fc.constant('ci' as const), success: fc.boolean() }),
    fc.constant({ type: 'pr_merged' as const }),
    fc.constant({ type: 'issue_opened' as const }),
    fc.constant({ type: 'issue_closed' as const }),
    fc.record({ type: fc.constant('poop' as const), reason: fc.string() })
  );
  const gap = fc.integer({ min: 0, max: 72 * H });
  const step = fc.tuple(simEvent, gap);
  const steps = fc.array(step, { maxLength: 60 });
  const userAction: fc.Arbitrary<PetActionName> = fc.constantFrom('feed', 'clean', 'revive');
  const mixedSteps = fc.array(fc.tuple(fc.oneof(simEvent, userAction), gap), { maxLength: 60 });

  const run = (
    seedState: PetState,
    list: [SimulatedEvent, number][],
    visit: (s: PetState, before: PetState, now: number) => void
  ) => {
    let s = seedState;
    let now = T0;
    for (const [e, dt] of list) {
      now += dt;
      const before = s;
      s = applyEvent(s, e, now).state;
      visit(s, before, now);
    }
  };

  const seedArb = fc.record({
    hp: fc.integer({ min: 0, max: 100 }),
    fullness: fc.integer({ min: 0, max: 100 }),
    sanity: fc.integer({ min: 0, max: 100 }),
    poopCount: fc.integer({ min: 0, max: 5 }),
    commitsTotal: fc.integer({ min: 0, max: 50 }),
  });
  const seeded = (o: Partial<PetState>) => pet(o);

  it('stats stay in range for any event sequence', () => {
    fc.assert(
      fc.property(seedArb, steps, (o, list) => {
        run(seeded(o), list, (s) => {
          for (const k of ['hp', 'fullness', 'sanity'] as const) {
            expect(Number.isInteger(s[k])).toBe(true);
            expect(s[k]).toBeGreaterThanOrEqual(0);
            expect(s[k]).toBeLessThanOrEqual(100);
          }
          expect(s.poopCount).toBeGreaterThanOrEqual(0);
          expect(s.poopCount).toBeLessThanOrEqual(5);
          expect(s.recentCi.length).toBeLessThanOrEqual(5);
        });
      })
    );
  });

  it('hp == 0 implies ZOMBIE_CORPSE, and a zombie with hp > 0 is a starvation zombie', () => {
    fc.assert(
      fc.property(seedArb, steps, (o, list) => {
        run(seeded(o), list, (s) => {
          if (s.hp === 0) expect(s.stage).toBe('ZOMBIE_CORPSE');
          if (s.stage === 'ZOMBIE_CORPSE' && s.hp > 0) expect(s.fullness).toBe(0);
          expect(isDead(s)).toBe(s.diedAt !== null);
        });
      })
    );
  });

  it('tick is idempotent for the same now', () => {
    fc.assert(
      fc.property(seedArb, steps, fc.integer({ min: 0, max: 90 * D }), (o, list, dt) => {
        let s = seeded(o);
        run(s, list, (x) => (s = x));
        const now = T0 + 72 * H * 60 + dt;
        const once = tick(s, now);
        expect(tick(once, now)).toEqual(once);
      })
    );
  });

  it('tick never raises fullness', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 90 * D }), (o, dt) => {
        const s = seeded(o);
        expect(tick(s, T0 + dt).fullness).toBeLessThanOrEqual(s.fullness);
      })
    );
  });

  it('resurrections only grow, by one, when the pet was dead', () => {
    fc.assert(
      fc.property(seedArb, steps, (o, list) => {
        run(seeded(o), list, (s, before, now) => {
          if (s.resurrections !== before.resurrections) {
            expect(isDead(tick(before, now))).toBe(true);
            expect(s.resurrections).toBe(before.resurrections + 1);
          }
        });
      })
    );
  });

  it('the revive action never changes a living pet', () => {
    fc.assert(
      fc.property(seedArb, steps, (o, list) => {
        let s = seeded(o);
        run(s, list, (x) => (s = x));
        const now = T0 + 72 * H * 60;
        const ticked = tick(s, now);
        const r = applyAction(s, 'revive', now);
        if (!isDead(ticked)) {
          expect(r.error).toBe('NOT_DEAD');
          expect(r.state).toEqual(ticked);
        }
      })
    );
  });

  // P7: SLEEPING is reserved for the UI loading LCD (R7.4).
  it('the engine never sets SLEEPING and the state has no isSleeping key', () => {
    const engineMoods: PetMood[] = ['DEAD', 'PARTY', 'SICK', 'HUNGRY', 'DIRTY', 'HAPPY'];
    const check = (s: PetState) => {
      expect(engineMoods).toContain(s.mood);
      expect(s).not.toHaveProperty('isSleeping');
    };
    fc.assert(
      fc.property(seedArb, mixedSteps, (o, list) => {
        let s = seeded(o);
        let now = T0;
        check(s);
        for (const [input, dt] of list) {
          now += dt;
          s = typeof input === 'string' ? applyAction(s, input, now).state : applyEvent(s, input, now).state;
          check(s);
          check(tick(s, now + dt));
        }
      })
    );
  });
});

// ---------- github-sync R4.8: webhook events that arrived before the first snapshot ----------

const ghEvent = (type: PetEvent['type'], at: number, o: Partial<PetEvent> = {}): PetEvent => ({
  id: `${type}-${at}`,
  at,
  type,
  label: type,
  deltas: {},
  source: 'github',
  ...o,
});

describe('replayWebhookEvents', () => {
  const seeded = () => seedFromSnapshot(snap({ staleIssues: 5 }), T0);

  it('applies PR and issue events oldest first and skips push, ci and non-github events', () => {
    const log = [
      ghEvent('issue_closed', T0 - 1 * H),
      ghEvent('push', T0 - 2 * H),
      ghEvent('ci', T0 - 3 * H),
      ghEvent('issue_opened', T0 - 4 * H, { source: 'user', simulated: true }),
      ghEvent('issue_opened', T0 - 5 * H),
    ];
    const out = replayWebhookEvents(seeded(), log, T0);
    // 50 - 5 (opened) + 10 (closed); the simulated user event is ignored.
    expect(out.sanity).toBe(55);
    expect(out.fullness).toBe(seeded().fullness);
    expect(out.recentCi).toEqual(seeded().recentCi);
  });

  it('a replayed PR merge parties until one hour after it arrived', () => {
    expect(replayWebhookEvents(seeded(), [ghEvent('pr_merged', T0 - 30 * 60_000)], T0).mood).toBe('PARTY');
    const late = replayWebhookEvents(seeded(), [ghEvent('pr_merged', T0 - 2 * H)], T0);
    expect(late.mood).not.toBe('PARTY');
    expect(late.partyUntil ?? null).toBeNull();
  });

  // Feature: kiroween-submission, Property 4 and 5: replay is an oldest-first fold of PR and issue events only
  it('equals an oldest-first fold of the github PR and issue events, ignoring push and ci', () => {
    const type = fc.constantFrom<PetEvent['type']>('pr_merged', 'issue_opened', 'issue_closed', 'push', 'ci');
    const logArb = fc.array(fc.tuple(type, fc.boolean()), { maxLength: 20 });
    fc.assert(
      fc.property(logArb, (spec) => {
        const log = spec.map(([t, sim], i) => ghEvent(t, T0 - 3 * H - i, sim ? { simulated: true } : {}));
        const got = replayWebhookEvents(seeded(), log, T0);
        let want = seeded();
        for (const e of [...log].reverse()) {
          if (e.simulated || !['pr_merged', 'issue_opened', 'issue_closed'].includes(e.type)) continue;
          want = applyEvent(want, { type: e.type } as SimulatedEvent, T0).state;
        }
        want = tick({ ...want, partyUntil: null }, T0);
        const pick = (s: PetState) => [s.hp, s.fullness, s.sanity, s.poopCount, s.stage];
        expect(pick(got)).toEqual(pick(want));
        const noPushCi = log.filter((e) => e.type !== 'push' && e.type !== 'ci');
        expect(pick(replayWebhookEvents(seeded(), noPushCi, T0))).toEqual(pick(got));
      }),
      { numRuns: 100 }
    );
  });
});

// ---------- pet-engine R9: per-file poop ----------

describe('per-file poop (applyHookReport, outstandingPoops)', () => {
  const report = (filePath: string, smell: HookSmell | null) => ({ filePath, smell });

  it('removes only the cleaned file and labels the event', () => {
    let s = pet({ sanity: 80 });
    let log: PetEvent[] = [];
    for (const f of ['a.ts', 'b.ts']) {
      const r = applyHookReport(s, log, report(f, 'TODO'), T0);
      s = r.state;
      log = [r.event!, ...log];
    }
    expect(s.poopCount).toBe(2);
    expect(outstandingPoops(log)).toEqual(['b.ts', 'a.ts']);

    const r = applyHookReport(s, log, report('a.ts', null), T0);
    expect(r.state.poopCount).toBe(1);
    expect(r.state.sanity).toBe(s.sanity + 12);
    expect(r.event).toMatchObject({ type: 'clean', source: 'kiro-hook', label: 'clean after a.ts', file: 'a.ts' });
    expect(outstandingPoops([r.event!, ...log])).toEqual(['b.ts']);
  });

  it('repeats, clean reports for clean files and reports on a dead pet change nothing', () => {
    const s = pet();
    const first = applyHookReport(s, [], report('a.ts', 'debugger'), T0);
    const log = [first.event!];
    expect(applyHookReport(first.state, log, report('a.ts', 'TODO'), T0).event).toBeNull();
    expect(applyHookReport(first.state, log, report('z.ts', null), T0).event).toBeNull();
    const dead = { ...first.state, hp: 0 };
    expect(applyHookReport(dead, log, report('a.ts', null), T0)).toEqual({ state: dead, event: null });
    expect(applyHookReport(dead, log, report('b.ts', 'TODO'), T0).event).toBeNull();
  });

  it('reads legacy events that carry the file only in the label', () => {
    const legacy: PetEvent = { id: 'x', at: T0, type: 'poop', label: 'console.log in src/old.ts', deltas: {}, source: 'kiro-hook' };
    expect(outstandingPoops([legacy])).toEqual(['src/old.ts']);
  });

  // Feature: kiroween-submission, Property 9: Per-file poop follows a set model
  it('follows a set model across hook reports, CLEAN actions and resurrections', () => {
    const op = fc.oneof(
      fc.record({ k: fc.constant('dirty' as const), f: fc.constantFrom('a', 'b', 'c') }),
      fc.record({ k: fc.constant('clean' as const), f: fc.constantFrom('a', 'b', 'c') }),
      fc.constant({ k: 'user-clean' as const, f: '' }),
      fc.constant({ k: 'revive' as const, f: '' })
    );
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        let s = pet({ sanity: 60 });
        let log: PetEvent[] = [];
        const model = new Set<string>();
        let now = T0;
        for (const o of ops) {
          now += 1000;
          if (o.k === 'dirty' || o.k === 'clean') {
            const before = s;
            const r = applyHookReport(s, log, report(o.f, o.k === 'dirty' ? 'TODO' : null), now);
            if (r.event) {
              log = [r.event, ...log];
              if (o.k === 'dirty') model.add(o.f);
              else {
                model.delete(o.f);
                const b = tick(before, now);
                expect(r.state.poopCount).toBe(Math.max(0, b.poopCount - 1));
                expect(r.state.sanity).toBe(Math.min(100, b.sanity + 12));
              }
            } else {
              expect(r.state).toEqual(before);
            }
            s = r.state;
          } else if (o.k === 'user-clean') {
            const r = applyAction(s, 'clean', now);
            s = r.state;
            if (r.event) {
              log = [r.event, ...log];
              model.clear();
            }
          } else {
            const r = applyEvent({ ...s, hp: 0 }, { type: 'issue_closed' }, now);
            s = r.state;
            log = [r.event, ...log];
            model.clear();
          }
          expect(new Set(outstandingPoops(log))).toEqual(model);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('rising ghost after resurrection (pet-engine R6.6 to R6.9)', () => {
  const HOUR = 3_600_000;
  const T = 1_800_000_000_000;
  // A pet with perfect stats that died only of hunger: without the rule it would come back as a CODE_DEMON.
  const starved = () =>
    createPet('acme/app', T, { hp: 95, fullness: 0, sanity: 100, commitsTotal: 50, recentCi: ['success'], lastPushAt: T - 40 * 24 * HOUR });

  it('a push brings it back as a BABY_GHOST, whatever its stats', () => {
    const r = applyEvent(starved(), { type: 'push', commits: 1 }, T);
    expect(r.state.stage).toBe('BABY_GHOST');
    expect(r.state.revivedAt).toBe(T);
    expect(r.state.activitySinceRevival).toBe(false);
    // Stats good enough for a demon still leave it a ghost.
    expect(tick({ ...r.state, hp: 100, fullness: 100, sanity: 100 }, T + HOUR).stage).toBe('BABY_GHOST');
  });

  it('24 hours alone are not enough; 24 hours plus a push or a green run after the revival are', () => {
    let s = applyEvent(starved(), { type: 'push', commits: 1 }, T).state;
    s = { ...s, hp: 100, sanity: 100 };
    expect(tick({ ...s, fullness: 100, updatedAt: T + 25 * HOUR }, T + 25 * HOUR).stage).toBe('BABY_GHOST');

    const pushed = applyEvent(s, { type: 'push', commits: 4 }, T + 2 * HOUR).state;
    expect(pushed.activitySinceRevival).toBe(true);
    expect(tick({ ...pushed, fullness: 100, updatedAt: T + 23 * HOUR }, T + 23 * HOUR).stage).toBe('BABY_GHOST');
    expect(tick({ ...pushed, fullness: 100, updatedAt: T + 24 * HOUR }, T + 24 * HOUR).stage).toBe('CODE_DEMON');

    const green = applyEvent(s, { type: 'ci', success: true }, T + HOUR).state;
    expect(green.activitySinceRevival).toBe(true);
    const red = applyEvent(s, { type: 'ci', success: false }, T + HOUR).state;
    expect(red.activitySinceRevival).toBe(false);
  });

  it('rising never blocks death, and the next resurrection starts a new rising period', () => {
    const s = applyEvent(starved(), { type: 'push', commits: 1 }, T).state;
    const dead = applyEvent({ ...s, hp: 10 }, { type: 'ci', success: false }, T + HOUR).state;
    expect(dead.stage).toBe('ZOMBIE_CORPSE');
    const again = applyEvent(dead, { type: 'ci', success: true }, T + 2 * HOUR).state;
    expect(again.stage).toBe('BABY_GHOST');
    expect(again.revivedAt).toBe(T + 2 * HOUR);
    expect(again.activitySinceRevival).toBe(false);
    expect(again.resurrections).toBe(2);
  });

  it('a pet that never died is not affected', () => {
    const fresh = createPet('acme/app', T, { hp: 100, fullness: 100, sanity: 100, commitsTotal: 50 });
    expect(fresh.stage).toBe('CODE_DEMON');
  });
});
