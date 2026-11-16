import { getPet, petErrorResponse } from '@/lib/pet-service';
import { diagnose } from '@/lib/heal';
import { normalizeRepoKey } from '@/lib/pet-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };

/** "Summon Kiro": read-only diagnosis plus a prompt to paste into Kiro. Nothing is changed or opened. */
export async function POST(req: Request) {
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
    const { pet, events } = await getPet(key, Date.now());
    return Response.json({ success: true, diagnosis: await diagnose(key, pet, events) }, { headers: HEADERS });
  } catch (e) {
    return petErrorResponse(e);
  }
}
