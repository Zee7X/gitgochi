import { deriveKey, open, seal } from './crypto';
import { StoreError, kvDel, kvGet, kvSet } from './kv';
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
  return parseEntry(await kvGet(KEY_PREFIX + key));
}

export async function setEntry(key: string, entry: PetEntry): Promise<PetEntry> {
  const stored = { ...entry, events: entry.events.slice(0, MAX_EVENTS) };
  const json = JSON.stringify(stored);
  // Private entries are sealed before they leave the process, so a copy of the store alone reveals nothing.
  await kvSet(KEY_PREFIX + key, stored.visibility === 'private' ? JSON.stringify({ enc: seal(json, dataKey()) }) : json);
  return stored;
}

export async function deleteEntry(key: string): Promise<void> {
  await kvDel(KEY_PREFIX + key);
}

/** Returns the updated entry, or undefined when the repo has no entry yet. */
export async function appendEvent(key: string, event: PetEvent): Promise<PetEntry | undefined> {
  const entry = await getEntry(key);
  if (!entry) return undefined;
  return setEntry(key, { ...entry, events: [event, ...entry.events] });
}
