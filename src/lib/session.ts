import { deriveKey, open, randomToken, seal, sha256 } from './crypto';
import { appConfig } from './github-app';
import { StoreError, kvDel, kvGet, kvSet } from './kv';
import type { Role } from './types';

export const SESSION_COOKIE = 'gg_session';
export const SESSION_TTL_S = 30 * 24 * 3600;
/** Role answers from GitHub are reused this long (accounts R2.1). */
export const ROLE_TTL_MS = 10 * 60_000;
const KEY_PREFIX = 'gitgotchi:session:';
const MAX_CACHED_ROLES = 40;
/** Sessions are kept in function memory this long, so polling does not read the store every time. */
const MEMORY_TTL_MS = 60_000;
const g = globalThis as unknown as { __ggSessions?: Map<string, { s: Session; at: number }> };
const memo = (g.__ggSessions ??= new Map());

export interface CachedRole {
  role: Role;
  visibility: 'public' | 'private';
  at: number;
}

export interface Session {
  userId: number;
  login: string;
  avatarUrl: string;
  token: string;
  tokenExpiresAt: number | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  roles: Record<string, CachedRole>;
  createdAt: number;
}

export interface TokenSet {
  token: string;
  tokenExpiresAt: number | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
}

function sessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new StoreError('session secret missing');
  return deriveKey(secret, 'session');
}

// The store key is a hash of the cookie value, so a copy of the store holds no usable session id.
const storeKey = (sid: string) => KEY_PREFIX + sha256(sid);

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionCookie(sid: string, maxAge = SESSION_TTL_S): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const clearSessionCookie = () => sessionCookie('', 0);

export async function loadSession(sid: string, now = Date.now()): Promise<Session | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(sid)) return null;
  const hit = memo.get(sid);
  if (hit && now - hit.at < MEMORY_TTL_MS) return structuredClone(hit.s);
  const raw = await kvGet(storeKey(sid));
  if (!raw) return null;
  const plain = open(raw, sessionKey());
  if (!plain) return null;
  try {
    const s = JSON.parse(plain) as Session;
    memo.set(sid, { s, at: now });
    return structuredClone(s);
  } catch {
    return null;
  }
}

export async function saveSession(sid: string, s: Session): Promise<void> {
  // Keep only the newest role answers so the record stays small.
  const roles = Object.entries(s.roles)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_CACHED_ROLES);
  const next = { ...s, roles: Object.fromEntries(roles) };
  await kvSet(storeKey(sid), seal(JSON.stringify(next), sessionKey()), SESSION_TTL_S);
  memo.set(sid, { s: next, at: Date.now() });
}

export async function createSession(user: { id: number; login: string; avatar_url: string }, t: TokenSet, now = Date.now()) {
  const sid = randomToken(32);
  const session: Session = {
    userId: user.id,
    login: user.login,
    avatarUrl: user.avatar_url,
    ...t,
    roles: {},
    createdAt: now,
  };
  await saveSession(sid, session);
  return { sid, session };
}

/**
 * Revokes the user's GitHub token at GitHub (accounts R1.5), so a copy of it is useless after sign out.
 * Best effort: sign out still completes when GitHub does not answer.
 */
export async function revokeGitHubToken(token: string): Promise<boolean> {
  const cfg = appConfig();
  if (!cfg || !token) return false;
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await fetch(`https://api.github.com/applications/${cfg.clientId}/token`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/vnd.github+json', 'User-Agent': 'gitgotchi', 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token }),
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  }).catch(() => null);
  return res?.status === 204;
}

export async function deleteSession(sid: string): Promise<void> {
  memo.delete(sid);
  await kvDel(storeKey(sid));
}

/** The session behind the request cookie, or null. A broken or expired record counts as signed out. */
export async function getSession(req: Request): Promise<{ sid: string; session: Session } | null> {
  const sid = readCookie(req, SESSION_COOKIE);
  if (!sid) return null;
  const session = await loadSession(sid);
  return session ? { sid, session } : null;
}

// ---------- GitHub OAuth (GitHub App user authorization) ----------

interface TokenAnswer {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
}

async function tokenRequest(params: Record<string, string>, now: number): Promise<TokenSet | null> {
  const cfg = appConfig();
  if (!cfg) return null;
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as TokenAnswer;
  if (!body.access_token) return null;
  return {
    token: body.access_token,
    tokenExpiresAt: body.expires_in ? now + body.expires_in * 1000 : null,
    refreshToken: body.refresh_token ?? null,
    refreshExpiresAt: body.refresh_token_expires_in ? now + body.refresh_token_expires_in * 1000 : null,
  };
}

export const exchangeCode = (code: string, redirectUri: string, now = Date.now()) =>
  tokenRequest({ code, redirect_uri: redirectUri }, now);

/**
 * A usable user token for this session, refreshing it when it expires within 5 minutes (accounts R1.4).
 * Returns null when the refresh fails; the caller then ends the session.
 */
export async function freshToken(sid: string, s: Session, now = Date.now()): Promise<string | null> {
  if (s.tokenExpiresAt === null || s.tokenExpiresAt - 5 * 60_000 > now) return s.token;
  if (!s.refreshToken || (s.refreshExpiresAt !== null && s.refreshExpiresAt <= now)) return null;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken }, now);
  if (!t) return null;
  Object.assign(s, t);
  await saveSession(sid, s);
  return t.token;
}

// ---------- one-time ticket from the sign-in host to the app host ----------

const TICKET_PREFIX = 'gitgotchi:ticket:';
const TICKET_TTL_S = 60;

/** A single-use ticket for `sid`, valid 60 seconds. Only its hash is stored. */
export async function createTicket(sid: string): Promise<string> {
  const ticket = randomToken(32);
  await kvSet(TICKET_PREFIX + sha256(ticket), sid, TICKET_TTL_S);
  return ticket;
}

/** The session id behind a ticket, or null. A ticket works once. */
export async function redeemTicket(ticket: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(ticket)) return null;
  const key = TICKET_PREFIX + sha256(ticket);
  const sid = await kvGet(key);
  if (!sid) return null;
  await kvDel(key);
  return sid;
}
