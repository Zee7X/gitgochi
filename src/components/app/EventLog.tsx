'use client';

import type { PetEvent } from '@/lib/types';
import { Panel, timeAgo, useNow } from './ui';

const SOURCE: Record<PetEvent['source'], { tag: string; name: string; cls: string }> = {
  github: { tag: 'GH', name: 'GitHub', cls: 'border-lime-400 text-lime-300' },
  'kiro-hook': { tag: 'KIRO', name: 'Kiro hook', cls: 'border-purple-400 text-purple-300' },
  user: { tag: 'YOU', name: 'You', cls: 'border-amber-400 text-amber-300' },
  system: { tag: 'SYS', name: 'System', cls: 'border-zinc-400 text-zinc-300' },
};

const DELTA_LABEL = { hp: 'HP', fullness: 'FOOD', sanity: 'SANITY', poopCount: 'POOP' } as const;

function deltas(ev: PetEvent) {
  return (Object.keys(DELTA_LABEL) as (keyof typeof DELTA_LABEL)[])
    .filter((k) => ev.deltas[k])
    .map((k) => {
      const v = ev.deltas[k] as number;
      // More poop is bad news, everything else is good when it goes up.
      const good = k === 'poopCount' ? v < 0 : v > 0;
      return { key: k, text: `${v > 0 ? '+' : ''}${v} ${DELTA_LABEL[k]}`, good };
    });
}

export function EventLog({ events }: { events: PetEvent[] }) {
  const now = useNow();
  return (
    <Panel title="EVENT LOG" right={<span className="text-[11px] text-zinc-400">newest first</span>}>
      {events.length === 0 ? (
        <p className="text-zinc-400">No events yet. Push a commit, or press FEED on the device.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Pet events, newest first">
          {events.map((ev) => {
            const src = SOURCE[ev.source];
            return (
              <li key={ev.id} className="flex flex-col gap-1 border-b border-zinc-800 pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-1 font-pixel text-[7px] leading-none ${src.cls}`}
                    title={src.name}
                  >
                    {src.tag}
                    <span className="sr-only"> event</span>
                  </span>
                  <span className="min-w-0 break-words font-bold text-zinc-100">{ev.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-[11px] text-zinc-400">
                  <span>{timeAgo(ev.at, now)}</span>
                  {deltas(ev).map((d) => (
                    <span key={d.key} className={d.good ? 'text-lime-300' : 'text-rose-300'}>
                      {d.text}
                    </span>
                  ))}
                  {ev.simulated && (
                    <span className="rounded border border-zinc-600 px-1 text-[10px] uppercase text-zinc-300">simulated</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
