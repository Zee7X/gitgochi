import type { HealDiagnosis, PetEvent, PetState } from './types';

type Finding = HealDiagnosis['findings'][number];

export interface DiagnoseOptions {
  now?: number;
  /** GitHub token; defaults to GITHUB_TOKEN. Public repos work without one. */
  token?: string;
  fetchFn?: typeof fetch;
}

const DAY = 86_400_000;
const STALE_DAYS = 30;
const HUNGRY_DAYS = 2;
const MAX_POOP_FINDINGS = 5;

/** GET a GitHub API path. Returns null on any failure, so one bad call never kills the diagnosis. */
async function gh<T>(path: string, o: DiagnoseOptions): Promise<T | null> {
  const token = o.token ?? process.env.GITHUB_TOKEN;
  try {
    const res = await (o.fetchFn ?? fetch)(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'gitgotchi',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

interface WorkflowRuns {
  workflow_runs: { name: string | null; run_number: number; head_branch: string | null; conclusion: string | null; html_url: string }[];
}
interface IssueSearch {
  items: { number: number; title: string; html_url: string; updated_at: string }[];
}

async function ciFinding(key: string, pet: PetState | undefined, o: DiagnoseOptions): Promise<Finding | null> {
  if (!key.startsWith('demo/')) {
    const runs = await gh<WorkflowRuns>(`/repos/${key}/actions/runs?status=completed&per_page=1`, o);
    const run = runs?.workflow_runs?.[0];
    if (run) {
      if (run.conclusion !== 'failure') return null;
      return {
        kind: 'ci',
        title: `CI failing: ${run.name ?? 'workflow'}`,
        detail: `Latest completed run #${run.run_number} on ${run.head_branch ?? 'unknown branch'} concluded with failure.`,
        url: run.html_url,
      };
    }
  }
  // No GitHub data (demo repo, rate limit, private repo): fall back to what the pet already knows.
  if (pet?.recentCi.at(-1) === 'failure') {
    return {
      kind: 'ci',
      title: 'CI failing',
      detail: `Latest recorded CI result is a failure (last ${pet.recentCi.length}: ${pet.recentCi.join(', ')}).`,
    };
  }
  return null;
}

async function issueFindings(key: string, now: number, o: DiagnoseOptions): Promise<Finding[]> {
  if (key.startsWith('demo/')) return [];
  const cutoff = new Date(now - STALE_DAYS * DAY).toISOString().slice(0, 10);
  const q = encodeURIComponent(`repo:${key} is:issue is:open updated:<${cutoff}`);
  const res = await gh<IssueSearch>(`/search/issues?q=${q}&sort=updated&order=asc&per_page=3`, o);
  return (res?.items ?? []).slice(0, 3).map((i) => ({
    kind: 'issue' as const,
    title: `Stale issue #${i.number}: ${i.title}`,
    detail: `Open with no activity since ${i.updated_at.slice(0, 10)} (over ${STALE_DAYS} days).`,
    url: i.html_url,
  }));
}

function poopFindings(pet: PetState | undefined, events: PetEvent[]): Finding[] {
  // Events are newest first; only the smells still on screen count.
  const live = pet ? pet.poopCount : MAX_POOP_FINDINGS;
  return events
    .filter((e) => e.type === 'poop' && e.source === 'kiro-hook')
    .slice(0, Math.min(live, MAX_POOP_FINDINGS))
    .map((e) => ({
      kind: 'poop' as const,
      title: `Code smell: ${e.label}`,
      detail: `Reported by the Kiro poop-detector hook at ${new Date(e.at).toISOString()}.`,
    }));
}

function hungerFinding(pet: PetState | undefined, now: number): Finding | null {
  if (!pet?.lastPushAt) return null;
  const days = Math.floor((now - pet.lastPushAt) / DAY);
  if (days < HUNGRY_DAYS) return null;
  return {
    kind: 'hunger',
    title: `No push for ${days} days`,
    detail: `Last push was ${new Date(pet.lastPushAt).toISOString().slice(0, 10)}; fullness is ${pet.fullness}/100.`,
  };
}

export function buildKiroPrompt(repo: string, findings: Finding[]): string {
  if (!findings.length) {
    return `GitGotchi diagnosed ${repo} and found nothing to fix. Reply with a one-line confirmation and do not change any files.`;
  }
  const list = findings
    .map((f, i) => `${i + 1}. [${f.kind}] ${f.title}\n   ${f.detail}${f.url ? `\n   ${f.url}` : ''}`)
    .join('\n');
  return [
    `GitGotchi diagnosed ${repo} and found ${findings.length} problem${findings.length === 1 ? '' : 's'}:`,
    '',
    list,
    '',
    'Work spec-first. For each finding, check the matching spec in .kiro/specs/ and update it before touching code.',
    'Then fix the findings in the order listed, run `npm test`, and report what changed and what you could not verify.',
    'Do not invent results. If a finding cannot be reproduced, say so.',
  ].join('\n');
}

/** Builds a diagnosis from live GitHub data (when reachable) plus what the pet already recorded. */
export async function diagnose(
  key: string,
  pet: PetState | undefined,
  events: PetEvent[],
  opts: DiagnoseOptions = {}
): Promise<HealDiagnosis> {
  const now = opts.now ?? Date.now();
  const [ci, issues] = await Promise.all([ciFinding(key, pet, opts), issueFindings(key, now, opts)]);
  const hunger = hungerFinding(pet, now);
  const findings = [
    ...(ci ? [ci] : []),
    ...issues,
    ...poopFindings(pet, events),
    ...(hunger ? [hunger] : []),
  ];
  return {
    repo: key,
    findings,
    kiroPrompt: buildKiroPrompt(key, findings),
    generatedAt: new Date(now).toISOString(),
  };
}
