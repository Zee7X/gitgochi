'use client';

import React, { useEffect, useState } from 'react';
import { PixelGrid, PixelIcon, PixelPet, PoopSprite } from './PixelSprites';
import {
  composeSprite,
  deriveMood,
  ICON_ORDER,
  menuIconName,
  SPARKLE_MAP,
  type PetMood,
  type PetStage,
} from './lcd/pixel-maps';

export type LcdAnimation = 'eat' | 'clean' | 'heal' | 'die' | 'revive';

/** Subset of the pet state the LCD reads. Structurally compatible with lib/types PetState. */
export interface LcdPetState {
  stage: PetStage;
  hp: number;
  fullness: number;
  sanity: number;
  poopCount: number;
  statusMessage: string;
  repoName?: string;
}

export interface LcdScreenProps {
  /** Legacy bundle. Individual props below win when both are given. */
  state?: LcdPetState;
  stage?: PetStage;
  mood?: PetMood;
  hp?: number;
  fullness?: number;
  sanity?: number;
  poopCount?: number;
  statusMessage?: string;
  repoName?: string;
  menuItems: string[];
  activeMenuIndex: number;
  showStats: boolean;
  /** One-shot (~1.2s) animation. Re-trigger by passing null in between. */
  animation?: LcdAnimation | null;
}

const ANIM_MS = 1200;
const MAX_POOPS = 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const StatBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const pct = clamp(Math.round(value), 0, 100);
  const filled = Math.round(pct / 10);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="flex justify-between pb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="lcd-seg-row" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`lcd-seg ${i < filled ? 'lcd-seg-on' : ''}`} />
        ))}
      </div>
    </div>
  );
};

function useOneShot(animation: LcdAnimation | null | undefined): LcdAnimation | null {
  const [seen, setSeen] = useState(animation ?? null);
  const [active, setActive] = useState<LcdAnimation | null>(animation ?? null);
  if ((animation ?? null) !== seen) {
    setSeen(animation ?? null);
    setActive(animation ?? null);
  }
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(null), ANIM_MS);
    return () => window.clearTimeout(id);
  }, [active]);
  return active;
}

