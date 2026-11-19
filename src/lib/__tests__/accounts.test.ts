import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as appWebhook } from '@/app/api/github-app/webhook/route';
import { GET as callback } from '@/app/api/auth/callback/route';
import { GET as badge } from '@/app/api/badge/[owner]/[repo]/route';
import { POST as legacyWebhook } from '@/app/api/webhook/github/route';
import { POST as settingsRoute } from '@/app/api/pet/[owner]/[repo]/settings/route';
import { POST as actionRoute } from '@/app/api/pet/[owner]/[repo]/action/route';
import { NextRequest } from 'next/server';
import { roleFromGitHub, sameOrigin, type PetCtx } from '../access';
import { safeNext } from '../auth-flow';
import { deriveKey, open, seal } from '../crypto';
import { actOnDemo, demoResponse, loadDemo } from '../demo-local';
import { kvGet, resetMemoryKv } from '../kv';
import { getPet } from '../pet-service';
import { runSettings } from '../pet-settings';
import { getEntry, setEntry } from '../pet-store';
import { createSession, loadSession, sessionCookie } from '../session';
import { fakeGitHub } from './helpers';

const NOW = Date.now();
const KEEPER: PetCtx = { role: 'keeper', canSeePrivate: true, signedIn: true, auth: { kind: 'token', token: 'u' }, login: 'kim' };

beforeEach(() => {
  resetMemoryKv();
  vi.stubEnv('DATA_ENCRYPTION_KEY', 'test-data-key-0123456789abcdef0123456789');
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-0123456789abcdef012345');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('crypto', () => {
  it('seal and open round-trip; tampering or another key gives null', () => {
    const k = deriveKey('secret', 'a');
    const box = seal('hello', k);
    expect(open(box, k)).toBe('hello');
    expect(open(box, deriveKey('secret', 'b'))).toBeNull();
    const raw = Buffer.from(box, 'base64url');
    raw[raw.length - 1] ^= 1;
    expect(open(raw.toString('base64url'), k)).toBeNull();
  });
});

describe('sessions (accounts R1)', () => {
  it('stores the user token encrypted under a hash of the cookie value', async () => {
    const { sid } = await createSession({ id: 7, login: 'kim', avatar_url: '' }, { token: 'ghu_SECRET', tokenExpiresAt: null, refreshToken: null, refreshExpiresAt: null });
    const { kvGet: get } = await import('../kv');
    expect(await get(`gitgotchi:session:${sid}`)).toBeNull();
    expect((await loadSession(sid))?.token).toBe('ghu_SECRET');
    expect(await loadSession('x'.repeat(43))).toBeNull();
  });

  it('cookie is HttpOnly, SameSite=Lax and Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookie('abc')).toMatch(/HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
  });

  it('the callback refuses a state that does not match the browser cookie', async () => {
    const res = await callback(new Request('http://x/api/auth/callback?code=c&state=evil', { headers: { cookie: 'gg_oauth=good.Lw' } }));
    expect(res.status).toBe(400);
  });

  it('next only allows same-site paths', () => {
    expect(safeNext('/pet/a/b')).toBe('/pet/a/b');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', null]) expect(safeNext(bad)).toBe('/me');
  });
});

describe('roles (accounts R2)', () => {
  it('push, maintain or admin is a keeper; pull on a private repo is a reader; anything else a visitor', async () => {
    const answer = (permissions: object, isPrivate = false) =>
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ private: isPrivate, permissions })));
    answer({ push: true });
    expect(await roleFromGitHub('a/b', 't')).toEqual({ role: 'keeper', visibility: 'public' });
    answer({ maintain: true }, true);
    expect((await roleFromGitHub('a/b', 't'))?.role).toBe('keeper');
    answer({ pull: true }, true);
    expect(await roleFromGitHub('a/b', 't')).toEqual({ role: 'reader', visibility: 'private' });
    answer({ pull: true });
    expect((await roleFromGitHub('a/b', 't'))?.role).toBe('visitor');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    expect(await roleFromGitHub('a/b', 't')).toBeNull();
  });

  it('cookie writes need our own Origin', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://gitgochi.lumelo.my.id');
    const req = (origin?: string) => new Request('https://gitgochi.lumelo.my.id/x', { method: 'POST', headers: origin ? { origin } : {} });
    expect(sameOrigin(req('https://gitgochi.lumelo.my.id'))).toBe(true);
    expect(sameOrigin(req('https://evil.example'))).toBe(false);
    expect(sameOrigin(req())).toBe(false);
    fakeGitHub();
    const res = await actionRoute(
      new Request('https://gitgochi.lumelo.my.id/api/pet/acme/rocket/action', {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'feed' }),
      }),
      { params: Promise.resolve({ owner: 'acme', repo: 'rocket' }) }
    );
    expect(res.status).toBe(403);
  });

  it('an anonymous feed on a real pet is 403 keepers only', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://g.example');
    fakeGitHub();
    const res = await actionRoute(
      new Request('https://g.example/api/pet/acme/rocket/action', {
        method: 'POST',
        headers: { origin: 'https://g.example' },
        body: JSON.stringify({ action: 'feed' }),
      }),
      { params: Promise.resolve({ owner: 'acme', repo: 'rocket' }) }
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'keepers only' });
  });
});

