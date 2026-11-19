import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderBadge, renderStatusBadge } from '../badge-svg';
import { GET } from '@/app/api/badge/[owner]/[repo]/route';
import { getPet } from '../pet-service';
import { NextRequest } from 'next/server';

const NOW = Date.now();
const pet = async (name: string) => (await getPet(`demo/${name}`, NOW, true)).pet;

const wellFormed = (svg: string) => {
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg.match(/<svg[ >]/g)).toHaveLength(1);
  expect(svg).not.toMatch(/@import|<script|https?:\/\/(?!www\.w3\.org)/i);
  const open = (svg.match(/<(g|style|text|title)[ >]/g) ?? []).length;
  const close = (svg.match(/<\/(g|style|text|title)>/g) ?? []).length;
  expect(open).toBe(close);
};

describe('renderBadge', () => {
  it('healthy badge is well formed, monospace, and under 12 KB', async () => {
    const svg = renderBadge(await pet('healthy'), 'demo/healthy');
    wellFormed(svg);
    expect(svg).toContain('font-family="monospace"');
    expect(svg).toContain('CODE DEMON');
    expect(svg).toContain('class="bob"');
    expect(Buffer.byteLength(svg)).toBeLessThan(12 * 1024);
  });

  it('static mode drops the animation', async () => {
    const svg = renderBadge(await pet('healthy'), 'demo/healthy', { animate: false });
    expect(svg).not.toMatch(/<style|bob/);
  });

  it('dead pet shows R.I.P. with the inverted palette and no bob', async () => {
    const svg = renderBadge(await pet('haunted'), 'demo/haunted');
    wellFormed(svg);
    expect(svg).toContain('R.I.P.');
    expect(svg).toContain('FIX CI TO REVIVE');
    expect(svg).toContain('<rect width="360" height="120" fill="#9bbc0f"/>');
    expect(svg).not.toContain('class="bob"');
  });

  it('escapes hostile repo names', async () => {
    const svg = renderBadge(await pet('healthy'), 'a/<script>alert("x")</script>&');
    wellFormed(svg);
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&#60;SCRIPT&#62;');
  });

  it('truncates long repo names', async () => {
    const svg = renderBadge(await pet('healthy'), `o/${'x'.repeat(80)}`);
    expect(svg).toContain('…');
    expect(svg).not.toContain('X'.repeat(30));
  });

  it('small variant is 220x40 and compact', async () => {
    const svg = renderBadge(await pet('healthy'), 'demo/healthy', { size: 'small' });
    wellFormed(svg);
    expect(svg).toContain('width="220" height="40"');
    expect(Buffer.byteLength(svg)).toBeLessThan(12 * 1024);
  });

  it('status badges are grey and well formed', () => {
    for (const k of ['invalid', 'not_found', 'signal_lost'] as const) {
      const svg = renderStatusBadge(k);
      wellFormed(svg);
      expect(svg).not.toContain('#9bbc0f');
    }
    expect(renderStatusBadge('signal_lost')).toContain('SIGNAL LOST');
  });
});

describe('badge route', () => {
  const call = (owner: string, repo: string, qs = '', headers: HeadersInit = {}) =>
    GET(new NextRequest(`http://x/api/badge/${owner}/${repo}${qs}`, { headers }), {
      params: Promise.resolve({ owner, repo }),
    });

  it('accepts repo.svg and sets camo-friendly headers', async () => {
    const res = await call('demo', 'healthy.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    expect(res.headers.get('etag')).toBeTruthy();
    expect(await res.text()).toContain('demo/healthy'.toUpperCase());
  });

  it('answers 304 on a matching ETag', async () => {
    const etag = (await call('demo', 'healthy', '?static=1')).headers.get('etag')!;
    expect((await call('demo', 'healthy', '?static=1', { 'if-none-match': etag })).status).toBe(304);
  });

  it('bad input is a 400 svg', async () => {
    const res = await call('demo', 'bad name');
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('INVALID REPO');
  });

  it('unknown demo is a 200 grey REPO NOT FOUND', async () => {
    const res = await call('demo', 'nope');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('REPO NOT FOUND');
  });

  describe('with KV down', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    it('shows SIGNAL LOST', async () => {
      vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
      vi.stubEnv('KV_REST_API_TOKEN', 'tok-SECRET');
      vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream down', { status: 502 })));
      const svg = await (await call('demo', 'healthy')).text();
      expect(svg).toContain('SIGNAL LOST');
      expect(svg).not.toContain('SECRET');
    });
  });

  it('writes demo files for eyeballing', async () => {
    const dir = process.env.TMPDIR ?? process.env.TEMP ?? '.';
    mkdirSync(dir, { recursive: true });
    for (const n of ['healthy', 'haunted']) {
      writeFileSync(join(dir, `badge-demo-${n}.svg`), renderBadge(await pet(n), `demo/${n}`, { animate: false }));
    }
    writeFileSync(join(dir, 'badge-demo-small.svg'), renderBadge(await pet('healthy'), 'demo/healthy', { size: 'small' }));
  });
});
