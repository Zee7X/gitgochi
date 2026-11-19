import { limit } from '@/lib/rate-limit';
import { resolveCtx } from '@/lib/access';
import { isDemoKey } from '@/lib/demo-fixtures';
import { githubRequest } from '@/lib/github';
import { normalizeRepoKey } from '@/lib/pet-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

/**
 * Where ADD TO README should send the user: the repo's default branch and README path, read on demand only
 * (one or two GitHub calls per click). A private repo answers 404 to anyone outside it, like everywhere else.
 */
export async function GET(req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const slow = limit(req, 'heal');
  if (slow) return slow;
  const { owner, repo } = await ctx.params;
  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: HEADERS });
  }
  if (isDemoKey(key)) return Response.json({ error: 'demo pets have no README' }, { status: 400, headers: HEADERS });

  const who = await resolveCtx(req, key).catch(() => null);
  const token = who?.auth.kind === 'token' ? who.auth.token : process.env.GITHUB_TOKEN;
  const repoRes = await githubRequest(`/repos/${key}`, token).catch(() => null);
  if (!repoRes?.ok) return Response.json({ error: 'repo not found' }, { status: 404, headers: HEADERS });
  const info = (await repoRes.json()) as { full_name?: string; default_branch?: string; private?: boolean };
  // The operator's token can see private repos; an outsider must not learn this one exists.
  if (info.private && !who?.canSeePrivate) return Response.json({ error: 'repo not found' }, { status: 404, headers: HEADERS });

  const readme = await githubRequest(`/repos/${key}/readme`, token).catch(() => null);
  const path = readme?.ok ? (((await readme.json()) as { path?: string }).path ?? null) : null;
  return Response.json({ fullName: info.full_name ?? key, branch: info.default_branch ?? 'main', path }, { headers: HEADERS });
}
