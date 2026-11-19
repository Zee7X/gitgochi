import { RateLimitError, RepoNotFoundError, fetchRepoSnapshot } from './github';
import { StoreError, getEntry, setEntry, type PetEntry } from './pet-store';
import { applyAction, applyEvent, createPet, seedFromSnapshot, tick } from './state-machine';
import type { PetEvent, PetResponse, PetState, RepoSnapshot, SimulatedEvent } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SNAPSHOT_TTL = 5 * 60_000;
const FEED_LIMIT_PER_HOUR = 3;
const ERROR_BACKOFF = 15_000;

export const PET_ACTIONS = ['feed', 'clean', 'revive', 'sync', 'simulate'] as const;
export type PetActionRequest = (typeof PET_ACTIONS)[number];

export interface ActResult {
  status: 200 | 403 | 409;
  response: PetResponse;
}

// Demo fixtures are relative to `now`, so the same call always yields the same pet.
const DEMOS: Record<string, (now: number) => RepoSnapshot> = {
  healthy: (now) => ({
    fullName: 'demo/healthy',
    createdAt: new Date(now - 200 * DAY).toISOString(),
    pushedAt: new Date(now - 2 * HOUR).toISOString(),
    commitsTotal: 240,
    openIssues: 3,
    staleIssues: 0,
    recentRuns: ['success', 'success', 'success', 'success', 'success'],
    defaultBranch: 'main',
  }),
  neglected: (now) => ({
    fullName: 'demo/neglected',
    createdAt: new Date(now - 300 * DAY).toISOString(),
    pushedAt: new Date(now - 80 * HOUR).toISOString(),
    commitsTotal: 61,
    openIssues: 14,
    staleIssues: 6,
    recentRuns: ['success', 'success', 'failure', 'failure', 'failure'],
    defaultBranch: 'main',
  }),
  haunted: (now) => ({
    fullName: 'demo/haunted',
    createdAt: new Date(now - 500 * DAY).toISOString(),
    pushedAt: new Date(now - 9 * DAY).toISOString(),
    commitsTotal: 118,
    openIssues: 31,
    staleIssues: 12,
    recentRuns: ['success', 'failure', 'failure', 'failure', 'failure', 'failure'],
    defaultBranch: 'main',
  }),
};

// Failed GitHub calls are not retried until `until`, so a rate limit is not hammered.
const backoff = new Map<string, { until: number; error: unknown }>();

let seq = 0;
function systemEvent(now: number, label: string, source: PetEvent['source'], simulated = false): PetEvent {
  return {
    id: `${now.toString(36)}-sync-${(seq++).toString(36)}`,
    at: now,
    type: 'sync',
    label,
    deltas: {},
    source,
    ...(simulated ? { simulated: true } : {}),
  };
}

function respond(entry: PetEntry, now: number, error?: string): PetResponse {
  return {
    pet: tick(entry.pet, now),
    events: entry.events,
    source: entry.source,
    fetchedAt: new Date(entry.snapshotAt).toISOString(),
    ...(error ? { error } : {}),
  };
}

function withMessage(res: PetResponse, statusMessage: string): PetResponse {
  return { ...res, pet: { ...res.pet, statusMessage } };
}

function seedDemo(key: string, now: number): Promise<PetEntry> {
  const fixture = DEMOS[key.slice('demo/'.length)];
  if (!fixture) throw new RepoNotFoundError(key);
  return setEntry(key, {
    pet: seedFromSnapshot(fixture(now), now),
    events: [systemEvent(now, 'DEMO FIXTURE LOADED', 'system', true)],
    snapshotAt: now,
    source: 'demo',
  });
}

function onGitHubError(key: string, now: number, prior: PetEntry | undefined, e: unknown): PetResponse {
  if (!prior && (e instanceof RepoNotFoundError || e instanceof RateLimitError)) throw e;
  const message = e instanceof Error ? e.message : 'GitHub unavailable';
  if (prior) return respond({ ...prior, source: 'fallback' }, now, message);
  const pet: PetState = createPet(key, now);
  return { pet, events: [], source: 'fallback', fetchedAt: new Date(now).toISOString(), error: message };
}

async function refresh(key: string, now: number, prior: PetEntry | undefined): Promise<PetResponse> {
  const hold = backoff.get(key);
  if (hold && now < hold.until) return onGitHubError(key, now, prior, hold.error);

  const [owner, repo] = key.split('/');
  let snap: RepoSnapshot;
  try {
    snap = await fetchRepoSnapshot(owner, repo);
  } catch (e) {
    const until = e instanceof RateLimitError && e.resetAt ? e.resetAt : now + ERROR_BACKOFF;
    if (!(e instanceof RepoNotFoundError)) backoff.set(key, { until, error: e });
    return onGitHubError(key, now, prior, e);
  }
  // The write stays outside the try so a store failure is not mistaken for a GitHub one.
  backoff.delete(key);
  const seeded = seedFromSnapshot(snap, now);
  // Poop and resurrections only exist here, so a resync keeps them.
  const pet = prior
    ? createPet(seeded.repoName, now, {
        ...seeded,
        poopCount: prior.pet.poopCount,
        resurrections: prior.pet.resurrections,
      })
    : seeded;
  const entry = await setEntry(key, {
    pet,
    events: [systemEvent(now, 'SYNCED WITH GITHUB', 'github'), ...(prior?.events ?? [])],
    snapshotAt: now,
    source: 'github',
  });
  return respond(entry, now);
}

