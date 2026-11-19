import { githubRequest } from '@/lib/github';
import { installUrl } from '@/lib/github-app';
import { getEntry, normalizeRepoKey } from '@/lib/pet-store';
import { freshToken, getSession } from '@/lib/session';
import { tick } from '@/lib/state-machine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
// Each listed pet costs one store read; the Upstash free plan is the budget.
const MAX_PETS = 30;

interface RepoJson {
  full_name: string;
  private: boolean;
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; pull?: boolean };
}

/** Installed repos the signed-in user can access, with their pets (accounts R8). */
export async function GET(req: Request) {
  const found = await getSession(req).catch(() => null);
  // Signed out is a normal state of this page, not an error (no 401 noise in the browser console).
  if (!found) return Response.json({ signedIn: false }, { headers: HEADERS });
  const token = await freshToken(found.sid, found.session).catch(() => null);
  if (!token) return Response.json({ signedIn: false }, { headers: HEADERS });

  const inst = await githubRequest('/user/installations?per_page=100', token).catch(() => null);
  if (!inst?.ok) return Response.json({ error: 'GitHub did not answer' }, { status: 502, headers: HEADERS });
  const { installations = [] } = (await inst.json()) as { installations?: { id: number }[] };

  const repos: RepoJson[] = [];
  for (const i of installations.slice(0, 10)) {
    const r = await githubRequest(`/user/installations/${i.id}/repositories?per_page=100`, token).catch(() => null);
    if (r?.ok) repos.push(...(((await r.json()) as { repositories?: RepoJson[] }).repositories ?? []));
    if (repos.length >= MAX_PETS) break;
  }

  const now = Date.now();
  const pets = await Promise.all(
    repos.slice(0, MAX_PETS).map(async (r) => {
      const [owner, name] = r.full_name.split('/');
      const key = normalizeRepoKey(owner, name);
      const p = r.permissions ?? {};
      const entry = await getEntry(key).catch(() => undefined);
      const pet = entry ? tick(entry.pet, now) : null;
      return {
        key,
        role: p.admin || p.maintain || p.push ? 'keeper' : 'reader',
        visibility: r.private ? 'private' : 'public',
        stage: pet?.stage ?? null,
        hp: pet?.hp ?? null,
        // No CI results: the HP is a placeholder, shown as "?" (pet-engine R8.1).
        noCi: pet ? pet.recentCi.length === 0 : false,
      };
    })
  );
  return Response.json({ signedIn: true, login: found.session.login, installUrl: installUrl(), pets }, { headers: HEADERS });
}
