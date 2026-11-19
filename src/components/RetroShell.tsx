'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { soundSynth } from '@/lib/audio-synth';

type ButtonId = 'A' | 'B' | 'C';

interface RetroShellProps {
  children: React.ReactNode;
  onPressA: () => void;
  onPressB: () => void;
  onPressC: () => void;
  /** Force the ghostly glow. It also switches on by itself while a dead LCD is inside. */
  haunted?: boolean;
}

const KEY_TO_BUTTON: Record<string, ButtonId> = {
  arrowleft: 'A',
  a: 'A',
  enter: 'B',
  b: 'B',
  ' ': 'B',
  c: 'C',
  escape: 'C',
};

const BUTTONS: {
  id: ButtonId;
  label: string;
  caption: string;
  aria: string;
  color: string;
  lift?: boolean;
}[] = [
  {
    id: 'A',
    label: 'A',
    caption: 'SELECT',
    aria: 'Button A: select next menu item (Left Arrow or A)',
    color: 'from-amber-400 to-amber-600 border-amber-300 shadow-[0_4px_0_#92400e]',
  },
  {
    id: 'B',
    label: 'B',
    caption: 'EXEC',
    aria: 'Button B: confirm action (Enter, Space or B)',
    color: 'from-emerald-400 to-emerald-600 border-emerald-300 shadow-[0_4px_0_#065f46]',
    lift: true,
  },
  {
    id: 'C',
    label: 'C',
    caption: 'STATS',
    aria: 'Button C: cancel or check stats (Escape or C)',
    color: 'from-rose-400 to-rose-600 border-rose-300 shadow-[0_4px_0_#9f1239]',
  },
];

const subscribeMute = (cb: () => void) => soundSynth.subscribe(cb);
const getMuted = () => soundSynth.isMuted();
const getMutedServer = () => false;

/** Board traces seen through the translucent casing: pads, caps and a coin cell. */
const PcbArt: React.FC = () => (
  <svg
    className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] pointer-events-none"
    viewBox="0 0 360 580"
    preserveAspectRatio="none"
    aria-hidden="true"
    shapeRendering="crispEdges"
    fill="none"
  >
    <g stroke="#7dffb4" strokeOpacity="0.32" strokeWidth="2">
      <path d="M30 300 H70 V260 H40 V200" />
      <path d="M330 300 H290 V250 H322 V190" />
      <path d="M60 420 H110 V470 H170" />
      <path d="M300 420 H250 V470 H190" />
      <path d="M20 360 H55 V400 H90" />
      <path d="M340 360 H305 V400 H270" />
    </g>
    <g fill="#f2c94c" fillOpacity="0.5">
      {[
        [30, 300], [330, 300], [40, 200], [322, 190], [60, 420], [300, 420], [20, 360], [340, 360],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width="8" height="8" />
      ))}
    </g>
    <g stroke="#1b1033" strokeOpacity="0.55" strokeWidth="2" fill="#0f0a1f" fillOpacity="0.55">
      <rect x="22" y="440" width="26" height="14" />
      <rect x="312" y="440" width="26" height="14" />
      <circle cx="318" cy="120" r="14" />
    </g>
  </svg>
);

