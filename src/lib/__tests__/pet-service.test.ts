import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/pet/[owner]/[repo]/route';
import { act, getPet, parseSimulatedEvent } from '../pet-service';

const NOW = Date.now();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('store errors', () => {
  it('GET /api/pet answers 503 store unavailable without leaking the KV URL or token', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://secret-host.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok-SECRET');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('timed out', 'TimeoutError'))));
    const res = await GET(new Request('http://x/api/pet/demo/healthy'), {
      params: Promise.resolve({ owner: 'demo', repo: 'healthy' }),
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
    expect((await getPet('demo/healthy', NOW, true)).pet.stage).toBe('CODE_DEMON');
    const haunted = await getPet('demo/haunted', NOW, true);
    expect(haunted.pet.stage).toBe('ZOMBIE_CORPSE');
    expect(haunted.source).toBe('demo');
    const neglected = (await getPet('demo/neglected', NOW, true)).pet;
    expect(['HUNGRY', 'SICK']).toContain(neglected.mood);
    expect(neglected.sanity).toBeLessThan(50);
  });

  it('unknown demo name throws', async () => {
    await expect(getPet('demo/nope', NOW)).rejects.toThrow();
  });
});

describe('act', () => {
  it('feed adds fullness, the 4th feed within an hour is refused', async () => {
    await getPet('demo/neglected', NOW, true);
    const start = (await getPet('demo/neglected', NOW)).pet.fullness;
    for (let i = 1; i <= 3; i++) {
      const r = await act('demo/neglected', 'feed', {}, NOW + i);
      expect(r.response.pet.fullness).toBe(start + 10 * i);
    }
    const full = await act('demo/neglected', 'feed', {}, NOW + 10);
    expect(full.response.pet.statusMessage).toBe('TOO FULL!');
    expect(full.response.pet.fullness).toBe(start + 30);
    // An hour later the limit is lifted again.
    const later = await act('demo/neglected', 'feed', {}, NOW + 3_600_000 + 5);
    expect(later.response.pet.statusMessage).toMatch(/YUM/);
  });

  it('revive on a dead pet with failing CI answers 409 FIX CI FIRST', async () => {
    await getPet('demo/haunted', NOW, true);
    const r = await act('demo/haunted', 'revive', {}, NOW + 1);
    expect(r.status).toBe(409);
    expect(r.response.pet.statusMessage).toBe('FIX CI FIRST');
    expect(r.response.pet.stage).toBe('ZOMBIE_CORPSE');
  });

  it('simulate ci success then revive brings the haunted pet back', async () => {
    await getPet('demo/haunted', NOW, true);
    const sim = await act('demo/haunted', 'simulate', { event: { type: 'ci', success: true } }, NOW + 1);
    expect(sim.response.pet.resurrections).toBe(1);
    expect(sim.response.events[0].simulated).toBe(true);
  });

  it('simulate on a real repo is 403 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const r = await act('acme/rocket', 'simulate', { event: { type: 'push', commits: 1 } }, NOW);
    expect(r.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
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
