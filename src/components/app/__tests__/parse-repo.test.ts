import { describe, expect, it } from 'vitest';
import { parseRepo } from '../parse-repo';

describe('parseRepo', () => {
  it('accepts owner/repo and lowercases it', () => {
    expect(parseRepo(' Vercel/Next.js ')).toBe('vercel/next.js');
  });

  it('accepts GitHub URLs, with or without scheme, .git and trailing paths', () => {
    expect(parseRepo('https://github.com/octocat/Hello-World')).toBe('octocat/hello-world');
    expect(parseRepo('github.com/octocat/hello-world.git')).toBe('octocat/hello-world');
    expect(parseRepo('https://github.com/octocat/hello-world/tree/main?x=1')).toBe('octocat/hello-world');
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'octocat', 'a/b/c', 'octocat/../x', 'a b/c', 'https://example.com/a/b']) {
      expect(parseRepo(bad)).toBeNull();
    }
  });
});
