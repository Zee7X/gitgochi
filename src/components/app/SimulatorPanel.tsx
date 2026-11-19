'use client';

import type { SimulatedEvent } from '@/lib/types';
import { btnGhost, Panel } from './ui';

const EVENTS: { label: string; hint: string; event: SimulatedEvent }[] = [
  { label: 'CI PASS', hint: 'check run succeeds', event: { type: 'ci', success: true } },
  { label: 'CI FAIL', hint: 'check run fails', event: { type: 'ci', success: false } },
  { label: 'PUSH', hint: 'one commit lands', event: { type: 'push', commits: 1 } },
  { label: 'PR MERGED', hint: 'a pull request merges', event: { type: 'pr_merged' } },
  { label: 'ISSUE OPENED', hint: 'someone files an issue', event: { type: 'issue_opened' } },
  { label: 'ISSUE CLOSED', hint: 'an issue gets closed', event: { type: 'issue_closed' } },
  { label: 'POOP', hint: 'a Kiro hook finds console.log', event: { type: 'poop', reason: 'simulated console.log' } },
];

export function SimulatorPanel({ disabled, onSimulate }: { disabled: boolean; onSimulate: (e: SimulatedEvent) => void }) {
  return (
    <Panel title="SIMULATOR (DEMO)">
      <p className="mb-3 text-zinc-400">Fake GitHub events, run through the same engine as the real webhook. Every entry is tagged simulated, and this demo pet lives only in your browser, so nobody else sees your changes.</p>
      <div className="grid grid-cols-2 gap-2">
        {EVENTS.map((e) => (
          <button
            key={e.label}
            type="button"
            disabled={disabled}
            title={e.hint}
            aria-label={`Simulate: ${e.hint}`}
            onClick={() => onSimulate(e.event)}
            className={btnGhost}
          >
            {e.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}
