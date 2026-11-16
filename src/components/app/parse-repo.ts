const SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Accepts `owner/repo`, `github.com/owner/repo` or a full GitHub URL. Returns null when it is none of those. */
export function parseRepo(input: string): string | null {
  const cleaned = input
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/[?#].*$/, '');
  const [owner, repo, ...rest] = cleaned.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  // Extra path parts only make sense after a URL (tree/main, issues, ...).
  if (rest.length && cleaned === input.trim()) return null;
  const name = repo.replace(/\.git$/i, '');
  if (![owner, name].every((p) => SEGMENT.test(p) && p !== '.' && p !== '..')) return null;
  return `${owner}/${name}`.toLowerCase();
}
