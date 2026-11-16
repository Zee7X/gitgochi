import { timingSafeEqual } from 'node:crypto';
import { getPet } from '@/lib/pet-service';
import { getEntry, normalizeRepoKey, setEntry } from '@/lib/pet-store';
import { applyAction, applyEvent } from '@/lib/state-machine';
import type { PetEvent } from '@/lib/types';

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

const smellOf = (d: Record<string, unknown>) =>
  d.hasConsoleLog === true ? 'console.log' : d.hasDebugger === true ? 'debugger' : d.hasTodo === true ? 'TODO' : null;

/** True when this file has a poop that no later clean removed. Events are newest first. */
function hasOutstanding(events: PetEvent[], filePath: string): boolean {
  for (const e of events) {
    if (e.type === 'clean') return false;
    if (e.type === 'poop' && e.label.endsWith(` in ${filePath}`)) return true;
  }
  return false;
}

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
    const entry = getEntry(key);
    if (!entry) return Response.json(current, { headers: HEADERS });

    const smell = data.clean === true ? null : smellOf(data);
    const pending = hasOutstanding(entry.events, filePath);

    if (smell && !pending) {
      const { state, event } = applyEvent(entry.pet, { type: 'poop', reason: smell }, now, { source: 'kiro-hook' });
      // An empty delta set means the engine ignored the event (dead pet): nothing to record.
      if (Object.keys(event.deltas).length) {
        const labelled = event.type === 'poop' ? { ...event, label: `${smell} in ${filePath}` } : event;
        setEntry(key, { ...entry, pet: state, events: [labelled, ...entry.events] });
      }
    } else if (!smell && pending) {
      // shortcut: the engine's clean wipes every poop, not just this file's. Per-file removal if that feels unfair.
      const r = applyAction(entry.pet, 'clean', now, { source: 'kiro-hook' });
      if (r.event) {
        setEntry(key, { ...entry, pet: r.state, events: [{ ...r.event, label: `clean after ${filePath}` }, ...entry.events] });
      }
    }
    return Response.json(await getPet(key, Date.now()), { headers: HEADERS });
  } catch {
    return Response.json({ error: 'internal error' }, { status: 500, headers: HEADERS });
  }
}
