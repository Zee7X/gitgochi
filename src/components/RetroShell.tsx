'use client';

import React from 'react';

interface RetroShellProps {
  children: React.ReactNode;
  onPressA: () => void;
  onPressB: () => void;
  onPressC: () => void;
}

export const RetroShell: React.FC<RetroShellProps> = ({
  children,
  onPressA,
  onPressB,
  onPressC,
}) => {
  return (
    <div className="relative mx-auto flex flex-col items-center select-none">
      {/* Top Keychain Loop */}
      <div className="flex flex-col items-center -mb-2 z-0">
        <div className="w-8 h-8 rounded-full border-4 border-slate-400 bg-slate-300 shadow-md flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-slate-800" />
        </div>
      </div>

      {/* Main Handheld Egg Shell Body (Translucent Atomic Purple) */}
      <div className="relative z-10 w-[340px] sm:w-[380px] h-[480px] rounded-[50%/40%] bg-gradient-to-b from-[#6b2a8d]/95 via-[#511870]/90 to-[#370c4e]/95 p-6 shadow-2xl border-4 border-[#8643aa]/80 backdrop-blur-md flex flex-col items-center justify-between">
        {/* Subtle internal PCB traces visible through translucent casing */}
        <div
          className="absolute inset-4 rounded-[45%/38%] pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(#10b981 1.5px, transparent 1.5px), linear-gradient(to right, #047857 1px, transparent 1px)',
            backgroundSize: '24px 24px, 48px 48px',
          }}
        />

        {/* Glossy Plastic Specular Highlight */}
        <div className="absolute top-4 left-10 right-10 h-28 rounded-[50%/30%] bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

        {/* Top Logo / Brand Bar */}
        <div className="relative z-10 pt-2 flex flex-col items-center">
          <h1 className="text-white font-mono font-black text-sm tracking-widest drop-shadow-md">
            GITGOTCHI
          </h1>
          <span className="text-[9px] text-purple-200 font-semibold tracking-wider opacity-80">
            KIRO-2026 EDITION
          </span>
        </div>

        {/* Recessed Screen Bezel */}
        <div className="relative z-10 w-full max-w-[290px] p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-zinc-700 shadow-inner flex items-center justify-center">
          {children}
        </div>

        {/* Hardware Controls & Speaker Section */}
        <div className="relative z-10 w-full flex flex-col items-center gap-4 pb-4">
          {/* 3 Physical Tactile Buttons (A, B, C) */}
          <div className="flex items-center justify-center gap-7 sm:gap-9">
            {/* Button A */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onPressA}
                className="w-12 h-12 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 shadow-[0_4px_0_#92400e] active:translate-y-1 active:shadow-none transition-transform flex items-center justify-center text-zinc-900 font-black text-sm font-mono cursor-pointer"
                title="Button A: Select / Cycle"
              >
                A
              </button>
              <span className="text-[9px] text-purple-200 font-bold font-mono">
                SELECT
              </span>
            </div>

            {/* Button B */}
            <div className="flex flex-col items-center gap-1 -translate-y-2">
              <button
                type="button"
                onClick={onPressB}
                className="w-12 h-12 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-emerald-300 shadow-[0_4px_0_#065f46] active:translate-y-1 active:shadow-none transition-transform flex items-center justify-center text-zinc-900 font-black text-sm font-mono cursor-pointer"
                title="Button B: Execute / Action"
              >
                B
              </button>
              <span className="text-[9px] text-purple-200 font-bold font-mono">
                EXEC
              </span>
            </div>

            {/* Button C */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={onPressC}
                className="w-12 h-12 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 border-2 border-rose-300 shadow-[0_4px_0_#9f1239] active:translate-y-1 active:shadow-none transition-transform flex items-center justify-center text-zinc-900 font-black text-sm font-mono cursor-pointer"
                title="Button C: Cancel / Stats"
              >
                C
              </button>
              <span className="text-[9px] text-purple-200 font-bold font-mono">
                STATS
              </span>
            </div>
          </div>

          {/* Retro Speaker Grille Slits */}
          <div className="flex gap-1.5 opacity-40">
            <div className="w-1.5 h-6 rounded-full bg-purple-950" />
            <div className="w-1.5 h-7 rounded-full bg-purple-950" />
            <div className="w-1.5 h-6 rounded-full bg-purple-950" />
          </div>
        </div>
      </div>
    </div>
  );
};
