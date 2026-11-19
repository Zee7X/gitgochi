import { limit } from '@/lib/rate-limit';
import { ANON, bearerOf, resolveCtx, sameOrigin } from '@/lib/access';
import { isDemoKey } from '@/lib/demo-fixtures';
import { normalizeRepoKey } from '@/lib/pet-store';
import { PET_ACTIONS, act, parseSimulatedEvent, petErrorResponse, petHeaders, type PetActionRequest } from '@/lib/pet-service';
import type { SimulatedEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const bad = (error: string) => Response.json({ error }, { status: 400, headers: NO_STORE });

export async function POST(req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
  const slow = limit(req, 'pet');
  if (slow) return slow;
  const { owner, repo } = await ctx.params;
  let key: string;
  try {
    key = normalizeRepoKey(owner, repo);
  } catch {
    return bad('invalid repo');
  }

  const body: unknown = await req.json().catch(() => null);
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const action = PET_ACTIONS.find((a) => a === raw.action) as PetActionRequest | undefined;
  if (!action) return bad('unknown action');

  let event: SimulatedEvent | undefined;
  if (action === 'simulate') {
    event = parseSimulatedEvent(raw.event) ?? undefined;
    if (!event) return bad('invalid event');
  }

  // Cookie-authenticated writes must come from our own pages (accounts R2.3); hook tokens are not cookies.
  const viaHookToken = bearerOf(req).startsWith('ggh_');
  if (!isDemoKey(key) && !viaHookToken && !sameOrigin(req)) {
    return Response.json({ error: 'cross-origin request refused' }, { status: 403, headers: NO_STORE });
  }

  try {
    const who = isDemoKey(key) ? ANON : await resolveCtx(req, key);
    const { status, response } = await act(key, action, { event }, Date.now(), who);
    return Response.json(response, { status, headers: petHeaders(response) });
  } catch (e) {
    return petErrorResponse(e);
  }
}
