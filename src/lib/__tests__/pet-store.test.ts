import { describe, expect, it } from 'vitest';
import { appendEvent, getEntry, MAX_EVENTS, normalizeRepoKey, setEntry } from '../pet-store';
import { createPet } from '../state-machine';
import type { PetEvent } from '../types';

const event = (n: number): PetEvent => ({
  id: String(n),
  at: n,
  type: 'push',
  label: 'PUSH',
  deltas: {},
  source: 'github',
});

describe('normalizeRepoKey', () => {
  it('lowercases and strips .svg / .git', () => {
    expect(normalizeRepoKey('Octo-Cat', 'GitGotchi.svg')).toBe('octo-cat/gitgotchi');
    expect(normalizeRepoKey('a', 'b.git')).toBe('a/b');
  });
  it.each([
    ['a/b', 'c'],
    ['a b', 'c'],
    ['', 'c'],
    ['a', ''],
    ['a', '.svg'],
    ['..', 'c'],
    ['a', '..'],
    ['a', 'c?x=1'],
  ])('rejects %j / %j', (o, r) => {
    expect(() => normalizeRepoKey(o, r)).toThrow();
  });
});

describe('store', () => {
  it('keeps events newest first and capped', () => {
    const key = 'test/cap';
    setEntry(key, { pet: createPet(key, 0), events: [], snapshotAt: 0, source: 'demo' });
    for (let i = 0; i < MAX_EVENTS + 10; i++) appendEvent(key, event(i));
    const entry = getEntry(key)!;
    expect(entry.events).toHaveLength(MAX_EVENTS);
    expect(entry.events[0].id).toBe(String(MAX_EVENTS + 9));
  });
  it('appendEvent on an unknown repo is a no-op', () => {
    expect(appendEvent('test/missing', event(1))).toBeUndefined();
    expect(getEntry('test/missing')).toBeUndefined();
  });
});
