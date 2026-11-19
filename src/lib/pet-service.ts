import { ANON, accessOf, type PetCtx } from './access';
import { isDemoKey } from './demo-fixtures';
import { RateLimitError, RepoNotFoundError, fetchRepoSnapshot } from './github';
import { actOnEntry, respond, seedDemoEntry, systemEvent, type PetActionRequest } from './pet-logic';
import { StoreError, getEntry, isPrivate, setEntry, type PetEntry, type Visibility } from './pet-store';
import { applyEvent, createPet, isDead, replayWebhookEvents, seedFromSnapshot } from './state-machine';
import type { PetEvent, PetResponse, PetState, RepoSnapshot, SimulatedEvent } from './types';

export { PET_ACTIONS, parseSimulatedEvent, type PetActionRequest } from './pet-logic';

const SNAPSHOT_TTL = 5 * 60_000;
const ERROR_BACKOFF = 15_000;

export interface ActResult {
  status: 200 | 403 | 409;
  response: PetResponse;
}

/** A requester who is not allowed to act on this pet (accounts R2.2). */
export class ForbiddenError extends Error {
  constructor(message = 'keepers only') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// Failed GitHub calls are not retried until `until`, so a rate limit is not hammered.
const backoff = new Map<string, { until: number; error: unknown }>();

/** Demo pets are never stored on the server (accounts R7.1): every call starts from the fixture. */
function demoEntry(key: string, now: number) {
  const entry = seedDemoEntry(key, now);
  if (!entry) throw new RepoNotFoundError(key);
  return entry;
}

const withAccess = (res: PetResponse, ctx: PetCtx, entry: PetEntry | undefined): PetResponse => ({
  ...res,
  access: accessOf(ctx, entry),
});

/** Private entries answer as if they did not exist for anyone outside the repo (accounts R3.3). */
function guard(entry: PetEntry | undefined, ctx: PetCtx, key: string): void {
  if (isPrivate(entry) && !ctx.canSeePrivate) throw new RepoNotFoundError(key);
}

function onGitHubError(key: string, now: number, prior: PetEntry | undefined, e: unknown, ctx: PetCtx): PetResponse {
  // A 404 is never papered over with a cached pet: the repo is gone, renamed or no longer visible.
  if (e instanceof RepoNotFoundError) throw e;
  if (!prior && e instanceof RateLimitError) throw e;
  const message = e instanceof Error ? e.message : 'GitHub unavailable';
  if (prior) return withAccess(respond({ ...prior, source: 'fallback' }, now, message), ctx, prior);
  const pet: PetState = createPet(key, now);
  return withAccess({ pet, events: [], source: 'fallback', fetchedAt: new Date(now).toISOString(), error: message }, ctx, prior);
}

/** An entry the webhook created before any snapshot was read. */
const isPlaceholder = (e: PetEntry) => e.snapshotAt === 0 && e.source === 'github';

async function refresh(key: string, now: number, prior: PetEntry | undefined, ctx: PetCtx): Promise<PetResponse> {
  const hold = backoff.get(key);
  if (hold && now < hold.until) return onGitHubError(key, now, prior, hold.error, ctx);

  const [owner, repo] = key.split('/');
  let snap: RepoSnapshot;
  try {
    snap = await fetchRepoSnapshot(owner, repo, ctx.auth);
  } catch (e) {
    const until = e instanceof RateLimitError && e.resetAt ? e.resetAt : now + ERROR_BACKOFF;
    if (!(e instanceof RepoNotFoundError)) backoff.set(key, { until, error: e });
    return onGitHubError(key, now, prior, e, ctx);
  }
  // The write stays outside the try so a store failure is not mistaken for a GitHub one.
  backoff.delete(key);
  const visibility: Visibility = snap.private ? 'private' : 'public';
  if (visibility === 'private' && !ctx.canSeePrivate) throw new RepoNotFoundError(key);

  const seeded = seedFromSnapshot(snap, now);
  // Poop and resurrections only exist here, so a resync keeps them.
  // A push newer than the last revival is activity after it, even when no webhook reported it (R6.8).
  const pushedAt = snap.pushedAt ? Date.parse(snap.pushedAt) : 0;
  const revivedAt = prior?.pet.revivedAt ?? null;
  const carried = prior
    ? createPet(seeded.repoName, now, {
        ...seeded,
        poopCount: prior.pet.poopCount,
        resurrections: prior.pet.resurrections,
        revivedAt,
        activitySinceRevival: !!prior.pet.activitySinceRevival || (revivedAt !== null && pushedAt > revivedAt),
      })
    : seeded;
  // Webhooks that landed before any snapshot are replayed once; the entry written below has a real
  // snapshotAt, so it is never a placeholder again.
  let pet = prior && isPlaceholder(prior) ? replayWebhookEvents(carried, prior.events, now) : carried;

  // A dead pet whose repo showed life since (a push, or a green run) climbs out of the grave even when no
  // webhook reported it: the resurrection is counted and logged like a webhook one (pet-engine R6).
  const revived = prior && !isPlaceholder(prior) ? revivalEvent(prior.pet, pet, snap, now) : null;
  if (revived) {
    // The stats stay what GitHub says; the stage waits as a rising ghost (R6.6).
    pet = createPet(pet.repoName, now, {
      ...pet,
      resurrections: prior!.pet.resurrections + 1,
      diedAt: null,
      revivedAt: now,
      activitySinceRevival: false,
    });
  }

  const entry = await setEntry(key, {
    ...prior,
    pet,
    events: [systemEvent(now, 'SYNCED WITH GITHUB', 'github'), ...(revived ? [revived] : []), ...(prior?.events ?? [])],
    snapshotAt: now,
    source: 'github',
    visibility,
    ...(snap.repoId ? { repoId: snap.repoId } : {}),
  });
  return withAccess(respond(entry, now), ctx, entry);
}

/** The resurrection event for a pet that was dead and is alive after a resync, or null. */
function revivalEvent(before: PetState, after: PetState, snap: RepoSnapshot, now: number): PetEvent | null {
  if (!isDead(before) || isDead(after)) return null;
  const pushedAt = snap.pushedAt ? Date.parse(snap.pushedAt) : 0;
  const trigger: SimulatedEvent | null =
    pushedAt > (before.lastPushAt ?? 0)
      ? { type: 'push', commits: Math.max(1, snap.commitsTotal - before.commitsTotal) }
      : snap.recentRuns.at(-1) === 'success' && before.recentCi.at(-1) !== 'success'
        ? { type: 'ci', success: true }
        : null;
  if (!trigger) return null;
  // The engine writes the same label as a webhook would, e.g. "PUSH → RESURRECTED!".
  return applyEvent(before, trigger, now, { source: 'github' }).event;
}

/** `force` refetches a real repo; a demo always answers its fixture. */
export async function getPet(key: string, now: number, ctx: PetCtx = ANON, force = false): Promise<PetResponse> {
  if (isDemoKey(key)) return respond(demoEntry(key, now), now);
  const entry = await getEntry(key);
  guard(entry, ctx, key);
  if (entry && !force && now - entry.snapshotAt < SNAPSHOT_TTL) return withAccess(respond(entry, now), ctx, entry);
  return refresh(key, now, entry, ctx);
}

/**
 * Apply a GitHub webhook event. A repo never seen before gets a placeholder (snapshotAt 0); the next
 * getPet seeds it from a real snapshot and replays the logged PR and issue events onto it.
 * `meta.visibility` comes from the webhook payload, so a private repo's entry is encrypted from the start.
 */
export async function ingestEvent(
  key: string,
  ev: SimulatedEvent,
  now: number,
  meta: { visibility?: Visibility; repoId?: number } = {}
): Promise<PetResponse> {
  const entry: PetEntry = (await getEntry(key)) ?? {
    pet: createPet(key, now),
    events: [],
    snapshotAt: 0,
    source: 'github',
  };
  const { state, event } = applyEvent(entry.pet, ev, now, { source: 'github' });
  const next = await setEntry(key, {
    ...entry,
    ...(meta.visibility ? { visibility: meta.visibility } : {}),
    ...(meta.repoId ? { repoId: meta.repoId } : {}),
    pet: state,
    events: [event, ...entry.events],
  });
  return respond(next, now);
}

export async function act(
  key: string,
  action: PetActionRequest,
  payload: { event?: SimulatedEvent },
  now: number,
  ctx: PetCtx = ANON
): Promise<ActResult> {
  // Demo actions are stateless on the server: browsers keep their own demo pets (accounts R7).
  if (isDemoKey(key)) {
    const base = demoEntry(key, now);
    if (action === 'sync') return { status: 200, response: respond(base, now) };
    const r = actOnEntry(base, action, payload, now, true);
    return { status: r.status, response: r.response };
  }

  const stored = await getEntry(key);
  guard(stored, ctx, key);
  if (ctx.role !== 'keeper') {
    // Resolve the repo first, so a missing repo and a hidden private one both answer 404 and only a visible
    // pet answers 403 (accounts R3.3: no way to probe for private repos).
    if (!stored) await getPet(key, now, ctx);
    throw new ForbiddenError();
  }

  if (action === 'sync') return { status: 200, response: await getPet(key, now, ctx, true) };

  const current = await getPet(key, now, ctx);
  const entry: PetEntry =
    (await getEntry(key)) ??
    (await setEntry(key, { pet: current.pet, events: [], snapshotAt: 0, source: 'fallback' }));

  const r = actOnEntry(entry, action, payload, now, process.env.NODE_ENV !== 'production');
  if (r.changed) await setEntry(key, r.entry);
  return { status: r.status, response: withAccess(r.response, ctx, r.entry) };
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Headers for a pet answer: private pets are never cached or indexed (accounts R9.5). */
export function petHeaders(res: PetResponse | undefined): Record<string, string> {
  return res?.access?.visibility === 'private'
    ? { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }
    : NO_STORE;
}

/** Maps errors thrown by getPet/act to the HTTP contract. */
export function petErrorResponse(e: unknown): Response {
  const headers = NO_STORE;
  if (e instanceof StoreError) return Response.json({ error: 'store unavailable' }, { status: 503, headers });
  if (e instanceof RepoNotFoundError) return Response.json({ error: 'repo not found' }, { status: 404, headers });
  if (e instanceof ForbiddenError) return Response.json({ error: e.message }, { status: 403, headers });
  if (e instanceof RateLimitError) {
    const secs = e.resetAt ? Math.max(1, Math.ceil((e.resetAt - Date.now()) / 1000)) : 60;
    return Response.json(
      { error: 'github rate limit reached' },
      { status: 503, headers: { ...headers, 'Retry-After': String(secs) } }
    );
  }
  return Response.json({ error: 'internal error' }, { status: 500, headers });
}
