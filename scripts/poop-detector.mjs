#!/usr/bin/env node
// Kiro PostFileSave hook: scan the saved file for code smells and tell the running GitGotchi app.
// Never fails the hook: if the server is down it prints one line and exits 0.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const BASE = (process.env.GITGOTCHI_URL || 'http://localhost:3000').replace(/\/$/, '');

// Kiro sends session context as JSON on stdin; the exact key is not documented, so try the likely ones.
function pathFromJson(raw) {
  try {
    const j = JSON.parse(raw);
    const found = [j.filePath, j.file_path, j.path, j.file, j.tool_input?.path, j.tool_input?.file_path].find(
      (v) => typeof v === 'string' && v
    );
    return found || '';
  } catch {
    return '';
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  const timer = setTimeout(() => process.stdin.destroy(), 1000);
  try {
    for await (const c of process.stdin) chunks.push(c);
  } catch {
    // stdin closed early: use whatever arrived
  }
  clearTimeout(timer);
  return Buffer.concat(chunks).toString('utf8');
}

function repoFromGit() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return url.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/)?.[1];
  } catch {
    return undefined;
  }
}

function scan(text) {
  return {
    hasConsoleLog: /\bconsole\.log\s*\(/.test(text),
    hasDebugger: /^\s*debugger\b/m.test(text),
    hasTodo: /\b(TODO:|FIXME)/.test(text),
  };
}

async function main() {
  const fromStdin = pathFromJson(await readStdin());
  // `{{filePath}}` reaches us verbatim when Kiro does not substitute it; fall through to env/stdin then.
  const arg = process.argv[2]?.includes('{{') ? '' : process.argv[2];
  const target = arg || process.env.KIRO_HOOK_FILE || fromStdin;
  if (!target) {
    console.log('gitgotchi: no file path given (argv, KIRO_HOOK_FILE or stdin), skipped.');
    return;
  }
  const abs = resolve(target);
  const filePath = relative(process.cwd(), abs).split('\\').join('/');
  // A deleted file has no smells left, so it reads as clean.
  const flags = existsSync(abs) ? scan(readFileSync(abs, 'utf8')) : scan('');
  const clean = !(flags.hasConsoleLog || flags.hasDebugger || flags.hasTodo);
  const repo = process.env.GITGOTCHI_REPO || repoFromGit();

  const body = { filePath, ...flags, ...(clean ? { clean: true } : {}), ...(repo ? { repo } : {}), timestamp: new Date().toISOString() };
  const token = process.env.GITGOTCHI_HOOK_TOKEN;
  try {
    const res = await fetch(`${BASE}/api/local-poop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    const verdict = clean ? 'clean' : Object.keys(flags).filter((k) => flags[k]).join(', ');
    console.log(`gitgotchi: ${filePath} ${verdict} -> HTTP ${res.status}`);
  } catch (e) {
    console.log(`gitgotchi: server not reachable at ${BASE} (${e.message}), skipped.`);
  }
}

main().catch((e) => console.log(`gitgotchi: ${e.message}, skipped.`));
