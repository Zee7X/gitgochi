export type PetStage = 'EGG' | 'BABY_GHOST' | 'CODE_DEMON' | 'ZOMBIE_CORPSE';

export type PetMood = 'HAPPY' | 'HUNGRY' | 'SICK' | 'DIRTY' | 'SLEEPING' | 'DEAD' | 'PARTY';

export type PetAction = 'IDLE' | 'FEEDING' | 'HEALING' | 'CLEANING' | 'REVIVING';

export type CiResult = 'success' | 'failure';

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
  commitsTotal: number;
  /** Last 5 CI conclusions, newest last. */
  recentCi: CiResult[];
  lastPushAt: number | null;
  diedAt: number | null;
  resurrections: number;
  /** Decay is accounted up to here; advances in whole hours only. */
  updatedAt: number;
  mood: PetMood;
  /** PARTY mood lasts until this time. Set by pr_merged, cleared by tick. */
  partyUntil?: number | null;
}

export type PetEventType =
  | 'push'
  | 'ci'
  | 'pr_merged'
  | 'issue_opened'
  | 'issue_closed'
  | 'poop'
  | 'clean'
  | 'feed'
  | 'revive'
  | 'death'
  | 'heal'
  | 'sync';

export interface PetEvent {
  id: string;
  at: number;
  type: PetEventType;
  label: string;
  deltas: Partial<Record<'hp' | 'fullness' | 'sanity' | 'poopCount', number>>;
  simulated?: boolean;
  source: 'github' | 'kiro-hook' | 'user' | 'system';
}

export interface RepoSnapshot {
  fullName: string;
  createdAt: string;
  pushedAt: string | null;
  commitsTotal: number;
  openIssues: number;
  staleIssues: number;
  /** Oldest first. */
  recentRuns: CiResult[];
  defaultBranch: string;
  description?: string;
  stars?: number;
}

export type SimulatedEvent =
  | { type: 'push'; commits: number }
  | { type: 'ci'; success: boolean }
  | { type: 'pr_merged' }
  | { type: 'issue_opened' }
  | { type: 'issue_closed' }
  | { type: 'poop'; reason: string };

export interface PetResponse {
  pet: PetState;
  events: PetEvent[];
  source: 'github' | 'demo' | 'fallback';
  fetchedAt: string;
  error?: string;
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
  repo?: string;
  hasDebugger?: boolean;
}

export interface HealDiagnosis {
  repo: string;
  findings: {
    kind: 'ci' | 'issue' | 'poop' | 'hunger';
    title: string;
    detail: string;
    url?: string;
  }[];
  kiroPrompt: string;
  generatedAt: string;
}

/** Superseded by HealDiagnosis. Kept only because mcp-client.ts still imports it. */
export interface AutoHealResult {
  success: boolean;
  fixedIssues: string[];
  prUrl: string;
  newHp: number;
  newSanity: number;
}
