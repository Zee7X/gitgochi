import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../../app/api/local-poop/route';
import { getEntry } from '../pet-store';

const KEY = 'demo/healthy';
const hook = (body: unknown, headers: Record<string, string> = { host: 'localhost:3000' }) =>
  POST(new Request('http://localhost:3000/api/local-poop', { method: 'POST', headers, body: JSON.stringify(body) }));

afterEach(() => {
  delete process.env.GITGOTCHI_HOOK_TOKEN;
  delete process.env.GITGOTCHI_REPO;
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
    expect(cleaned.events[0]).toMatchObject({ type: 'clean', source: 'kiro-hook' });
    expect(getEntry(KEY)).toBeDefined();
  });

  it('rejects non-local callers unless the bearer token matches', async () => {
    const body = { filePath: 'src/b.ts', hasTodo: true, repo: KEY };
    expect((await hook(body, { host: 'gitgotchi.example.com' })).status).toBe(403);
    expect((await hook(body, { host: 'localhost', 'x-forwarded-for': '203.0.113.9' })).status).toBe(403);

    process.env.GITGOTCHI_HOOK_TOKEN = 's3cret';
    expect((await hook(body, { host: 'gitgotchi.example.com', authorization: 'Bearer wrong' })).status).toBe(403);
    expect((await hook(body, { host: 'gitgotchi.example.com', authorization: 'Bearer s3cret' })).status).toBe(200);
  });

  it('validates input', async () => {
    expect((await hook({ hasTodo: true })).status).toBe(400);
    expect((await hook({ filePath: 'src/c.ts', repo: 'not a repo' })).status).toBe(400);
  });
});
