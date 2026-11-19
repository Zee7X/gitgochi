'use client';

import { useEffect, useState } from 'react';

export interface Me {
  signedIn: boolean;
  login?: string;
  avatarUrl?: string;
  signInAvailable: boolean;
  installUrl: string | null;
}

// One request per page load, shared by the header and the keeper panel.
let pending: Promise<Me | null> | null = null;

function fetchMe(): Promise<Me | null> {
  pending ??= fetch('/api/auth/me', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null);
  return pending;
}

/** Who is signed in; null until known or when the server cannot say. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    void fetchMe().then((m) => {
      if (live) setMe(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return me;
}

export const signInHref = () =>
  `/api/auth/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/me' : window.location.pathname)}`;
