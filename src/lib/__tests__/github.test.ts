import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRepoSnapshot, RateLimitError, RepoNotFoundError, commitCountFromLink } from '../github';

type Route = (url: string) => Response;

function mockFetch(route: Route) {
  const fn = vi.fn((url: string | URL | Request) => Promise.resolve(route(String(url))));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

const repoJson = {
  full_name: 'acme/rocket',
  created_at: '2020-01-01T00:00:00Z',
  pushed_at: '2026-11-01T00:00:00Z',
  open_issues_count: 7,
  default_branch: 'trunk',
  description: 'rockets',
  stargazers_count: 42,
};

const happyRoute: Route = (url) => {
  if (url.includes('/actions/runs')) {
    // GitHub returns newest first.
    return json({
      workflow_runs: [
        { conclusion: 'failure' },
        { conclusion: 'cancelled' },
        { conclusion: 'timed_out' },
        { conclusion: 'skipped' },
        { conclusion: 'success' },
        { conclusion: null },
      ],
    });
  }
  if (url.includes('/commits')) {
    return json([{ sha: 'a' }], {
      headers: {
        link: '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=1234>; rel="last"',
      },
    });
  }
  if (url.includes('/search/issues')) return json({ total_count: 3 });
  return json(repoJson);
};

beforeEach(() => vi.stubEnv('GITHUB_TOKEN', ''));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchRepoSnapshot', () => {
  it('maps repo, runs, Link-header commit count and stale issues', async () => {
    const fn = mockFetch(happyRoute);
    const snap = await fetchRepoSnapshot('acme', 'rocket');

    expect(snap).toMatchObject({
      fullName: 'acme/rocket',
      commitsTotal: 1234,
      openIssues: 7,
      staleIssues: 3,
      defaultBranch: 'trunk',
      stars: 42,
      description: 'rockets',
    });
    // Newest-first input [failure, timed_out, success] becomes oldest-first output.
    expect(snap.recentRuns).toEqual(['success', 'failure', 'failure']);

    const runsUrl = fn.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/actions/runs'))!;
    expect(runsUrl).toContain('branch=trunk');
    expect(runsUrl).toContain('status=completed');
    const searchUrl = new URL(
      fn.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/search/issues'))!
    ).searchParams.get('q')!;
    expect(searchUrl).toMatch(/repo:acme\/rocket is:issue is:open updated:<\d{4}-\d{2}-\d{2}/);
  });

  it('falls back to the list length when there is no Link header, and to 0 when search fails', async () => {
    mockFetch((url) => {
      if (url.includes('/commits')) return json([{ sha: 'a' }]);
      if (url.includes('/search/issues')) return new Response('nope', { status: 422 });
      if (url.includes('/actions/runs')) return new Response('nope', { status: 404 });
      return json(repoJson);
    });
    const snap = await fetchRepoSnapshot('acme', 'rocket');
    expect(snap.commitsTotal).toBe(1);
    expect(snap.staleIssues).toBe(0);
    expect(snap.recentRuns).toEqual([]);
  });

  it('throws RepoNotFoundError on 404', async () => {
    mockFetch(() => new Response('{}', { status: 404 }));
    await expect(fetchRepoSnapshot('acme', 'nope')).rejects.toBeInstanceOf(RepoNotFoundError);
  });

  it('throws RateLimitError with the reset time on 403 + exhausted limit', async () => {
    mockFetch(
      () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' } })
    );
    const err = await fetchRepoSnapshot('acme', 'rocket').catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).resetAt).toBe(1_800_000_000_000);
  });

  it('throws RateLimitError on 429', async () => {
    mockFetch(() => new Response('{}', { status: 429, headers: { 'retry-after': '30' } }));
    await expect(fetchRepoSnapshot('acme', 'rocket')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('sends no Authorization header without a token, and Bearer with one', async () => {
    const fn = mockFetch(happyRoute);
    await fetchRepoSnapshot('acme', 'rocket');
    for (const [, init] of fn.mock.calls as unknown as [string, RequestInit][]) {
      const h = init.headers as Record<string, string>;
      expect(h.Authorization).toBeUndefined();
      expect(h['User-Agent']).toBe('gitgotchi');
      expect(h['X-GitHub-Api-Version']).toBe('2022-11-28');
    }

    vi.stubEnv('GITHUB_TOKEN', 'tok');
    fn.mockClear();
    await fetchRepoSnapshot('acme', 'rocket');
    const first = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect((first[1].headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});

describe('commitCountFromLink', () => {
  it('reads the last page and returns null when absent', () => {
    expect(commitCountFromLink('<https://x/y?per_page=1&page=9>; rel="last"')).toBe(9);
    expect(commitCountFromLink('<https://x/y?page=2&per_page=1>; rel="last"')).toBe(2);
    expect(commitCountFromLink(null)).toBeNull();
  });
});
