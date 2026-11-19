'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { actOnDemo, demoResponse, DEMO_STORAGE_PREFIX } from '@/lib/demo-local';
import type { PetResponse, PetStage, SimulatedEvent } from '@/lib/types';

export const POLL_MS = 15_000;
/** Polling slows down while nothing changes, to stay inside the free store quota (2x per quiet poll, up to this). */
export const MAX_POLL_MS = 120_000;

export type PetErrorKind = 'not_found' | 'rate_limited' | 'invalid' | 'network' | 'server' | 'forbidden';
export interface PetError {
  kind: PetErrorKind;
  message: string;
}

export type PetActionName = 'feed' | 'clean' | 'revive' | 'sync' | 'simulate';

export interface ActOutcome {
  ok: boolean;
  httpStatus: number;
  /** Present whenever the server returned a pet, including 409 and 403. */
  response?: PetResponse;
  error?: string;
}

interface Options {
  /** Called when a response changes the stage (poll or action). */
  onStageChange?: (from: PetStage, to: PetStage) => void;
}

function toError(status: number, body: unknown): PetError {
  const msg = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : '';
  if (status === 404) return { kind: 'not_found', message: msg || 'repo not found' };
  if (status === 403) return { kind: 'forbidden', message: msg || 'keepers only' };
  if (status === 503 || status === 429) return { kind: 'rate_limited', message: msg || 'rate limited' };
  if (status === 400) return { kind: 'invalid', message: msg || 'invalid repo' };
  return { kind: 'server', message: msg || 'server error' };
}

const isPetResponse = (v: unknown): v is PetResponse =>
  typeof v === 'object' && v !== null && 'pet' in v && 'events' in v;

export function usePet(key: string, { onStageChange }: Options = {}) {
  const [data, setData] = useState<PetResponse | null>(null);
  const [error, setError] = useState<PetError | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = useRef<PetStage | null>(null);
  const lastEvent = useRef<string | null>(null);
  const delay = useRef(POLL_MS);
  const onChange = useRef(onStageChange);
  useEffect(() => {
    onChange.current = onStageChange;
  });

  const url = `/api/pet/${key.split('/').map(encodeURIComponent).join('/')}`;
  // Demo pets never touch the server: this browser keeps its own copy (accounts R7).
  const isDemo = key.startsWith('demo/');

  const apply = useCallback((res: PetResponse) => {
    const prev = stage.current;
    stage.current = res.pet.stage;
    // A new event resets the poll interval; a quiet answer stretches it.
    const newest = res.events[0]?.id ?? null;
    delay.current = newest !== lastEvent.current ? POLL_MS : Math.min(MAX_POLL_MS, delay.current * 2);
    lastEvent.current = newest;
    setData(res);
    setError(null);
    if (prev && prev !== res.pet.stage) onChange.current?.(prev, res.pet.stage);
  }, []);

  const refresh = useCallback(async () => {
    if (isDemo) {
      const res = demoResponse(key, Date.now());
      if (res) apply(res);
      else setError({ kind: 'not_found', message: 'repo not found' });
      return;
    }
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && isPetResponse(body)) apply(body);
      else setError(toError(res.status, body));
    } catch {
      setError({ kind: 'network', message: 'cannot reach the server' });
    }
  }, [url, apply, isDemo, key]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    let poll = 0;
    const schedule = () => {
      poll = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await refresh();
        schedule();
      }, delay.current);
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        delay.current = POLL_MS;
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    // Another tab of this browser changed the same demo pet.
    const onStorage = (e: StorageEvent) => {
      if (isDemo && e.key === DEMO_STORAGE_PREFIX + key) void refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh, isDemo, key]);

  const act = useCallback(
    async (action: PetActionName, event?: SimulatedEvent): Promise<ActOutcome> => {
      if (isDemo) {
        const out = actOnDemo(key, action, event, Date.now());
        if (!out) return { ok: false, httpStatus: 404, error: 'repo not found' };
        apply(out.response);
        const ok = out.status >= 200 && out.status < 300;
        return { ok, httpStatus: out.status, response: out.response, error: out.response.error };
      }
      setBusy(true);
      try {
        const res = await fetch(`${url}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, event }),
        });
        const body: unknown = await res.json().catch(() => null);
        if (isPetResponse(body)) {
          apply(body);
          return { ok: res.ok, httpStatus: res.status, response: body, error: body.error };
        }
        return { ok: false, httpStatus: res.status, error: toError(res.status, body).message };
      } catch {
        return { ok: false, httpStatus: 0, error: 'cannot reach the server' };
      } finally {
        setBusy(false);
      }
    },
    [url, apply, isDemo, key]
  );

  return { data, error, busy, act, refresh };
}