export const LcdScreen: React.FC<LcdScreenProps> = ({
  state,
  stage: stageProp,
  mood: moodProp,
  hp: hpProp,
  fullness: fullnessProp,
  sanity: sanityProp,
  poopCount: poopProp,
  statusMessage: messageProp,
  repoName: repoProp,
  activeMenuIndex,
  showStats,
  menuItems,
  animation = null,
}) => {
  const stage = stageProp ?? state?.stage ?? 'EGG';
  const hp = hpProp ?? state?.hp ?? 100;
  const fullness = fullnessProp ?? state?.fullness ?? 100;
  const sanity = sanityProp ?? state?.sanity ?? 100;
  const poopCount = clamp(poopProp ?? state?.poopCount ?? 0, 0, MAX_POOPS);
  const message = messageProp ?? state?.statusMessage ?? '';
  const repoName = repoProp ?? state?.repoName;

  // SLEEPING only arrives through the mood prop (the loading LCD); deriveMood never returns it.
  const mood: PetMood = moodProp ?? deriveMood({ hp, fullness, sanity, poopCount, stage });
  const dead = hp <= 0 || stage === 'ZOMBIE_CORPSE' || mood === 'DEAD';
  const anim = useOneShot(animation);

  const selectedLabel = menuItems[activeMenuIndex];
  const selectedIcon = showStats ? 'stats' : selectedLabel ? menuIconName(selectedLabel) : null;
  const petAnim = anim === 'eat' ? 'lcd-hop' : anim === 'heal' ? 'lcd-blinkfx' : anim === 'die' ? 'lcd-die' : '';

  return (
    <div
      className={`lcd ${dead ? 'lcd-dead' : ''}`}
      role="group"
      aria-label={`GitGotchi screen, ${stage.replace('_', ' ').toLowerCase()}, ${dead ? 'dead' : mood.toLowerCase()}`}
    >
      {/* Top icon row: the 8 classic menu icons, the selected one inverted */}
      <div className="lcd-row lcd-icons" aria-hidden="true">
        {ICON_ORDER.map((name) => (
          <div key={name} className={`lcd-icon ${name === selectedIcon ? 'lcd-icon-on' : 'lcd-icon-off'}`}>
            <PixelIcon name={name} />
          </div>
        ))}
      </div>

      <div className="lcd-row lcd-hud">
        <span>{repoName ?? stage.replace('_', ' ')}</span>
        <span>{dead ? 'DEAD' : mood === 'SLEEPING' ? 'ZZZ' : `HP${clamp(Math.round(hp), 0, 100)}`}</span>
      </div>

      {/* Viewport */}
      <div className="lcd-row flex-1 min-h-0 flex items-center justify-center">
        {showStats ? (
          <div className="w-full px-2 space-y-3">
            <div className="text-center pb-1 border-b border-[var(--lcd-s1)]">REPO METRICS</div>
            <StatBar label="HP" value={hp} />
            <StatBar label="FULL" value={fullness} />
            <StatBar label="SANITY" value={sanity} />
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`lcd-anim h-[min(100%,128px)] aspect-square ${petAnim}`}>
              <PixelPet stage={stage} mood={mood} ghosting />
            </div>

            {anim === 'eat' && (
              <div className="lcd-anim lcd-food">
                <PixelIcon name="feed" />
              </div>
            )}
            {anim === 'clean' && <div className="lcd-anim lcd-sweep" />}
            {anim === 'heal' &&
              [28, 48, 68].map((left, i) => (
                <div
                  key={left}
                  className="lcd-anim lcd-plus"
                  style={{ left: `${left}%`, animationDelay: `${i * 0.15}s` }}
                >
                  <PixelIcon name="medicine" />
                </div>
              ))}
            {anim === 'revive' && (
              <>
                <div className="lcd-anim lcd-rise">
                  <PixelGrid rows={composeSprite('BABY_GHOST', 0, 'HAPPY')} />
                </div>
                {[18, 42, 70].map((left, i) => (
                  <div
                    key={left}
                    className="lcd-anim lcd-spark"
                    style={{ left: `${left}%`, top: `${58 - i * 8}%`, animationDelay: `${i * 0.2}s` }}
                  >
                    <PixelGrid rows={SPARKLE_MAP} />
                  </div>
                ))}
              </>
            )}

            {poopCount > 0 && (
              <div
                className={`absolute left-0 bottom-0 flex gap-0.5 ${anim === 'clean' ? 'lcd-anim lcd-poop-out' : ''}`}
                role="img"
                aria-label={`${poopCount} poop${poopCount === 1 ? '' : 's'} to clean`}
              >
                {Array.from({ length: poopCount }, (_, i) => (
                  <PoopSprite key={i} className="w-5 h-5" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status ticker; long messages scroll */}
      <div className="lcd-row lcd-ticker" aria-live="polite">
        {message.length > 30 ? <span className="lcd-ticker-run">{message}</span> : message || '\u00a0'}
      </div>

      {/* Menu labels */}
      <div className="lcd-row lcd-menu">
        {menuItems.map((item, idx) => (
          <span key={item} className={`lcd-menu-item ${activeMenuIndex === idx ? 'lcd-menu-item-on' : ''}`}>
            {item}
          </span>
        ))}
      </div>

      {/* Dot-matrix grid, scanline sweep, power flicker */}
      <div className="lcd-layer lcd-grid" aria-hidden="true" />
      <div className="lcd-layer lcd-scanline" aria-hidden="true" />
      <div className="lcd-layer lcd-flicker" aria-hidden="true" />
      {(anim === 'die' || anim === 'revive') && (
        <div className="lcd-layer lcd-anim lcd-flash" aria-hidden="true" />
      )}
    </div>
  );
};
