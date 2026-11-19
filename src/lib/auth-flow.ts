// Helpers for the GitHub App user authorization routes under /api/auth.

export const STATE_COOKIE = 'gg_oauth';

export const appOrigin = (req: Request) => process.env.APP_ORIGIN || new URL(req.url).origin;
/**
 * Where GitHub sign in runs. When AUTH_ORIGIN is set (gitgochi.vercel.app), the OAuth callback lands there and
 * hands the session to APP_ORIGIN with a one-time ticket, so the custom domain never serves an OAuth callback.
 */
export const authOrigin = (req: Request) => process.env.AUTH_ORIGIN || appOrigin(req);
export const callbackUrl = (req: Request) => `${authOrigin(req)}/api/auth/callback`;
export const splitAuth = (req: Request) => authOrigin(req) !== appOrigin(req);
export const onAuthHost = (req: Request) => new URL(req.url).host === new URL(authOrigin(req)).host;

/** Only same-site relative paths, so `next` cannot send the user to another site after sign in. */
export function safeNext(v: string | null | undefined): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 300) return '/me';
  return v;
}

export function stateCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${STATE_COOKIE}=${value}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const redirect = (to: string, cookies: string[] = [], status = 302) => {
  const headers = new Headers({ Location: to, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status, headers });
};
