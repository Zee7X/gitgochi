import { deriveKey, open, seal } from './crypto';
import { StoreError, kvConfig, kvDel, kvGet, kvSet } from './kv';
import type { PetEvent, PetState } from './types';

export { StoreError, kvConfig } from './kv';

export const MAX_EVENTS = 50;
export const MAX_HOOK_TOKENS = 5;
const KEY_PREFIX = 'gitgotchi:pet:';

export type Visibility = 'public' | 'private';

export interface HookTokenRecord {
  id: string;
  /** sha256 of the secret part; the secret itself is shown once and never stored. */
  hash: string;
  createdBy: string;
  createdAt: number;
}

export interface PetEntry {
  pet: PetState;
  /** Newest first, capped at MAX_EVENTS. */
  events: PetEvent[];
  snapshotAt: number;
  source: 'github' | 'demo' | 'fallback';
  /** Missing on entries written before accounts existed: they are public. */
  visibility?: Visibility;
  repoId?: number;
  /** sha256 of the private badge key (accounts R5). */
  badgeKeyHash?: string;
  hookTokens?: HookTokenRecord[];
}

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

export const isPrivate = (e: PetEntry | undefined) => e?.visibility === 'private';

/**
 * Reads are kept in function memory for 30 seconds, so polling pages and badges do not read Upstash every time
 * (free plan budget). Writes from this instance update the copy at once; a write on another instance shows up
 * here within 30 seconds. Only used with a real store: the local in-memory store needs no cache.
 */
export const READ_CACHE_MS = 30_000;
const g = globalThis as unknown as { __ggPetCache?: Map<string, { entry: PetEntry | undefined; at: number }> };
const cache = (g.__ggPetCache ??= new Map());
const MAX_CACHED = 500;

/** Test hook. */
export function resetPetCache(): void {
  cache.clear();
}

function remember(key: string, entry: PetEntry | undefined): void {
  if (!kvConfig()) return;
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(key, { entry, at: Date.now() });
}

/** Key for private entries (accounts R9.3). Missing key: private pets cannot be stored. */
function dataKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret) throw new StoreError('encryption key missing');
  return deriveKey(secret, 'pet-entry');
}

function isEntry(v: unknown): v is PetEntry {
  const e = v as PetEntry | null;
  return !!e && typeof e === 'object' && typeof e.pet === 'object' && !!e.pet && Array.isArray(e.events);
}

/** A stored value that does not parse, does not decrypt, or is not shaped like an entry counts as no entry. */
function parseEntry(raw: string | null): PetEntry | undefined {
  if (raw === null) return undefined;
  try {
    let v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && typeof (v as { enc?: unknown }).enc === 'string') {
      const plain = open((v as { enc: string }).enc, dataKey());
      if (plain === null) return undefined;
      v = JSON.parse(plain);
    }
    return isEntry(v) ? v : undefined;
  } catch (e) {
    if (e instanceof StoreError) throw e;
    return undefined;
  }
}

export async function getEntry(key: string): Promise<PetEntry | undefined> {
  const hit = kvConfig() ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < READ_CACHE_MS) return hit.entry && structuredClone(hit.entry);
  const entry = parseEntry(await kvGet(KEY_PREFIX + key));
  remember(key, entry);
  return entry && structuredClone(entry);
}

export async function setEntry(key: string, entry: PetEntry): Promise<PetEntry> {
  const stored = { ...entry, events: entry.events.slice(0, MAX_EVENTS) };
  const json = JSON.stringify(stored);
  // Private entries are sealed before they leave the process, so a copy of the store alone reveals nothing.
  await kvSet(KEY_PREFIX + key, stored.visibility === 'private' ? JSON.stringify({ enc: seal(json, dataKey()) }) : json);
  remember(key, structuredClone(stored));
  return stored;
}

export async function deleteEntry(key: string): Promise<void> {
  cache.delete(key);
  await kvDel(KEY_PREFIX + key);
}

/** Returns the updated entry, or undefined when the repo has no entry yet. */
export async function appendEvent(key: string, event: PetEvent): Promise<PetEntry | undefined> {
  const entry = await getEntry(key);
  if (!entry) return undefined;
  return setEntry(key, { ...entry, events: [event, ...entry.events] });
}
