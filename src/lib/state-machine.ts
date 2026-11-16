import type {
  CiResult,
  PetEvent,
  PetEventType,
  PetMood,
  PetStage,
  PetState,
  RepoSnapshot,
  SimulatedEvent,
} from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ABANDONED_AFTER = 30 * DAY;
const PARTY_DURATION = HOUR;

export const FULLNESS_PER_COMMIT = 5;
export const MAX_PUSH_GAIN = 20;
export const FEED_GAIN = 10;
export const RECENT_CI_SIZE = 5;

export function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

type StageInput = Pick<
  PetState,
  'hp' | 'sanity' | 'fullness' | 'commitsTotal' | 'recentCi' | 'lastPushAt' | 'resurrections'
>;

export function determineStage(s: StageInput, now: number): PetStage {
  const abandoned =
    s.fullness === 0 && s.lastPushAt !== null && now - s.lastPushAt >= ABANDONED_AFTER;
  if (s.hp <= 0 || abandoned) return 'ZOMBIE_CORPSE';
  // A resurrected pet never goes back into the egg.
  if (s.commitsTotal < 5 && s.resurrections === 0) return 'EGG';
  const failedRecently = s.recentCi.slice(-3).includes('failure');
  if (s.hp >= 80 && s.sanity >= 70 && s.fullness >= 50 && !failedRecently) return 'CODE_DEMON';
  return 'BABY_GHOST';
}

export function isDead(s: Pick<PetState, 'stage'>): boolean {
  return s.stage === 'ZOMBIE_CORPSE';
}

/** The ritual only works while the latest CI run is green. */
export function canRevive(s: Pick<PetState, 'recentCi'>): boolean {
  return s.recentCi[s.recentCi.length - 1] === 'success';
}

function deriveMood(s: PetState, now: number): PetMood {
  if (isDead(s)) return 'DEAD';
  if (s.partyUntil != null && now < s.partyUntil) return 'PARTY';
  if (s.hp < 40) return 'SICK';
  if (s.fullness < 30) return 'HUNGRY';
  if (s.poopCount >= 2) return 'DIRTY';
  return 'HAPPY';
}

/** Recompute the derived fields (stage, death bookkeeping, mood). */
function settle(s: PetState, now: number): PetState {
  const stage = determineStage(s, now);
  const dead = stage === 'ZOMBIE_CORPSE';
  const justDied = dead && s.diedAt === null;
  const next: PetState = {
    ...s,
    stage,
    diedAt: dead ? (s.diedAt ?? now) : null,
    isSleeping: false,
    statusMessage: justDied ? (s.hp <= 0 ? 'DEAD! FIX THE REPO' : 'STARVED. PUSH CODE') : s.statusMessage,
  };
  return { ...next, mood: deriveMood(next, now) };
}

export function createPet(repoName: string, now: number, overrides: Partial<PetState> = {}): PetState {
  return settle(
    {
      hp: 100,
      fullness: 80,
      sanity: 100,
      stage: 'BABY_GHOST',
      poopCount: 0,
      lastFedTimestamp: now,
      isSleeping: false,
      statusMessage: 'HELLO WORLD!',
      repoName,
      commitsTotal: 0,
      recentCi: [],
      lastPushAt: null,
      diedAt: null,
      resurrections: 0,
      updatedAt: now,
      mood: 'HAPPY',
      partyUntil: null,
      ...overrides,
    },
    now
  );
}

export function seedFromSnapshot(snap: RepoSnapshot, now: number): PetState {
  const runs = snap.recentRuns;
  const hp = runs.length
    ? runs.reduce((h, r) => clamp(h + (r === 'success' ? 15 : -25)), 100)
    : 85;
  const pushed = snap.pushedAt ? Date.parse(snap.pushedAt) : NaN;
  const lastPushAt = Number.isNaN(pushed) ? null : pushed;
  const fullness =
    lastPushAt === null ? 50 : clamp(100 - Math.floor((now - lastPushAt) / HOUR));
  const sanity = clamp(100 - 10 * Math.min(snap.staleIssues, 10));

  return createPet(snap.fullName, now, {
    hp,
    fullness,
    sanity,
    commitsTotal: snap.commitsTotal,
    recentCi: runs.slice(-RECENT_CI_SIZE),
    lastPushAt,
    lastFedTimestamp: lastPushAt ?? now,
    statusMessage: 'SYNCED WITH GITHUB',
  });
}

