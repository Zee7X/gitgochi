import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { ANON, type PetCtx } from '@/lib/access';
import { renderBadge, renderStatusBadge, type BadgeOpts, type StatusKind } from '@/lib/badge-svg';
import { isDemoKey } from '@/lib/demo-fixtures';
import { RepoNotFoundError } from '@/lib/github';
import { repoToken } from '@/lib/github-app';
import { getPet } from '@/lib/pet-service';
import { badgeKeyValid } from '@/lib/pet-settings';
import { getEntry, isPrivate, normalizeRepoKey } from '@/lib/pet-store';

// GitHub's camo proxy keeps the badge as long as max-age says, so keep it short: a change shows in a README
// within about two minutes. The CDN may serve a stale copy for one more minute while it refetches.
const CACHE = 'max-age=120, s-maxage=60, stale-while-revalidate=60';
// A private badge must not sit in our CDN, where its URL key is the only lock (accounts R9.5).
const PRIVATE = 'private, no-store';

function svgResponse(req: NextRequest, svg: string, status = 200, cache = CACHE): Response {
  const etag = `"${createHash('sha1').update(svg).digest('hex').slice(0, 16)}"`;
  const headers: Record<string, string> = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': status === 400 ? 'no-store' : cache,
    ETag: etag,
  };
  if (cache === PRIVATE) headers['X-Robots-Tag'] = 'noindex';
  if (status === 200 && req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(svg, { status, headers });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const q = req.nextUrl.searchParams;
  const opts: BadgeOpts = { size: q.get('size') === 'small' ? 'small' : 'full', animate: q.get('static') !== '1' };
  const status = (kind: StatusKind, code = 200) => svgResponse(req, renderStatusBadge(kind, opts), code);

  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return status('invalid', 400);
  }

  try {
    let ctx: PetCtx = ANON;
    let cache = CACHE;
    if (!isDemoKey(key)) {
      const entry = await getEntry(key);
      if (isPrivate(entry)) {
        // Same answer as a repo that does not exist, so a wrong key reveals nothing (accounts R5.2).
        if (!badgeKeyValid(entry, q.get('k'))) return status('not_found', 404);
        const token = await repoToken(key).catch(() => null);
        ctx = { role: 'visitor', canSeePrivate: true, signedIn: false, auth: token ? { kind: 'token', token } : ANON.auth };
        cache = PRIVATE;
      }
    }
    const res = await getPet(key, Date.now(), ctx);
    // Fallback with no stored events means GitHub failed and nothing was cached.
    if (res.source === 'fallback' && res.error && res.events.length === 0) return status('signal_lost');
    return svgResponse(req, renderBadge(res.pet, key, opts), 200, cache);
  } catch (e) {
    return status(e instanceof RepoNotFoundError ? 'not_found' : 'signal_lost');
  }
}
