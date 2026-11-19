import { appConfig, installUrl } from '@/lib/github-app';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

/** Who is signed in, for the header. Never returns tokens (accounts R1.6). */
export async function GET(req: Request) {
  const base = { signInAvailable: !!appConfig(), installUrl: installUrl() };
  const found = await getSession(req).catch(() => null);
  if (!found) return Response.json({ signedIn: false, ...base }, { headers: HEADERS });
  const { login, avatarUrl } = found.session;
  return Response.json({ signedIn: true, login, avatarUrl, ...base }, { headers: HEADERS });
}
