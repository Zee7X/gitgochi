# State Machine Specification

## Overview
Spesifikasi logika siklus hidup dan kalkulasi atribut monster GitGotchi berdasarkan aktivitas repositori GitHub.

## Attributes & Clamping
Semua nilai atribut berada dalam rentang integer 0 hingga 100.

| Atribut | Default | Min | Max | Dampak |
|---|---|---|---|---|
| HP | 100 | 0 | 100 | CI/CD build passing (+15) / failing (-25) |
| Fullness | 80 | 0 | 100 | Push commit (+10), PR merge (+20), starvation decay (-1/jam) |
| Sanity | 100 | 0 | 100 | Lint errors (-5/error), Stale issues (-10/issue) |
| Poop Count | 0 | 0 | 5 | Dirty file saves (`console.log`, `TODO:`), dibersihkan via Clean action |

## Evolution Stages
1. **EGG:**
   - Kondisi: Total commit < 5 dan usia repo < 24 jam.
   - Status: Monster dalam cangkang telur bersayap kelelawar.
2. **BABY_GHOST:**
   - Kondisi: HP > 0, commit >= 5, dan HP < 80 atau usia repo baru.
   - Status: Hantu kecil tersenyum memakai topi penyihir.
3. **CODE_DEMON:**
   - Kondisi: HP >= 80, Sanity >= 70, Fullness >= 50, dan tidak ada failing build dalam 3 run terakhir.
   - Status: Monster berkepala tanduk, memegang trisula kode, berenergi tinggi.
4. **ZOMBIE_CORPSE (DEAD):**
   - Kondisi: HP == 0.
   - Status: Monster berwajah tengkorak dengan nisan kuburan dan tulang berserakan. UI terkunci hingga ritual kebangkitan dijalankan.

## Calculations
```typescript
function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function calculateHp(currentHp: number, ciPasses: number, ciFails: number): number {
  return clamp(currentHp + (15 * ciPasses) - (25 * ciFails));
}

function calculateSanity(lintErrors: number, staleIssues: number): number {
  return clamp(100 - (5 * lintErrors) - (10 * staleIssues));
}
```
