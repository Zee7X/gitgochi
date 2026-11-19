import { LCD_PALETTE, PIXEL_MAPS, composeSprite, spriteRuns } from '@/components/lcd/pixel-maps';
import type { PetStage } from '@/components/lcd/pixel-maps';
import type { PetState } from './types';

// Pure SVG string builder. No fonts, no @import, no script: GitHub's camo proxy strips them.

export interface BadgeOpts {
  size?: 'full' | 'small';
  /** Idle bob. Off for ?static=1. */
  animate?: boolean;
}

type Palette = readonly string[];

const INVERTED: Palette = [...LCD_PALETTE].reverse();
const GREY: Palette = ['#2b2b2b', '#5a5a5a', '#a8a8a8', '#c4c4c4'];

const STAGE_LABEL: Record<PetStage, string> = {
  EGG: 'EGG',
  BABY_GHOST: 'BABY GHOST',
  CODE_DEMON: 'CODE DEMON',
  NECROMANCER: 'NECROMANCER',
  ZOMBIE_CORPSE: 'ZOMBIE CORPSE',
};

const HEADER_NS = 'xmlns="http://www.w3.org/2000/svg"';
const TEXT = 'font-family="monospace" letter-spacing="1"';
const BOB_CSS =
  '@keyframes b{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-3px)}}' +
  '.bob{animation:b 1.2s steps(1) infinite}' +
  '@media(prefers-reduced-motion:reduce){.bob{animation:none}}';

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

// One path per shade keeps the sprite to a few KB.
function spritePaths(rows: readonly string[], pal: Palette): string {
  const byShade: string[][] = [[], [], [], []];
  for (const r of spriteRuns(rows)) byShade[r.shade].push(`M${r.x} ${r.y}h${r.w}v1h-${r.w}z`);
  return byShade
    .map((d, i) => (d.length ? `<path fill="${pal[i]}" d="${d.join('')}"/>` : ''))
    .join('');
}

function sprite(rows: readonly string[], pal: Palette, x: number, y: number, scale: number, bob: boolean): string {
  return `<g${bob ? ' class="bob"' : ''}><g transform="translate(${x} ${y}) scale(${scale})" shape-rendering="crispEdges">${spritePaths(rows, pal)}</g></g>`;
}

// 10 segments of `w`x`h`, filled in shade 0, empty in shade 2.
function bar(value: number, pal: Palette, x: number, y: number, w: number, h: number, gap: number): string {
  const on = Math.round(clamp(value) / 10);
  const on_d: string[] = [];
  const off_d: string[] = [];
  for (let i = 0; i < 10; i++) (i < on ? on_d : off_d).push(`M${x + i * (w + gap)} ${y}h${w}v${h}h-${w}z`);
  return (
    (on_d.length ? `<path fill="${pal[0]}" d="${on_d.join('')}"/>` : '') +
    (off_d.length ? `<path fill="${pal[2]}" d="${off_d.join('')}"/>` : '')
  );
}

function text(s: string, x: number, y: number, size: number, pal: Palette, bold = false): string {
  return `<text x="${x}" y="${y}" ${TEXT} font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="${pal[0]}">${escapeXml(s)}</text>`;
}

function wrap(w: number, h: number, pal: Palette, label: string, body: string, animate: boolean): string {
  const style = animate ? `<style>${BOB_CSS}</style>` : '';
  return (
    `<svg ${HEADER_NS} width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(label)}">` +
    `<title>${escapeXml(label)}</title>${style}` +
    `<rect width="${w}" height="${h}" fill="${pal[0]}"/>` +
    `<rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="${pal[3]}"/>` +
    body +
    `</svg>`
  );
}

