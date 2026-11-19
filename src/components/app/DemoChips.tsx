import Link from 'next/link';

const DEMOS = [
  { name: 'healthy', label: 'HEALTHY', note: 'Green CI, fresh pushes.' },
  { name: 'neglected', label: 'NEGLECTED', note: 'Hungry, red CI, stale issues.' },
  { name: 'haunted', label: 'HAUNTED', note: 'Dead. Bring it back.' },
  { name: 'necromancer', label: 'NECROMANCER', note: 'Came back, stayed healthy a week.' },
] as const;

/** Zero-setup demo pets. `current` marks the one being viewed. */
/** `wide`: a full-width page, so the four chips sit in one row from 1024 px up. */
export function DemoChips({ current, compact = false, wide = false }: { current?: string; compact?: boolean; wide?: boolean }) {
  return (
    <nav aria-label="Demo pets">
      <ul className={compact ? 'flex flex-wrap gap-2' : wide ? 'grid gap-2 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4'}>
        {DEMOS.map((d) => {
          const active = current === `demo/${d.name}`;
          return (
            <li key={d.name}>
              <Link
                href={`/pet/demo/${d.name}`}
                aria-current={active ? 'page' : undefined}
                className={`block rounded border-2 px-3 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? 'border-[#9bbc0f] bg-[#0f380f] text-[#9bbc0f]' : 'border-purple-800 bg-zinc-950 text-purple-100 hover:bg-purple-950'
                }`}
              >
                <span className="font-pixel text-[9px] leading-relaxed">{d.label}</span>
                {!compact && <span className="mt-1 block font-mono text-[11px] text-zinc-400">{d.note}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
