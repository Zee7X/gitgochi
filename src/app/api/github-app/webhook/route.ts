import { deleteEntry, getEntry, isPrivate, setEntry, StoreError } from '@/lib/pet-store';
import { ingestEvent } from '@/lib/pet-service';
import { extractFacts, repoKeyOf, toPetEvent, validSignature } from '@/lib/webhook-map';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => Response.json({ success: false, error }, { status });
const ok = (extra: Record<string, unknown> = {}) => Response.json({ success: true, ...extra });

type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- untrusted GitHub JSON, every read is optional-chained

/** Private pets are forgotten when the app loses access to their repo (accounts R4.3, R9.6). */
async function forgetPrivate(repos: unknown): Promise<number> {
  if (!Array.isArray(repos)) return 0;
  let n = 0;
  for (const r of repos) {
    const key = repoKeyOf((r as { full_name?: unknown })?.full_name);
    if (!key) continue;
    const entry = await getEntry(key);
    if (entry && (isPrivate(entry) || (r as { private?: unknown }).private === true)) {
      await deleteEntry(key);
      n++;
    }
  }
  return n;
}

async function onRepository(body: Payload): Promise<Response> {
  const key = repoKeyOf(body.repository?.full_name);
  if (!key) return ok({ ignored: true });
  switch (body.action) {
    case 'renamed': {
      const from = body.changes?.repository?.name?.from;
      const oldKey = repoKeyOf(`${body.repository?.owner?.login}/${from}`);
      const entry = oldKey ? await getEntry(oldKey) : undefined;
      if (oldKey && entry) {
        await setEntry(key, { ...entry, pet: { ...entry.pet, repoName: key } });
        await deleteEntry(oldKey);
      }
      return ok({ moved: !!entry });
    }
    case 'privatized':
    case 'publicized': {
      const entry = await getEntry(key);
      // Re-writing the entry seals or unseals it (accounts R3.5).
      if (entry) await setEntry(key, { ...entry, visibility: body.action === 'privatized' ? 'private' : 'public' });
      return ok({ visibility: body.action });
    }
    case 'deleted':
      await deleteEntry(key);
      return ok({ deleted: true });
    default:
      return ok({ ignored: true });
  }
}

/** GitGotchi App webhook: one endpoint for every installed repo, signed with the app's secret (accounts R4). */
export async function POST(req: Request) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return fail('app webhook not configured', 503);
  const raw = await req.text();
  if (!validSignature(secret, raw, req.headers.get('x-hub-signature-256'))) return fail('invalid signature', 401);

  const eventType = req.headers.get('x-github-event');
  if (!eventType) return fail('missing X-GitHub-Event', 400);
  if (eventType === 'ping') return Response.json({ ok: true });

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('invalid JSON', 400);
  }

  try {
    if (eventType === 'installation') {
      if (body.action === 'deleted') return ok({ forgotten: await forgetPrivate(body.repositories) });
      return ok({ ignored: true });
    }
    if (eventType === 'installation_repositories') {
      return ok({ forgotten: await forgetPrivate(body.repositories_removed) });
    }
    if (eventType === 'repository') return await onRepository(body);

    const facts = extractFacts(eventType, body);
    if (!facts) return fail('missing repository', 400);
    const petEvent = toPetEvent(facts);
    if (!petEvent) return ok({ eventType, ignored: true });
    await ingestEvent(facts.key, petEvent, Date.now(), {
      visibility: facts.private ? 'private' : 'public',
      repoId: facts.repoId,
    });
    // The answer is visible in the app's delivery log; it carries no pet data.
    return ok({ eventType, applied: petEvent.type });
  } catch (e) {
    if (e instanceof StoreError) return fail('store unavailable', 503);
    throw e;
  }
}
