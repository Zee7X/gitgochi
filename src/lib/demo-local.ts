// Demo pets live in each browser's localStorage (accounts R7). They run the same rules as the server
// (pet-logic.ts on top of state-machine.ts), so a demo behaves exactly like a real pet, only privately.
import { actOnEntry, respond, seedDemoEntry, type LogicEntry, type PetActionRequest } from './pet-logic';
import type { PetResponse, SimulatedEvent } from './types';

export const DEMO_STORAGE_PREFIX = 'gitgotchi:demo:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(s?: StorageLike): StorageLike | null {
  if (s) return s;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Private mode or blocked storage: the demo still works, it just forgets on reload.
    return null;
  }
}

function isEntry(v: unknown): v is LogicEntry {
  const e = v as LogicEntry | null;
  return !!e && typeof e === 'object' && !!e.pet && typeof e.pet === 'object' && typeof e.pet.hp === 'number' && Array.isArray(e.events);
}

export function saveDemo(key: string, entry: LogicEntry, s?: StorageLike): void {
  try {
    storage(s)?.setItem(DEMO_STORAGE_PREFIX + key, JSON.stringify({ ...entry, events: entry.events.slice(0, 50) }));
  } catch {
    // Quota or blocked storage: keep going in memory.
  }
}

/** The browser's saved demo pet, or a fresh one from the fixture. Null for an unknown demo name. */
export function loadDemo(key: string, now: number, s?: StorageLike): LogicEntry | null {
  try {
    const raw = storage(s)?.getItem(DEMO_STORAGE_PREFIX + key);
    if (raw) {
      const v: unknown = JSON.parse(raw);
      if (isEntry(v) && v.pet.repoName === key) return v;
    }
  } catch {
    // Unreadable value: start over from the fixture.
  }
  const fresh = seedDemoEntry(key, now);
  if (fresh) saveDemo(key, fresh, s);
  return fresh;
}

export function demoResponse(key: string, now: number, s?: StorageLike): PetResponse | null {
  const e = loadDemo(key, now, s);
  return e ? respond(e, now) : null;
}

/** Runs an action on this browser's demo pet. `sync` is RESET DEMO. */
export function actOnDemo(
  key: string,
  action: PetActionRequest,
  event: SimulatedEvent | undefined,
  now: number,
  s?: StorageLike
): { status: number; response: PetResponse } | null {
  if (action === 'sync') {
    const fresh = seedDemoEntry(key, now);
    if (!fresh) return null;
    saveDemo(key, fresh, s);
    return { status: 200, response: respond(fresh, now) };
  }
  const entry = loadDemo(key, now, s);
  if (!entry) return null;
  const r = actOnEntry(entry, action, { event }, now, true);
  if (r.changed) saveDemo(key, r.entry, s);
  return { status: r.status, response: r.response };
}
