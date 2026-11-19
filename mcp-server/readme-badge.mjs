// Pure helpers for the add_badge MCP tool: build the badge markdown and put it into a README.
// No I/O here, so the rules are tested in src/lib/__tests__/readme-badge.test.ts.

/** Markdown for a pet badge. `badgeKey` is needed for private repos (KEEPER TOOLS, MAKE BADGE LINK). */
export function badgeMarkdown(base, key, { size = 'small', badgeKey } = {}) {
  const q = new URLSearchParams();
  if (size === 'small') q.set('size', 'small');
  if (badgeKey) q.set('k', badgeKey);
  const qs = q.toString();
  return `[![GitGotchi](${base}/api/badge/${key}.svg${qs ? `?${qs}` : ''})](${base}/pet/${key})`;
}

const BADGE_LINE = /^\s*(\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*)+$|^\s*!\[[^\]]*\]\([^)]*\)\s*$/;

/**
 * Inserts `snippet` into `readme`:
 * - nothing changes when a GitGotchi badge for `key` is already there;
 * - after the last badge line of the first badge row near the top (keeping its indentation);
 * - otherwise right after the first `# ` heading;
 * - otherwise at the very top.
 * Returns the new text, whether it changed, and where the badge went.
 */
export function insertBadge(readme, snippet, key) {
  // Keep the file's own line endings.
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const text = readme.replace(/\r\n/g, '\n');
  if (text.toLowerCase().includes(`/api/badge/${key.toLowerCase()}`)) return { text: readme, changed: false, where: 'already present' };
  const lines = text.split('\n');
  const top = Math.min(lines.length, 60);

  let first = -1;
  for (let i = 0; i < top; i++) {
    if (BADGE_LINE.test(lines[i])) {
      first = i;
      break;
    }
  }
  if (first >= 0) {
    let last = first;
    while (last + 1 < lines.length && BADGE_LINE.test(lines[last + 1])) last++;
    const indent = lines[last].match(/^\s*/)[0];
    lines.splice(last + 1, 0, indent + snippet);
    return { text: lines.join(eol), changed: true, where: `after the badge row on line ${last + 1}` };
  }

  const h1 = lines.slice(0, top).findIndex((l) => /^\s*#\s+\S/.test(l));
  if (h1 >= 0) {
    lines.splice(h1 + 1, 0, '', snippet);
    return { text: lines.join(eol), changed: true, where: `below the title on line ${h1 + 1}` };
  }
  return { text: `${snippet}${eol}${eol}${readme}`, changed: true, where: 'at the top' };
}
