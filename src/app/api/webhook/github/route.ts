import { StoreError, getEntry, isPrivate } from '@/lib/pet-store';
import { ingestEvent } from '@/lib/pet-service';
import { extractFacts, toPetEvent, validSignature } from '@/lib/webhook-map';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => Response.json({ success: false, error }, { status });

export async function GET() {
  return Response.json({
    endpoint: 'POST /api/webhook/github',
    events: ['push', 'workflow_run', 'check_run', 'pull_request', 'issues', 'ping'],
    signature: 'X-Hub-Signature-256 is checked when GITHUB_WEBHOOK_SECRET is set',
    state: 'GET /api/pet/{owner}/{repo}',
    note: 'Manual webhooks keep working. New repos should install the GitGotchi GitHub App instead.',
  });
}

/** Manual repo webhook (github-sync R3, R4), kept for repos set up before the GitGotchi App (accounts R4.4). */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret && !validSignature(secret, raw, req.headers.get('x-hub-signature-256'))) {
    return fail('invalid signature', 401);
  }

  const eventType = req.headers.get('x-github-event');
  if (!eventType) return fail('missing X-GitHub-Event', 400);
  if (eventType === 'ping') return Response.json({ ok: true });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('invalid JSON', 400);
  }

  const facts = extractFacts(eventType, body as Record<string, unknown>);
  if (!facts) return fail((body as { repository?: unknown })?.repository ? 'invalid repository' : 'missing repository', 400);

  const petEvent = toPetEvent(facts);
  const visibility = facts.private === undefined ? undefined : facts.private ? 'private' : 'public';
  try {
    if (!petEvent) {
      const entry = await getEntry(facts.key);
      return Response.json({
        success: true,
        eventType,
        repo: facts.key,
        ignored: true,
        // A private pet's state stays out of the answer; GitHub shows webhook responses to repo admins only, but less is safer.
        petState: entry && !isPrivate(entry) ? entry.pet : null,
      });
    }
    const { pet } = await ingestEvent(facts.key, petEvent, Date.now(), { visibility, repoId: facts.repoId });
    return Response.json({ success: true, eventType, repo: facts.key, petState: visibility === 'private' ? null : pet });
  } catch (e) {
    if (e instanceof StoreError) return fail('store unavailable', 503);
    throw e;
  }
}
