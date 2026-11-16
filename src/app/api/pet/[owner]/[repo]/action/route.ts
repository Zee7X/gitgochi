import { normalizeRepoKey } from '@/lib/pet-store';
import { PET_ACTIONS, act, parseSimulatedEvent, petErrorResponse, type PetActionRequest } from '@/lib/pet-service';
import type { SimulatedEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const bad = (error: string) => Response.json({ error }, { status: 400, headers: NO_STORE });

export async function POST(req: Request, ctx: { params: Promise<{ owner: string; repo: string }> }) {
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

  try {
    const { status, response } = await act(key, action, { event }, Date.now());
    return Response.json(response, { status, headers: NO_STORE });
  } catch (e) {
    return petErrorResponse(e);
  }
}
