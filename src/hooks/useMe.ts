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

export interface MyPet {
  key: string;
  role: 'keeper' | 'reader';
  visibility: 'public' | 'private';
  stage: string | null;
  hp: number | null;
  noCi?: boolean;
}

let petsPending: Promise<MyPet[] | null> | null = null;

function fetchMyPets(): Promise<MyPet[] | null> {
  petsPending ??= fetch('/api/me/pets', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<{ signedIn?: boolean; pets?: MyPet[] }>) : null))
    .then((b) => (b?.signedIn ? (b.pets ?? []) : null))
    .catch(() => null);
  return petsPending;
}

/**
 * The signed-in user's pets: `undefined` while loading, `null` when signed out (or unknown), else the list.
 * One request per page load, shared by every caller.
 */
export function useMyPets(enabled = true): MyPet[] | null | undefined {
  const [pets, setPets] = useState<MyPet[] | null | undefined>(enabled ? undefined : null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchMyPets().then((p) => {
      if (live) setPets(p);
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return pets;
}

export const signInHref = () =>
  `/api/auth/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/me' : window.location.pathname)}`;
