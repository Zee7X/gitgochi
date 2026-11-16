'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';

const TICK_MS = 5_000;
const subscribeClock = (cb: () => void) => {
  const id = window.setInterval(cb, TICK_MS);
  return () => window.clearInterval(id);
};
const readClock = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/** Wall clock that re-renders every 5 s. 0 on the server, so relative times never mismatch on hydration. */
export const useNow = () => useSyncExternalStore(subscribeClock, readClock, () => 0);

const noopSubscribe = () => () => {};
/** Page origin for snippets. Empty on the server and during hydration. */
export const useOrigin = () => useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');

export function timeAgo(at: number, now: number): string {
  if (!now) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border-2 border-purple-900 bg-zinc-900/80 ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b-2 border-purple-900 px-3 py-2">
        <h2 className="font-pixel text-[9px] leading-relaxed tracking-wider text-[#9bbc0f]">{title}</h2>
        {right}
      </header>
      <div className="p-3 font-mono text-xs text-zinc-300">{children}</div>
    </section>
  );
}

const BTN =
  'font-pixel text-[9px] leading-none px-3 py-2.5 rounded border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed';

export const btnPrimary = `${BTN} bg-[#9bbc0f] border-[#0f380f] text-[#0f380f] hover:bg-[#b4d62a]`;
export const btnGhost = `${BTN} bg-zinc-950 border-purple-800 text-purple-100 hover:bg-purple-950`;

/** Copy button that flips to COPIED for two seconds. Falls back to a visible failure label. */
export function CopyButton({ text, label = 'COPY', className = btnGhost }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  };
  return (
    <button type="button" onClick={onClick} className={className} aria-live="polite">
      {state === 'copied' ? 'COPIED!' : state === 'failed' ? 'COPY FAILED' : label}
    </button>
  );
}
