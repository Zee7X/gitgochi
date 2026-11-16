#!/usr/bin/env node
// GitGotchi MCP server (stdio). Every tool calls the running app over HTTP; nothing is computed here.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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
    `HP     ${bar(pet.hp)}`,
    `FOOD   ${bar(pet.fullness)}`,
    `SANITY ${bar(pet.sanity)}`,
    `POOP   ${pet.poopCount}   COMMITS ${pet.commitsTotal}   REVIVALS ${pet.resurrections}`,
    `"${pet.statusMessage}"  (data: ${source})`,
    ...(recent ? ['Recent:', recent] : []),
  ].join('\n');
}

const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });

async function call(path, init) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error(`GitGotchi app not reachable at ${BASE}. Start it with "npm run dev" or set GITGOTCHI_URL.`);
  }
  const body = await res.json().catch(() => ({}));
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
      ? d.findings.map((f, i) => `${i + 1}. [${f.kind}] ${f.title}\n   ${f.detail}${f.url ? `\n   ${f.url}` : ''}`).join('\n')
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

await server.connect(new StdioServerTransport());
