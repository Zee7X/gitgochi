import type { CiResult, RepoSnapshot } from './types';

const API = 'https://api.github.com';
const TIMEOUT_MS = 8000;
const STALE_DAYS = 30;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class RepoNotFoundError extends GitHubError {
  constructor(fullName: string) {
    super(`Repo not found: ${fullName}`, 404);
    this.name = 'RepoNotFoundError';
  }
}

export class RateLimitError extends GitHubError {
  /** Epoch ms when the limit resets, or null when GitHub did not say. */
  constructor(
    readonly resetAt: number | null,
    status = 403
  ) {
    super('GitHub rate limit reached', status);
    this.name = 'RateLimitError';
  }
}

function request(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'gitgotchi',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
}

function rateLimitReset(res: Response): number | null {
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (reset > 0) return reset * 1000;
  const retry = Number(res.headers.get('retry-after'));
  return retry > 0 ? Date.now() + retry * 1000 : null;
}

function isRateLimited(res: Response): boolean {
  if (res.status === 429) return true;
  return (
    res.status === 403 &&
    (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after'))
  );
}

/** Secondary calls degrade to a fallback value instead of failing the whole snapshot. */
async function optional<T>(path: string, read: (res: Response) => Promise<T>, fallback: T): Promise<T> {
  try {
    const res = await request(path);
    return res.ok ? await read(res) : fallback;
  } catch {
    return fallback;
  }
}

interface RepoJson {
  full_name?: string;
  created_at: string;
  pushed_at: string | null;
  open_issues_count: number;
  default_branch: string;
  description?: string | null;
  stargazers_count?: number;
}

/** Oldest first. Only success and failure/timed_out count; cancelled, skipped etc. are dropped. */
export function mapRuns(runs: { conclusion: string | null }[]): CiResult[] {
  const out: CiResult[] = [];
  for (const r of runs) {
    if (r.conclusion === 'success') out.push('success');
    else if (r.conclusion === 'failure' || r.conclusion === 'timed_out') out.push('failure');
  }
  return out.reverse();
}

/** With per_page=1 the `rel="last"` page number equals the commit count. */
export function commitCountFromLink(link: string | null): number | null {
  const m = link?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return m ? Number(m[1]) : null;
}

export async function fetchRepoSnapshot(owner: string, repo: string): Promise<RepoSnapshot> {
  const fullName = `${owner}/${repo}`;
  const res = await request(`/repos/${owner}/${repo}`);
  if (res.status === 404) throw new RepoNotFoundError(fullName);
  if (isRateLimited(res)) throw new RateLimitError(rateLimitReset(res), res.status);
  if (!res.ok) throw new GitHubError(`GitHub responded ${res.status}`, res.status);
  const data = (await res.json()) as RepoJson;

  const since = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ q: `repo:${fullName} is:issue is:open updated:<${since}`, per_page: '1' });
  const runsQuery = new URLSearchParams({
    per_page: '10',
    branch: data.default_branch,
    status: 'completed',
  });

  const [recentRuns, commitsTotal, staleIssues] = await Promise.all([
    optional(
      `/repos/${owner}/${repo}/actions/runs?${runsQuery}`,
      async (r) => mapRuns(((await r.json()) as { workflow_runs?: { conclusion: string | null }[] }).workflow_runs ?? []),
      [] as CiResult[]
    ),
    optional(
      `/repos/${owner}/${repo}/commits?per_page=1`,
      async (r) => commitCountFromLink(r.headers.get('link')) ?? ((await r.json()) as unknown[]).length,
      0
    ),
    optional(`/search/issues?${q}`, async (r) => ((await r.json()) as { total_count?: number }).total_count ?? 0, 0),
  ]);

  return {
    fullName: data.full_name ?? fullName,
    createdAt: data.created_at,
    pushedAt: data.pushed_at,
    commitsTotal,
    openIssues: data.open_issues_count,
    staleIssues,
    recentRuns,
    defaultBranch: data.default_branch,
    description: data.description ?? undefined,
    stars: data.stargazers_count,
  };
}
