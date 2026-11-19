'use client';

import { useCallback, useEffect, useState } from 'react';
import { signInHref, useMe } from '@/hooks/useMe';
import type { PetAccess } from '@/lib/types';
import { CopyButton, Panel, useOrigin } from './ui';
import { btnGhost } from './styles';

interface SettingsView {
  visibility: 'public' | 'private';
  hasBadgeKey: boolean;
  hookTokens: { id: string; createdBy: string; createdAt: number }[];
  badgeKey?: string;
  hookToken?: string;
  deleted?: boolean;
}

type Op = 'view' | 'rotate-badge-key' | 'create-hook-token' | 'revoke-hook-token' | 'delete-pet';

function Secret({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-2 rounded border border-amber-400 p-2">
      <div className="text-amber-200">{label}</div>
      <code className="block break-all rounded bg-zinc-950 p-2 text-[11px] text-zinc-100">{value}</code>
      <CopyButton text={value} label="COPY" />
      <p className="text-zinc-400">{note}</p>
    </div>
  );
}

/** Live updates, badge key, hook tokens and DELETE PET for keepers; a short explanation for everyone else. */
export function KeeperPanel({ repoKey, access, onChanged }: { repoKey: string; access?: PetAccess; onChanged: () => void }) {
  const me = useMe();
  const origin = useOrigin();
  const [view, setView] = useState<SettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keeper = access?.role === 'keeper';

  const run = useCallback(
    async (op: Op, id?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/pet/${repoKey}/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op, id }),
        });
        const body = (await res.json().catch(() => null)) as (SettingsView & { error?: string }) | null;
        if (!res.ok || !body) setError(body?.error ?? `server answered ${res.status}`);
        else {
          setView(body);
          if (op === 'delete-pet' || op === 'rotate-badge-key') onChanged();
        }
      } catch {
        setError('cannot reach the server');
      } finally {
        setBusy(false);
      }
    },
    [repoKey, onChanged]
  );

  // The first view loads in a callback, not in the effect body, so it never renders twice in a row.
  useEffect(() => {
    if (!keeper) return;
    let live = true;
    void fetch(`/api/pet/${repoKey}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'view' }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<SettingsView>) : null))
      .catch(() => null)
      .then((v) => {
        if (live && v) setView(v);
      });
    return () => {
      live = false;
    };
  }, [keeper, repoKey]);

  if (!me?.signInAvailable) return null;

  if (!keeper) {
    return (
      <Panel title="CARE FOR THIS PET">
        {me.signedIn ? (
          <p>
            Signed in as @{me.login}. You can look, but only collaborators with push access to {repoKey} can feed, clean or revive this
            pet. If you are one, ask an admin to install the GitGotchi App on the repo.
          </p>
        ) : (
          <p className="space-y-3">
            <span className="block">Visitors can look. Collaborators with push access sign in to feed, clean and revive.</span>
            <a href={signInHref()} className={`${btnGhost} inline-block`}>
              SIGN IN WITH GITHUB
            </a>
          </p>
        )}
      </Panel>
    );
  }

  const isPrivate = (view?.visibility ?? access?.visibility) === 'private';
  const badgeMd = view?.badgeKey
    ? `[![GitGotchi](${origin}/api/badge/${repoKey}.svg?k=${view.badgeKey})](${origin}/pet/${repoKey})`
    : null;

  return (
    <Panel title="KEEPER TOOLS">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-zinc-100">Live updates</h3>
          <p className="text-zinc-400">Install the GitGotchi App on this repo. Pushes, CI, pull requests and issues then reach the pet at once. Read-only, no secret to copy.</p>
          {me.installUrl && (
            <a href={me.installUrl} className={`${btnGhost} inline-block`}>
              INSTALL GITGOTCHI
            </a>
          )}
        </section>

        {isPrivate && (
          <section className="space-y-2">
            <h3 className="text-zinc-100">Private badge</h3>
            <p className="text-zinc-400">
              A private repo&apos;s badge needs a key in its URL. Anyone with the link sees the badge, so make a new one if the README is copied
              somewhere public. The old link stops working at once.
            </p>
            <button type="button" disabled={busy} onClick={() => void run('rotate-badge-key')} className={btnGhost}>
              {view?.hasBadgeKey ? 'MAKE A NEW BADGE LINK' : 'MAKE BADGE LINK'}
            </button>
            {badgeMd && <Secret label="Badge markdown (shown once)" value={badgeMd} note="Paste it into the README of this repo." />}
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-zinc-100">Kiro hook and MCP token</h3>
          <p className="text-zinc-400">Lets the poop-detector hook and the MCP server report to this pet only. Up to 5 tokens.</p>
          <ul className="space-y-1">
            {(view?.hookTokens ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>
                  ggh_{t.id} by @{t.createdBy}, {new Date(t.createdAt).toISOString().slice(0, 10)}
                </span>
                <button type="button" disabled={busy} onClick={() => void run('revoke-hook-token', t.id)} className={btnGhost}>
                  REVOKE
                </button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={() => void run('create-hook-token')} className={btnGhost}>
            NEW TOKEN
          </button>
          {view?.hookToken && (
            <Secret
              label="Hook token (shown once)"
              value={`GITGOTCHI_URL=${origin}\nGITGOTCHI_REPO=${repoKey}\nGITGOTCHI_HOOK_TOKEN=${view.hookToken}`}
              note="Put these lines in .env.local of the repo where Kiro runs."
            />
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-zinc-100">Delete pet</h3>
          <p className="text-zinc-400">Removes its stats, history, badge key and tokens. Opening the page again starts a fresh pet from GitHub.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete the pet of ${repoKey}? This cannot be undone.`)) void run('delete-pet');
            }}
            className={btnGhost}
          >
            DELETE PET
          </button>
        </section>

        {error && (
          <p role="alert" className="text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
