import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendEvent, getEntry, kvConfig, MAX_EVENTS, normalizeRepoKey, setEntry, StoreError } from '../pet-store';
import { createPet } from '../state-machine';
import type { PetEvent } from '../types';

const event = (n: number): PetEvent => ({
  id: String(n),
  at: n,
  type: 'push',
  label: 'PUSH',
  deltas: {},
  source: 'github',
});

const URL_ = 'https://kv.example.upstash.io';
const TOKEN = 'tok-SECRET-123';

/** Stands in for the Upstash REST endpoint: GET and SET on a Map. */
function fakeKv() {
  const data = new Map<string, string>();
  const fn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const [cmd, key, value] = JSON.parse(String(init?.body)) as string[];
    if (cmd === 'SET') data.set(key, value);
    return Response.json({ result: cmd === 'SET' ? 'OK' : (data.get(key) ?? null) });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, data };
}

const useKv = () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', URL_);
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', TOKEN);
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('normalizeRepoKey', () => {
  it('lowercases and strips .svg / .git', () => {
    expect(normalizeRepoKey('Octo-Cat', 'GitGotchi.svg')).toBe('octo-cat/gitgotchi');
    expect(normalizeRepoKey('a', 'b.git')).toBe('a/b');
  });
  it.each([
    ['a/b', 'c'],
    ['a b', 'c'],
    ['', 'c'],
    ['a', ''],
    ['a', '.svg'],
    ['..', 'c'],
    ['a', '..'],
    ['a', 'c?x=1'],
  ])('rejects %j / %j', (o, r) => {
    expect(() => normalizeRepoKey(o, r)).toThrow();
  });
});

describe('in-memory store', () => {
  it('keeps events newest first and capped', async () => {
    const key = 'test/cap';
    await setEntry(key, { pet: createPet(key, 0), events: [], snapshotAt: 0, source: 'demo' });
    for (let i = 0; i < MAX_EVENTS + 10; i++) await appendEvent(key, event(i));
    const entry = (await getEntry(key))!;
    expect(entry.events).toHaveLength(MAX_EVENTS);
    expect(entry.events[0].id).toBe(String(MAX_EVENTS + 9));
  });
  it('appendEvent on an unknown repo is a no-op', async () => {
    expect(await appendEvent('test/missing', event(1))).toBeUndefined();
    expect(await getEntry('test/missing')).toBeUndefined();
  });
});

describe('KV store', () => {
  it('Upstash vars win over KV_* vars; a half-set pair is skipped; none means in-memory', () => {
    for (const v of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
      vi.stubEnv(v, '');
    }
    expect(kvConfig()).toBeNull();
    vi.stubEnv('KV_REST_API_URL', 'https://vercel-kv');
    vi.stubEnv('KV_REST_API_TOKEN', 'vercel-token');
    expect(kvConfig()).toEqual({ url: 'https://vercel-kv', token: 'vercel-token' });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', URL_);
    expect(kvConfig()?.url).toBe('https://vercel-kv');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', TOKEN);
    expect(kvConfig()).toEqual({ url: URL_, token: TOKEN });
  });

  it('round-trips an entry as JSON under a prefixed key, bypassing the in-memory Map', async () => {
    useKv();
    const { fn, data } = fakeKv();
    const key = 'test/kv-roundtrip';
    const entry = { pet: createPet(key, 0), events: [event(1)], snapshotAt: 5, source: 'github' as const };

    await setEntry(key, entry);
    expect(await getEntry(key)).toEqual(entry);
    expect(JSON.parse(data.get(`gitgotchi:pet:${key}`)!)).toEqual(entry);

    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(URL_);
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    vi.unstubAllEnvs();
    expect(await getEntry(key)).toBeUndefined();
  });

  it('caps events through KV, newest first', async () => {
    useKv();
    const { data } = fakeKv();
    const key = 'test/kv-cap';
    await setEntry(key, { pet: createPet(key, 0), events: [], snapshotAt: 0, source: 'demo' });
    for (let i = 0; i < MAX_EVENTS + 10; i++) await appendEvent(key, event(i));
    const entry = (await getEntry(key))!;
    expect(entry.events).toHaveLength(MAX_EVENTS);
    expect(entry.events[0].id).toBe(String(MAX_EVENTS + 9));
    expect(JSON.parse(data.get(`gitgotchi:pet:${key}`)!).events).toHaveLength(MAX_EVENTS);
  });

  it('a value that does not parse counts as no entry', async () => {
    useKv();
    const { data } = fakeKv();
    data.set('gitgotchi:pet:test/kv-junk', 'not json{');
    expect(await getEntry('test/kv-junk')).toBeUndefined();
    data.set('gitgotchi:pet:test/kv-junk', '"a string"');
    expect(await getEntry('test/kv-junk')).toBeUndefined();
  });

  it.each([
    ['an error reply', () => Promise.resolve(Response.json({ error: `WRONGPASS ${TOKEN}` }, { status: 401 }))],
    ['a 200 with an error field', () => Promise.resolve(Response.json({ error: 'ERR' }))],
    ['a network failure', () => Promise.reject(new TypeError(`fetch failed: ${URL_}?token=${TOKEN}`))],
    ['a timeout', () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))],
  ])('%s throws StoreError without the URL or token', async (_, reply) => {
    useKv();
    vi.stubGlobal('fetch', vi.fn(reply));
    const err = await getEntry('test/kv-down').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StoreError);
    expect(String(err)).not.toMatch(/SECRET|upstash/);
  });
});

describe('read cache (free-plan budget)', () => {
  it('a second read within 30 s skips the store; a write updates it; after 30 s it reads again', async () => {
    useKv();
    const { fn } = fakeKv();
    const { resetPetCache, READ_CACHE_MS } = await import('../pet-store');
    resetPetCache();
    vi.useFakeTimers();
    try {
      const key = 'test/cache';
      await setEntry(key, { pet: createPet(key, 0), events: [], snapshotAt: 1, source: 'github' });
      const before = fn.mock.calls.length;
      expect((await getEntry(key))?.snapshotAt).toBe(1);
      expect((await getEntry(key))?.snapshotAt).toBe(1);
      expect(fn.mock.calls.length).toBe(before);

      await setEntry(key, { pet: createPet(key, 0), events: [], snapshotAt: 2, source: 'github' });
      expect((await getEntry(key))?.snapshotAt).toBe(2);

      vi.advanceTimersByTime(READ_CACHE_MS + 1);
      await getEntry(key);
      expect(fn.mock.calls.length).toBe(before + 2);
    } finally {
      vi.useRealTimers();
    }
  });
});
