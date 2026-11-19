import { limit } from '@/lib/rate-limit';
import { ANON, resolveCtx } from '@/lib/access';
import { isDemoKey } from '@/lib/demo-fixtures';
import { normalizeRepoKey } from '@/lib/pet-store';
import { getPet, petErrorResponse, petHeaders } from '@/lib/pet-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const slow = limit(req, 'pet');
  if (slow) return slow;
  const { owner, repo } = await ctx.params;
  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const who = isDemoKey(key) ? ANON : await resolveCtx(req, key);
    const res = await getPet(key, Date.now(), who);
    return Response.json(res, { headers: petHeaders(res) });
  } catch (e) {
    return petErrorResponse(e);
  }
}
