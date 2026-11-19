import { timingSafeEqual } from 'node:crypto';
import { getPet } from '@/lib/pet-service';
import { StoreError, getEntry, normalizeRepoKey, setEntry } from '@/lib/pet-store';
import { applyHookReport, type HookSmell } from '@/lib/state-machine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store' };
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\]|::ffff:127\.\d+\.\d+\.\d+)$/;

function bearerOk(req: Request): boolean {
  const secret = process.env.GITGOTCHI_HOOK_TOKEN;
  if (!secret) return false;
  const got = Buffer.from((req.headers.get('authorization') ?? '').replace(/^Bearer /i, ''));
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

export async function POST(req: Request) {
  if (!bearerOk(req) && !isLocal(req)) {
    return Response.json({ error: 'local requests or a valid bearer token only' }, { status: 403, headers: HEADERS });
  }

  const data = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') {
    return Response.json({ error: 'JSON body required' }, { status: 400, headers: HEADERS });
  }
  const filePath = cleanPath(data.filePath);
  if (!filePath) return Response.json({ error: 'filePath required' }, { status: 400, headers: HEADERS });

  let key: string;
  try {
    key = repoKey(data.repo);
  } catch {
    return Response.json({ error: 'invalid repo' }, { status: 400, headers: HEADERS });
  }

  try {
    const now = Date.now();
    const current = await getPet(key, now);
    const entry = await getEntry(key);
    if (!entry) return Response.json(current, { headers: HEADERS });

    const smell = data.clean === true ? null : smellOf(data);
    // Only this file's poop is added or removed; other files keep theirs (pet-engine R9).
    const { state, event } = applyHookReport(entry.pet, entry.events, { filePath, smell }, now);
    if (event) await setEntry(key, { ...entry, pet: state, events: [event, ...entry.events] });
    return Response.json(await getPet(key, Date.now()), { headers: HEADERS });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ error: 'store unavailable' }, { status: 503, headers: HEADERS });
    }
    return Response.json({ error: 'internal error' }, { status: 500, headers: HEADERS });
  }
}
