import { normalizeRepoKey } from '@/lib/pet-store';
import { getPet, petErrorResponse } from '@/lib/pet-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await ctx.params;
  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return Response.json(await getPet(key, Date.now()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return petErrorResponse(e);
  }
}
