import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// kiro-healer task 12: the Power in power-gitgotchi/ (Agent Plugins 1.0.0 format).
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const POWER = `${ROOT}power-gitgotchi/`;
const json = (f: string) => JSON.parse(readFileSync(POWER + f, 'utf8'));

/** Starts an MCP stdio server, runs initialize + tools/list, returns the sorted tool names. */
function listTools(script: string, cwd: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, GITGOTCHI_URL: 'http://127.0.0.1:9' } });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no tools/list answer from ${script}`));
    }, 10_000);
    child.stdout.on('data', (d) => {
      out += d;
      const line = out.split('\n').find((l) => l.includes('"id":2'));
      if (!line) return;
      clearTimeout(timer);
      child.kill();
      resolve((JSON.parse(line).result.tools as { name: string }[]).map((t) => t.name).sort());
    });
    const send = (m: object) => child.stdin.write(`${JSON.stringify(m)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  });
}

describe('Kiro Power (power-gitgotchi/)', () => {
  it('plugin.json has the required Agent Plugins fields and no others', () => {
    const p = json('plugin.json');
    expect(p.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(p.name).toBe('gitgotchi');
    expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(p.description).toBeTruthy();
    expect(p.author.name).toBeTruthy();
    expect(p.keywords.length).toBeGreaterThan(0);
    const allowed = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'];
    expect(Object.keys(p).filter((k) => !allowed.includes(k))).toEqual([]);
  });

  it('mcp.json starts the bundled server over stdio from inside the Power', () => {
    const m = json('mcp.json');
    expect(m.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
    const s = m.mcpServers.gitgotchi;
    expect(s).toMatchObject({ type: 'stdio', command: 'node', cwd: '${PLUGIN_ROOT}', env: { GITGOTCHI_URL: 'http://localhost:3000' } });
    expect(Object.keys(s).sort()).toEqual(['args', 'command', 'cwd', 'env', 'type']);
    expect(existsSync(POWER + s.args[0])).toBe(true);
  });

  it('SKILL.md has summon-healer frontmatter and the four steps', () => {
    // Windows checkouts with core.autocrlf=true have CRLF line endings.
    const md = readFileSync(`${POWER}skills/summon-healer/SKILL.md`, 'utf8').replace(/\r\n/g, '\n');
    expect(md).toMatch(/^---\nname: summon-healer\ndescription: .+\n---\n/);
    for (const step of ['diagnose_pet', '.kiro/specs/', 'npm test', 'actually ran']) expect(md).toContain(step);
  });

  it('the bundle lists the same tools as mcp-server/index.mjs (run npm run build:power if not)', async () => {
    const [source, bundle] = await Promise.all([
      listTools('mcp-server/index.mjs', ROOT),
      listTools('server/gitgotchi-mcp.mjs', POWER),
    ]);
    expect(source.length).toBe(7);
    expect(source).toContain('add_badge');
    expect(bundle).toEqual(source);
  }, 20_000);
});
