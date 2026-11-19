import type { RepoSnapshot } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEMO_NAMES = ['healthy', 'neglected', 'haunted'] as const;
export type DemoName = (typeof DEMO_NAMES)[number];

// Demo fixtures are relative to `now`, so the same call always yields the same pet.
const DEMOS: Record<DemoName, (now: number) => RepoSnapshot> = {
  healthy: (now) => ({
    fullName: 'demo/healthy',
    createdAt: new Date(now - 200 * DAY).toISOString(),
    pushedAt: new Date(now - 2 * HOUR).toISOString(),
    commitsTotal: 240,
    openIssues: 3,
    staleIssues: 0,
    recentRuns: ['success', 'success', 'success', 'success', 'success'],
    defaultBranch: 'main',
  }),
  neglected: (now) => ({
    fullName: 'demo/neglected',
    createdAt: new Date(now - 300 * DAY).toISOString(),
    pushedAt: new Date(now - 80 * HOUR).toISOString(),
    commitsTotal: 61,
    openIssues: 14,
    staleIssues: 6,
    recentRuns: ['success', 'success', 'failure', 'failure', 'failure'],
    defaultBranch: 'main',
  }),
  haunted: (now) => ({
    fullName: 'demo/haunted',
    createdAt: new Date(now - 500 * DAY).toISOString(),
    pushedAt: new Date(now - 9 * DAY).toISOString(),
    commitsTotal: 118,
    openIssues: 31,
    staleIssues: 12,
    recentRuns: ['success', 'failure', 'failure', 'failure', 'failure', 'failure'],
    defaultBranch: 'main',
  }),
};

export const isDemoKey = (key: string) => key.startsWith('demo/');

/** Snapshot for `demo/<name>`, or null when there is no such demo. */
export function demoSnapshot(key: string, now: number): RepoSnapshot | null {
  const name = key.slice('demo/'.length);
  return (DEMO_NAMES as readonly string[]).includes(name) ? DEMOS[name as DemoName](now) : null;
}
