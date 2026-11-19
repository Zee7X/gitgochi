import { newHookToken, type PetCtx } from './access';
import { randomToken, safeEqual, sha256 } from './crypto';
import { RepoNotFoundError } from './github';
import { MAX_HOOK_TOKENS, deleteEntry, getEntry, setEntry, type PetEntry } from './pet-store';
import { ForbiddenError, getPet } from './pet-service';

export const SETTINGS_OPS = ['view', 'rotate-badge-key', 'create-hook-token', 'revoke-hook-token', 'delete-pet'] as const;
export type SettingsOp = (typeof SETTINGS_OPS)[number];

/** What a keeper sees. Secrets appear only in the answer that created them (accounts R5.3, R6.1). */
export interface SettingsView {
  visibility: 'public' | 'private';
  hasBadgeKey: boolean;
  hookTokens: { id: string; createdBy: string; createdAt: number }[];
  /** Present once, right after rotate-badge-key. */
  badgeKey?: string;
  /** Present once, right after create-hook-token. */
  hookToken?: string;
  deleted?: boolean;
}

function view(entry: PetEntry): SettingsView {
  return {
    visibility: entry.visibility ?? 'public',
    hasBadgeKey: !!entry.badgeKeyHash,
    hookTokens: (entry.hookTokens ?? []).map(({ id, createdBy, createdAt }) => ({ id, createdBy, createdAt })),
  };
}

/** Keeper-only settings. A missing pet is seeded first, so settings work on a pet nobody opened yet. */
export async function runSettings(key: string, op: SettingsOp, arg: { id?: string }, ctx: PetCtx, now = Date.now()): Promise<SettingsView> {
  if (key.startsWith('demo/')) throw new ForbiddenError('demo pets have no settings');
  // getPet applies the private-repo guard and seeds the entry.
  await getPet(key, now, ctx);
  if (ctx.role !== 'keeper') throw new ForbiddenError();
  const entry = await getEntry(key);
  if (!entry) throw new RepoNotFoundError(key);

  switch (op) {
    case 'view':
      return view(entry);
    case 'rotate-badge-key': {
      const badgeKey = randomToken(18);
      const next = await setEntry(key, { ...entry, badgeKeyHash: sha256(badgeKey) });
      return { ...view(next), badgeKey };
    }
    case 'create-hook-token': {
      const list = entry.hookTokens ?? [];
      if (list.length >= MAX_HOOK_TOKENS) throw new ForbiddenError(`at most ${MAX_HOOK_TOKENS} hook tokens; revoke one first`);
      const t = newHookToken();
      const rec = { id: t.id, hash: t.hash, createdBy: ctx.login ?? 'hook', createdAt: now };
      const next = await setEntry(key, { ...entry, hookTokens: [...list, rec] });
      return { ...view(next), hookToken: t.token };
    }
    case 'revoke-hook-token': {
      const next = await setEntry(key, { ...entry, hookTokens: (entry.hookTokens ?? []).filter((h) => h.id !== arg.id) });
      return view(next);
    }
    case 'delete-pet':
      await deleteEntry(key);
      return { visibility: entry.visibility ?? 'public', hasBadgeKey: false, hookTokens: [], deleted: true };
  }
}

/** True when `k` opens this private pet's badge (accounts R5.2). */
export function badgeKeyValid(entry: PetEntry | undefined, k: string | null): boolean {
  return !!entry?.badgeKeyHash && !!k && safeEqual(entry.badgeKeyHash, sha256(k));
}
