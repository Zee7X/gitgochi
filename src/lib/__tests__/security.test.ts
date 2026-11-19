import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as localPoop } from '@/app/api/local-poop/route';
import { GET as petGet } from '@/app/api/pet/[owner]/[repo]/route';
import { resetMemoryKv } from '../kv';
import { allow, resetRateLimits } from '../rate-limit';
import { createSession, loadSession } from '../session';

beforeEach(() => {
  resetMemoryKv();
  resetRateLimits();
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-0123456789abcdef012345');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('rate limits', () => {
  it('counts per key and window', () => {
    for (let i = 0; i < 3; i++) expect(allow('k', 3, 1000, 0)).toBe(true);
    expect(allow('k', 3, 1000, 10)).toBe(false);
    expect(allow('other', 3, 1000, 10)).toBe(true);
    expect(allow('k', 3, 1000, 1001)).toBe(true);
  });

  it('a flood of pet reads from one IP gets 429, another IP is unaffected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const get = (ip: string) =>
      petGet(new Request('http://x/api/pet/acme/rocket', { headers: { 'x-forwarded-for': ip } }), {
        params: Promise.resolve({ owner: 'acme', repo: 'rocket' }),
      });
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await get('203.0.113.1')).status;
    expect(last).toBe(429);
    expect((await get('203.0.113.2')).status).toBe(404);
  });
});

describe('sign out', () => {
  it('revokes the GitHub token at GitHub and deletes the session', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://g.example');
    vi.stubEnv('GITHUB_APP_ID', '1');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'unused');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'cid');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'csecret');
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);
    const { sid } = await createSession({ id: 1, login: 'kim', avatar_url: '' }, { token: 'ghu_TOKEN', tokenExpiresAt: null, refreshToken: null, refreshExpiresAt: null });

    const res = await logout(new Request('https://g.example/api/auth/logout', { method: 'POST', headers: { origin: 'https://g.example', cookie: `gg_session=${sid}` } }));
    expect(res.status).toBe(303);
    const calls = fetchSpy.mock.calls as unknown as [string, RequestInit][];
    const [url, init] = calls[0];
    expect(url).toBe('https://api.github.com/applications/cid/token');
    expect(init.method).toBe('DELETE');
    expect(String(init.body)).toContain('ghu_TOKEN');
    expect(await loadSession(sid)).toBeNull();
  });
});

describe('hook endpoint on a deployment', () => {
  it('never trusts a localhost Host or X-Forwarded-For in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await localPoop(
      new Request('http://localhost:3000/api/local-poop', {
        method: 'POST',
        headers: { host: 'localhost:3000', 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({ filePath: 'src/a.ts', hasTodo: true, repo: 'demo/healthy' }),
      })
    );
    expect(res.status).toBe(403);
  });
});
