import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { RepoNotFoundError } from '@/lib/github';
import { renderBadge, renderStatusBadge, type BadgeOpts, type StatusKind } from '@/lib/badge-svg';
import { getPet } from '@/lib/pet-service';
import { normalizeRepoKey } from '@/lib/pet-store';

// GitHub's camo proxy needs a short cache or the badge never refreshes.
const CACHE = 'max-age=300, s-maxage=300, stale-while-revalidate=600';

function svgResponse(req: NextRequest, svg: string, status = 200): Response {
  const etag = `"${createHash('sha1').update(svg).digest('hex').slice(0, 16)}"`;
  const headers = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': status === 400 ? 'no-store' : CACHE,
    ETag: etag,
  };
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
    const res = await getPet(key, Date.now());
    // Fallback with no stored events means GitHub failed and nothing was cached.
    if (res.source === 'fallback' && res.error && res.events.length === 0) return status('signal_lost');
    return svgResponse(req, renderBadge(res.pet, key, opts));
  } catch (e) {
    return status(e instanceof RepoNotFoundError ? 'not_found' : 'signal_lost');
  }
}
