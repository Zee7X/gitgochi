import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as login } from '@/app/api/auth/login/route';
import { GET as callback } from '@/app/api/auth/callback/route';
import { GET as handoff } from '@/app/api/auth/handoff/route';
import { resetMemoryKv } from '../kv';
import { loadSession } from '../session';

const APP = 'https://gitgochi.lumelo.my.id';
const AUTH = 'https://gitgochi.vercel.app';

beforeEach(() => {
  resetMemoryKv();
  vi.stubEnv('APP_ORIGIN', APP);
  vi.stubEnv('AUTH_ORIGIN', AUTH);
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-0123456789abcdef012345');
  vi.stubEnv('GITHUB_APP_ID', '1');
  vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'unused');
  vi.stubEnv('GITHUB_APP_CLIENT_ID', 'cid');
  vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'csecret');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const setCookies = (r: Response) => r.headers.getSetCookie();

describe('sign in on the Vercel host, session on the custom domain', () => {
  it('SIGN IN on the app host moves to the sign-in host first', async () => {
    const r = await login(new Request(`${APP}/api/auth/login?next=/pet/a/b`));
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe(`${AUTH}/api/auth/login?next=%2Fpet%2Fa%2Fb`);
    expect(setCookies(r)).toEqual([]);
  });

  it('the sign-in host sends GitHub a callback on its own domain', async () => {
    const r = await login(new Request(`${AUTH}/api/auth/login?next=/me`));
    const to = new URL(r.headers.get('location')!);
    expect(to.origin).toBe('https://github.com');
    expect(to.searchParams.get('redirect_uri')).toBe(`${AUTH}/api/auth/callback`);
  });

  it('the callback hands over a one-time ticket; the custom domain sets the cookie; the ticket works once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string | URL | Request) =>
        String(u).includes('login/oauth/access_token')
          ? Response.json({ access_token: 'ghu_X', expires_in: 28800 })
          : Response.json({ id: 7, login: 'kim', avatar_url: '' })
      )
    );
    const start = await login(new Request(`${AUTH}/api/auth/login?next=/me`));
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const cookie = setCookies(start)[0].split(';')[0];

    const cb = await callback(new Request(`${AUTH}/api/auth/callback?code=c&state=${state}`, { headers: { cookie } }));
    const to = new URL(cb.headers.get('location')!);
    expect(to.origin + to.pathname).toBe(`${APP}/api/auth/handoff`);
    expect(to.searchParams.get('next')).toBe('/me');
    // No session cookie is left on the sign-in host.
    expect(setCookies(cb).some((c) => c.startsWith('gg_session='))).toBe(false);

    const h = await handoff(new Request(to.toString()));
    expect(h.headers.get('location')).toBe('/me');
    expect(h.headers.get('referrer-policy')).toBe('no-referrer');
    const sid = setCookies(h).find((c) => c.startsWith('gg_session='))!.split(';')[0].split('=')[1];
    expect((await loadSession(sid))?.login).toBe('kim');

    const again = await handoff(new Request(to.toString()));
    expect(again.headers.get('location')).toBe('/?signin=expired');
    expect(setCookies(again)).toEqual([]);
  });

  it('a made-up ticket is refused', async () => {
    const r = await handoff(new Request(`${APP}/api/auth/handoff?t=${'x'.repeat(43)}&next=/me`));
    expect(r.headers.get('location')).toBe('/?signin=expired');
  });
});
