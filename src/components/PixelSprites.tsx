import React from 'react';
import { PetStage } from '@/lib/types';

interface PixelSpriteProps {
  stage: PetStage;
  isBlinking?: boolean;
  className?: string;
}

export const EggSprite: React.FC<{ isBlinking?: boolean }> = ({ isBlinking }) => (
  <svg
    viewBox="0 0 64 64"
    className="w-full h-full pixelated select-none"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Shadow */}
    <ellipse cx="32" cy="56" rx="14" ry="3" fill="#306230" opacity="0.6" />

    {/* Left Bat Wing */}
    <path
      d="M10 24 L22 28 L20 36 L14 34 L12 40 L6 30 Z"
      fill="#0f380f"
      className="origin-bottom-right animate-pulse"
    />
    {/* Right Bat Wing */}
    <path
      d="M54 24 L42 28 L44 36 L50 34 L52 40 L58 30 Z"
      fill="#0f380f"
      className="origin-bottom-left animate-pulse"
    />

    {/* Egg Base Body */}
    <ellipse cx="32" cy="38" rx="14" ry="17" fill="#8bac0f" stroke="#0f380f" strokeWidth="2.5" />

    {/* Egg Cracks / Spots */}
    <circle cx="26" cy="32" r="2.5" fill="#306230" />
    <circle cx="36" cy="42" r="3" fill="#306230" />
    <circle cx="30" cy="47" r="2" fill="#306230" />
    <path d="M 30 24 L 33 28 L 29 30" stroke="#0f380f" strokeWidth="1.5" fill="none" />

    {/* Peek Eyes if Blinking */}
    {isBlinking && (
      <g>
        <circle cx="28" cy="36" r="1.5" fill="#0f380f" />
        <circle cx="36" cy="36" r="1.5" fill="#0f380f" />
      </g>
    )}
  </svg>
);

export const BabyGhostSprite: React.FC<{ isBlinking?: boolean }> = ({ isBlinking }) => (
  <svg
    viewBox="0 0 64 64"
    className="w-full h-full pixelated select-none"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Floating Shadow */}
    <ellipse cx="32" cy="57" rx="11" ry="2.5" fill="#306230" opacity="0.5" />

    {/* Ghost Body Floating Group */}
    <g className="animate-bounce" style={{ animationDuration: '2.5s' }}>
      {/* Ghost Main Sheet */}
      <path
        d="M20 30 C20 20 44 20 44 30 L44 48 L40 45 L36 49 L32 45 L28 49 L24 45 L20 48 Z"
        fill="#9bbc0f"
        stroke="#0f380f"
        strokeWidth="2.5"
      />
      {/* Ghost Inner Highlight */}
      <path
        d="M24 30 C24 24 40 24 40 30 L40 42 L36 40 L32 43 L28 40 L24 42 Z"
        fill="#8bac0f"
        opacity="0.7"
      />

      {/* Witch Hat */}
      <path d="M12 28 L52 28 L46 25 L38 12 L32 6 L28 16 L20 25 Z" fill="#0f380f" />
      <path d="M22 25 L42 25 L40 27 L24 27 Z" fill="#8bac0f" />
      <rect x="30" y="24" width="4" height="3" fill="#9bbc0f" />

      {/* Cute Eyes & Mouth */}
      {!isBlinking ? (
        <g>
          <circle cx="28" cy="34" r="2" fill="#0f380f" />
          <circle cx="36" cy="34" r="2" fill="#0f380f" />
          <path d="M30 38 Q32 40 34 38" stroke="#0f380f" strokeWidth="1.5" fill="none" />
        </g>
      ) : (
        <g>
          <line x1="26" y1="34" x2="30" y2="34" stroke="#0f380f" strokeWidth="2" />
          <line x1="34" y1="34" x2="38" y2="34" stroke="#0f380f" strokeWidth="2" />
          <line x1="30" y1="38" x2="34" y2="38" stroke="#0f380f" strokeWidth="1.5" />
        </g>
      )}

      {/* Rosy Cheeks */}
      <circle cx="24" cy="36" r="1.5" fill="#306230" />
      <circle cx="40" cy="36" r="1.5" fill="#306230" />
    </g>
  </svg>
);