describe('keeper settings (accounts R5, R6, R9.7)', () => {
  it('only keepers reach settings; a signed-out request is 401', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://g.example');
    fakeGitHub();
    const res = await settingsRoute(
      new Request('https://g.example/api/pet/acme/rocket/settings', { method: 'POST', headers: { origin: 'https://g.example' }, body: JSON.stringify({ op: 'view' }) }),
      { params: Promise.resolve({ owner: 'acme', repo: 'rocket' }) }
    );
    expect(res.status).toBe(401);
    await expect(runSettings('acme/rocket', 'view', {}, { ...KEEPER, role: 'visitor' })).rejects.toThrow('keepers only');
  });

  it('hook tokens are shown once and stored as hashes; delete removes the pet', async () => {
    fakeGitHub();
    const made = await runSettings('acme/rocket', 'create-hook-token', {}, KEEPER);
    expect(made.hookToken).toMatch(/^ggh_/);
    const stored = (await getEntry('acme/rocket'))!;
    expect(JSON.stringify(stored)).not.toContain(made.hookToken!.split('.')[1]);
    expect((await runSettings('acme/rocket', 'view', {}, KEEPER)).hookToken).toBeUndefined();
    await runSettings('acme/rocket', 'revoke-hook-token', { id: made.hookTokens[0].id }, KEEPER);
    expect((await getEntry('acme/rocket'))!.hookTokens).toEqual([]);
    expect((await runSettings('acme/rocket', 'delete-pet', {}, KEEPER)).deleted).toBe(true);
    expect(await getEntry('acme/rocket')).toBeUndefined();
  });
});

