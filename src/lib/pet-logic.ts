// Pure pet rules shared by the server and the browser (demo pets run here, accounts R7).
// No I/O and no Node APIs: everything takes an entry and returns the next one.
import { demoHistory, demoSnapshot } from './demo-fixtures';
import { applyAction, applyEvent, createPet, seedFromSnapshot, tick } from './state-machine';
import type { PetEvent, PetResponse, PetState, SimulatedEvent } from './types';

const HOUR = 3_600_000;
export const FEED_LIMIT_PER_HOUR = 3;

export const PET_ACTIONS = ['feed', 'clean', 'revive', 'sync', 'simulate'] as const;
export type PetActionRequest = (typeof PET_ACTIONS)[number];

/** The parts of a stored entry the rules need. */
export interface LogicEntry {
  pet: PetState;
  events: PetEvent[];
  snapshotAt: number;
  source: PetResponse['source'];
}

let seq = 0;
export function systemEvent(now: number, label: string, source: PetEvent['source'], simulated = false): PetEvent {
  return {
    id: `${now.toString(36)}-sync-${(seq++).toString(36)}`,
    at: now,
    type: 'sync',
    label,
    deltas: {},
    source,
    ...(simulated ? { simulated: true } : {}),
  };
}

export function respond(entry: LogicEntry, now: number, error?: string): PetResponse {
  return {
    pet: tick(entry.pet, now),
    events: entry.events,
    source: entry.source,
    fetchedAt: new Date(entry.snapshotAt).toISOString(),
    ...(error ? { error } : {}),
  };
}

export function withMessage(res: PetResponse, statusMessage: string): PetResponse {
  return { ...res, pet: { ...res.pet, statusMessage } };
}

/** Fresh demo entry from its fixture, or null for an unknown demo name. */
export function seedDemoEntry(key: string, now: number): LogicEntry | null {
  const snap = demoSnapshot(key, now);
  if (!snap) return null;
  return {
    // The LCD says DEMO PET, never SYNCED WITH GITHUB: a demo is not a real repo.
    pet: createPet(key, now, { ...seedFromSnapshot(snap, now), ...demoHistory(key, now), statusMessage: 'DEMO PET' }),
    events: [systemEvent(now, 'DEMO FIXTURE LOADED', 'system', true)],
    snapshotAt: now,
    source: 'demo',
  };
}

export interface LogicResult<E extends LogicEntry> {
  status: 200 | 403 | 409;
  /** The entry to store; the same object when nothing changed. */
  entry: E;
  changed: boolean;
  response: PetResponse;
}

/**
 * Applies feed, clean, revive or simulate to an entry. `sync` is not handled here because it needs
 * GitHub (real repos) or the fixture (demos). Simulate is only allowed when `allowSimulate` is true.
 */
export function actOnEntry<E extends LogicEntry>(
  entry: E,
  action: Exclude<PetActionRequest, 'sync'>,
  payload: { event?: SimulatedEvent },
  now: number,
  allowSimulate: boolean
): LogicResult<E> {
  const same = (status: LogicResult<E>['status'], response: PetResponse): LogicResult<E> => ({
    status,
    entry,
    changed: false,
    response,
  });
  const commit = (state: PetState, event: PetEvent): LogicResult<E> => {
    const next = { ...entry, pet: state, events: [event, ...entry.events] };
    return { status: 200, entry: next, changed: true, response: respond(next, now) };
  };

  if (action === 'simulate') {
    if (!allowSimulate) return same(403, { ...respond(entry, now), error: 'simulate is disabled in production' });
    if (!payload.event) return same(403, { ...respond(entry, now), error: 'event required' });
    const { state, event } = applyEvent(entry.pet, payload.event, now, { source: 'user', simulated: true });
    return commit(state, event);
  }

  if (action === 'feed') {
    const recent = entry.events.filter((e) => e.type === 'feed' && e.source === 'user' && now - e.at < HOUR);
    if (recent.length >= FEED_LIMIT_PER_HOUR) return same(200, withMessage(respond(entry, now), 'TOO FULL!'));
  }

  const result = applyAction(entry.pet, action, now, { source: 'user' });
  if (result.error === 'REPO_STILL_BROKEN') return same(409, withMessage(respond(entry, now), 'FIX CI FIRST'));
  if (result.error === 'NOT_DEAD') return same(409, withMessage(respond(entry, now), 'STILL ALIVE'));
  if (result.error || !result.event) return same(200, withMessage(respond(entry, now), 'PET IS DEAD...'));
  return commit(result.state, result.event);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Hand-rolled check of a client-supplied event; null when it is not a valid SimulatedEvent. */
export function parseSimulatedEvent(v: unknown): SimulatedEvent | null {
  if (!isObj(v)) return null;
  switch (v.type) {
    case 'push':
      return typeof v.commits === 'number' && Number.isFinite(v.commits) && v.commits >= 0
        ? { type: 'push', commits: v.commits }
        : null;
    case 'ci':
      return typeof v.success === 'boolean' ? { type: 'ci', success: v.success } : null;
    case 'poop':
      return typeof v.reason === 'string' ? { type: 'poop', reason: v.reason.slice(0, 40) } : null;
    case 'pr_merged':
    case 'issue_opened':
    case 'issue_closed':
      return { type: v.type };
    default:
      return null;
  }
}