/** `force` refetches a real repo and resets a demo to its fixture. */
export async function getPet(key: string, now: number, force = false): Promise<PetResponse> {
  const entry = await getEntry(key);
  if (key.startsWith('demo/')) return respond(force || !entry ? await seedDemo(key, now) : entry, now);
  if (entry && !force && now - entry.snapshotAt < SNAPSHOT_TTL) return respond(entry, now);
  return refresh(key, now, entry);
}

/** Apply a GitHub webhook event. A repo never seen before gets a placeholder that the next getPet replaces with a real snapshot. */
export async function ingestEvent(key: string, ev: SimulatedEvent, now: number): Promise<PetResponse> {
  const entry: PetEntry = (await getEntry(key)) ?? {
    pet: createPet(key, now),
    events: [],
    snapshotAt: 0,
    source: 'github',
  };
  const { state, event } = applyEvent(entry.pet, ev, now, { source: 'github' });
  return respond(await setEntry(key, { ...entry, pet: state, events: [event, ...entry.events] }), now);
}

export async function act(
  key: string,
  action: PetActionRequest,
  payload: { event?: SimulatedEvent },
  now: number
): Promise<ActResult> {
  if (action === 'sync') return { status: 200, response: await getPet(key, now, true) };

  if (action === 'simulate' && !key.startsWith('demo/') && process.env.NODE_ENV === 'production') {
    const stored = await getEntry(key);
    const response: PetResponse = stored
      ? respond(stored, now)
      : { pet: createPet(key, now), events: [], source: 'fallback', fetchedAt: new Date(now).toISOString() };
    return { status: 403, response: { ...response, error: 'simulate is disabled in production' } };
  }

  const current = await getPet(key, now);
  const entry =
    (await getEntry(key)) ??
    (await setEntry(key, { pet: current.pet, events: [], snapshotAt: 0, source: 'fallback' }));

  if (action === 'simulate') {
    if (!payload.event) return { status: 403, response: { ...current, error: 'event required' } };
    const { state, event } = applyEvent(entry.pet, payload.event, now, { source: 'user', simulated: true });
    return commit(key, entry, state, event, now);
  }

  if (action === 'feed') {
    const recent = entry.events.filter((e) => e.type === 'feed' && e.source === 'user' && now - e.at < HOUR);
    if (recent.length >= FEED_LIMIT_PER_HOUR) {
      return { status: 200, response: withMessage(respond(entry, now), 'TOO FULL!') };
    }
  }

  const result = applyAction(entry.pet, action, now, { source: 'user' });
  if (result.error === 'REPO_STILL_BROKEN') {
    return { status: 409, response: withMessage(respond(entry, now), 'FIX CI FIRST') };
  }
  if (result.error === 'NOT_DEAD') {
    return { status: 409, response: withMessage(respond(entry, now), 'STILL ALIVE') };
  }
  if (result.error || !result.event) {
    return { status: 200, response: withMessage(respond(entry, now), 'PET IS DEAD...') };
  }
  return commit(key, entry, result.state, result.event, now);
}

async function commit(key: string, entry: PetEntry, state: PetState, event: PetEvent, now: number): Promise<ActResult> {
  const next = await setEntry(key, { ...entry, pet: state, events: [event, ...entry.events] });
  return { status: 200, response: respond(next, now) };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Hand-rolled check of a client-supplied event; null when it is not a valid SimulatedEvent. */
export function parseSimulatedEvent(v: unknown): SimulatedEvent | null {
  if (!isObj(v)) return null;
  switch (v.type) {
    case 'push':
      return typeof v.commits === 'number' && Number.isFinite(v.commits) && v.commits >= 0
        ? { type: 'push', commits: v.commits }
        : null;
    case 'ci':
      return typeof v.success === 'boolean' ? { type: 'ci', success: v.success } : null;
    case 'poop':
      return typeof v.reason === 'string' ? { type: 'poop', reason: v.reason.slice(0, 40) } : null;
    case 'pr_merged':
    case 'issue_opened':
    case 'issue_closed':
      return { type: v.type };
    default:
      return null;
  }
}

/** Maps errors thrown by getPet/act to the HTTP contract. */
export function petErrorResponse(e: unknown): Response {
  const headers = { 'Cache-Control': 'no-store' };
  if (e instanceof StoreError) return Response.json({ error: 'store unavailable' }, { status: 503, headers });
  if (e instanceof RepoNotFoundError) return Response.json({ error: 'repo not found' }, { status: 404, headers });
  if (e instanceof RateLimitError) {
    const secs = e.resetAt ? Math.max(1, Math.ceil((e.resetAt - Date.now()) / 1000)) : 60;
    return Response.json(
      { error: 'github rate limit reached' },
      { status: 503, headers: { ...headers, 'Retry-After': String(secs) } }
    );
  }
  return Response.json({ error: 'internal error' }, { status: 500, headers });
}
