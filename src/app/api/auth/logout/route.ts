import { sameOrigin } from '@/lib/access';
import { redirect } from '@/lib/auth-flow';
import { SESSION_COOKIE, clearSessionCookie, deleteSession, loadSession, readCookie, revokeGitHubToken } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deletes the session record and clears the cookie (accounts R1.5). A form POST from our own pages only. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'cross-origin request refused' }, { status: 403 });
  const sid = readCookie(req, SESSION_COOKIE);
  if (sid) {
    const s = await loadSession(sid).catch(() => null);
    if (s) await revokeGitHubToken(s.token).catch(() => false);
    await deleteSession(sid).catch(() => undefined);
  }
  return redirect('/', [clearSessionCookie()], 303);
}
