import { describe, expect, it } from 'vitest';
import { buildKiroPrompt, diagnose } from '../heal';
import { createPet } from '../state-machine';
import type { PetEvent } from '../types';

const NOW = Date.parse('2026-11-16T00:00:00Z');
const DAY = 86_400_000;

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

/** Fake GitHub: routes by URL substring, anything else is a 404. */
const fakeFetch = (routes: Record<string, unknown>): typeof fetch =>
  (async (url: string) => {
    const hit = Object.keys(routes).find((k) => String(url).includes(k));
    return hit ? json(routes[hit]) : json({}, false);
  }) as unknown as typeof fetch;

const poop = (label: string, at: number): PetEvent => ({
  id: label,
  at,
  type: 'poop',
  label,
  deltas: {},
  source: 'kiro-hook',
});

describe('diagnose', () => {
  it('builds findings from GitHub and pet data with real URLs only', async () => {
    const pet = createPet('acme/app', NOW, { poopCount: 1, lastPushAt: NOW - 5 * DAY });
    const fetchFn = fakeFetch({
      '/actions/runs': {
        workflow_runs: [
          { name: 'CI', run_number: 42, head_branch: 'main', conclusion: 'failure', html_url: 'https://github.com/acme/app/actions/runs/1' },
        ],
      },
      '/search/issues': {
        items: [{ number: 7, title: 'Flaky login', html_url: 'https://github.com/acme/app/issues/7', updated_at: '2026-08-01T00:00:00Z' }],
      },
    });
    const d = await diagnose('acme/app', pet, [poop('console.log in src/a.ts', NOW)], { now: NOW, fetchFn, token: 'x' });

    expect(d.findings.map((f) => f.kind)).toEqual(['ci', 'issue', 'poop', 'hunger']);
    expect(d.findings[0]).toMatchObject({ title: 'CI failing: CI', url: 'https://github.com/acme/app/actions/runs/1' });
    expect(d.findings[1].title).toContain('#7');
    expect(d.findings[2].title).toContain('src/a.ts');
    expect(d.findings[3].title).toBe('No push for 5 days');
    expect(d.kiroPrompt).toContain('Flaky login');
    // Only URLs that GitHub returned may appear; nothing invented.
    expect(d.kiroPrompt.match(/https?:\/\/\S+/g)).toEqual([
      'https://github.com/acme/app/actions/runs/1',
      'https://github.com/acme/app/issues/7',
    ]);
    expect(d.kiroPrompt).not.toMatch(/\/pull\//);
  });

  it('reports a clean repo with no findings and no mutation hints', async () => {
    const pet = createPet('acme/app', NOW, { lastPushAt: NOW - 1000 });
    const fetchFn = fakeFetch({
      '/actions/runs': { workflow_runs: [{ name: 'CI', run_number: 1, head_branch: 'main', conclusion: 'success', html_url: 'u' }] },
      '/search/issues': { items: [] },
    });
    const d = await diagnose('acme/app', pet, [], { now: NOW, fetchFn });
    expect(d.findings).toEqual([]);
    expect(d.kiroPrompt).toContain('nothing to fix');
  });

  it('falls back to pet data when GitHub is unreachable', async () => {
    const pet = createPet('acme/app', NOW, { recentCi: ['success', 'failure'] });
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const d = await diagnose('acme/app', pet, [], { now: NOW, fetchFn: boom });
    expect(d.findings).toHaveLength(1);
    expect(d.findings[0]).toMatchObject({ kind: 'ci', title: 'CI failing' });
    expect(d.findings[0].url).toBeUndefined();
  });

  it('never calls GitHub for demo repos', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return json({});
    }) as unknown as typeof fetch;
    const pet = createPet('demo/haunted', NOW, { recentCi: ['failure'] });
    const d = await diagnose('demo/haunted', pet, [], { now: NOW, fetchFn });
    expect(calls).toBe(0);
    expect(d.findings[0].kind).toBe('ci');
  });

  it('lists only as many poop events as poops still on screen', async () => {
    const pet = createPet('demo/x', NOW, { poopCount: 1 });
    const d = await diagnose('demo/x', pet, [poop('new', NOW), poop('old', NOW - 1)], { now: NOW });
    expect(d.findings.filter((f) => f.kind === 'poop').map((f) => f.title)).toEqual(['Code smell: new']);
  });
});

describe('buildKiroPrompt', () => {
  it('asks for spec-first work and forbids invented results', () => {
    const p = buildKiroPrompt('a/b', [{ kind: 'hunger', title: 'No push for 3 days', detail: 'd' }]);
    expect(p).toContain('spec');
    expect(p).toContain('Do not invent results');
  });
});
