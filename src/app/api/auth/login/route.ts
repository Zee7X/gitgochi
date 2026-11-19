import { callbackUrl, redirect, safeNext, stateCookie } from '@/lib/auth-flow';
import { randomToken } from '@/lib/crypto';
import { appConfig } from '@/lib/github-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Starts "Sign in with GitHub" with a random state bound to this browser (accounts R1.1). */
export async function GET(req: Request) {
  const cfg = appConfig();
  if (!cfg) return Response.json({ error: 'sign in is not configured on this deployment' }, { status: 503 });
  const next = safeNext(new URL(req.url).searchParams.get('next'));
  const state = randomToken(24);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(req));
  url.searchParams.set('state', state);
  // No scope parameter: a GitHub App user token gets exactly the app's permissions (accounts R1.3).
  return redirect(url.toString(), [stateCookie(`${state}.${Buffer.from(next).toString('base64url')}`, 600)]);
}