export const CodeDemonSprite: React.FC<{ isBlinking?: boolean }> = ({ isBlinking }) => (
  <svg
    viewBox="0 0 64 64"
    className="w-full h-full pixelated select-none"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Shadow */}
    <ellipse cx="30" cy="57" rx="14" ry="3" fill="#306230" opacity="0.7" />

    {/* Pitchfork in Left Hand */}
    <g>
      <line x1="49" y1="20" x2="49" y2="52" stroke="#0f380f" strokeWidth="2" />
      <path d="M44 20 L44 26 L54 26 L54 20" stroke="#0f380f" strokeWidth="2" fill="none" />
      <line x1="49" y1="16" x2="49" y2="26" stroke="#0f380f" strokeWidth="2" />
      <line x1="44" y1="16" x2="44" y2="20" stroke="#0f380f" strokeWidth="2" />
      <line x1="54" y1="16" x2="54" y2="20" stroke="#0f380f" strokeWidth="2" />
    </g>

    {/* Demon Horns */}
    <path d="M18 16 C16 10 21 8 23 18 Z" fill="#0f380f" />
    <path d="M38 18 C40 8 45 10 43 16 Z" fill="#0f380f" />

    {/* Demon Body */}
    <rect x="18" y="20" width="24" height="26" rx="6" fill="#0f380f" />

    {/* Demon Arms */}
    <rect x="12" y="27" width="7" height="6" rx="2" fill="#0f380f" />
    <rect x="41" y="27" width="9" height="6" rx="2" fill="#0f380f" />

    {/* Demon Legs */}
    <rect x="21" y="44" width="6" height="8" rx="2" fill="#0f380f" />
    <rect x="33" y="44" width="6" height="8" rx="2" fill="#0f380f" />

    {/* Menacing Eyes */}
    {!isBlinking ? (
      <g>
        <polygon points="22,28 28,30 22,32" fill="#9bbc0f" />
        <polygon points="38,28 32,30 38,32" fill="#9bbc0f" />
      </g>
    ) : (
      <g>
        <line x1="22" y1="30" x2="28" y2="30" stroke="#9bbc0f" strokeWidth="2" />
        <line x1="32" y1="30" x2="38" y2="30" stroke="#9bbc0f" strokeWidth="2" />
      </g>
    )}

    {/* Wicked Tooth Grin */}
    <path d="M23 37 Q30 42 37 37 Z" fill="#9bbc0f" stroke="#0f380f" strokeWidth="1" />
    <polygon points="25,37 27,40 29,37" fill="#0f380f" />
    <polygon points="31,37 33,40 35,37" fill="#0f380f" />
  </svg>
);

export const ZombieCorpseSprite: React.FC<{ isBlinking?: boolean }> = () => (
  <svg
    viewBox="0 0 64 64"
    className="w-full h-full pixelated select-none"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Gravestone on Left */}
    <path d="M8 38 C8 32 18 32 18 38 L18 54 L8 54 Z" fill="#306230" stroke="#0f380f" strokeWidth="1.5" />
    <line x1="13" y1="36" x2="13" y2="44" stroke="#0f380f" strokeWidth="1.5" />
    <line x1="10" y1="39" x2="16" y2="39" stroke="#0f380f" strokeWidth="1.5" />

    {/* Bones & Dirt Pile on Right */}
    <ellipse cx="54" cy="54" rx="8" ry="3" fill="#306230" />
    <circle cx="50" cy="46" r="2" fill="#8bac0f" stroke="#0f380f" strokeWidth="1" />
    <circle cx="56" cy="46" r="2" fill="#8bac0f" stroke="#0f380f" strokeWidth="1" />
    <line x1="51" y1="46" x2="57" y2="52" stroke="#0f380f" strokeWidth="2" />

    {/* Dead Floating Shadow */}
    <ellipse cx="34" cy="56" rx="10" ry="2.5" fill="#306230" opacity="0.6" />

    {/* Floating Zombie Ghost Body */}
    <g className="animate-pulse" style={{ animationDuration: '3s' }}>
      <path
        d="M24 28 C24 18 44 18 44 28 L44 46 L40 43 L36 47 L32 43 L28 47 L24 44 Z"
        fill="#8bac0f"
        stroke="#0f380f"
        strokeWidth="2"
      />

      {/* Skull Face Inset */}
      <circle cx="34" cy="28" r="8" fill="#9bbc0f" />

      {/* Dead Crossed Eyes (X X) */}
      <g stroke="#0f380f" strokeWidth="2">
        <line x1="28" y1="24" x2="32" y2="28" />
        <line x1="32" y1="24" x2="28" y2="28" />

        <line x1="36" y1="24" x2="40" y2="28" />
        <line x1="40" y1="24" x2="36" y2="28" />
      </g>

      {/* Stitched Dead Smile */}
      <line x1="29" y1="33" x2="39" y2="33" stroke="#0f380f" strokeWidth="2" />
      <line x1="31" y1="31" x2="31" y2="35" stroke="#0f380f" strokeWidth="1.5" />
      <line x1="34" y1="31" x2="34" y2="35" stroke="#0f380f" strokeWidth="1.5" />
      <line x1="37" y1="31" x2="37" y2="35" stroke="#0f380f" strokeWidth="1.5" />
    </g>
  </svg>
);

export const PoopSprite: React.FC = () => (
  <svg viewBox="0 0 16 16" className="w-5 h-5 pixelated inline-block" style={{ imageRendering: 'pixelated' }}>
    <path
      d="M7 2 Q8 1 9 2 Q10 4 8 5 Q12 6 12 9 Q13 13 8 13 Q3 13 4 9 Q4 6 8 5 Z"
      fill="#306230"
      stroke="#0f380f"
      strokeWidth="1"
    />
    <circle cx="6" cy="8" r="0.8" fill="#9bbc0f" />
    <circle cx="9" cy="8" r="0.8" fill="#9bbc0f" />
  </svg>
);

export const PixelPet: React.FC<PixelSpriteProps> = ({ stage, isBlinking }) => {
  switch (stage) {
    case 'EGG':
      return <EggSprite isBlinking={isBlinking} />;
    case 'BABY_GHOST':
      return <BabyGhostSprite isBlinking={isBlinking} />;
    case 'CODE_DEMON':
      return <CodeDemonSprite isBlinking={isBlinking} />;
    case 'ZOMBIE_CORPSE':
      return <ZombieCorpseSprite isBlinking={isBlinking} />;
    default:
      return <BabyGhostSprite isBlinking={isBlinking} />;
  }
};
