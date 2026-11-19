'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RetroShell } from '@/components/RetroShell';
import { LcdScreen, type LcdAnimation } from '@/components/LcdScreen';
import { soundSynth } from '@/lib/audio-synth';
import { usePet } from '@/hooks/usePet';
import type { HealDiagnosis, PetStage, SimulatedEvent } from '@/lib/types';
import { BadgeEmbed } from './BadgeEmbed';
import { DemoChips } from './DemoChips';
import { ErrorCard } from './ErrorCard';
import { EventLog } from './EventLog';
import { HealModal, type HealState } from './HealModal';
import { SimulatorPanel } from './SimulatorPanel';
import { StatsCard } from './StatsCard';
import { WebhookSetup } from './WebhookSetup';
import { btnGhost, timeAgo, useNow } from './ui';

const ALIVE_MENU = ['FEED', 'CLEAN', 'HEAL', 'STATS'];
const DEAD_MENU = ['REVIVE', 'HEAL'];
const LOADING_MENU = ALIVE_MENU;

const FX_SOUND: Record<LcdAnimation, () => void> = {
  eat: () => soundSynth.playEat(),
  clean: () => soundSynth.playClean(),
  heal: () => soundSynth.playHeal(),
  die: () => soundSynth.playDeath(),
  revive: () => soundSynth.playRevive(),
};

const ANIM_MS = 1250;
const HINT_MS = 9000;

const SIM_SOUND: Partial<Record<SimulatedEvent['type'], () => void>> = {
  poop: () => soundSynth.playPoop(),
  pr_merged: () => soundSynth.playParty(),
};

const canSimulateHere = (key: string) => key.startsWith('demo/') || process.env.NODE_ENV !== 'production';

const SOURCE_TAG = {
  github: { text: 'LIVE FROM GITHUB', cls: 'border-lime-400 text-lime-300' },
  demo: { text: 'DEMO PET', cls: 'border-purple-400 text-purple-300' },
  fallback: { text: 'OFFLINE CACHE', cls: 'border-amber-400 text-amber-300' },
} as const;

function KeyHints() {
  return (
    <p className="text-center font-mono text-[11px] leading-relaxed text-zinc-300">
      <span className="font-bold text-amber-400">A</span> or Left: next item
      <span className="mx-1.5 text-zinc-500" aria-hidden="true">
        |
      </span>
      <span className="font-bold text-emerald-400">B</span> or Enter: do it
      <span className="mx-1.5 text-zinc-500" aria-hidden="true">
        |
      </span>
      <span className="font-bold text-rose-400">C</span> or Esc: stats
    </p>
  );
}

