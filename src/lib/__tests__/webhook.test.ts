import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/webhook/github/route';
import { getEntry, setEntry } from '../pet-store';
import { createPet } from '../state-machine';

const NOW = Date.now();
let n = 0;
const nextRepo = () => `test${n++}/webhook-repo`;

function seed(repo: string, overrides = {}) {
  setEntry(repo, { pet: createPet(repo, NOW, overrides), events: [], snapshotAt: NOW, source: 'github' });
}

function hook(event: string, body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request('http://localhost/api/webhook/github', {
      method: 'POST',
      headers: { 'x-github-event': event, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
}

const sign = (secret: string, raw: string) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

afterEach(() => vi.unstubAllEnvs());

describe('webhook signature', () => {
  it('accepts a valid signature and rejects a wrong or missing one', async () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', 's3cret');
    const repo = nextRepo();
    seed(repo, { fullness: 40 });
    const raw = JSON.stringify({ repository: { full_name: repo }, commits: [{}] });

    const ok = await hook('push', raw, { 'x-hub-signature-256': sign('s3cret', raw) });
    expect(ok.status).toBe(200);

    const bad = await hook('push', raw, { 'x-hub-signature-256': sign('other', raw) });
    expect(bad.status).toBe(401);

    const missing = await hook('push', raw);
    expect(missing.status).toBe(401);

    const short = await hook('push', raw, { 'x-hub-signature-256': 'sha256=abc' });
    expect(short.status).toBe(401);
  });

  it('skips verification when no secret is configured', async () => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', '');
    expect((await hook('ping', {})).status).toBe(200);
  });
});

describe('webhook routing', () => {
  it('ping answers {ok:true}', async () => {
    expect(await (await hook('ping', {})).json()).toEqual({ ok: true });
  });

  it('push feeds only the repo named in the payload', async () => {
    const a = nextRepo();
    const b = nextRepo();
    seed(a, { fullness: 40 });
    seed(b, { fullness: 40 });

    const res = await hook('push', { repository: { full_name: a.toUpperCase() }, commits: [{}, {}] });
    const body = await res.json();

    expect(body).toMatchObject({ success: true, eventType: 'push', repo: a });
    expect(body.petState.fullness).toBe(50);
    expect(getEntry(a)!.pet.fullness).toBe(50);
    expect(getEntry(b)!.pet.fullness).toBe(40);
  });

  it('ignores a check_run that is not completed', async () => {
    const repo = nextRepo();
    seed(repo);
    const res = await hook('check_run', {
      action: 'created',
      repository: { full_name: repo },
      check_run: { status: 'in_progress', conclusion: null },
    });
    expect((await res.json()).ignored).toBe(true);
    expect(getEntry(repo)!.pet.hp).toBe(100);
    expect(getEntry(repo)!.events).toHaveLength(0);
  });

  it('ignores a completed run that is neither success nor failure', async () => {
    const repo = nextRepo();
    seed(repo);
    await hook('workflow_run', {
      action: 'completed',
      repository: { full_name: repo },
      workflow_run: { conclusion: 'cancelled' },
    });
    expect(getEntry(repo)!.pet.hp).toBe(100);
  });

  it('a failed check_run costs 25 HP', async () => {
    const repo = nextRepo();
    seed(repo);
    const res = await hook('check_run', {
      action: 'completed',
      repository: { full_name: repo },
      check_run: { conclusion: 'failure' },
    });
    expect((await res.json()).petState.hp).toBe(75);
    expect(getEntry(repo)!.pet.recentCi).toEqual(['failure']);
  });

  it('a merged PR throws a party, an unmerged close does nothing', async () => {
    const repo = nextRepo();
    seed(repo, { hp: 50 });
    await hook('pull_request', { action: 'closed', repository: { full_name: repo }, pull_request: { merged: false } });
    expect(getEntry(repo)!.pet.hp).toBe(50);
    await hook('pull_request', { action: 'closed', repository: { full_name: repo }, pull_request: { merged: true } });
    expect(getEntry(repo)!.pet.hp).toBe(60);
    expect(getEntry(repo)!.pet.mood).toBe('PARTY');
  });

  it('an issue closed revives a dead pet', async () => {
    const repo = nextRepo();
    seed(repo, { hp: 0 });
    expect(getEntry(repo)!.pet.stage).toBe('ZOMBIE_CORPSE');

    const res = await hook('issues', { action: 'closed', repository: { full_name: repo } });
    const { petState } = await res.json();

    expect(petState.stage).not.toBe('ZOMBIE_CORPSE');
    expect(petState.resurrections).toBe(1);
    expect(getEntry(repo)!.events[0].type).toBe('revive');
  });

  it('400 on a missing repository, bad JSON or missing event header', async () => {
    expect((await hook('push', { commits: [{}] })).status).toBe(400);
    expect((await hook('push', 'not json')).status).toBe(400);
    const noHeader = await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }));
    expect(noHeader.status).toBe(400);
  });
});
