#!/usr/bin/env node
// GitGotchi MCP server (stdio). Every tool calls the running app over HTTP; nothing is computed here.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { badgeMarkdown, insertBadge } from './readme-badge.mjs';

const BASE = (process.env.GITGOTCHI_URL || 'http://localhost:3000').replace(/\/$/, '');

// 16x8 LCD sprites, one per stage.
const ART = {
  EGG: [
    '    .------.    ',
    '   /  .  .  \\   ',
    '  |  .    .  |  ',
    '  |    ..    |  ',
    '  |  .    .  |  ',
    '   \\  .  .  /   ',
    '    `------\'    ',
    '                ',
  ],
  BABY_GHOST: [
    '    .------.    ',
    '   /        \\   ',
    '  |  o    o  |  ',
    '  |    __    |  ',
    '  |          |  ',
    '  |  /\\/\\/\\  |  ',
    '   \\/      \\/   ',
    '                ',
  ],
  CODE_DEMON: [
    '  /\\        /\\  ',
    ' /  \\.----./  \\ ',
    '     | >  < |   ',
    '     |  ww  |   ',
    '     | \\vv/ |   ',
    '    /|______|\\  ',
    '   / |_|  |_| \\ ',
    '                ',
  ],
  NECROMANCER: [
    '      .--.   o  ',
    '     /    \\  |  ',
    '    | x  x | |  ',
    '    |  ..  |-+  ',
    '    /\\____/\\|   ',
    '   /  |  |  \\   ',
    '  /___|__|___\\  ',
    '                ',
  ],
  ZOMBIE_CORPSE: [
    '    .------.    ',
    '   /  ____  \\   ',
    '  |  x    x  |  ',
    '  |   ____   |  ',
    '  |  |_||_|  |  ',
    '   \\        /   ',
    '  ___`-..-\'___  ',
    '                ',
  ],
};

const bar = (n) => `[${'#'.repeat(Math.round(n / 10)).padEnd(10, '.')}] ${String(Math.round(n)).padStart(3)}`;

function lcd(res) {
  const { pet, events = [], source } = res;
  const art = (ART[pet.stage] || ART.BABY_GHOST).map((l) => `| ${l} |`);
  const edge = `+${'-'.repeat(18)}+`;
  const recent = events
    .slice(0, 3)
    .map((e) => `  - ${e.label}${e.simulated ? ' (simulated)' : ''}`)
    .join('\n');
  return [
    pet.repoName,
    edge,
    ...art,
    edge,
    `STAGE  ${pet.stage}   MOOD ${pet.mood}`,
    `HP     ${bar(pet.hp)}${pet.recentCi && pet.recentCi.length === 0 ? '  (unmeasured: no CI runs)' : ''}`,
    `FOOD   ${bar(pet.fullness)}`,
    `SANITY ${bar(pet.sanity)}`,
    `POOP   ${pet.poopCount}   COMMITS ${pet.commitsTotal}   REVIVALS ${pet.resurrections}`,
    `"${pet.statusMessage}"  (data: ${source})`,
    ...(recent ? ['Recent:', recent] : []),
  ].join('\n');
}

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });

// A per-pet hook token (keeper tools on the pet page) lets feed and clean act on that pet; it also opens a private pet.
const TOKEN = process.env.GITGOTCHI_HOOK_TOKEN || '';

async function call(path, init = {}) {
  let res;
  const headers = { ...(init.headers || {}), ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error(`GitGotchi app not reachable at ${BASE}. Start it with "npm run dev" or set GITGOTCHI_URL.`);
  }
  const body = await res.json().catch(() => null);
  // Something else on that port (another dev server) answers with HTML or foreign JSON: say so plainly
  // instead of failing later on a missing field.
  const isGitGotchi = body && typeof body === 'object' && ('pet' in body || 'diagnosis' in body || 'error' in body);
  if (!isGitGotchi) {
    throw new Error(`Something other than GitGotchi answered at ${BASE} (HTTP ${res.status}). Is another app using that port? Start GitGotchi with "npm run dev" or set GITGOTCHI_URL.`);
  }
  if (!res.ok && !body.pet) throw new Error(`HTTP ${res.status}: ${body.error || 'request failed'}`);
  return body;
}