/** Live badge for a pet. Dead pets get the tombstone frame and the inverted palette. */
export function renderBadge(pet: PetState, key: string, opts: BadgeOpts = {}): string {
  const dead = pet.mood === 'DEAD' || pet.stage === 'ZOMBIE_CORPSE';
  const pal = dead ? INVERTED : LCD_PALETTE;
  const bob = opts.animate !== false && !dead;
  const rows = dead ? PIXEL_MAPS.ZOMBIE_CORPSE[0] : composeSprite(pet.stage, 0, pet.mood, pet.resurrections);
  const stage = STAGE_LABEL[pet.stage];
  // No CI results means the HP is a placeholder: show "?" rather than a made-up health (pet-engine R8.1).
  const noCi = pet.recentCi.length === 0;
  const hpText = noCi ? '? NO CI' : `${Math.round(clamp(pet.hp))}%`;
  const label = `${key} ${stage} ${pet.mood} HP ${noCi ? 'unmeasured, no CI' : hpText}`;

  if (opts.size === 'small') {
    const body =
      sprite(rows, pal, 6, 4, 1, bob) +
      text(stage, 44, 17, 9, pal, true) +
      text('HP', 44, 33, 8, pal) +
      bar(pet.hp, pal, 62, 26, 8, 7, 2) +
      text(noCi ? '?' : hpText, 168, 33, 8, pal);
    return wrap(220, 40, pal, label, body, bob);
  }

  const stat = (name: string, v: number, y: number) =>
    text(name, 122, y + 8, 9, pal) + bar(v, pal, 160, y, 10, 8, 2) + text(name === 'HP' && noCi ? '?' : `${Math.round(clamp(v))}%`, 290, y + 8, 9, pal);
  const body =
    sprite(rows, pal, 9, 12, 3, bob) +
    `<rect x="111" y="12" width="2" height="96" fill="${pal[1]}"/>` +
    text(truncate(key.toUpperCase(), 25), 122, 26, 12, pal, true) +
    text(`${stage} / ${pet.mood}`, 122, 42, 9, pal) +
    stat('HP', pet.hp, 52) +
    stat('FUL', pet.fullness, 67) +
    stat('SAN', pet.sanity, 82) +
    // A pet that starved with HP left comes back with a push; one killed by red CI needs a green run (pet-engine).
    text(dead ? (pet.hp > 0 ? 'R.I.P. — PUSH CODE TO REVIVE' : 'R.I.P. — FIX CI TO REVIVE') : `RESURRECTIONS: ${pet.resurrections}`, 122, 104, 8, pal);
  return wrap(360, 120, pal, label, body, bob);
}

export type StatusKind = 'invalid' | 'not_found' | 'signal_lost';

const STATUS: Record<StatusKind, { title: string; sub: string; stage: PetStage }> = {
  invalid: { title: 'INVALID REPO', sub: 'USE OWNER/REPO', stage: 'EGG' },
  not_found: { title: 'REPO NOT FOUND', sub: 'NO PET HATCHED HERE', stage: 'EGG' },
  signal_lost: { title: 'SIGNAL LOST', sub: 'GITHUB UNREACHABLE', stage: 'BABY_GHOST' },
};

/** Grey badge for repos we cannot show. Served with 200 (except invalid) so README images do not break. */
export function renderStatusBadge(kind: StatusKind, opts: BadgeOpts = {}): string {
  const { title, sub, stage } = STATUS[kind];
  const rows = PIXEL_MAPS[stage][0];
  if (opts.size === 'small') {
    const body = sprite(rows, GREY, 6, 4, 1, false) + text(title, 44, 17, 9, GREY, true) + text(sub, 44, 31, 8, GREY);
    return wrap(220, 40, GREY, title, body, false);
  }
  const body =
    sprite(rows, GREY, 9, 12, 3, false) +
    `<rect x="111" y="12" width="2" height="96" fill="${GREY[1]}"/>` +
    text(title, 122, 56, 13, GREY, true) +
    text(sub, 122, 76, 9, GREY);
  return wrap(360, 120, GREY, title, body, false);
}
