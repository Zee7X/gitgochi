import { timingSafeEqual } from 'node:crypto';
import { ANON, bearerOf, hookTokenValid, resolveCtx, type PetCtx } from '@/lib/access';
import { isDemoKey } from '@/lib/demo-fixtures';
import { repoToken } from '@/lib/github-app';
import { respond, seedDemoEntry } from '@/lib/pet-logic';
import { getPet, petHeaders } from '@/lib/pet-service';
import { StoreError, getEntry, isPrivate, normalizeRepoKey, setEntry } from '@/lib/pet-store';
import { applyHookReport, type HookSmell } from '@/lib/state-machine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\]|::ffff:127\.\d+\.\d+\.\d+)$/;

/** The deployment-wide token from GITGOTCHI_HOOK_TOKEN (local development and the operator, accounts R6.4). */
function operatorBearer(bearer: string): boolean {
  const secret = process.env.GITGOTCHI_HOOK_TOKEN;
  if (!secret || !bearer) return false;
  const got = Buffer.from(bearer);
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

// shortcut: Host is client-supplied, so a remote caller can fake it. Set GITGOTCHI_HOOK_TOKEN when the app is exposed.
function isLocal(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').replace(/:\d+$/, '');
  const hops = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return LOOPBACK.test(host) && hops.every((ip) => LOOPBACK.test(ip));
}

function repoKey(raw: unknown): string {
  const value = typeof raw === 'string' && raw ? raw : (process.env.GITGOTCHI_REPO ?? 'demo/healthy');
  const [owner, repo, ...rest] = value.split('/');
  if (rest.length) throw new Error('invalid repo');
  return normalizeRepoKey(owner, repo ?? '');
}

// Control characters are stripped so a path cannot forge labels.
const cleanPath = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) : '';

const smellOf = (d: Record<string, unknown>): HookSmell | null =>
  d.hasConsoleLog === true ? 'console.log' : d.hasDebugger === true ? 'debugger' : d.hasTodo === true ? 'TODO' : null;

async function operatorCtx(key: string): Promise<PetCtx> {
  const entry = await getEntry(key);
  const token = isPrivate(entry) ? await repoToken(key).catch(() => null) : null;
  return { ...ANON, role: 'keeper', canSeePrivate: true, auth: token ? { kind: 'token', token } : ANON.auth };
}

export async function POST(req: Request) {
  const data = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') {
    return Response.json({ error: 'JSON body required' }, { status: 400, headers: HEADERS });
  }

  let key: string;
  try {
    key = repoKey(data.repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: HEADERS });
  }

  try {
    const bearer = bearerOf(req);
    const operator = operatorBearer(bearer) || isLocal(req);
    // A per-pet hook token only opens the pet it was made for (accounts R6.2).
    const bound = !operator && !isDemoKey(key) && hookTokenValid(bearer, await getEntry(key));
    if (!operator && !bound) {
      return Response.json({ error: 'a hook token for this pet, or a local request' }, { status: 403, headers: HEADERS });
    }

    const filePath = cleanPath(data.filePath);
    if (!filePath) return Response.json({ error: 'filePath required' }, { status: 400, headers: HEADERS });
    const smell = data.clean === true ? null : smellOf(data);
    const now = Date.now();

    // Demo pets live in browsers, not here: the report is applied to the fixture and not stored (accounts R7.1).
    if (isDemoKey(key)) {
      const base = seedDemoEntry(key, now);
      if (!base) return Response.json({ error: 'repo not found' }, { status: 404, headers: HEADERS });
      const { state, event } = applyHookReport(base.pet, base.events, { filePath, smell }, now);
      return Response.json(respond(event ? { ...base, pet: state, events: [event, ...base.events] } : base, now), { headers: HEADERS });
    }

    // A private pet refreshes through the app installation; the operator token never reads private repos.
    const ctx = bound ? await resolveCtx(req, key) : await operatorCtx(key);
    const current = await getPet(key, now, ctx);
    const entry = await getEntry(key);
    if (!entry) return Response.json(current, { headers: petHeaders(current) });

    // Only this file's poop is added or removed; other files keep theirs (pet-engine R9).
    const { state, event } = applyHookReport(entry.pet, entry.events, { filePath, smell }, now);
    if (event) await setEntry(key, { ...entry, pet: state, events: [event, ...entry.events] });
    const res = await getPet(key, Date.now(), ctx);
    return Response.json(res, { headers: petHeaders(res) });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ error: 'store unavailable' }, { status: 503, headers: HEADERS });
    }
    return Response.json({ error: 'internal error' }, { status: 500, headers: HEADERS });
  }
}