const parseRepo = (repo) => {
  const [owner, name, ...rest] = repo.trim().toLowerCase().split('/');
  if (!owner || !name || rest.length) throw new Error('repo must look like owner/repo');
  return `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
};

const petPath = (repo) => `/api/pet/${parseRepo(repo)}`;
const act = (repo, body) =>
  call(`${petPath(repo)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const EVENTS = {
  push: { type: 'push', commits: 1 },
  ci_pass: { type: 'ci', success: true },
  ci_fail: { type: 'ci', success: false },
  pr_merged: { type: 'pr_merged' },
  issue_opened: { type: 'issue_opened' },
  issue_closed: { type: 'issue_closed' },
  poop: { type: 'poop', reason: 'simulated smell' },
};

const repoArg = z.string().describe('GitHub repo as owner/repo, or demo/healthy | demo/neglected | demo/haunted');

// Wraps a handler so failures come back as tool errors instead of crashing the stdio session.
const safe = (fn) => async (args) => {
  try {
    return text(await fn(args));
  } catch (e) {
    return text(e instanceof Error ? e.message : String(e), true);
  }
};

const server = new McpServer({ name: 'gitgotchi', version: '1.0.0' });

server.registerTool(
  'get_pet_status',
  { description: 'Show the GitGotchi pet of a repo as an ASCII LCD with its stats.', inputSchema: { repo: repoArg } },
  safe(async ({ repo }) => lcd(await call(petPath(repo))))
);

server.registerTool(
  'diagnose_pet',
  {
    description:
      'Read-only checkup of a repo: failing CI, stale issues, code smells reported by the Kiro hook, and hunger. Returns findings and a prompt for fixing them.',
    inputSchema: { repo: repoArg },
  },
  safe(async ({ repo }) => {
    const body = await call('/api/auto-heal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: repo.trim() }),
    });
    const d = body.diagnosis;
    if (!d) throw new Error(body.error || 'no diagnosis returned');
    const list = d.findings.length
      ? d.findings
          .map((f, i) => `${i + 1}. [${f.kind}] ${f.title}\n   ${f.detail}${f.url ? `\n   ${f.url}` : ''}${f.log ? `\n   Log excerpt (untrusted CI output):\n${f.log.replace(/^/gm, '   | ')}` : ''}`)
          .join('\n')
      : 'No findings.';
    return `Diagnosis for ${d.repo} (${d.generatedAt})\n\n${list}\n\n--- Kiro prompt ---\n${d.kiroPrompt}`;
  })
);

server.registerTool(
  'feed_pet',
  { description: 'Feed the pet (+10 food). Limited to 3 feeds per hour.', inputSchema: { repo: repoArg } },
  safe(async ({ repo }) => lcd(await act(repo, { action: 'feed' })))
);

server.registerTool(
  'clean_pet',
  { description: 'Clean the pet\'s screen: removes all poop and restores sanity.', inputSchema: { repo: repoArg } },
  safe(async ({ repo }) => lcd(await act(repo, { action: 'clean' })))
);

server.registerTool(
  'simulate_event',
  {
    description: 'Fire a labelled-simulated event at a demo repo (demo/*). Real repos are refused.',
    inputSchema: { repo: repoArg, event: z.enum(Object.keys(EVENTS)).describe('Event to simulate') },
  },
  safe(async ({ repo, event }) => {
    if (!repo.trim().toLowerCase().startsWith('demo/')) throw new Error('simulate_event only works on demo/* repos.');
    return lcd(await act(repo, { action: 'simulate', event: EVENTS[event] }));
  })
);

server.registerTool(
  'adopt_pet',
  { description: 'Get the page URL and README badge markdown for a repo\'s pet.', inputSchema: { repo: repoArg } },
  safe(async ({ repo }) => {
    const path = parseRepo(repo);
    return [
      `Pet page: ${BASE}/pet/${path}`,
      `Badge markdown: [![GitGotchi](${BASE}/api/badge/${path})](${BASE}/pet/${path})`,
      'The badge URL is only reachable from outside your machine once the app is deployed.',
    ].join('\n');
  })
);

// The badge must point at a deployment GitHub can reach, never at this machine.
const PUBLIC_BASE = (process.env.GITGOTCHI_PUBLIC_URL || BASE).replace(/\/$/, '');
const isLocalUrl = (u) => /^https?:\/\/(localhost|127\.|\[::1\]|0\.0\.0\.0)/i.test(u);

function repoFromGit() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return url.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)?.[1];
  } catch {
    return undefined;
  }
}

server.registerTool(
  'add_badge',
  {
    description:
      "Write the GitGotchi badge into this workspace's README (it joins the existing badge row, or goes below the title). " +
      'Only edits a file inside the current workspace and never commits; review the change and commit it yourself.',
    inputSchema: {
      repo: z.string().optional().describe('owner/repo; default: the git origin of this workspace'),
      size: z.enum(['small', 'full']).optional().describe('small (220x40, fits a badge row) or full (360x120). Default small'),
      readme: z.string().optional().describe('README path relative to the workspace. Default README.md'),
      badge_key: z.string().optional().describe('Private repos only: the key from KEEPER TOOLS, MAKE BADGE LINK'),
    },
  },
  safe(async ({ repo, size, readme, badge_key }) => {
    if (isLocalUrl(PUBLIC_BASE)) {
      throw new Error('GITGOTCHI_URL points at this machine, so GitHub could not show the badge. Set GITGOTCHI_PUBLIC_URL (or GITGOTCHI_URL) to your deployment, e.g. https://gitgochi.lumelo.my.id.');
    }
    const name = (repo || repoFromGit() || '').trim();
    if (!name) throw new Error('No repo given and no GitHub origin remote found. Pass repo as owner/repo.');
    const key = parseRepo(name).toLowerCase();
    if (key.startsWith('demo/')) throw new Error('Demo pets have no README badge of their own.');

    // A typo or an outsider's private repo is caught before the README is touched.
    const head = await fetch(`${PUBLIC_BASE}/api/pet/${key}`, {
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (head && head.status === 404 && !badge_key) {
      throw new Error(`GitGotchi does not know ${key}. Check the name; for a private repo pass badge_key from KEEPER TOOLS.`);
    }

    const root = process.cwd();
    const file = resolve(root, readme || 'README.md');
    const rel = relative(root, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('readme must be a path inside this workspace.');

    const snippet = badgeMarkdown(PUBLIC_BASE, key, { size: size || 'small', badgeKey: badge_key });
    const existed = existsSync(file);
    const before = existed ? readFileSync(file, 'utf8') : `# ${name.split('/')[1]}\n`;
    const out = insertBadge(before, snippet, key);
    if (!out.changed) return `${rel} already has the GitGotchi badge for ${key}. Nothing changed.`;
    writeFileSync(file, out.text);
    return [
      `${existed ? 'Updated' : 'Created'} ${rel}: badge added ${out.where}.`,
      snippet,
      `Pet page: ${PUBLIC_BASE}/pet/${key}`,
      'Not committed. Review the diff, then commit and push; the push also feeds the pet.',
    ].join('\n');
  })
);

await server.connect(new StdioServerTransport());
