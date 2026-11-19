import { limit } from '@/lib/rate-limit';
import { ANON, resolveCtx } from '@/lib/access';
import { isDemoKey } from '@/lib/demo-fixtures';
import { diagnose } from '@/lib/heal';
import { getPet, petErrorResponse, petHeaders } from '@/lib/pet-service';
import { normalizeRepoKey } from '@/lib/pet-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };

/**
 * "Summon Kiro": read-only diagnosis plus a prompt to paste into Kiro. Nothing is changed or opened.
 * A private repo's diagnosis is built for readers and keepers only and never stored (accounts R9.4).
 */
export async function POST(req: Request) {
  const slow = limit(req, 'heal');
  if (slow) return slow;
  const body = (await req.json().catch(() => null)) as { repo?: unknown } | null;
  const raw = typeof body?.repo === 'string' ? body.repo : '';
  const [owner, repo, ...rest] = raw.split('/');
  let key: string;
  try {
    if (rest.length) throw new Error('invalid repo');
    key = normalizeRepoKey(owner, repo ?? '');
  } catch {
    return Response.json({ success: false, error: 'repo must be owner/repo' }, { status: 400, headers: HEADERS });
  }
  try {
    const who = isDemoKey(key) ? ANON : await resolveCtx(req, key);
    const res = await getPet(key, Date.now(), who);
    // The requester's own token reads GitHub; anonymous diagnoses of public repos use GITHUB_TOKEN.
    const token = who.auth.kind === 'token' ? who.auth.token : undefined;
    const diagnosis = await diagnose(key, res.pet, res.events, { token });
    return Response.json({ success: true, diagnosis }, { headers: petHeaders(res) });
  } catch (e) {
    return petErrorResponse(e);
  }
}
