import { PetState, PetStage } from './types';

export function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function determineStage(hp: number, sanity: number, fullness: number, commitsTotal = 12): PetStage {
  if (hp <= 0) return 'ZOMBIE_CORPSE';
  if (commitsTotal < 5) return 'EGG';
  if (hp >= 80 && sanity >= 70 && fullness >= 50) return 'CODE_DEMON';
  return 'BABY_GHOST';
}

export const INITIAL_PET_STATE: PetState = {
  hp: 90,
  fullness: 80,
  sanity: 95,
  stage: 'BABY_GHOST',
  poopCount: 0,
  lastFedTimestamp: Date.now(),
  isSleeping: false,
  statusMessage: 'HAPPY & CODING',
  repoName: 'octocat/gitgotchi',
};

export function applyCiResult(current: PetState, isSuccess: boolean): PetState {
  const hpDelta = isSuccess ? 15 : -25;
  const newHp = clamp(current.hp + hpDelta);
  const newStage = determineStage(newHp, current.sanity, current.fullness);
  const statusMessage = isSuccess ? 'CI PASSED! +15 HP' : 'BUILD BROKEN! -25 HP';

  return {
    ...current,
    hp: newHp,
    stage: newStage,
    statusMessage: newHp === 0 ? 'DIED! REVIVE NEEDED' : statusMessage,
  };
}

export function applyCommitPush(current: PetState, commitCount = 1): PetState {
  if (current.hp <= 0) return current;
  const newFullness = clamp(current.fullness + commitCount * 8);
  const newStage = determineStage(current.hp, current.sanity, newFullness);

  return {
    ...current,
    fullness: newFullness,
    stage: newStage,
    lastFedTimestamp: Date.now(),
    statusMessage: `FED ${commitCount} COMMITS!`,
  };
}

export function applyPrMerge(current: PetState): PetState {
  if (current.hp <= 0) return current;
  const newFullness = clamp(current.fullness + 20);
  const newHp = clamp(current.hp + 10);
  const newSanity = clamp(current.sanity + 10);
  const newStage = determineStage(newHp, newSanity, newFullness);

  return {
    ...current,
    fullness: newFullness,
    hp: newHp,
    sanity: newSanity,
    stage: newStage,
    statusMessage: 'PR MERGED! PARTY!',
  };
}

export function applyPoopSpawn(current: PetState, reason = 'CODE SMELL'): PetState {
  const newCount = Math.min(5, current.poopCount + 1);
  const newSanity = clamp(current.sanity - 10);
  const newStage = determineStage(current.hp, newSanity, current.fullness);

  return {
    ...current,
    poopCount: newCount,
    sanity: newSanity,
    stage: newStage,
    statusMessage: `POOP! ${reason}`,
  };
}

export function applyClean(current: PetState): PetState {
  if (current.hp <= 0) return current;
  const newSanity = clamp(current.sanity + current.poopCount * 12);
  const newStage = determineStage(current.hp, newSanity, current.fullness);

  return {
    ...current,
    poopCount: 0,
    sanity: newSanity,
    stage: newStage,
    statusMessage: 'SCREEN CLEANED!',
  };
}

export function applyRevive(current: PetState): PetState {
  return {
    ...current,
    hp: 50,
    fullness: 50,
    sanity: 60,
    poopCount: 0,
    stage: 'BABY_GHOST',
    statusMessage: 'RESURRECTED FROM ASHES!',
  };
}
