'use client';

import React from 'react';
import { PetState } from '@/lib/types';
import { PixelPet, PoopSprite } from './PixelSprites';

interface LcdScreenProps {
  state: PetState;
  activeMenuIndex: number;
  showStats: boolean;
  menuItems: string[];
}

export const LcdScreen: React.FC<LcdScreenProps> = ({
  state,
  activeMenuIndex,
  showStats,
  menuItems,
}) => {
  const renderMeter = (val: number) => {
    const totalBars = 8;
    const filled = Math.round((val / 100) * totalBars);
    return '■'.repeat(filled) + '□'.repeat(totalBars - filled);
  };

  return (
    <div className="relative w-full aspect-square max-w-[280px] bg-[#9bbc0f] border-4 border-[#0f380f] rounded-lg shadow-inner p-3 flex flex-col justify-between font-mono text-[#0f380f] select-none overflow-hidden">
      {/* Dot-matrix scanline & grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15, 56, 15, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 56, 15, 0.4) 1px, transparent 1px)',
          backgroundSize: '4px 4px',
        }}
      />

      {/* Top Header HUD */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#0f380f]/40 pb-1 text-[9px] uppercase tracking-wider font-bold">
        <span>{state.stage.replace('_', ' ')}</span>
        <div className="flex items-center gap-1">
          {state.poopCount > 0 && (
            <span className="flex items-center text-[#306230]">
              <PoopSprite /> x{state.poopCount}
            </span>
          )}
          <span className="px-1 bg-[#8bac0f] border border-[#0f380f] text-[8px] rounded">
            {state.hp > 0 ? 'LIVE' : 'DEAD'}
          </span>
        </div>
      </div>

      {/* Center Viewport */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-1">
        {showStats ? (
          <div className="w-full text-[10px] space-y-1.5 px-2">
            <div className="text-center font-bold pb-1 border-b border-[#0f380f]/30">
              REPO METRICS
            </div>
            <div>
              <div className="flex justify-between">
                <span>HP</span>
                <span>{state.hp}%</span>
              </div>
              <div className="tracking-widest text-[#0f380f] text-xs">
                {renderMeter(state.hp)}
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>FULL</span>
                <span>{state.fullness}%</span>
              </div>
              <div className="tracking-widest text-[#0f380f] text-xs">
                {renderMeter(state.fullness)}
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>SANITY</span>
                <span>{state.sanity}%</span>
              </div>
              <div className="tracking-widest text-[#0f380f] text-xs">
                {renderMeter(state.sanity)}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-28 h-28 flex items-center justify-center">
            <PixelPet stage={state.stage} />

            {/* Floating Poops */}
            {state.poopCount > 0 && (
              <div className="absolute right-0 bottom-2 flex flex-col gap-1 items-end animate-bounce">
                {Array.from({ length: state.poopCount }).map((_, idx) => (
                  <PoopSprite key={idx} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message Ticker */}
      <div className="relative z-10 text-[9px] text-center font-semibold tracking-tight py-0.5 border-t border-[#0f380f]/30 truncate">
        {state.statusMessage}
      </div>

      {/* Bottom Menu Navigation Bar */}
      <div className="relative z-10 bg-[#8bac0f] border border-[#0f380f] rounded px-1 py-0.5 mt-1 flex justify-between text-[8px] font-bold">
        {menuItems.map((item, idx) => (
          <span
            key={item}
            className={`px-1 py-0.5 transition-colors ${
              activeMenuIndex === idx
                ? 'bg-[#0f380f] text-[#9bbc0f] shadow-sm'
                : 'text-[#0f380f]'
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};
