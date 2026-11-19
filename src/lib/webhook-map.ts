import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeRepoKey } from './pet-store';
import type { SimulatedEvent } from './types';

export function validSignature(secret: string, raw: string, header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Only the fields the pet needs, copied out of the untrusted GitHub JSON. Everything else (commit messages,
 * authors, emails, titles, bodies) is dropped with the request (accounts R9.1, R9.2).
 */
export interface WebhookFacts {
  event: string;
  action?: string;
  key: string;
  repoId?: number;
  private?: boolean;
  commits: number;
  conclusion?: string;
  merged?: boolean;
  installationId?: number;
}

type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- untrusted GitHub JSON, every read is optional-chained

export function repoKeyOf(fullName: unknown): string | null {
  if (typeof fullName !== 'string') return null;
  const [owner, repo, ...rest] = fullName.split('/');
  if (rest.length || !repo) return null;
  try {
    return normalizeRepoKey(owner, repo);
  } catch {
    return null;
  }
}

/** Null when the payload names no valid repository. */
export function extractFacts(event: string, body: Payload): WebhookFacts | null {
  const key = repoKeyOf(body?.repository?.full_name);
  if (!key) return null;
  const run = body.check_run ?? body.workflow_run;
  return {
    event,
    action: typeof body.action === 'string' ? body.action : undefined,
    key,
    repoId: typeof body.repository?.id === 'number' ? body.repository.id : undefined,
    private: typeof body.repository?.private === 'boolean' ? body.repository.private : undefined,
    commits: Array.isArray(body.commits) ? body.commits.length : 0,
    conclusion: typeof run?.conclusion === 'string' ? run.conclusion : undefined,
    merged: body.pull_request?.merged === true,
    installationId: typeof body.installation?.id === 'number' ? body.installation.id : undefined,
  };
}

/** Maps a GitHub event to a pet event; null means the event does not affect the pet. */
export function toPetEvent(f: WebhookFacts): SimulatedEvent | null {
  switch (f.event) {
    case 'push':
      return f.commits > 0 ? { type: 'push', commits: f.commits } : null;
    case 'workflow_run':
    case 'check_run':
      if (f.action !== 'completed') return null;
      if (f.conclusion === 'success' || f.conclusion === 'failure') return { type: 'ci', success: f.conclusion === 'success' };
      return null;
    case 'pull_request':
      return f.action === 'closed' && f.merged ? { type: 'pr_merged' } : null;
    case 'issues':
      if (f.action === 'opened') return { type: 'issue_opened' };
      return f.action === 'closed' ? { type: 'issue_closed' } : null;
    default:
      return null;
  }
}
