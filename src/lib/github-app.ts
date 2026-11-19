import { createSign } from 'node:crypto';
import { githubRequest } from './github';

/** The GitGotchi App credentials; null when the deployment has not registered an app yet. */
export function appConfig() {
  const e = process.env;
  if (!e.GITHUB_APP_ID || !e.GITHUB_APP_PRIVATE_KEY || !e.GITHUB_APP_CLIENT_ID || !e.GITHUB_APP_CLIENT_SECRET) return null;
  return {
    appId: e.GITHUB_APP_ID,
    // Vercel keeps newlines, but a key pasted as one line with literal \n is accepted too.
    privateKey: e.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientId: e.GITHUB_APP_CLIENT_ID,
    clientSecret: e.GITHUB_APP_CLIENT_SECRET,
    slug: e.GITHUB_APP_SLUG ?? '',
  };
}

export const installUrl = () => {
  const slug = process.env.GITHUB_APP_SLUG;
  return slug ? `https://github.com/apps/${slug}/installations/new` : null;
};

const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** RS256 app JWT, valid 9 minutes, issued 60 s in the past against clock drift. */
export function appJwt(now = Date.now()): string {
  const cfg = appConfig();
  if (!cfg) throw new Error('github app not configured');
  const iat = Math.floor(now / 1000) - 60;
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ iat, exp: iat + 540, iss: cfg.appId }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(cfg.privateKey);
  return `${head}.${body}.${b64(sig)}`;
}

// Installation tokens live in function memory only (accounts R9 design table) and are refreshed 10 minutes early.
const g = globalThis as unknown as { __ggInstallTokens?: Map<number, { token: string; expiresAt: number }> };
const tokens = (g.__ggInstallTokens ??= new Map());

export async function installationToken(installationId: number, now = Date.now()): Promise<string> {
  const hit = tokens.get(installationId);
  if (hit && hit.expiresAt - 10 * 60_000 > now) return hit.token;
  const res = await githubRequest(`/app/installations/${installationId}/access_tokens`, appJwt(now), { method: 'POST' });
  if (!res.ok) throw new Error(`installation token failed: ${res.status}`);
  const body = (await res.json()) as { token: string; expires_at: string };
  tokens.set(installationId, { token: body.token, expiresAt: Date.parse(body.expires_at) });
  return body.token;
}

/** Installation id for a repo, or null when the app is not installed there (or not configured). */
export async function repoInstallation(key: string): Promise<number | null> {
  if (!appConfig()) return null;
  const res = await githubRequest(`/repos/${key}/installation`, appJwt());
  if (!res.ok) return null;
  const body = (await res.json()) as { id?: number };
  return typeof body.id === 'number' ? body.id : null;
}

/** Installation token for a repo, or null when the app is not installed there. */
export async function repoToken(key: string): Promise<string | null> {
  const id = await repoInstallation(key).catch(() => null);
  return id === null ? null : installationToken(id);
}
