import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/pet/[owner]/[repo]/route';
import { ANON, type PetCtx } from '../access';
import { resetMemoryKv } from '../kv';
import { actOnEntry, seedDemoEntry } from '../pet-logic';
import { ForbiddenError, act, getPet, parseSimulatedEvent } from '../pet-service';
import { getEntry } from '../pet-store';
import { fakeGitHub } from './helpers';

const NOW = Date.now();
const KEEPER: PetCtx = { role: 'keeper', canSeePrivate: true, signedIn: true, auth: { kind: 'token', token: 'user-token' }, login: 'kim' };
const READER: PetCtx = { ...KEEPER, role: 'reader' };

beforeEach(() => {
  resetMemoryKv();
  vi.stubEnv('DATA_ENCRYPTION_KEY', 'test-data-key-0123456789abcdef0123456789');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('store errors', () => {
  it('GET /api/pet answers 503 store unavailable without leaking the KV URL or token', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://secret-host.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok-SECRET');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('timed out', 'TimeoutError'))));
    const res = await GET(new Request('http://x/api/pet/acme/rocket'), {
      params: Promise.resolve({ owner: 'acme', repo: 'rocket' }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'store unavailable' });
    expect(text).not.toMatch(/SECRET|secret-host/);
  });
});

describe('demo fixtures', () => {
  it('healthy is a CODE_DEMON, haunted is a ZOMBIE, neglected is hungry or sick', async () => {
    expect((await getPet('demo/healthy', NOW, ANON, true)).pet.stage).toBe('CODE_DEMON');
    const haunted = await getPet('demo/haunted', NOW, ANON, true);
    expect(haunted.pet.stage).toBe('ZOMBIE_CORPSE');
    expect(haunted.source).toBe('demo');
    const neglected = (await getPet('demo/neglected', NOW, ANON, true)).pet;
    expect(['HUNGRY', 'SICK']).toContain(neglected.mood);
    expect(neglected.sanity).toBeLessThan(50);
  });

  it('unknown demo name throws', async () => {
    await expect(getPet('demo/nope', NOW)).rejects.toThrow();
  });

  it('demo pets are never written to the server store (accounts R7.1)', async () => {
    await act('demo/healthy', 'feed', {}, NOW);
    await act('demo/healthy', 'simulate', { event: { type: 'ci', success: false } }, NOW);
    expect(await getEntry('demo/healthy')).toBeUndefined();
    // Every visitor sees the fixture, whatever anyone clicked.
    expect((await getPet('demo/healthy', NOW)).pet.stage).toBe('CODE_DEMON');
  });
});

describe('pet rules (shared by server and browser)', () => {
  it('feed adds fullness, the 4th feed within an hour is refused, an hour later it works again', () => {
    let entry = seedDemoEntry('demo/neglected', NOW)!;
    const start = entry.pet.fullness;
    for (let i = 1; i <= 3; i++) {
      const r = actOnEntry(entry, 'feed', {}, NOW + i, true);
      expect(r.response.pet.fullness).toBe(start + 10 * i);
      entry = r.entry;
    }
    const full = actOnEntry(entry, 'feed', {}, NOW + 10, true);
    expect(full.changed).toBe(false);
    expect(full.response.pet.statusMessage).toBe('TOO FULL!');
    expect(full.response.pet.fullness).toBe(start + 30);
    expect(actOnEntry(entry, 'feed', {}, NOW + 3_600_000 + 5, true).response.pet.statusMessage).toMatch(/YUM/);
  });

  it('revive on a dead pet with failing CI answers 409 FIX CI FIRST', async () => {
    const r = await act('demo/haunted', 'revive', {}, NOW + 1);
    expect(r.status).toBe(409);
    expect(r.response.pet.statusMessage).toBe('FIX CI FIRST');
    expect(r.response.pet.stage).toBe('ZOMBIE_CORPSE');
  });

  it('simulate ci success brings the haunted pet back, labelled simulated', async () => {
    const sim = await act('demo/haunted', 'simulate', { event: { type: 'ci', success: true } }, NOW + 1);
    expect(sim.response.pet.resurrections).toBe(1);
    expect(sim.response.events[0].simulated).toBe(true);
  });
});

describe('keepers (accounts R2)', () => {
  it('a visitor cannot act on a real pet and nothing changes', async () => {
    fakeGitHub();
    await getPet('acme/rocket', NOW);
    const before = (await getEntry('acme/rocket'))!;
    await expect(act('acme/rocket', 'feed', {}, NOW, ANON)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(act('acme/rocket', 'sync', {}, NOW, { ...KEEPER, role: 'visitor' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getEntry('acme/rocket')).toEqual(before);
  });

  it('a keeper can feed, and the answer says who they are', async () => {
    fakeGitHub();
    const r = await act('acme/rocket', 'feed', {}, NOW, KEEPER);
    expect(r.status).toBe(200);
    expect(r.response.events[0]).toMatchObject({ type: 'feed', source: 'user' });
    expect(r.response.access).toEqual({ role: 'keeper', visibility: 'public', signedIn: true });
  });

  it('simulate on a real repo is 403 in production, even for a keeper', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    fakeGitHub();
    const r = await act('acme/rocket', 'simulate', { event: { type: 'push', commits: 1 } }, NOW, KEEPER);
    expect(r.status).toBe(403);
  });
});

describe('private repos (accounts R3, R9)', () => {
  it('an anonymous read never reveals a private repo, even when the operator token can see it', async () => {
    fakeGitHub({ private: true });
    await expect(getPet('acme/rocket', NOW, ANON)).rejects.toThrow(/not found/i);
    expect(await getEntry('acme/rocket')).toBeUndefined();
  });

  it('a reader sees the pet; afterwards visitors get the same 404 as for a missing repo', async () => {
    fakeGitHub({ private: true });
    const res = await getPet('acme/rocket', NOW, READER);
    expect(res.access?.visibility).toBe('private');
    await expect(getPet('acme/rocket', NOW + 1, ANON)).rejects.toThrow(/not found/i);
    await expect(act('acme/rocket', 'feed', {}, NOW + 1, ANON)).rejects.toThrow(/not found/i);
  });

  it('a private entry is ciphertext in the store', async () => {
    fakeGitHub({ private: true });
    await getPet('acme/rocket', NOW, READER);
    const { kvGet } = await import('../kv');
    const raw = (await kvGet('gitgotchi:pet:acme/rocket'))!;
    expect(raw).toMatch(/^\{"enc":"/);
    expect(raw).not.toContain('acme');
    expect(raw).not.toContain('SYNCED');
    expect((await getEntry('acme/rocket'))?.pet.repoName).toBe('acme/rocket');
  });

  it('without DATA_ENCRYPTION_KEY a private pet is refused instead of stored in clear', async () => {
    vi.stubEnv('DATA_ENCRYPTION_KEY', '');
    fakeGitHub({ private: true });
    await expect(getPet('acme/rocket', NOW, READER)).rejects.toThrow(/encryption key missing/);
    const { kvGet } = await import('../kv');
    expect(await kvGet('gitgotchi:pet:acme/rocket')).toBeNull();
  });
});

describe('resurrection on resync (pet-engine R6)', () => {
  it('a pet that starved comes back after a new push even without a webhook, and the revival is counted', async () => {
    const DAY = 86_400_000;
    fakeGitHub({ pushedAt: NOW - 77 * DAY, commits: 10, runs: [] });
    const dead = await getPet('acme/rocket', NOW, ANON);
    expect(dead.pet.stage).toBe('ZOMBIE_CORPSE');

    fakeGitHub({ pushedAt: NOW + 60_000, commits: 11, runs: [] });
    const back = await getPet('acme/rocket', NOW + 120_000, ANON, true);
    // Fresh revival: a ghost, whatever GitHub's numbers say (R6.6).
    expect(back.pet.stage).toBe('BABY_GHOST');
    expect(back.pet.fullness).toBe(100);
    expect(back.pet.resurrections).toBe(1);
    expect(back.events.map((e) => e.label)).toContain('PUSH \u2192 RESURRECTED!');

    // A plain resync of a living pet adds no second resurrection and keeps it rising.
    const again = await getPet('acme/rocket', NOW + 240_000, ANON, true);
    expect(again.pet.resurrections).toBe(1);
    expect(again.pet.stage).toBe('BABY_GHOST');

    // A later push, read on a resync more than 24 hours after the revival, lets it become a demon (R6.7, R6.8).
    const later = NOW + 25 * 3_600_000;
    // A repo without CI stays a ghost (HP 70 < 80, pet-engine R8.1); one green run on top lets it rise.
    fakeGitHub({ pushedAt: later - 60_000, commits: 12, runs: [] });
    expect((await getPet('acme/rocket', later, ANON, true)).pet.stage).toBe('BABY_GHOST');
    fakeGitHub({ pushedAt: later - 60_000, commits: 12, runs: ['success'] });
    expect((await getPet('acme/rocket', later + 1, ANON, true)).pet.stage).toBe('CODE_DEMON');
  });
});

describe('parseSimulatedEvent', () => {
  it('accepts valid events and rejects junk', () => {
    expect(parseSimulatedEvent({ type: 'push', commits: 2 })).toEqual({ type: 'push', commits: 2 });
    expect(parseSimulatedEvent({ type: 'ci', success: false })).toEqual({ type: 'ci', success: false });
    expect(parseSimulatedEvent({ type: 'ci', success: 'yes' })).toBeNull();
    expect(parseSimulatedEvent({ type: 'push', commits: -1 })).toBeNull();
    expect(parseSimulatedEvent({ type: 'boom' })).toBeNull();
    expect(parseSimulatedEvent(null)).toBeNull();
  });
});
