export type PetStage = 'EGG' | 'BABY_GHOST' | 'CODE_DEMON' | 'ZOMBIE_CORPSE';

export type PetAction = 'IDLE' | 'FEEDING' | 'HEALING' | 'CLEANING' | 'REVIVING';

export interface PetState {
  hp: number;
  fullness: number;
  sanity: number;
  stage: PetStage;
  poopCount: number;
  lastFedTimestamp: number;
  isSleeping: boolean;
  statusMessage: string;
  repoName: string;
}

export interface WebhookEventPayload {
  event: 'push' | 'check_run' | 'pull_request' | 'issues';
  repo: string;
  commitsCount?: number;
  conclusion?: 'success' | 'failure' | 'neutral';
  action?: string;
  merged?: boolean;
}

export interface PoopDetectorPayload {
  filePath: string;
  hasConsoleLog: boolean;
  hasTodo: boolean;
  timestamp: string;
}

export interface AutoHealResult {
  success: boolean;
  fixedIssues: string[];
  prUrl: string;
  newHp: number;
  newSanity: number;
}
