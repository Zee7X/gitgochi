'use client';

import type { PetState } from '@/lib/types';
import { Panel, timeAgo, useNow } from './ui';

const STAGE_NAME: Record<PetState['stage'], string> = {
  EGG: 'Egg',
  BABY_GHOST: 'Baby ghost',
  CODE_DEMON: 'Code demon',
  ZOMBIE_CORPSE: 'Zombie corpse',
};

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const low = pct < 30;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className={low ? 'text-rose-300' : 'text-lime-300'}>
          {pct}%{low ? ' LOW' : ''}
        </span>
      </div>
      <div className="h-3 border border-zinc-600 bg-zinc-950" aria-hidden="true">
        <div className={`h-full ${low ? 'bg-rose-400' : 'bg-lime-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ciSummary(runs: PetState['recentCi']): string {
  if (!runs.length) return 'no runs yet';
  const last = runs[runs.length - 1];
  let n = 0;
  for (let i = runs.length - 1; i >= 0 && runs[i] === last; i--) n++;
  return `${n} ${last === 'success' ? 'passing' : 'failing'} in a row`;
}

export function StatsCard({ pet }: { pet: PetState }) {
  const now = useNow();
  return (
    <Panel title="STATS">
      <div className="space-y-3">
        <Bar label="HP" value={pet.hp} />
        <Bar label="Fullness" value={pet.fullness} />
        <Bar label="Sanity" value={pet.sanity} />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-zinc-800 pt-3">
        <dt className="text-zinc-400">Stage</dt>
        <dd className="text-right font-bold text-zinc-100">{STAGE_NAME[pet.stage]}</dd>
        <dt className="text-zinc-400">Resurrections</dt>
        <dd className="text-right font-bold text-zinc-100">{pet.resurrections}</dd>
        <dt className="text-zinc-400">Last push</dt>
        <dd className="text-right font-bold text-zinc-100">{pet.lastPushAt ? timeAgo(pet.lastPushAt, now) || '...' : 'never'}</dd>
        <dt className="text-zinc-400">Commits</dt>
        <dd className="text-right font-bold text-zinc-100">{pet.commitsTotal}</dd>
        <dt className="text-zinc-400">CI streak</dt>
        <dd className="flex flex-wrap items-center justify-end gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {pet.recentCi.map((r, i) => (
              <span key={i} className={`h-3 w-3 border ${r === 'success' ? 'border-lime-300 bg-lime-400' : 'border-rose-300 bg-rose-400'}`} />
            ))}
          </span>
          <span className="font-bold text-zinc-100">{ciSummary(pet.recentCi)}</span>
        </dd>
      </dl>
    </Panel>
  );
}