/** Lazy decay since `updatedAt`. Idempotent for the same `now`. */
export function tick(state: PetState, now: number): PetState {
  let s = state;
  const hours = isDead(state) ? 0 : Math.floor((now - state.updatedAt) / HOUR);
  if (hours > 0) {
    const updatedAt = state.updatedAt + hours * HOUR;
    // ponytail: poop damage lands on each UTC midnight crossed, not 24h after the poop. Per-poop timestamps if that feels unfair.
    const days = Math.floor(updatedAt / DAY) - Math.floor(state.updatedAt / DAY);
    s = {
      ...state,
      updatedAt,
      fullness: clamp(state.fullness - hours),
      hp: state.poopCount > 0 ? clamp(state.hp - 5 * days) : state.hp,
    };
  }
  if (s.partyUntil != null && now >= s.partyUntil) s = { ...s, partyUntil: null };
  const out = settle(s, now);
  return isDead(out) && out.updatedAt < now ? { ...out, updatedAt: now } : out;
}

let seq = 0;

function diffStats(a: PetState, b: PetState): PetEvent['deltas'] {
  const deltas: PetEvent['deltas'] = {};
  for (const k of ['hp', 'fullness', 'sanity', 'poopCount'] as const) {
    if (b[k] !== a[k]) deltas[k] = b[k] - a[k];
  }
  return deltas;
}

export interface ApplyOptions {
  source?: PetEvent['source'];
  simulated?: boolean;
}

export interface EngineResult {
  state: PetState;
  event: PetEvent;
}

function makeEvent(
  type: PetEventType,
  label: string,
  deltas: PetEvent['deltas'],
  now: number,
  opts: ApplyOptions,
  defaultSource: PetEvent['source']
): PetEvent {
  return {
    id: `${now.toString(36)}-${(seq++).toString(36)}`,
    at: now,
    type,
    label,
    deltas,
    source: opts.source ?? defaultSource,
    ...(opts.simulated ? { simulated: true } : {}),
  };
}

/** Finish a transition: settle derived fields, detect death, build the event. */
function finish(
  before: PetState,
  next: PetState,
  type: PetEventType,
  label: string,
  now: number,
  opts: ApplyOptions,
  defaultSource: PetEvent['source']
): EngineResult {
  let state = settle(next, now);
  if (isDead(state) && !isDead(before)) {
    type = 'death';
    label = state.statusMessage;
  } else {
    state = { ...state, statusMessage: label };
  }
  return { state, event: makeEvent(type, label, diffStats(before, state), now, opts, defaultSource) };
}

function resurrect(s: PetState, now: number): PetState {
  return {
    ...s,
    hp: 50,
    fullness: 50,
    sanity: 60,
    poopCount: 0,
    stage: 'BABY_GHOST',
    diedAt: null,
    resurrections: s.resurrections + 1,
    partyUntil: null,
    updatedAt: now,
  };
}

function withCi(s: PetState, success: boolean): PetState {
  const r: CiResult = success ? 'success' : 'failure';
  return { ...s, recentCi: [...s.recentCi, r].slice(-RECENT_CI_SIZE) };
}

function withPush(s: PetState, commits: number, now: number): PetState {
  return { ...s, commitsTotal: s.commitsTotal + commits, lastPushAt: now, lastFedTimestamp: now };
}

