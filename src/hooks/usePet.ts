'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PetResponse, PetStage, SimulatedEvent } from '@/lib/types';

export const POLL_MS = 15_000;

export type PetErrorKind = 'not_found' | 'rate_limited' | 'invalid' | 'network' | 'server';
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
  const onChange = useRef(onStageChange);
  useEffect(() => {
    onChange.current = onStageChange;
  });

  const url = `/api/pet/${key.split('/').map(encodeURIComponent).join('/')}`;

  const apply = useCallback((res: PetResponse) => {
    const prev = stage.current;
    stage.current = res.pet.stage;
    setData(res);
    setError(null);
    if (prev && prev !== res.pet.stage) onChange.current?.(prev, res.pet.stage);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && isPetResponse(body)) apply(body);
      else setError(toError(res.status, body));
    } catch {
      setError({ kind: 'network', message: 'cannot reach the server' });
    }
  }, [url, apply]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const act = useCallback(
    async (action: PetActionName, event?: SimulatedEvent): Promise<ActOutcome> => {
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
    [url, apply]
  );

  return { data, error, busy, act, refresh };
}