describe('private badge (accounts R5)', () => {
  const call = (q = '') =>
    badge(new NextRequest(`http://x/api/badge/acme/rocket${q}`), { params: Promise.resolve({ owner: 'acme', repo: 'rocket' }) });

  it('needs the badge key; a wrong key looks like a missing repo; the right one is not cached by the CDN', async () => {
    fakeGitHub({ private: true });
    const reader = { ...KEEPER };
    await getPet('acme/rocket', NOW, reader);
    const { badgeKey } = await runSettings('acme/rocket', 'rotate-badge-key', {}, KEEPER);

    // Identical to a repo that does not exist: same status, same cache header, same body.
    const missing = await badge(new NextRequest('http://x/api/badge/acme/nope'), { params: Promise.resolve({ owner: 'acme', repo: 'nope' }) });
    for (const res of [await call(), await call('?k=wrong')]) {
      expect(res.status).toBe(missing.status);
      expect(res.headers.get('cache-control')).toBe(missing.headers.get('cache-control'));
      expect(await res.text()).toBe(await missing.clone().text());
    }

    const ok = await call(`?k=${badgeKey}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('private, no-store');
    const svg = await ok.text();
    expect(svg).toContain('ACME/ROCKET');
    expect(svg).not.toContain(badgeKey!);

    // Rotating makes the old key stop working at once.
    await runSettings('acme/rocket', 'rotate-badge-key', {}, KEEPER);
    expect(await (await call(`?k=${badgeKey}`)).text()).toContain('REPO NOT FOUND');
  });
});

function signed(secret: string, event: string, body: object) {
  const raw = JSON.stringify(body);
  const sig = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return new Request('http://x/hook', { method: 'POST', body: raw, headers: { 'x-github-event': event, 'x-hub-signature-256': sig } });
}

describe('GitGotchi App webhook (accounts R4, R9)', () => {
  const SECRET = 'app-secret';
  beforeEach(() => vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', SECRET));

  it('rejects a bad signature without touching any pet', async () => {
    const req = new Request('http://x/hook', { method: 'POST', body: '{}', headers: { 'x-github-event': 'push', 'x-hub-signature-256': 'sha256=00' } });
    expect((await appWebhook(req)).status).toBe(401);
  });

  it('a private push is stored encrypted, without commit messages or emails, and the answer carries no pet', async () => {
    const res = await appWebhook(
      signed(SECRET, 'push', {
        repository: { full_name: 'Acme/Secret', id: 9, private: true },
        installation: { id: 1 },
        commits: [{ message: 'fix: leak SECRET_MESSAGE', author: { email: 'kim@acme.example' } }],
      })
    );
    expect(await res.json()).toEqual({ success: true, eventType: 'push', applied: 'push' });
    const raw = (await kvGet('gitgotchi:pet:acme/secret'))!;
    expect(raw).toMatch(/^\{"enc":/);
    const entry = (await getEntry('acme/secret'))!;
    expect(entry.visibility).toBe('private');
    expect(JSON.stringify(entry)).not.toMatch(/SECRET_MESSAGE|kim@acme/);
  });

  it('uninstalling, or removing a repo from the installation, deletes its private pet', async () => {
    for (const name of ['a', 'b']) {
      await appWebhook(signed(SECRET, 'push', { repository: { full_name: `acme/${name}`, private: true }, commits: [{}] }));
    }
    await appWebhook(signed(SECRET, 'installation_repositories', { repositories_removed: [{ full_name: 'acme/a', private: true }] }));
    expect(await getEntry('acme/a')).toBeUndefined();
    expect(await getEntry('acme/b')).toBeDefined();
    await appWebhook(signed(SECRET, 'installation', { action: 'deleted', repositories: [{ full_name: 'acme/b', private: true }] }));
    expect(await getEntry('acme/b')).toBeUndefined();
  });

  it('a rename moves the pet; privatized seals it', async () => {
    await appWebhook(signed(SECRET, 'push', { repository: { full_name: 'acme/old', private: false }, commits: [{}] }));
    await appWebhook(
      signed(SECRET, 'repository', { action: 'renamed', repository: { full_name: 'acme/new', owner: { login: 'acme' } }, changes: { repository: { name: { from: 'old' } } } })
    );
    expect(await getEntry('acme/old')).toBeUndefined();
    expect((await getEntry('acme/new'))?.pet.repoName).toBe('acme/new');
    await appWebhook(signed(SECRET, 'repository', { action: 'privatized', repository: { full_name: 'acme/new' } }));
    expect(await kvGet('gitgotchi:pet:acme/new')).toMatch(/^\{"enc":/);
  });

  it('the manual webhook also keeps private pets out of its answer', async () => {
    const res = await legacyWebhook(signed('ignored', 'push', { repository: { full_name: 'acme/p', private: true }, commits: [{}] }));
    expect((await res.json()).petState).toBeNull();
    expect(await kvGet('gitgotchi:pet:acme/p')).toMatch(/^\{"enc":/);
  });
});

describe('personal demo pets (accounts R7)', () => {
  it('two browsers keep separate demo pets; RESET DEMO restores the fixture', () => {
    const a = memoryStorage();
    const b = memoryStorage();
    actOnDemo('demo/healthy', 'simulate', { type: 'ci', success: false }, NOW, a);
    actOnDemo('demo/healthy', 'simulate', { type: 'ci', success: false }, NOW, a);
    expect(demoResponse('demo/healthy', NOW, a)!.pet.hp).toBeLessThan(demoResponse('demo/healthy', NOW, b)!.pet.hp);
    expect(demoResponse('demo/healthy', NOW, b)!.pet.stage).toBe('CODE_DEMON');
    actOnDemo('demo/healthy', 'sync', undefined, NOW, a);
    expect(demoResponse('demo/healthy', NOW, a)!.pet.hp).toBe(demoResponse('demo/healthy', NOW, b)!.pet.hp);
  });

  it('a junk or foreign saved value starts over from the fixture; unknown demos are null', () => {
    const s = memoryStorage();
    s.setItem('gitgotchi:demo:demo/haunted', '{oops');
    expect(loadDemo('demo/haunted', NOW, s)?.pet.stage).toBe('ZOMBIE_CORPSE');
    s.setItem('gitgotchi:demo:demo/haunted', JSON.stringify(loadDemo('demo/healthy', NOW, s)));
    expect(loadDemo('demo/haunted', NOW, s)?.pet.repoName).toBe('demo/haunted');
    expect(loadDemo('demo/nope', NOW, s)).toBeNull();
  });

  it('a stored demo entry is ignored by the server badge too', async () => {
    await setEntry('demo/healthy', { ...loadDemo('demo/haunted', NOW, memoryStorage())!, pet: { ...loadDemo('demo/haunted', NOW, memoryStorage())!.pet, repoName: 'demo/healthy' } });
    expect((await getPet('demo/healthy', NOW)).pet.stage).toBe('CODE_DEMON');
  });
});

describe('ADD TO README target (no writes, accounts R3.3)', () => {
  const call = async (isPrivate: boolean, readme = true) => {
    const { GET } = await import('@/app/api/pet/[owner]/[repo]/readme/route');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string | URL | Request) =>
        String(u).endsWith('/readme')
          ? readme
            ? Response.json({ path: 'docs/README.md' })
            : new Response('{}', { status: 404 })
          : Response.json({ full_name: 'Acme/Rocket', default_branch: 'trunk', private: isPrivate })
      )
    );
    return GET(new Request('http://x/api/pet/acme/rocket/readme'), { params: Promise.resolve({ owner: 'acme', repo: 'rocket' }) });
  };

  it('gives the branch and README path of a public repo', async () => {
    expect(await (await call(false)).json()).toEqual({ fullName: 'Acme/Rocket', branch: 'trunk', path: 'docs/README.md' });
    expect((await (await call(false, false)).json()).path).toBeNull();
  });

  it('answers 404 for a private repo to someone outside it', async () => {
    const res = await call(true);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('trunk');
  });
});

describe('no probing for private repos (accounts R3.3)', () => {
  const feed = async (repo: string) => {
    vi.stubEnv('APP_ORIGIN', 'https://g.example');
    const res = await actionRoute(
      new Request(`https://g.example/api/pet/acme/${repo}/action`, { method: 'POST', headers: { origin: 'https://g.example' }, body: JSON.stringify({ action: 'feed' }) }),
      { params: Promise.resolve({ owner: 'acme', repo }) }
    );
    return { status: res.status, body: await res.text() };
  };

  it('an outsider gets the same answer for a missing repo and a private one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const missing = await feed('nope');
    fakeGitHub({ private: true });
    await getPet('acme/rocket', NOW, KEEPER);
    const hidden = await feed('rocket');
    expect(hidden).toEqual(missing);
    expect(missing.status).toBe(404);
  });
});

describe('one CI run counts once (github-sync R4.3)', () => {
  beforeEach(() => vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'app-secret'));
  it('a GitHub Actions run arrives as workflow_run and check_run but adds +15 HP once', async () => {
    const repository = { full_name: 'acme/ci', private: false };
    await appWebhook(signed('app-secret', 'push', { repository, commits: [{}] }));
    const hp0 = (await getEntry('acme/ci'))!.pet.hp;
    await appWebhook(signed('app-secret', 'workflow_run', { repository, action: 'completed', workflow_run: { conclusion: 'failure' } }));
    await appWebhook(signed('app-secret', 'check_run', { repository, action: 'completed', check_run: { conclusion: 'failure', app: { slug: 'github-actions' } } }));
    const after = (await getEntry('acme/ci'))!;
    expect(after.pet.hp).toBe(Math.max(0, hp0 - 25));
    expect(after.pet.recentCi).toEqual(['failure']);
    // Another app's check (e.g. an external CI) still counts.
    await appWebhook(signed('app-secret', 'check_run', { repository, action: 'completed', check_run: { conclusion: 'success', app: { slug: 'circleci-checks' } } }));
    expect((await getEntry('acme/ci'))!.pet.recentCi).toEqual(['failure', 'success']);
  });
});