function commitCount(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function applyEvent(
  state: PetState,
  ev: SimulatedEvent,
  now: number,
  opts: ApplyOptions = {}
): EngineResult {
  const before = tick(state, now);

  if (isDead(before)) {
    const revives = (ev.type === 'ci' && ev.success) || ev.type === 'issue_closed' || ev.type === 'push';
    if (!revives) {
      const ignored = makeEvent(ev.type, 'PET IS DEAD...', {}, now, opts, 'github');
      return { state: before, event: ignored };
    }
    let next = resurrect(before, now);
    if (ev.type === 'ci') next = withCi(next, true);
    if (ev.type === 'push') next = withPush(next, commitCount(ev.commits), now);
    const r = finish(before, next, 'revive', 'RESURRECTED!', now, opts, 'github');
    // The LCD keeps the short status; only the log entry names the trigger.
    const trigger = ev.type === 'ci' ? 'CI PASSED' : ev.type === 'push' ? 'PUSH' : 'ISSUE CLOSED';
    return { state: r.state, event: { ...r.event, label: `${trigger} \u2192 RESURRECTED!` } };
  }

  switch (ev.type) {
    case 'push': {
      const n = commitCount(ev.commits);
      const gain = Math.min(MAX_PUSH_GAIN, FULLNESS_PER_COMMIT * n);
      const next = { ...withPush(before, n, now), fullness: clamp(before.fullness + gain) };
      return finish(before, next, 'push', `PUSH! +${gain} FOOD`, now, opts, 'github');
    }
    case 'ci': {
      const next = withCi({ ...before, hp: clamp(before.hp + (ev.success ? 15 : -25)) }, ev.success);
      const label = ev.success ? 'CI PASSED! +15 HP' : 'CI FAILED! -25 HP';
      return finish(before, next, 'ci', label, now, opts, 'github');
    }
    case 'pr_merged': {
      const next: PetState = {
        ...before,
        fullness: clamp(before.fullness + 20),
        hp: clamp(before.hp + 10),
        sanity: clamp(before.sanity + 10),
        partyUntil: now + PARTY_DURATION,
      };
      return finish(before, next, 'pr_merged', 'PR MERGED! PARTY!', now, opts, 'github');
    }
    case 'issue_opened': {
      const next = { ...before, sanity: clamp(before.sanity - 5) };
      return finish(before, next, 'issue_opened', 'NEW ISSUE! -5 SAN', now, opts, 'github');
    }
    case 'issue_closed': {
      const next = { ...before, sanity: clamp(before.sanity + 10) };
      return finish(before, next, 'issue_closed', 'ISSUE CLOSED +10', now, opts, 'github');
    }
    case 'poop': {
      const next = {
        ...before,
        poopCount: clamp(before.poopCount + 1, 0, 5),
        sanity: clamp(before.sanity - 10),
      };
      const label = `POOP! ${ev.reason}`.toUpperCase().slice(0, 18);
      return finish(before, next, 'poop', label, now, opts, 'kiro-hook');
    }
  }
}

export type PetActionName = 'feed' | 'clean' | 'revive';
export type ActionError = 'PET_DEAD' | 'NOT_DEAD' | 'REPO_STILL_BROKEN';

export interface ActionResult {
  state: PetState;
  event: PetEvent | null;
  error?: ActionError;
}

/** User-triggered actions. Revive only works on a dead pet whose latest CI is green. */
export function applyAction(
  state: PetState,
  action: PetActionName,
  now: number,
  opts: ApplyOptions = {}
): ActionResult {
  const before = tick(state, now);
  const dead = isDead(before);

  if (action === 'revive') {
    if (!dead) return { state: before, event: null, error: 'NOT_DEAD' };
    if (!canRevive(before)) return { state: before, event: null, error: 'REPO_STILL_BROKEN' };
    const r = finish(before, resurrect(before, now), 'revive', 'RESURRECTED!', now, opts, 'user');
    return { state: r.state, event: r.event };
  }

  if (dead) return { state: before, event: null, error: 'PET_DEAD' };

  if (action === 'feed') {
    const next = { ...before, fullness: clamp(before.fullness + FEED_GAIN), lastFedTimestamp: now };
    const r = finish(before, next, 'feed', `YUM! +${FEED_GAIN} FOOD`, now, opts, 'user');
    return { state: r.state, event: r.event };
  }

  const next = {
    ...before,
    poopCount: 0,
    sanity: clamp(before.sanity + before.poopCount * 12),
  };
  const r = finish(before, next, 'clean', 'SCREEN CLEANED!', now, opts, 'user');
  return { state: r.state, event: r.event };
}

// Legacy click-driven API used by src/app/page.tsx and the webhook route until the page is rewired.
// These read the wall clock, so they live outside the pure layer above.

export const INITIAL_PET_STATE: PetState = createPet('octocat/gitgotchi', Date.now(), {
  hp: 90,
  sanity: 95,
  commitsTotal: 12,
  statusMessage: 'HAPPY & CODING',
});

const legacy: ApplyOptions = { source: 'user', simulated: true };

export function applyCiResult(current: PetState, isSuccess: boolean): PetState {
  return applyEvent(current, { type: 'ci', success: isSuccess }, Date.now(), legacy).state;
}

export function applyCommitPush(current: PetState, commitCount = 1): PetState {
  return applyEvent(current, { type: 'push', commits: commitCount }, Date.now(), legacy).state;
}

export function applyPrMerge(current: PetState): PetState {
  return applyEvent(current, { type: 'pr_merged' }, Date.now(), legacy).state;
}

export function applyPoopSpawn(current: PetState, reason = 'CODE SMELL'): PetState {
  return applyEvent(current, { type: 'poop', reason }, Date.now(), legacy).state;
}

export function applyClean(current: PetState): PetState {
  return applyAction(current, 'clean', Date.now(), legacy).state;
}

/** @deprecated Demo-only: skips the canRevive gate. Use applyAction(state, 'revive', now). */
export function applyRevive(current: PetState): PetState {
  const now = Date.now();
  const before = tick(current, now);
  if (!isDead(before)) return before;
  return finish(before, resurrect(before, now), 'revive', 'RESURRECTED!', now, legacy, 'user').state;
}
