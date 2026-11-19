import { createHmac, timingSafeEqual } from 'node:crypto';
import { StoreError, getEntry, normalizeRepoKey } from '@/lib/pet-store';
import { ingestEvent } from '@/lib/pet-service';
import type { SimulatedEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validSignature(secret: string, raw: string, header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- untrusted GitHub JSON, every read is optional-chained

/** Maps a GitHub event to a pet event; null means the event does not affect the pet. */
function toPetEvent(event: string, body: Payload): SimulatedEvent | null {
  switch (event) {
    case 'push': {
      const commits = Array.isArray(body.commits) ? body.commits.length : 0;
      return commits > 0 ? { type: 'push', commits } : null;
    }
    case 'workflow_run':
    case 'check_run': {
      if (body.action !== 'completed') return null;
      const conclusion = (body.check_run ?? body.workflow_run)?.conclusion;
      if (conclusion === 'success' || conclusion === 'failure') {
        return { type: 'ci', success: conclusion === 'success' };
      }
      return null;
    }
    case 'pull_request':
      return body.action === 'closed' && body.pull_request?.merged === true ? { type: 'pr_merged' } : null;
    case 'issues':
      if (body.action === 'opened') return { type: 'issue_opened' };
      return body.action === 'closed' ? { type: 'issue_closed' } : null;
    default:
      return null;
  }
}

const fail = (error: string, status: number) => Response.json({ success: false, error }, { status });

export async function GET() {
  return Response.json({
    endpoint: 'POST /api/webhook/github',
    events: ['push', 'workflow_run', 'check_run', 'pull_request', 'issues', 'ping'],
    signature: 'X-Hub-Signature-256 is checked when GITHUB_WEBHOOK_SECRET is set',
    state: 'GET /api/pet/{owner}/{repo}',
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret && !validSignature(secret, raw, req.headers.get('x-hub-signature-256'))) {
    return fail('invalid signature', 401);
  }

  const eventType = req.headers.get('x-github-event');
  if (!eventType) return fail('missing X-GitHub-Event', 400);
  if (eventType === 'ping') return Response.json({ ok: true });

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('invalid JSON', 400);
  }

  const fullName: unknown = body?.repository?.full_name;
  if (typeof fullName !== 'string') return fail('missing repository', 400);
  const [owner, repo, ...rest] = fullName.split('/');
  let key: string;
  try {
    if (rest.length || !repo) throw new Error('bad full_name');
    key = normalizeRepoKey(owner, repo);
  } catch {
    return fail('invalid repository', 400);
  }

  const petEvent = toPetEvent(eventType, body);
  try {
    if (!petEvent) {
      return Response.json({
        success: true,
        eventType,
        repo: key,
        ignored: true,
        petState: (await getEntry(key))?.pet ?? null,
      });
    }
    const { pet } = await ingestEvent(key, petEvent, Date.now());
    return Response.json({ success: true, eventType, repo: key, petState: pet });
  } catch (e) {
    if (e instanceof StoreError) return fail('store unavailable', 503);
    throw e;
  }
}
