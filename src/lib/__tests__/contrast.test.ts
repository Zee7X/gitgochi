import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tw from 'tailwindcss/colors';
import { LCD_PALETTE } from '@/components/lcd/pixel-maps';
import { renderBadge, renderStatusBadge } from '../badge-svg';
import { getPet } from '../pet-service';

// WCAG 2.x contrast of the real color pairs (haunted-ui task 12, R4.4). Each pair names the file it
// lives in and the class, CSS declaration or hex it is drawn with, and the test checks those strings
// are still in the files, so a color change fails here until the pair and design.md (Contrast) are
// updated. Translucent colors are composited over what sits behind them.

type RGB = readonly [number, number, number];
type Ref = readonly [file: string, text: string];
type Surface = { name: string; color: RGB; src: Ref[] };
type Pair = { file: string; name: string; fg: RGB; bg: RGB; min: number; src: Ref[]; limit?: string; worst?: number };

const TEXT = 4.5; // 1.4.3 normal text. Pixel text here is 7-15 px and body text 11-16 px, so nothing counts as large.
const UI = 3; // 1.4.11: UI component boundaries and states, focus indicators, meaningful graphics.

// ---------- color math ----------
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as RGB;
const toHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const over = (fg: RGB, a: number, bg: RGB): RGB => fg.map((c, i) => c * a + bg[i] * (1 - a)) as unknown as RGB;
const mix = (a: RGB, b: RGB, s: number) => over(b, s, a);
const lum = (c: RGB) => {
  const [r, g, b] = c.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const WHITE = hex('#ffffff');

/** `[color, alpha]` of a Tailwind 3 color class: `text-zinc-300`, `hover:!bg-[#8bac0f]`, `from-white/25`. */
const twColor = (cls: string): [RGB, number] => {
  const m = cls.match(/^(?:[\w-]+:)*!?(?:text|bg|border|from|via|to|outline)-(\[#[0-9a-f]{6}\]|white|[a-z]+-\d{2,3})(?:\/(\d+))?$/);
  if (!m) throw new Error(`not a color class: ${cls}`);
  const [, name, alpha] = m;
  const [family, shade] = name.split('-');
  const rgb = name.startsWith('[')
    ? hex(name.slice(1, -1))
    : name === 'white'
      ? WHITE
      : hex((tw as unknown as Record<string, Record<string, string>>)[family][shade]);
  return [rgb, alpha ? Number(alpha) / 100 : 1];
};
const paint = (cls: string, behind?: RGB): RGB => {
  const [c, a] = twColor(cls);
  if (a === 1) return c;
  if (!behind) throw new Error(`${cls} is translucent and needs a background`);
  return over(c, a, behind);
};

// ---------- sources (paths relative to src/) ----------
const files: Record<string, string> = {};
const read = (file: string) => (files[file] ??= readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDGE = '[\\s"\'`{}();,\\[\\]]';
/** `text` appears as a whole token: `bg-zinc-950` does not match `hover:bg-zinc-950`. */
const has = (src: string, text: string) => new RegExp(`(?:^|${EDGE})${esc(text)}(?=$|${EDGE})`).test(src);

const surf = (name: string, file: string, cls: string, under?: Surface): Surface => ({
  name,
  color: paint(cls, under?.color),
  src: [[file, cls], ...(under?.src ?? [])],
});
/** Foreground class `fg` in `file` on surface `bg`. */
const pair = (file: string, what: string, fg: string, bg: Surface, min: number, limit?: string): Pair => ({
  file,
  name: `${what}: ${fg} on ${bg.name}`,
  fg: paint(fg, bg.color),
  bg: bg.color,
  min,
  limit,
  src: [[file, fg], ...bg.src],
});
const worse = (fg: string, ...bgs: Surface[]) => bgs.reduce((a, b) => (ratio(paint(fg, b.color), b.color) < ratio(paint(fg, a.color), a.color) ? b : a));

// ---------- page surfaces ----------
const LAYOUT = 'app/layout.tsx';
const HOME = 'app/page.tsx';
const UI_F = 'components/app/ui.tsx';
const CHROME = 'components/app/SiteChrome.tsx';
const ADOPT = 'components/app/AdoptForm.tsx';
const CHIPS = 'components/app/DemoChips.tsx';
const HOW = 'components/app/HowItWorks.tsx';
const STATS = 'components/app/StatsCard.tsx';
const LOG = 'components/app/EventLog.tsx';
const SIM = 'components/app/SimulatorPanel.tsx';
const BADGE_E = 'components/app/BadgeEmbed.tsx';
const HOOK = 'components/app/WebhookSetup.tsx';
const ERR = 'components/app/ErrorCard.tsx';
const HEAL = 'components/app/HealModal.tsx';
const CONSOLE = 'components/app/PetConsole.tsx';
const SHELL = 'components/RetroShell.tsx';
const SPRITES = 'components/PixelSprites.tsx';
const LCD = 'components/LcdScreen.tsx';
const CSS = 'app/globals.css';
const MAPS = 'components/lcd/pixel-maps.ts';
const BADGE = 'lib/badge-svg.ts';

const page = surf('page zinc-950', LAYOUT, 'bg-zinc-950');
const panel = surf('panel zinc-900/80', UI_F, 'bg-zinc-900/80', page);
const ghost = surf('ghost button', UI_F, 'bg-zinc-950');
const primary = surf('primary button', UI_F, 'bg-[#9bbc0f]');
const modal = surf('modal', HEAL, 'bg-[#9bbc0f]');
const finding = surf('finding', HEAL, 'bg-[#8bac0f]');
const chipOn = surf('current chip', CHIPS, 'bg-[#0f380f]');
const NOT_REQUIRED_BTN = 'not required by 1.4.11: the text label identifies the control';

// ---------- handheld shell (RetroShell.tsx) ----------
const shellTop = surf('shell top stop', SHELL, 'from-[#6b2a8d]/95', page);
const shellVia = surf('shell via stop', SHELL, 'via-[#511870]/90', page);
const shellBottom = surf('shell bottom stop', SHELL, 'to-[#370c4e]/95', page);
// h-[600px] minus border-4 top and bottom: the gradient spans a 592 px padding box. The specular
// highlight (top-4 h-28: 16..128 px) fades from white/25 to transparent. The logo h1 starts at pt-10
// (40 px), is text-[15px] leading-none tall, then gap-1.5: the edition line starts at 61 px. Each is
// measured at the top of its box, where the highlight is strongest and the gradient lightest.
const SHELL_GEOM: Ref[] = ['h-[600px]', 'border-4', 'pt-10', 'top-4 left-10 right-10 h-28', 'from-white/25 to-transparent', 'text-[15px] leading-none', 'gap-1.5'].map((t): Ref => [SHELL, t]);
const GLARE = twColor('from-white/25')[1];
const shellAt = (y: number) => {
  const t = y / 592;
  return t <= 0.5 ? mix(shellTop.color, shellVia.color, t / 0.5) : mix(shellVia.color, shellBottom.color, (t - 0.5) / 0.5);
};
const shellLit = (name: string, y: number): Surface => ({
  name,
  color: over(WHITE, GLARE * Math.min(1, Math.max(0, 1 - (y - 16) / 112)), shellAt(y)),
  src: [...shellTop.src, ...shellVia.src, ...SHELL_GEOM],
});
// Buttons are w-12 h-12 with border-2: a 44 px gradient. The text-xs line box (16 px) spans 14..30 px.
const BTN_GEOM: Ref[] = ['w-12 h-12', 'border-2', 'text-xs'].map((t): Ref => [SHELL, t]);
const face = (key: string, from: string, to: string): Surface[] =>
  [14 / 44, 30 / 44].map((s, i): Surface => ({
    name: `button ${key} gradient at the label ${i ? 'bottom' : 'top'}`,
    color: mix(paint(from), paint(to), s),
    src: [[SHELL, `${from} ${to}`], ...BTN_GEOM],
  }));
const label = (key: string, from: string, to: string) => pair(SHELL, `button ${key} label`, 'text-zinc-950', worse('text-zinc-950', ...face(key, from, to)), TEXT);

// ---------- LCD (globals.css, drawn by LcdScreen.tsx) ----------
const css = read(CSS);
const block = (sel: string) => {
  const m = css.match(new RegExp(`(?:^|\\n)${esc(sel)}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule ${sel} in ${CSS}`);
  return m[1];
};
const shade = (sel: string, prop: string) => {
  const m = block(sel).match(new RegExp(`(?:^|[;\\s])${prop}:\\s*var\\(--lcd-s(\\d)\\);`));
  if (!m) throw new Error(`no ${prop}: var(--lcd-sN) in ${sel}`);
  return Number(m[1]);
};
const vars = (sel: string) => Object.fromEntries([...block(sel).matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const rgba = (s: string): [RGB, number] => {
  const [r, g, b, a] = s.match(/[\d.]+/g)!.map(Number);
  return [[r, g, b], a];
};
const palette = (v: Record<string, string>) => {
  const [grid, gridA] = rgba(v['lcd-grid']);
  const [scan, scanA] = rgba(v['lcd-scan']);
  // Darkest/lightest a pixel gets: both grid lines (intersection) plus the scanline peak.
  const ov = (c: RGB) => over(scan, scanA, over(grid, gridA, over(grid, gridA, c)));
  return { s: [0, 1, 2, 3].map((i) => hex(v[`lcd-s${i}`])), ov };
};
const ROOT = vars(':root');
const LIVE = palette(ROOT);
const DEAD = palette({ ...ROOT, ...vars('.lcd-dead') });

const lcdPairs = (label: string, p: ReturnType<typeof palette>, menuSel: string): Pair[] => {
  const s = p.s;
  const screen = shade('.lcd', 'background');
  const textS = shade('.lcd', 'color');
  const row = (what: string, f: number, b: number, min: number, src: Ref[], limit?: string, worst = false): Pair => ({
    file: CSS,
    name: `${label} ${what}: s${f} ${toHex(s[f])} on s${b} ${toHex(s[b])}`,
    fg: s[f],
    bg: s[b],
    min,
    limit,
    src,
    worst: worst ? Math.min(ratio(s[f], p.ov(s[b])), ratio(p.ov(s[f]), s[b])) : undefined,
  });
  const sprite = (i: number) => shade(`.lcd-f${i}`, 'fill');
  return [
    row('HUD, ticker, stats text', textS, screen, TEXT, [[LCD, 'lcd-hud'], [LCD, 'lcd-ticker']], undefined, true),
    row('menu text', textS, shade(menuSel, 'background'), TEXT, [[LCD, 'lcd-menu']], undefined, true),
    row('selected menu item', shade('.lcd-menu-item-on', 'color'), shade('.lcd-menu-item-on', 'background'), TEXT, [[LCD, 'lcd-menu-item-on']], undefined, true),
    row('selected icon tile vs screen', shade('.lcd-icon-on', 'background'), screen, UI, [[LCD, 'lcd-icon-on']]),
    row('selected icon glyph', shade('.lcd-icon-on .lcd-f0', 'fill'), shade('.lcd-icon-on', 'background'), UI, [[LCD, 'lcd-icon-on']]),
    row('unselected icon glyph', shade('.lcd-icon-off .lcd-f0', 'fill'), screen, UI, [[LCD, 'lcd-icon-off']]),
    row('stat segment on vs off', shade('.lcd-seg-on', 'background'), shade('.lcd-seg', 'background'), UI, [[LCD, 'lcd-seg-on']]),
    row('sprite outline', sprite(0), screen, UI, [[SPRITES, 'lcd-f0']]),
    row('sprite shading', sprite(1), screen, UI, [[SPRITES, 'lcd-f1']]),
    row('sprite highlight', sprite(2), screen, UI, [[SPRITES, 'lcd-f2']], 'palette: s2 and s3 are the two lightest greens; every sprite is outlined in s0'),
  ];
};

// ---------- badge (rendered SVG) ----------
const NOW = Date.now();
const half = async (key: string) => ({ ...(await getPet(key, NOW, true)).pet, hp: 50 });
const badgeColors = (svg: string) => {
  const bars = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="M\d+ 52h10v8h-10z/g)].map((m) => hex(m[1]));
  return {
    text: hex(svg.match(/<text [^>]*fill="(#[0-9a-f]{6})"/)![1]),
    card: hex(svg.match(/<rect x="3" y="3" [^>]*fill="(#[0-9a-f]{6})"/)![1]),
    on: bars[0],
    off: bars[1],
  };
};
const live = badgeColors(renderBadge(await half('demo/healthy'), 'demo/healthy'));
const dead = badgeColors(renderBadge(await half('demo/haunted'), 'demo/haunted'));
const grey = badgeColors(renderStatusBadge('not_found'));
/** Where a badge hex is defined: GREY in badge-svg.ts, the LCD shades in pixel-maps.ts. */
const defined = (c: RGB): Ref => [read(BADGE).includes(`'${toHex(c)}'`) ? BADGE : MAPS, `'${toHex(c)}'`];
const badge = (what: string, fg: RGB, bg: RGB, min: number): Pair => ({
  file: BADGE,
  name: `${what}: ${toHex(fg)} on ${toHex(bg)}`,
  fg,
  bg,
  min,
  src: [defined(fg), defined(bg)],
});

// ---------- every pair ----------
const PAIRS: Pair[] = [
  ...lcdPairs('live', LIVE, '.lcd-menu'),
  ...lcdPairs('dead', DEAD, '.lcd-dead .lcd-menu'),
  {
    file: CSS,
    name: 'gg-btn / gg-chip focus outline: #fff on shell via stop',
    fg: WHITE,
    bg: shellVia.color,
    min: UI,
    src: [[CSS, 'outline: 3px solid #fff'], ...shellVia.src],
  },

  pair(SHELL, 'GITGOTCHI logo', 'text-[#f6efff]', shellLit('shell + highlight at y 40', 40), TEXT),
  pair(SHELL, 'KIRO-2026 EDITION', 'text-purple-200', shellLit('shell + highlight at y 61', 61), TEXT),
  pair(SHELL, 'button captions, SND', 'text-purple-100/90', shellVia, TEXT),
  pair(SHELL, 'button captions, SND', 'text-purple-100/90', shellBottom, TEXT),
  pair(SHELL, 'MUTE', 'text-rose-300', shellVia, TEXT),
  label('A', 'from-amber-400', 'to-amber-600'),
  label('B', 'from-emerald-400', 'to-emerald-600'),
  label('C', 'from-rose-400', 'to-rose-600'),
  pair(SHELL, 'button A border', 'border-amber-300', shellVia, UI),
  pair(SHELL, 'button B border', 'border-emerald-300', shellVia, UI),
  pair(SHELL, 'button C border', 'border-rose-300', shellVia, UI),

  pair(HOME, 'main text', 'text-zinc-100', page, TEXT),
  pair(HOME, 'hero h1', 'text-zinc-50', page, TEXT),
  pair(HOME, 'hero accent', 'text-[#9bbc0f]', page, TEXT),
  pair(HOME, 'hero copy', 'text-zinc-300', page, TEXT),
  pair(HOME, 'demo heading', 'text-purple-100', page, TEXT),

  pair(CHROME, 'logo link', 'text-[#9bbc0f]', page, TEXT),
  pair(CHROME, 'footer', 'text-zinc-400', page, TEXT),
  pair(CHROME, 'logo focus outline', 'focus-visible:outline-white', page, UI),

  pair(ADOPT, 'label', 'text-purple-100', page, TEXT),
  pair(ADOPT, 'input text', 'text-zinc-100', surf('input', ADOPT, 'bg-zinc-950'), TEXT),
  pair(ADOPT, 'placeholder', 'placeholder:text-zinc-400', surf('input', ADOPT, 'bg-zinc-950'), TEXT),
  pair(ADOPT, 'input border', 'border-purple-600', page, UI),
  pair(ADOPT, 'error', 'text-rose-300', page, TEXT),
  pair(ADOPT, 'focus outline', 'focus-visible:outline-white', page, UI),

  pair(UI_F, 'panel title', 'text-[#9bbc0f]', panel, TEXT),
  pair(UI_F, 'panel body', 'text-zinc-300', panel, TEXT),
  pair(UI_F, 'primary button label', 'text-[#0f380f]', primary, TEXT),
  pair(UI_F, 'primary button label, hover', 'text-[#0f380f]', surf('primary hover', UI_F, 'hover:bg-[#b4d62a]'), TEXT),
  pair(UI_F, 'primary button face', 'bg-[#9bbc0f]', page, UI),
  pair(UI_F, 'ghost button label', 'text-purple-100', ghost, TEXT),
  pair(UI_F, 'ghost button label, hover', 'text-purple-100', surf('ghost hover', UI_F, 'hover:bg-purple-950'), TEXT),
  pair(UI_F, 'ghost button border', 'border-purple-800', page, UI, NOT_REQUIRED_BTN),
  pair(UI_F, 'button focus outline', 'focus-visible:outline-white', page, UI),
  pair(UI_F, 'button focus outline', 'focus-visible:outline-white', panel, UI),

  pair(CHIPS, 'chip label', 'text-purple-100', surf('chip', CHIPS, 'bg-zinc-950'), TEXT),
  pair(CHIPS, 'chip label, hover', 'text-purple-100', surf('chip hover', CHIPS, 'hover:bg-purple-950'), TEXT),
  pair(CHIPS, 'chip note', 'text-zinc-400', surf('chip', CHIPS, 'bg-zinc-950'), TEXT),
  pair(CHIPS, 'current chip label', 'text-[#9bbc0f]', chipOn, TEXT),
  pair(CHIPS, 'current chip note', 'text-zinc-400', chipOn, TEXT),
  pair(CHIPS, 'current chip border (state)', 'border-[#9bbc0f]', page, UI),
  pair(CHIPS, 'chip border', 'border-purple-800', page, UI, NOT_REQUIRED_BTN),
  pair(CHIPS, 'chip focus outline', 'focus-visible:outline-white', page, UI),

  pair(HOW, 'heading', 'text-[#9bbc0f]', page, TEXT),
  pair(HOW, 'step number', 'text-purple-300', surf('panel zinc-900/80', HOW, 'bg-zinc-900/80', page), TEXT),
  pair(HOW, 'step title', 'text-zinc-100', surf('panel zinc-900/80', HOW, 'bg-zinc-900/80', page), TEXT),
  pair(HOW, 'step body', 'text-zinc-300', surf('panel zinc-900/80', HOW, 'bg-zinc-900/80', page), TEXT),

  pair(STATS, 'value', 'text-lime-300', panel, TEXT),
  pair(STATS, 'low value', 'text-rose-300', panel, TEXT),
  pair(STATS, 'term', 'text-zinc-400', panel, TEXT),
  pair(STATS, 'definition', 'text-zinc-100', panel, TEXT),
  pair(STATS, 'bar fill', 'bg-lime-400', surf('bar track', STATS, 'bg-zinc-950'), UI),
  pair(STATS, 'low bar fill', 'bg-rose-400', surf('bar track', STATS, 'bg-zinc-950'), UI),
  pair(STATS, 'bar track border', 'border-zinc-600', panel, UI, 'not required by 1.4.11: the value is printed above the bar'),
  pair(STATS, 'CI pass square', 'bg-lime-400', panel, UI),
  pair(STATS, 'CI fail square', 'bg-rose-400', panel, UI),

  pair(LOG, 'GH tag, good delta', 'text-lime-300', panel, TEXT),
  pair(LOG, 'KIRO tag', 'text-purple-300', panel, TEXT),
  pair(LOG, 'YOU tag', 'text-amber-300', panel, TEXT),
  pair(LOG, 'SYS tag, simulated tag', 'text-zinc-300', panel, TEXT),
  pair(LOG, 'bad delta', 'text-rose-300', panel, TEXT),
  pair(LOG, 'event label', 'text-zinc-100', panel, TEXT),
  pair(LOG, 'times, newest first', 'text-zinc-400', panel, TEXT),
  pair(LOG, 'list focus outline', 'focus-visible:outline-white', panel, UI),

  pair(SIM, 'intro', 'text-zinc-400', panel, TEXT),

  pair(BADGE_E, 'snippet label', 'text-zinc-400', panel, TEXT),
  pair(BADGE_E, 'snippet', 'text-zinc-200', surf('code box', BADGE_E, 'bg-zinc-950'), TEXT),
  pair(BADGE_E, 'snippet border', 'border-zinc-500', panel, UI),
  pair(BADGE_E, 'snippet focus outline', 'focus-visible:outline-white', panel, UI),

  pair(HOOK, 'summary title', 'text-[#9bbc0f]', surf('panel zinc-900/80', HOOK, 'bg-zinc-900/80', page), TEXT),
  pair(HOOK, 'show/hide, labels', 'text-zinc-400', surf('panel zinc-900/80', HOOK, 'bg-zinc-900/80', page), TEXT),
  pair(HOOK, 'body', 'text-zinc-300', surf('panel zinc-900/80', HOOK, 'bg-zinc-900/80', page), TEXT),
  pair(HOOK, 'values', 'text-zinc-100', surf('panel zinc-900/80', HOOK, 'bg-zinc-900/80', page), TEXT),
  pair(HOOK, 'payload URL', 'text-zinc-200', surf('code box', HOOK, 'bg-zinc-950'), TEXT),
  pair(HOOK, 'summary focus outline', 'focus-visible:outline-white', surf('panel zinc-900/80', HOOK, 'bg-zinc-900/80', page), UI),

  pair(ERR, 'title', 'text-rose-300', surf('error card zinc-900/90', ERR, 'bg-zinc-900/90', page), TEXT),
  pair(ERR, 'body', 'text-zinc-200', surf('error card zinc-900/90', ERR, 'bg-zinc-900/90', page), TEXT),
  pair(ERR, 'note', 'text-zinc-400', surf('error card zinc-900/90', ERR, 'bg-zinc-900/90', page), TEXT),

  pair(HEAL, 'body text', 'text-[#0f380f]', modal, TEXT),
  pair(HEAL, 'finding text', 'text-[#0f380f]', finding, TEXT),
  pair(HEAL, 'ESC and CLOSE, hover', 'text-[#0f380f]', surf('button hover', HEAL, 'hover:bg-[#8bac0f]'), TEXT),
  pair(HEAL, 'kind tag, prompt', 'text-[#9bbc0f]', surf('tag, prompt', HEAL, 'bg-[#0f380f]'), TEXT),
  pair(HEAL, 'COPY PROMPT', '!text-[#9bbc0f]', surf('COPY PROMPT', HEAL, '!bg-[#0f380f]'), TEXT),
  pair(HEAL, 'COPY PROMPT, hover', 'hover:!text-[#0f380f]', surf('COPY PROMPT hover', HEAL, 'hover:!bg-[#8bac0f]'), TEXT),
  pair(HEAL, 'button borders', 'border-[#0f380f]', modal, UI),
  pair(HEAL, 'focus outline', 'focus-visible:outline-[#0f380f]', modal, UI),
  pair(HEAL, 'link focus outline', 'focus-visible:outline-[#0f380f]', finding, UI),

  pair(CONSOLE, 'key hints', 'text-zinc-300', page, TEXT),
  pair(CONSOLE, 'key A', 'text-amber-400', page, TEXT),
  pair(CONSOLE, 'key B', 'text-emerald-400', page, TEXT),
  pair(CONSOLE, 'key C', 'text-rose-400', page, TEXT),
  pair(CONSOLE, 'key hint "|" separator', 'text-zinc-500', page, TEXT, 'aria-hidden decoration, exempt from 1.4.3'),
  pair(CONSOLE, 'hint line', 'text-amber-200', page, TEXT),
  pair(CONSOLE, 'LIVE FROM GITHUB tag', 'text-lime-300', page, TEXT),
  pair(CONSOLE, 'DEMO PET tag', 'text-purple-300', page, TEXT),
  pair(CONSOLE, 'OFFLINE CACHE tag', 'text-amber-300', page, TEXT),
  pair(CONSOLE, 'repo name', 'text-zinc-100', page, TEXT),
  pair(CONSOLE, 'synced', 'text-zinc-400', page, TEXT),
  pair(CONSOLE, 'MEET ANOTHER PET', 'text-[#9bbc0f]', page, TEXT),

  badge('live badge text', live.text, live.card, TEXT),
  badge('dead badge text', dead.text, dead.card, TEXT),
  badge('status badge text', grey.text, grey.card, TEXT),
  badge('live bar segment on vs off', live.on, live.off, UI),
  badge('dead bar segment on vs off', dead.on, dead.off, UI),
];

const rows = PAIRS.map((p) => {
  const r = ratio(p.fg, p.bg);
  const worst = p.worst === undefined ? '' : `, ${p.worst.toFixed(2)}:1 under grid+scanline`;
  const result = r >= p.min ? 'PASS' : p.limit ? `FAIL, known limit (${p.limit})` : 'FAIL';
  return { ...p, r, shown: `${r.toFixed(2)}:1${worst} (needs ${p.min}:1) ${result}` };
});

describe('steering palette', () => {
  it('the LCD shades are the 4 greens in retro-aesthetic.md, inverted on the dead LCD', () => {
    const steering = [...read('../.kiro/steering/retro-aesthetic.md').matchAll(/`(#[0-9a-f]{6})`/g)].map((m) => m[1]);
    expect(steering).toEqual([...LCD_PALETTE]);
    expect(LIVE.s.map(toHex)).toEqual([...LCD_PALETTE]);
    expect(DEAD.s.map(toHex)).toEqual([...LCD_PALETTE].reverse());
  });

  it('the heal modal uses only those 4 greens', () => {
    const used = new Set([...read(HEAL).matchAll(/\[(#[0-9a-f]{6})\]/g)].map((m) => m[1]));
    expect([...used].filter((c) => !(LCD_PALETTE as readonly string[]).includes(c))).toEqual([]);
  });
});

for (const file of [...new Set(rows.map((r) => r.file))]) {
  describe(file, () => {
    // A pair with `limit` asserts the failure; fixing it flips the test so design.md gets updated.
    it.each(rows.filter((r) => r.file === file))('$name = $shown', ({ src, r, min, limit }) => {
      for (const [f, text] of src) expect(has(read(f), text), `${f} should contain "${text}"`).toBe(true);
      expect(r >= min, limit ?? 'below the WCAG AA threshold').toBe(!limit);
    });
  });
}