export function PetConsole({ repoKey, variant = 'full' }: { repoKey: string; variant?: 'full' | 'device' }) {
  const [menuIndex, setMenuIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [anim, setAnim] = useState<LcdAnimation | null>(null);
  const [heal, setHeal] = useState<HealState | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const now = useNow();

  const timers = useRef<number[]>([]);
  const lastFx = useRef<{ name: LcdAnimation | null; at: number }>({ name: null, at: 0 });
  const hintTimer = useRef<number | null>(null);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach((t) => window.clearTimeout(t));
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, []);

  // One-shot LCD animation plus its sound. The null gap lets the same animation replay.
  const fx = useCallback((name: LcdAnimation) => {
    const t = Date.now();
    // A stage change and the action that caused it both ask for the same effect.
    if (lastFx.current.name === name && t - lastFx.current.at < 600) return;
    lastFx.current = { name, at: t };
    FX_SOUND[name]();
    timers.current.forEach((id) => window.clearTimeout(id));
    setAnim(null);
    timers.current = [
      window.setTimeout(() => setAnim(name), 30),
      window.setTimeout(() => setAnim(null), 30 + ANIM_MS),
    ];
  }, []);

  const showHint = useCallback((text: string | null) => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setHint(text);
    if (text) hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS);
  }, []);

  const onStageChange = useCallback(
    (from: PetStage, to: PetStage) => {
      if (to === 'ZOMBIE_CORPSE') fx('die');
      else if (from === 'ZOMBIE_CORPSE') {
        showHint(null);
        fx('revive');
      }
    },
    [fx, showHint]
  );

  const { data, error, busy, act, refresh } = usePet(repoKey, { onStageChange });
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  });

  const pet = data?.pet ?? null;
  const dead = pet?.stage === 'ZOMBIE_CORPSE';
  const items = !pet ? LOADING_MENU : dead ? DEAD_MENU : ALIVE_MENU;
  const activeIndex = menuIndex % items.length;
  const isDemo = repoKey.startsWith('demo/');

  const runAction = useCallback(
    async (action: 'feed' | 'clean' | 'revive') => {
      const before = latest.current?.events[0]?.id;
      const out = await act(action);
      const res = out.response;
      if (!res) {
        showHint(out.error ?? 'Nothing happened.');
        return;
      }
      if (out.httpStatus === 409 && action === 'revive') {
        soundSynth.playDeath();
        showHint('Revive only works while the latest CI run is green. Fix the build, push, then try again.');
        return;
      }
      // No new event means the server refused (too full, still dead): stay quiet.
      if (res.events[0]?.id === before) return;
      if (action === 'feed') fx('eat');
      if (action === 'clean') fx('clean');
    },
    [act, fx, showHint]
  );

  // Each diagnosis request gets an id; closing the dialog bumps it, so a late answer cannot reopen it.
  const healRun = useRef(0);
  const closeHeal = useCallback(() => {
    healRun.current++;
    setHeal(null);
  }, []);

  const runHeal = useCallback(async () => {
    const run = ++healRun.current;
    const settle = (next: HealState) => {
      if (healRun.current === run) setHeal(next);
    };
    setHeal({ status: 'loading' });
    soundSynth.playSelect();
    try {
      const res = await fetch('/api/auto-heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoKey }),
      });
      const body = (await res.json().catch(() => null)) as { success?: boolean; diagnosis?: HealDiagnosis; error?: string } | null;
      if (res.ok && body?.success && body.diagnosis) {
        settle({ status: 'ready', diagnosis: body.diagnosis });
        if (healRun.current === run) fx('heal');
      } else {
        settle({ status: 'error', message: body?.error ?? `server answered ${res.status}` });
      }
    } catch {
      settle({ status: 'error', message: 'cannot reach the server' });
    }
  }, [repoKey, fx]);

  const onA = () => {
    soundSynth.playSelect();
    setShowStats(false);
    setMenuIndex((i) => ((i % items.length) + 1) % items.length);
  };

  const onB = () => {
    if (!pet || busy) return;
    const selected = items[activeIndex];
    if (selected === 'STATS') {
      soundSynth.playSelect();
      setShowStats((s) => !s);
    } else if (selected === 'HEAL') void runHeal();
    else if (selected === 'FEED') void runAction('feed');
    else if (selected === 'CLEAN') void runAction('clean');
    else if (selected === 'REVIVE') void runAction('revive');
  };

  const onC = () => {
    soundSynth.playSelect();
    setShowStats((s) => !s);
  };

  const simulate = async (event: SimulatedEvent) => {
    if (busy) return;
    (SIM_SOUND[event.type] ?? (() => soundSynth.playSelect()))();
    const out = await act('simulate', event);
    if (!out.ok) showHint(out.error ?? 'The simulator is disabled here.');
  };

  const sync = async () => {
    soundSynth.playSelect();
    setShowStats(false);
    await act('sync');
  };

  if (error && !data) return <ErrorCard error={error} repoKey={repoKey} onRetry={() => void refresh()} />;

  const tag = data ? SOURCE_TAG[data.source] : null;

  const device = (
    <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4">
      <RetroShell onPressA={onA} onPressB={onB} onPressC={onC} haunted={dead}>
        {pet ? (
          <LcdScreen
            stage={pet.stage}
            mood={pet.mood}
            hp={pet.hp}
            fullness={pet.fullness}
            sanity={pet.sanity}
            poopCount={pet.poopCount}
            statusMessage={pet.statusMessage}
            repoName={pet.repoName}
            menuItems={items}
            activeMenuIndex={activeIndex}
            showStats={showStats}
            animation={anim}
          />
        ) : (
          <LcdScreen
            stage="EGG"
            mood="SLEEPING"
            statusMessage="LOADING..."
            repoName={repoKey}
            menuItems={LOADING_MENU}
            activeMenuIndex={0}
            showStats={false}
          />
        )}
      </RetroShell>
      <KeyHints />
      <p
        role="status"
        className={`min-h-[2.5rem] max-w-[340px] text-center font-mono text-xs leading-relaxed text-amber-200 ${hint ? '' : 'invisible'}`}
      >
        {hint ?? '\u00a0'}
      </p>
    </div>
  );

  if (variant === 'device') {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        {device}
        <Link href={`/pet/${repoKey}`} className={btnGhost}>
          OPEN FULL CONSOLE
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <h1 className="min-w-0 max-w-full break-all font-pixel text-[11px] leading-relaxed text-zinc-100 sm:text-sm">{repoKey}</h1>
        {tag && (
          <span
            className={`rounded border px-2 py-1 font-pixel text-[8px] leading-none ${tag.cls}`}
            title={data?.error ? `GitHub unavailable: ${data.error}` : undefined}
          >
            {tag.text}
          </span>
        )}
        {data && data.source !== 'demo' && (
          <span className="font-mono text-[11px] text-zinc-400">synced {timeAgo(new Date(data.fetchedAt).getTime(), now) || '...'}</span>
        )}
      </div>

      {error && data && (
        <p role="status" className="mx-auto mb-4 max-w-xl rounded border border-amber-400 px-3 py-2 text-center font-mono text-xs text-amber-200">
          Connection trouble ({error.message}). Showing the last known state, retrying every 15 seconds.
        </p>
      )}

      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px_minmax(0,1fr)]">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          {pet && <StatsCard pet={pet} />}
          <EventLog events={data?.events ?? []} />
        </div>

        <div className="order-1 min-w-0 lg:order-2">
          {device}
          <div className="mt-2 flex justify-center">
            <button type="button" onClick={() => void sync()} disabled={busy || !data} className={btnGhost}>
              {isDemo ? 'RESET DEMO' : 'SYNC NOW'}
            </button>
          </div>
        </div>

        <div className="order-3 min-w-0 space-y-4">
          {canSimulateHere(repoKey) && <SimulatorPanel disabled={busy || !pet} onSimulate={(e) => void simulate(e)} />}
          <BadgeEmbed repoKey={repoKey} version={data?.events[0]?.id ?? ''} />
          <WebhookSetup />
        </div>
      </div>

      <div className="mt-12 border-t-2 border-purple-900 pt-6">
        <h2 className="mb-3 font-pixel text-[10px] leading-relaxed text-[#9bbc0f]">MEET ANOTHER PET</h2>
        <DemoChips current={repoKey} />
      </div>

      {heal && <HealModal state={heal} repo={repoKey} onClose={closeHeal} />}
    </>
  );
}
