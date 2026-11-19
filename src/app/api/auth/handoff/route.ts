import { redirect, safeNext } from '@/lib/auth-flow';
import { redeemTicket, sessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** App host: turns the one-time ticket from the sign-in host into this host's session cookie. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const next = safeNext(q.get('next'));
  const sid = await redeemTicket(q.get('t') ?? '').catch(() => null);
  if (!sid) return redirect('/?signin=expired');
  const res = redirect(next, [sessionCookie(sid)]);
  // The ticket is spent, but keep it out of Referer headers anyway.
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
