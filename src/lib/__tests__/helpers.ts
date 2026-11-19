import { vi } from 'vitest';

const NOW = Date.now();

/** Stands in for api.github.com: one repo, its runs, commit count and stale issues. */
export function fakeGitHub(opts: { private?: boolean; status?: number } = {}) {
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (opts.status) return new Response('{}', { status: opts.status });
    if (url.includes('/actions/runs')) return Response.json({ workflow_runs: [{ conclusion: 'success' }] });
    if (url.includes('/commits')) return Response.json([{}], { headers: { link: '<https://api.github.com/x?page=12>; rel="last"' } });
    if (url.includes('/search/issues')) return Response.json({ total_count: 0 });
    return Response.json({
      id: 42,
      full_name: 'acme/rocket',
      created_at: new Date(NOW - 86_400_000 * 30).toISOString(),
      pushed_at: new Date(NOW - 3_600_000).toISOString(),
      open_issues_count: 1,
      default_branch: 'main',
      private: opts.private === true,
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
