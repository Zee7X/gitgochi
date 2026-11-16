'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  composeSprite,
  deriveMood,
  ICON_MAPS,
  POOP_MAP,
  spriteRuns,
  type IconName,
  type PetMood,
  type PetStage,
  type SpriteMatrix,
} from './lcd/pixel-maps';

// Fills come from --lcd-s0..s3 (globals.css) so the dead LCD can invert the palette.
const SHADE_CLASS = ['lcd-f0', 'lcd-f1', 'lcd-f2', 'lcd-f3'] as const;

export const PixelGrid: React.FC<{
  rows: SpriteMatrix;
  className?: string;
  title?: string;
}> = ({ rows, className = 'w-full h-full', title }) => (
  <svg
    viewBox={`0 0 ${rows[0]?.length ?? 32} ${rows.length}`}
    className={`pixelated select-none ${className}`}
    shapeRendering="crispEdges"
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    {spriteRuns(rows).map((r) => (
      <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} className={SHADE_CLASS[r.shade]} />
    ))}
  </svg>
);

export const PoopSprite: React.FC<{ className?: string }> = ({ className = 'w-5 h-5 inline-block' }) => (
  <PixelGrid rows={POOP_MAP} className={className} />
);

export const PixelIcon: React.FC<{ name: IconName; className?: string }> = ({ name, className = 'w-full h-full' }) => (
  <PixelGrid rows={ICON_MAPS[name]} className={className} />
);

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );

interface PixelSpriteProps {
  stage: PetStage;
  mood?: PetMood;
  /** Legacy: forces the blink/closed-eye frame. */
  isBlinking?: boolean;
  /** Pin a frame and stop the idle loop (badge/static renders). */
  frame?: 0 | 1;
  /** Faint previous-frame trail, LCD ghosting. */
  ghosting?: boolean;
  className?: string;
}

export const PixelPet: React.FC<PixelSpriteProps> = ({
  stage,
  mood = 'HAPPY',
  isBlinking,
  frame,
  ghosting = false,
  className = 'w-full h-full',
}) => {
  const [tick, setTick] = useState<0 | 1>(0);
  const reduced = usePrefersReducedMotion();
  const animated = frame === undefined && isBlinking === undefined && !reduced;

  useEffect(() => {
    if (!animated) return;
    const id = window.setInterval(() => setTick((t) => (t ? 0 : 1)), 700);
    return () => window.clearInterval(id);
  }, [animated]);

  const current: 0 | 1 = frame ?? (isBlinking ? 1 : animated ? tick : 0);
  const other: 0 | 1 = current ? 0 : 1;
  const label = `${stage.replace('_', ' ').toLowerCase()} pet, ${mood.toLowerCase()}`;

  return (
    <div className={`relative ${className}`}>
      {ghosting && animated && (
        <div className="absolute inset-0 opacity-25">
          <PixelGrid rows={composeSprite(stage, other, mood)} />
        </div>
      )}
      <div className="relative w-full h-full">
        <PixelGrid rows={composeSprite(stage, current, mood)} title={label} />
      </div>
    </div>
  );
};

export { deriveMood };
export type { PetStage, PetMood };
