import Link from 'next/link';

export interface PetChip {
  key: string;
  label: string;
  note?: string;
}

/** Links to pets, styled like the demo chips. `current` marks the one being viewed. */
export function PetChips({ items, current, label }: { items: PetChip[]; current?: string; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid gap-2 sm:grid-cols-3">
        {items.map((p) => {
          const active = current === p.key;
          return (
            <li key={p.key} className="min-w-0">
              <Link
                href={`/pet/${p.key}`}
                aria-current={active ? 'page' : undefined}
                className={`block h-full rounded border-2 px-3 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? 'border-[#9bbc0f] bg-[#0f380f] text-[#9bbc0f]' : 'border-purple-800 bg-zinc-950 text-purple-100 hover:bg-purple-950'
                }`}
              >
                <span className="block break-all font-pixel text-[9px] leading-relaxed">{p.label}</span>
                {p.note && <span className="mt-1 block font-mono text-[11px] text-zinc-400">{p.note}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const STAGE_NAMES: Record<string, string> = {
  EGG: 'Egg',
  BABY_GHOST: 'Baby ghost',
  CODE_DEMON: 'Code demon',
  NECROMANCER: 'Necromancer',
  ZOMBIE_CORPSE: 'Dead',
};

/** Chip text for one of the user's pets. */
export function myPetChip(p: { key: string; role: string; visibility: string; stage: string | null; hp: number | null; noCi?: boolean }): PetChip {
  const hp = p.noCi ? 'HP ? (no CI)' : `HP ${p.hp}`;
  const state = p.stage ? `${STAGE_NAMES[p.stage] ?? p.stage}, ${hp}` : 'Not hatched yet';
  return {
    key: p.key,
    label: p.key.toUpperCase(),
    note: `${state}. ${p.role === 'keeper' ? 'Keeper' : 'Reader'}, ${p.visibility}.`,
  };
}
