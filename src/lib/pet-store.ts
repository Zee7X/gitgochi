import type { PetEvent, PetState } from './types';

export const MAX_EVENTS = 50;

export interface PetEntry {
  pet: PetState;
  /** Newest first, capped at MAX_EVENTS. */
  events: PetEvent[];
  snapshotAt: number;
  source: 'github' | 'demo' | 'fallback';
}

// Kept on globalThis so Next dev HMR and every route module share one Map.
// A KV backend can replace these four functions without touching callers.
const g = globalThis as unknown as { __gitgotchiPets?: Map<string, PetEntry> };
const entries = (g.__gitgotchiPets ??= new Map<string, PetEntry>());

const SEGMENT = /^[a-z0-9._-]+$/;

export function normalizeRepoKey(owner: string, repo: string): string {
  const o = owner.toLowerCase();
  const r = repo.toLowerCase().replace(/\.svg$/, '').replace(/\.git$/, '');
  for (const part of [o, r]) {
    if (!SEGMENT.test(part) || part === '.' || part === '..') {
      throw new Error(`Invalid repo key: ${owner}/${repo}`);
    }
  }
  return `${o}/${r}`;
}

export function getEntry(key: string): PetEntry | undefined {
  return entries.get(key);
}

export function setEntry(key: string, entry: PetEntry): PetEntry {
  const stored = { ...entry, events: entry.events.slice(0, MAX_EVENTS) };
  entries.set(key, stored);
  return stored;
}

/** Returns the updated entry, or undefined when the repo has no entry yet. */
export function appendEvent(key: string, event: PetEvent): PetEntry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  return setEntry(key, { ...entry, events: [event, ...entry.events] });
}
