import { limit } from '@/lib/rate-limit';
import { resolveCtx, sameOrigin } from '@/lib/access';
import { normalizeRepoKey } from '@/lib/pet-store';
import { petErrorResponse } from '@/lib/pet-service';
import { SETTINGS_OPS, runSettings, type SettingsOp } from '@/lib/pet-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Settings answers can hold a fresh secret: never cache or index them (accounts R9.5).
const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

/** Keeper-only: badge key, hook tokens, delete pet. Signed-in sessions only, same origin only. */
export async function POST(req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const slow = limit(req, 'pet');
  if (slow) return slow;
  const { owner, repo } = await ctx.params;
  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: HEADERS });
  }
  if (!sameOrigin(req)) return Response.json({ error: 'cross-origin request refused' }, { status: 403, headers: HEADERS });

  const body = (await req.json().catch(() => null)) as { op?: unknown; id?: unknown } | null;
  const op = SETTINGS_OPS.find((o) => o === body?.op) as SettingsOp | undefined;
  if (!op) return Response.json({ error: 'unknown op' }, { status: 400, headers: HEADERS });

  try {
    const who = await resolveCtx(req, key);
    // A hook token acts for a keeper on the pet, but cannot mint or revoke tokens.
    if (!who.signedIn) return Response.json({ error: 'sign in first' }, { status: 401, headers: HEADERS });
    const id = typeof body?.id === 'string' ? body.id : undefined;
    return Response.json(await runSettings(key, op, { id }, who), { headers: HEADERS });
  } catch (e) {
    const res = petErrorResponse(e);
    return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...HEADERS } });
  }
}
