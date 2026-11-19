import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/local-poop/route';
import { newHookToken } from '../access';
import { resetMemoryKv } from '../kv';
import { getPet } from '../pet-service';
import { getEntry, setEntry } from '../pet-store';
import { fakeGitHub } from './helpers';

const KEY = 'acme/rocket';
const hook = (body: unknown, headers: Record<string, string> = { host: 'localhost:3000' }) =>
  POST(new Request('http://localhost:3000/api/local-poop', { method: 'POST', headers, body: JSON.stringify(body) }));

beforeEach(() => {
  resetMemoryKv();
  fakeGitHub();
});

afterEach(() => {
  delete process.env.GITGOTCHI_HOOK_TOKEN;
  delete process.env.GITGOTCHI_REPO;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/local-poop', () => {
  it('adds a poop for a smell, ignores a repeat, and removes it when the file is clean', async () => {
    const smelly = { filePath: 'src/a.ts', hasConsoleLog: true, repo: KEY };
    const first = await (await hook(smelly)).json();
    const base = first.pet.poopCount;
    expect(base).toBeGreaterThan(0);
    expect(first.events[0]).toMatchObject({ type: 'poop', source: 'kiro-hook', label: 'console.log in src/a.ts' });

    expect((await (await hook(smelly)).json()).pet.poopCount).toBe(base);

    const cleaned = await (await hook({ filePath: 'src/a.ts', clean: true, repo: KEY })).json();
    expect(cleaned.pet.poopCount).toBe(0);
    expect(cleaned.events[0]).toMatchObject({ type: 'clean', source: 'kiro-hook', label: 'clean after src/a.ts', file: 'src/a.ts' });
    expect(await getEntry(KEY)).toBeDefined();
  });

  it('cleaning one file leaves the poop of other files in place', async () => {
    const repo = KEY;
    const start = (await (await hook({ filePath: 'src/x.ts', clean: true, repo })).json()).pet;
    await hook({ filePath: 'src/x.ts', hasTodo: true, repo });
    const two = await (await hook({ filePath: 'src/y.ts', hasDebugger: true, repo })).json();
    expect(two.pet.poopCount).toBe(Math.min(5, start.poopCount + 2));

    const one = await (await hook({ filePath: 'src/x.ts', clean: true, repo })).json();
    expect(one.pet.poopCount).toBe(two.pet.poopCount - 1);
    expect(one.events[0]).toMatchObject({ type: 'clean', label: 'clean after src/x.ts' });
    // y.ts is still outstanding: a repeat report changes nothing, and its clean removes one more.
    expect((await (await hook({ filePath: 'src/y.ts', hasDebugger: true, repo })).json()).pet.poopCount).toBe(one.pet.poopCount);
    expect((await (await hook({ filePath: 'src/y.ts', clean: true, repo })).json()).pet.poopCount).toBe(one.pet.poopCount - 1);
  });

  it('a demo pet gets the report applied to its fixture, and nothing is stored (accounts R7.1)', async () => {
    const res = await (await hook({ filePath: 'src/a.ts', hasConsoleLog: true, repo: 'demo/healthy' })).json();
    expect(res.events[0]).toMatchObject({ type: 'poop', source: 'kiro-hook' });
    expect(await getEntry('demo/healthy')).toBeUndefined();
  });

  it('answers 503 store unavailable when KV is down', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://kv.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok-SECRET');
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    const res = await hook({ filePath: 'src/d.ts', hasTodo: true, repo: KEY });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'store unavailable' });
  });

  it('rejects non-local callers unless the operator token matches', async () => {
    const body = { filePath: 'src/b.ts', hasTodo: true, repo: KEY };
    expect((await hook(body, { host: 'gitgotchi.example.com' })).status).toBe(403);
    expect((await hook(body, { host: 'localhost', 'x-forwarded-for': '203.0.113.9' })).status).toBe(403);

    process.env.GITGOTCHI_HOOK_TOKEN = 's3cret';
    expect((await hook(body, { host: 'gitgotchi.example.com', authorization: 'Bearer wrong' })).status).toBe(403);
    expect((await hook(body, { host: 'gitgotchi.example.com', authorization: 'Bearer s3cret' })).status).toBe(200);
  });

  it('a per-pet hook token opens its own pet only, and stops working once revoked (accounts R6)', async () => {
    await getPet(KEY, Date.now());
    await getPet('acme/other', Date.now());
    const t = newHookToken();
    const entry = (await getEntry(KEY))!;
    await setEntry(KEY, { ...entry, hookTokens: [{ id: t.id, hash: t.hash, createdBy: 'kim', createdAt: 0 }] });
    const remote = { host: 'gitgotchi.example.com', authorization: `Bearer ${t.token}` };

    expect((await hook({ filePath: 'src/b.ts', hasTodo: true, repo: KEY }, remote)).status).toBe(200);
    expect((await hook({ filePath: 'src/b.ts', hasTodo: true, repo: 'acme/other' }, remote)).status).toBe(403);

    await setEntry(KEY, { ...(await getEntry(KEY))!, hookTokens: [] });
    expect((await hook({ filePath: 'src/b.ts', hasTodo: true, repo: KEY }, remote)).status).toBe(403);
  });

  it('validates input', async () => {
    expect((await hook({ hasTodo: true, repo: KEY })).status).toBe(400);
    expect((await hook({ filePath: 'src/c.ts', repo: 'not a repo' })).status).toBe(400);
  });
});
