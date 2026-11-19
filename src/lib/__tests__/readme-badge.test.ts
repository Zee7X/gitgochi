import { describe, expect, it } from 'vitest';
import { badgeMarkdown, insertBadge } from '../../../mcp-server/readme-badge.mjs';

const B = 'https://gitgochi.lumelo.my.id';
const KEY = 'zee7x/pocket-flow';
const SNIP = badgeMarkdown(B, KEY);

describe('badgeMarkdown', () => {
  it('small by default; full drops the size; a badge key is added for private repos', () => {
    expect(SNIP).toBe(`[![GitGotchi](${B}/api/badge/${KEY}.svg?size=small)](${B}/pet/${KEY})`);
    expect(badgeMarkdown(B, KEY, { size: 'full' })).toContain(`${KEY}.svg)`);
    expect(badgeMarkdown(B, KEY, { badgeKey: 'abc' })).toContain('?size=small&k=abc');
  });
});

describe('insertBadge', () => {
  it('joins the existing badge row, keeping its indentation (the Pocket-Flow README)', () => {
    const readme = [
      '<div align="center">',
      '  # PocketFlow',
      '',
      '  [![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B)](https://flutter.dev)',
      '  [![License](https://img.shields.io/badge/License-Private-slate.svg)](#)',
      '',
      '  **PocketFlow** adalah aplikasi...',
    ].join('\n');
    const r = insertBadge(readme, SNIP, KEY);
    expect(r.changed).toBe(true);
    const lines = r.text.split('\n');
    expect(lines[5]).toBe(`  ${SNIP}`);
    expect(lines[6]).toBe('');
  });

  it('goes below the first title when there are no badges, else at the top', () => {
    expect(insertBadge('# App\n\nText', SNIP, KEY).text).toBe(`# App\n\n${SNIP}\n\nText`);
    expect(insertBadge('Just text', SNIP, KEY).text).toBe(`${SNIP}\n\nJust text`);
  });

  it('does nothing when the badge is already there, whatever the case of the repo name', () => {
    const readme = `# App\n\n[![GitGotchi](${B}/api/badge/Zee7X/Pocket-Flow)](${B}/pet/zee7x/pocket-flow)`;
    expect(insertBadge(readme, SNIP, KEY)).toEqual({ text: readme, changed: false, where: 'already present' });
  });

  it('leaves Windows line endings readable and never touches badges far down the file', () => {
    const body = Array.from({ length: 80 }, (_, i) => `line ${i}`).join('\n');
    const readme = `# App\r\n\r\n${body}\n[![x](a)](b)`;
    const r = insertBadge(readme, SNIP, KEY);
    expect(r.where).toMatch(/below the title/);
    expect(r.text.startsWith(`# App\r\n\r\n${SNIP}\r\n`)).toBe(true);
  });
});
