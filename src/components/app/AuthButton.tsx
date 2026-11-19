'use client';

import Link from 'next/link';
import { signInHref, useMe } from '@/hooks/useMe';
import { btnGhost } from './styles';

/** SIGN IN WITH GITHUB, or the signed-in login with MY PETS and SIGN OUT (accounts R1). */
export function AuthButton() {
  const me = useMe();
  if (!me || !me.signInAvailable) return null;
  if (!me.signedIn) {
    return (
      <a href={signInHref()} className={btnGhost}>
        SIGN IN WITH GITHUB
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/me" className={btnGhost}>
        MY PETS
      </Link>
      <span className="hidden font-mono text-xs text-zinc-300 sm:inline">@{me.login}</span>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className={btnGhost}>
          SIGN OUT
        </button>
      </form>
    </div>
  );
}
