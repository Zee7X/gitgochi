import { STATE_COOKIE, appOrigin, callbackUrl, redirect, safeNext, splitAuth, stateCookie } from '@/lib/auth-flow';
import { safeEqual } from '@/lib/crypto';
import { githubRequest } from '@/lib/github';
import { createSession, createTicket, exchangeCode, readCookie, sessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const failPage = (msg: string) =>
  new Response(`Sign in failed: ${msg}. Go back to GitGotchi and try again.`, {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': stateCookie('', 0) },
  });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const code = q.get('code');
  const state = q.get('state');

  // Right after installing the app, GitHub sends a code without our state. It is not trusted; the user
  // goes through a normal sign in instead, which GitHub approves without asking again.
  if (!state && q.get('installation_id')) return redirect('/api/auth/login?next=/me');

  const saved = readCookie(req, STATE_COOKIE) ?? '';
  const [savedState, savedNext] = saved.split('.');
  if (!code || !state || !savedState || !safeEqual(state, savedState)) return failPage('the sign in link expired or was not started here');
  const next = safeNext(savedNext ? Buffer.from(savedNext, 'base64url').toString('utf8') : null);

  const tokens = await exchangeCode(code, callbackUrl(req));
  if (!tokens) return failPage('GitHub did not accept the code');

  const res = await githubRequest('/user', tokens.token).catch(() => null);
  const user = res?.ok ? ((await res.json()) as { id?: number; login?: string; avatar_url?: string }) : null;
  if (!user?.id || !user.login) return failPage('GitHub did not return the account');

  const { sid } = await createSession({ id: user.id, login: user.login, avatar_url: user.avatar_url ?? '' }, tokens);
  if (splitAuth(req)) {
    // Sign-in host: hand the session to the app host with a one-time ticket; no cookie is left here.
    const ticket = await createTicket(sid);
    const to = `${appOrigin(req)}/api/auth/handoff?t=${ticket}&next=${encodeURIComponent(next)}`;
    return redirect(to, [stateCookie('', 0)]);
  }
  return redirect(next, [sessionCookie(sid), stateCookie('', 0)]);
}
