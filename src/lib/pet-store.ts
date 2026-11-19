import type { PetEvent, PetState } from './types';

export const MAX_EVENTS = 50;
const KEY_PREFIX = 'gitgotchi:pet:';
const KV_TIMEOUT_MS = 5000;

export interface PetEntry {
  pet: PetState;
  /** Newest first, capped at MAX_EVENTS. */
  events: PetEvent[];
  snapshotAt: number;
  source: 'github' | 'demo' | 'fallback';
}

/** A KV call failed. The message never contains the KV URL or token. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

// Without KV credentials pets live in this Map, kept on globalThis so Next dev HMR
// and every route module share it. A restart empties it.
const g = globalThis as unknown as { __gitgotchiPets?: Map<string, PetEntry> };
const memory = (g.__gitgotchiPets ??= new Map<string, PetEntry>());

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

interface KvConfig {
  url: string;
  token: string;
}

/** Upstash's own names win over the KV_* names the Vercel integration injects. Null means in-memory. */
export function kvConfig(): KvConfig | null {
  const env = process.env;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  return null;
}

/** Runs one Upstash REST command such as ['GET', key] and returns its `result`. */
async function kv({ url, token }: KvConfig, command: string[]): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(KV_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (e) {
    // Fetch errors can quote the URL, so only the kind of failure is kept.
    throw new StoreError((e as Error)?.name === 'TimeoutError' ? 'store timed out' : 'store unreachable');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || typeof body !== 'object' || body === null || 'error' in body) {
    throw new StoreError(`store responded ${res.status}`);
  }
  return (body as { result?: unknown }).result;
}

/** A stored value that does not parse, or is not shaped like an entry, counts as no entry. */
function parseEntry(raw: unknown): PetEntry | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const v = JSON.parse(raw) as PetEntry | null;
    return v && typeof v.pet === 'object' && v.pet && Array.isArray(v.events) ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function getEntry(key: string): Promise<PetEntry | undefined> {
  const cfg = kvConfig();
  return cfg ? parseEntry(await kv(cfg, ['GET', KEY_PREFIX + key])) : memory.get(key);
}

export async function setEntry(key: string, entry: PetEntry): Promise<PetEntry> {
  const stored = { ...entry, events: entry.events.slice(0, MAX_EVENTS) };
  const cfg = kvConfig();
  if (cfg) await kv(cfg, ['SET', KEY_PREFIX + key, JSON.stringify(stored)]);
  else memory.set(key, stored);
  return stored;
}

/** Returns the updated entry, or undefined when the repo has no entry yet. */
export async function appendEvent(key: string, event: PetEvent): Promise<PetEntry | undefined> {
  const entry = await getEntry(key);
  if (!entry) return undefined;
  return setEntry(key, { ...entry, events: [event, ...entry.events] });
}
