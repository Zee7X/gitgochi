'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signInHref } from '@/hooks/useMe';
import { Panel } from './ui';
import { btnGhost, btnPrimary } from './styles';

interface Row {
  key: string;
  role: 'keeper' | 'reader';
  visibility: 'public' | 'private';
  stage: string | null;
  hp: number | null;
  noCi?: boolean;
}

type State = { kind: 'loading' } | { kind: 'signed_out' } | { kind: 'error'; message: string } | { kind: 'ready'; login: string; installUrl: string | null; pets: Row[] };

const tag = 'rounded border px-1.5 py-0.5 font-pixel text-[7px] leading-none';

/** Installed repos the signed-in user can access (accounts R8). */
export function MyPets() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch('/api/me/pets', { cache: 'no-store' }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as (Omit<Extract<State, { kind: 'ready' }>, 'kind'> & { error?: string; signedIn?: boolean }) | null;
      if (!live) return;
      if (res?.ok && body?.signedIn === false) setState({ kind: 'signed_out' });
      else if (!res?.ok || !body) setState({ kind: 'error', message: body?.error ?? 'cannot reach the server' });
      else setState({ kind: 'ready', login: body.login, installUrl: body.installUrl, pets: body.pets });
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === 'loading') return <p className="font-mono text-sm text-zinc-400">Loading your pets...</p>;
  if (state.kind === 'signed_out') {
    return (
      <div className="space-y-4 font-mono text-sm text-zinc-300">
        <p>Sign in with GitHub to see the pets of the repos you work on, public and private.</p>
        <a href={signInHref()} className={`${btnPrimary} inline-block`}>
          SIGN IN WITH GITHUB
        </a>
      </div>
    );
  }
  if (state.kind === 'error') return <p role="alert" className="font-mono text-sm text-rose-300">{state.message}</p>;

  return (
    <div className="space-y-6">
      <p className="font-mono text-sm text-zinc-300">
        Signed in as @{state.login}. These are the repos where the GitGotchi App is installed and you have access.
      </p>
      {state.installUrl && (
        <a href={state.installUrl} className={`${btnPrimary} inline-block`}>
          ADD A REPO (INSTALL GITGOTCHI)
        </a>
      )}
      <Panel title={`MY PETS (${state.pets.length})`}>
        {state.pets.length === 0 ? (
          <p>No repos yet. Install the GitGotchi App on a repo, then come back here.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {state.pets.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-all text-zinc-100">{p.key}</span>
                  <span className={`${tag} ${p.role === 'keeper' ? 'border-lime-400 text-lime-300' : 'border-zinc-400 text-zinc-300'}`}>
                    {p.role.toUpperCase()}
                  </span>
                  <span className={`${tag} ${p.visibility === 'private' ? 'border-rose-400 text-rose-300' : 'border-purple-400 text-purple-300'}`}>
                    {p.visibility.toUpperCase()}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-zinc-400">{p.stage ? `${p.stage} / HP ${p.noCi ? '? (no CI)' : p.hp}` : 'not hatched yet'}</span>
                  <Link href={`/pet/${p.key}`} className={btnGhost}>
                    OPEN
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
