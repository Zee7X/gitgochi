import { describe, expect, it, vi } from 'vitest';
import type { RepoSnapshot } from '../types';

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

const snapshot: RepoSnapshot = {
  fullName: 'acme/early',
  createdAt: new Date(NOW - 100 * 24 * H).toISOString(),
  pushedAt: new Date(NOW - 2 * H).toISOString(),
  commitsTotal: 40,
  openIssues: 2,
  staleIssues: 3,
  recentRuns: ['success', 'success'],
  defaultBranch: 'main',
};

vi.mock('../github', async (orig) => ({
  ...(await orig<typeof import('../github')>()),
  fetchRepoSnapshot: vi.fn(async () => snapshot),
}));

const { getPet, ingestEvent } = await import('../pet-service');
const { getEntry } = await import('../pet-store');
const { seedFromSnapshot } = await import('../state-machine');

// Feature: kiroween-submission, Property 7: Replay runs once and logs once
describe('webhook events before the first snapshot (github-sync R4.8)', () => {
  it('stores a placeholder, replays PR and issue events once on seeding, and keeps the log', async () => {
    const key = 'acme/early';
    await ingestEvent(key, { type: 'issue_closed' }, NOW - 40 * 60_000);
    await ingestEvent(key, { type: 'push', commits: 3 }, NOW - 35 * 60_000);
    await ingestEvent(key, { type: 'pr_merged' }, NOW - 30 * 60_000);

    const placeholder = await getEntry(key);
    expect(placeholder).toMatchObject({ snapshotAt: 0, source: 'github' });
    const webhookLog = placeholder!.events;
    expect(webhookLog).toHaveLength(3);

    const seeded = seedFromSnapshot(snapshot, NOW);
    const first = await getPet(key, NOW);
    expect(first.source).toBe('github');
    // issue_closed +10 and pr_merged +10 sanity on top of the snapshot; the push is not counted twice.
    expect(first.pet.sanity).toBe(Math.min(100, seeded.sanity + 20));
    expect(first.pet.commitsTotal).toBe(seeded.commitsTotal);
    expect(first.pet.mood).toBe('PARTY');
    expect(first.events.map((e) => e.label)).toEqual(['SYNCED WITH GITHUB', ...webhookLog.map((e) => e.label)]);

    // A forced resync with the same snapshot replays nothing.
    const again = await getPet(key, NOW + 1000, true);
    expect(again.pet.sanity).toBe(seeded.sanity);
    expect(again.events).toHaveLength(first.events.length + 1);
  });
});
