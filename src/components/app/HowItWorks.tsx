const STEPS = [
  { n: '01', title: 'GitHub events', body: 'Pushes feed it. Green CI gives +15 HP, red CI costs 25. Merged PRs throw a party.' },
  { n: '02', title: 'Pet stats', body: 'HP, fullness and sanity decay when the repo goes quiet. Stage follows health: egg, ghost, demon, zombie.' },
  { n: '03', title: 'Kiro hooks and MCP heal', body: 'Hooks smell console.log and TODOs as poop. HEAL reads your repo and hands Kiro a ready prompt.' },
  { n: '04', title: 'Resurrection', body: 'Zombie pets rise again once CI is green. Every comeback is counted.' },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="w-full">
      <h2 id="how-title" className="mb-4 font-pixel text-[11px] leading-relaxed text-[#9bbc0f]">
        HOW IT WORKS
      </h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-md border-2 border-purple-900 bg-zinc-900/80 p-4">
            <div className="font-pixel text-[10px] text-purple-300">{s.n}</div>
            <h3 className="mt-2 font-pixel text-[9px] leading-relaxed text-zinc-100">{s.title.toUpperCase()}</h3>
            <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-300">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