const RetroShell: React.FC<RetroShellProps> = ({ children, onPressA, onPressB, onPressC, haunted }) => {
  const [pressed, setPressed] = useState<ButtonId | null>(null);
  const timer = useRef<number | null>(null);
  const muted = useSyncExternalStore(subscribeMute, getMuted, getMutedServer);

  // Latest handlers without re-binding the window listener each render.
  const handlers = useRef({ A: onPressA, B: onPressB, C: onPressC });
  useEffect(() => {
    handlers.current = { A: onPressA, B: onPressB, C: onPressC };
  });

  const flash = useCallback((id: ButtonId) => {
    setPressed(id);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPressed(null), 120);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const id = KEY_TO_BUTTON[e.key.toLowerCase()];
      if (!id) return;
      const target = e.target instanceof Element ? e.target : null;
      const ownButton = target?.closest('[data-gg-btn]');
      const nativeActivation = e.key === 'Enter' || e.key === ' ';
      // Leave typing fields and other controls alone; our own buttons click natively on Enter/Space.
      if (target?.closest('input,textarea,select,a,button,[contenteditable="true"],[role="button"]') && !ownButton) return;
      flash(id);
      if (ownButton && nativeActivation) return;
      e.preventDefault();
      if (!e.repeat) handlers.current[id]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [flash]);

  return (
    <div className="relative mx-auto flex flex-col items-center select-none">
      {/* Keychain loop */}
      <div className="flex flex-col items-center -mb-2 z-0">
        <div className="w-8 h-8 rounded-full border-4 border-slate-400 bg-slate-300 shadow-md flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-slate-800" />
        </div>
      </div>

      {/* Egg casing: translucent atomic purple */}
      <div
        className={`gg-shell ${haunted ? 'gg-shell-haunted' : ''} relative z-10 w-[340px] sm:w-[380px] h-[600px] rounded-[50%/34%] overflow-hidden bg-gradient-to-b from-[#6b2a8d]/95 via-[#511870]/90 to-[#370c4e]/95 px-6 pt-10 pb-8 shadow-2xl border-4 border-[#8643aa]/80 backdrop-blur-md flex flex-col items-center justify-between`}
      >
        <PcbArt />

        {/* Specular highlight */}
        <div className="absolute top-4 left-10 right-10 h-28 rounded-[50%/30%] bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

        {/* Printed logo */}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <h1
            className="font-pixel text-[15px] leading-none tracking-[0.12em] text-[#f6efff]"
            style={{ textShadow: '2px 2px 0 #2a0a3d, 0 0 8px rgba(190, 140, 255, 0.55)' }}
          >
            GITGOTCHI
          </h1>
          <span className="font-pixel text-[7px] tracking-widest text-purple-200">
            KIRO-2026 EDITION
          </span>
        </div>

        {/* Recessed screen bezel */}
        <div className="relative z-10 w-full max-w-[290px] p-3 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-zinc-700 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] flex items-center justify-center">
          {children}
        </div>

        {/* Controls + speaker */}
        <div className="relative z-10 w-full flex flex-col items-center gap-5">
          <div className="flex items-center justify-center gap-7 sm:gap-9">
            {BUTTONS.map((b) => (
              <div key={b.id} className={`flex flex-col items-center gap-1.5 ${b.lift ? '-translate-y-2' : ''}`}>
                <button
                  type="button"
                  data-gg-btn
                  data-pressed={pressed === b.id}
                  onClick={{ A: onPressA, B: onPressB, C: onPressC }[b.id]}
                  aria-label={b.aria}
                  className={`gg-btn w-12 h-12 rounded-full bg-gradient-to-b border-2 flex items-center justify-center text-zinc-950 font-pixel text-xs ${b.color}`}
                >
                  {b.label}
                </button>
                <span className="font-pixel text-[7px] text-purple-100/90" aria-hidden="true">
                  {b.caption}
                </span>
              </div>
            ))}
          </div>

          {/* Speaker grille doubles as the mute switch */}
          <button
            type="button"
            onClick={() => soundSynth.toggleMuted()}
            aria-pressed={muted}
            aria-label={muted ? 'Sound off. Press to unmute' : 'Sound on. Press to mute'}
            title={muted ? 'Unmute' : 'Mute'}
            className="gg-chip flex items-center gap-2 px-2 py-1 rounded-full cursor-pointer"
          >
            <span className="relative grid grid-cols-5 gap-1.5" aria-hidden="true">
              {Array.from({ length: 15 }, (_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full bg-purple-950 shadow-[inset_0_1px_1px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.18)] ${muted ? 'opacity-40' : ''}`}
                />
              ))}
              {muted && <span className="absolute -inset-x-1 top-1/2 h-0.5 -rotate-[20deg] bg-rose-400" />}
            </span>
            <span
              className={`font-pixel text-[7px] ${muted ? 'text-rose-300 line-through' : 'text-purple-100/90'}`}
              aria-hidden="true"
            >
              {muted ? 'MUTE' : 'SND'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export { RetroShell };
