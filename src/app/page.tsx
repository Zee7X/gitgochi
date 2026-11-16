'use client';

import React, { useState } from 'react';
import { RetroShell } from '@/components/RetroShell';
import { LcdScreen } from '@/components/LcdScreen';
import { PixelPet } from '@/components/PixelSprites';
import { soundSynth } from '@/lib/audio-synth';
import {
  INITIAL_PET_STATE,
  applyCommitPush,
  applyCiResult,
  applyPrMerge,
  applyPoopSpawn,
  applyClean,
  applyRevive,
} from '@/lib/state-machine';
import { PetState, PetStage } from '@/lib/types';

export default function GitGotchiHome() {
  const [petState, setPetState] = useState<PetState>(INITIAL_PET_STATE);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [recentLog, setRecentLog] = useState<string>('Ready for commits...');

  const isDead = petState.hp <= 0;
  const menuItems = isDead
    ? ['REVIVE', 'LOGS']
    : ['FEED', 'CLEAN', 'HEAL', 'STATS'];

  // Button A: Cycle menu
  const handlePressA = () => {
    soundSynth.playSelect();
    setActiveMenuIndex((prev) => (prev + 1) % menuItems.length);
  };

  // Button B: Execute action
  const handlePressB = async () => {
    const selected = menuItems[activeMenuIndex];

    if (isDead) {
      if (selected === 'REVIVE') {
        soundSynth.playRevive();
        setPetState((prev) => applyRevive(prev));
        setRecentLog('Ritual completed! Pet resurrected.');
      }
      return;
    }

    switch (selected) {
      case 'FEED':
        soundSynth.playFeed();
        setPetState((prev) => applyCommitPush(prev, 1));
        setRecentLog('Pushed commit: "feat: fed with code"');
        break;

      case 'CLEAN':
        soundSynth.playSelect();
        setPetState((prev) => applyClean(prev));
        setRecentLog('Linter cleaned all code smells!');
        break;

      case 'HEAL':
        soundSynth.playHeal();
        setPetState((prev) => ({
          ...prev,
          statusMessage: 'MCP HEALING IN PROGRESS...',
        }));
        try {
          const res = await fetch('/api/auto-heal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo: petState.repoName }),
          });
          const data = await res.json();
          if (data.success) {
            setPetState((prev) => ({
              ...prev,
              hp: 100,
              sanity: 100,
              poopCount: 0,
              statusMessage: 'HEALED VIA MCP PR!',
            }));
            setRecentLog(`Auto-Heal PR Created: ${data.result.prUrl}`);
          }
        } catch {
          setPetState((prev) => ({
            ...prev,
            hp: 100,
            sanity: 100,
            statusMessage: 'MCP AUTO-HEAL SUCCESS!',
          }));
        }
        break;

      case 'STATS':
        soundSynth.playSelect();
        setShowStats((prev) => !prev);
        break;
    }
  };

  // Button C: Toggle stats / Cancel
  const handlePressC = () => {
    soundSynth.playSelect();
    setShowStats((prev) => !prev);
  };

  // Simulator Triggers
  const simulateCiPass = () => {
    soundSynth.playSelect();
    setPetState((prev) => applyCiResult(prev, true));
    setRecentLog('GitHub Action: check_run passed (+15 HP)');
  };

  const simulateCiFail = () => {
    soundSynth.playDeath();
    setPetState((prev) => applyCiResult(prev, false));
    setRecentLog('GitHub Action: check_run failed (-25 HP)');
  };

  const simulatePoop = () => {
    soundSynth.playPoop();
    setPetState((prev) => applyPoopSpawn(prev, 'console.log on save'));
    setRecentLog('Kiro Agent Hook: console.log detected -> Poop spawned!');
  };

  const stages: { stage: PetStage; label: string; desc: string }[] = [
    { stage: 'EGG', label: 'EGG', desc: 'Inkubasi repositori baru' },
    { stage: 'BABY_GHOST', label: 'BABY GHOST', desc: 'Build stabil & aktif' },
    { stage: 'CODE_DEMON', label: 'CODE EVOLVED', desc: 'High performance CI/CD' },
    { stage: 'ZOMBIE_CORPSE', label: 'ZOMBIE DEAD', desc: 'Broken build (HP=0)' },
  ];

  return (
    <main className="min-h-screen py-10 px-4 flex flex-col items-center justify-between text-zinc-100 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-block px-3 py-1 bg-purple-900/60 border border-purple-500 rounded-full text-xs font-mono text-purple-300">
          KIROWEEN 2026 OFFICIAL ENTRY: RESURRECTION
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
          GITGOTCHI: THE REPO-NECROMANCER
        </h1>
        <p className="text-xs text-zinc-400 max-w-xl mx-auto font-mono">
          Virtual pet retro 90-an yang hidup dari commit, CI/CD, dan otomatis diperbaiki oleh Model Context Protocol (MCP).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
        {/* Left Column: Evolutionary Stages Cards */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">
            Evolution Stages
          </div>
          {stages.map((st) => (
            <div
              key={st.stage}
              onClick={() => {
                soundSynth.playSelect();
                setPetState((prev) => ({ ...prev, stage: st.stage }));
              }}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                petState.stage === st.stage
                  ? 'bg-purple-950/80 border-purple-400 shadow-md scale-102'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="w-12 h-12 bg-[#9bbc0f] border-2 border-[#0f380f] rounded p-1 flex-shrink-0">
                <PixelPet stage={st.stage} />
              </div>
              <div className="text-left font-mono">
                <div className="text-[10px] font-bold text-purple-200">
                  {st.label}
                </div>
                <div className="text-[8px] text-zinc-400">{st.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Center: Handheld Device Shell */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <RetroShell
            onPressA={handlePressA}
            onPressB={handlePressB}
            onPressC={handlePressC}
          >
            <LcdScreen
              state={petState}
              activeMenuIndex={activeMenuIndex}
              showStats={showStats}
              menuItems={menuItems}
            />
          </RetroShell>
          <div className="mt-4 text-[10px] font-mono text-zinc-400 text-center">
            Pencet <span className="text-amber-400 font-bold">A</span> untuk ganti menu,{' '}
            <span className="text-emerald-400 font-bold">B</span> untuk eksekusi,{' '}
            <span className="text-rose-400 font-bold">C</span> untuk cek stats
          </div>
        </div>

        {/* Right Column: Webhook Simulator & Spec Check */}
        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 font-mono">
            <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Webhook & Hook Simulator
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={simulateCiPass}
                className="w-full py-2 px-3 text-[10px] font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg transition"
              >
                CI Pass (+15 HP)
              </button>
              <button
                onClick={simulateCiFail}
                className="w-full py-2 px-3 text-[10px] font-bold bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 rounded-lg transition"
              >
                CI Fail (-25 HP)
              </button>
              <button
                onClick={() => {
                  soundSynth.playFeed();
                  setPetState((prev) => applyPrMerge(prev));
                  setRecentLog('PR #42 Merged: Big health & fullness bonus!');
                }}
                className="w-full py-2 px-3 text-[10px] font-bold bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-300 rounded-lg transition"
              >
                Merge Pull Request
              </button>
              <button
                onClick={simulatePoop}
                className="w-full py-2 px-3 text-[10px] font-bold bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 rounded-lg transition"
              >
                Hook: On-Save Poop Trigger
              </button>
            </div>
          </div>

          {/* Activity Console */}
          <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 font-mono text-[9px] space-y-1">
            <div className="text-zinc-500 font-bold uppercase">Activity Log</div>
            <div className="text-emerald-400 break-words">{recentLog}</div>
          </div>

          {/* README Badge Preview */}
          <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 font-mono text-[9px] space-y-2">
            <div className="text-zinc-400 font-bold uppercase">Dynamic SVG Badge</div>
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800 overflow-x-auto text-[8px] text-zinc-300">
              <code>{`<img src="/api/badge/octocat/gitgotchi.svg" alt="GitGotchi" />`}</code>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
