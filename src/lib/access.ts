import { randomToken, safeEqual, sha256 } from './crypto';
import { PUBLIC_AUTH, githubRequest, type GitHubAuth } from './github';
import { repoToken } from './github-app';
import { getEntry, type PetEntry } from './pet-store';
import { ROLE_TTL_MS, freshToken, getSession, saveSession, type Session } from './session';
import type { PetAccess, Role } from './types';

/** Who is asking, and how the server may read GitHub for them. */
export interface PetCtx {
  role: Role;
  /** True for readers, keepers, a bound hook token or a valid badge key (accounts R3.3, R5.2). */
  canSeePrivate: boolean;
  signedIn: boolean;
  /** How to read a snapshot for this requester. */
  auth: GitHubAuth;
  /** Set when a signed-in user made the request. */
  login?: string;
}

export const ANON: PetCtx = { role: 'visitor', canSeePrivate: false, signedIn: false, auth: PUBLIC_AUTH };

export const accessOf = (ctx: PetCtx, entry: Pick<PetEntry, 'visibility'> | undefined): PetAccess => ({
  role: ctx.role,
  visibility: entry?.visibility ?? 'public',
  signedIn: ctx.signedIn,
});

// ---------- hook tokens: "ggh_<id>.<secret>" (accounts R6) ----------

export function newHookToken(): { id: string; token: string; hash: string } {
  const id = randomToken(6);
  const secret = randomToken(24);
  return { id, token: `ggh_${id}.${secret}`, hash: sha256(secret) };
}

function parseHookToken(bearer: string): { id: string; secret: string } | null {
  const m = /^ggh_([A-Za-z0-9_-]{8})\.([A-Za-z0-9_-]{32})$/.exec(bearer);
  return m ? { id: m[1], secret: m[2] } : null;
}

export const bearerOf = (req: Request) => (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

/** True when the request carries a hook token bound to this entry. */
export function hookTokenValid(bearer: string, entry: PetEntry | undefined): boolean {
  const t = parseHookToken(bearer);
  if (!t || !entry?.hookTokens?.length) return false;
  const rec = entry.hookTokens.find((h) => h.id === t.id);
  return !!rec && safeEqual(rec.hash, sha256(t.secret));
}

// ---------- roles from GitHub ----------

interface RepoPermissions {
  private?: boolean;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; pull?: boolean };
}

/** Role of the token's user on a repo, read with their own token. */
export async function roleFromGitHub(key: string, token: string): Promise<{ role: Role; visibility: 'public' | 'private' } | null> {
  const res = await githubRequest(`/repos/${key}`, token).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as RepoPermissions;
  const p = data.permissions ?? {};
  const visibility = data.private ? 'private' : 'public';
  if (p.admin || p.maintain || p.push) return { role: 'keeper', visibility };
  if (visibility === 'private' && p.pull) return { role: 'reader', visibility };
  return { role: 'visitor', visibility };
}

async function sessionRole(key: string, sid: string, s: Session, token: string, now: number) {
  const hit = s.roles[key];
  if (hit && now - hit.at < ROLE_TTL_MS) return hit;
  const answer = await roleFromGitHub(key, token);
  if (!answer) return null;
  s.roles[key] = { ...answer, at: now };
  await saveSession(sid, s);
  return s.roles[key];
}

/**
 * Resolves the requester for a real (non-demo) repo: a bound hook token, then the session, then anonymous.
 * Private pets are read with an installation token when the requester itself cannot read GitHub.
 */
export async function resolveCtx(req: Request, key: string, now = Date.now()): Promise<PetCtx> {
  const bearer = bearerOf(req);
  if (bearer.startsWith('ggh_')) {
    const entry = await getEntry(key);
    if (hookTokenValid(bearer, entry)) {
      const token = entry?.visibility === 'private' ? await repoToken(key).catch(() => null) : null;
      return { role: 'keeper', canSeePrivate: true, signedIn: false, auth: token ? { kind: 'token', token } : PUBLIC_AUTH };
    }
  }

  const found = await getSession(req);
  if (!found) return ANON;
  const { sid, session } = found;
  const token = await freshToken(sid, session, now).catch(() => null);
  if (!token) return ANON;
  const r = await sessionRole(key, sid, session, token, now);
  if (!r) return { ...ANON, signedIn: true, login: session.login };
  return {
    role: r.role,
    canSeePrivate: r.role !== 'visitor',
    signedIn: true,
    login: session.login,
    // A visitor's token cannot read a private repo; it still reads public ones with the user's own quota.
    auth: r.role !== 'visitor' || r.visibility === 'public' ? { kind: 'token', token } : PUBLIC_AUTH,
  };
}

/** Same-origin check for cookie-authenticated writes (accounts R2.3). Hook-token calls skip it. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
  return origin === expected;
}
