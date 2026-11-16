type Wave = OscillatorType;

interface Note {
  freq: number;
  /** Start offset in seconds. */
  at: number;
  dur: number;
  type?: Wave;
  vol?: number;
  /** Optional glide target in Hz. */
  to?: number;
}

const MUTE_KEY = 'gitgotchi:muted';

class RetroSoundSynth {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage blocked: stay unmuted for this session
    }
    // Browsers only allow audio after a gesture, so the context is never built earlier.
    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // storage blocked: preference lasts until reload
      }
    }
    this.listeners.forEach((fn) => fn(muted));
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** For useSyncExternalStore-style subscriptions. Returns the unsubscribe fn. */
  subscribe(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.muted || !this.unlocked) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private play(notes: Note[]): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + n.at;
      const end = start + n.dur;
      osc.type = n.type ?? 'square';
      osc.frequency.setValueAtTime(n.freq, start);
      if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
      gain.gain.setValueAtTime(n.vol ?? 0.07, start);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
    }
  }

  private run(freqs: number[], step: number, dur: number, type: Wave, vol: number): void {
    this.play(freqs.map((freq, i) => ({ freq, at: i * step, dur, type, vol })));
  }

  playSelect(): void {
    this.play([
      { freq: 880, at: 0, dur: 0.04, vol: 0.08 },
      { freq: 1200, at: 0.04, dur: 0.04, vol: 0.08 },
    ]);
  }

  playFeed(): void {
    this.run([440, 554, 659, 880], 0.05, 0.05, 'square', 0.06);
  }

  /** Chomp chomp, then a happy blip. */
  playEat(): void {
    this.play([
      { freq: 330, at: 0, dur: 0.07, type: 'square', vol: 0.07 },
      { freq: 220, at: 0.1, dur: 0.07, type: 'square', vol: 0.07 },
      { freq: 330, at: 0.24, dur: 0.07, type: 'square', vol: 0.07 },
      { freq: 220, at: 0.34, dur: 0.07, type: 'square', vol: 0.07 },
      { freq: 988, at: 0.5, dur: 0.1, type: 'triangle', vol: 0.08 },
    ]);
  }

  /** Descending wipe, like a flush. */
  playClean(): void {
    this.play([
      { freq: 1400, at: 0, dur: 0.5, type: 'sawtooth', vol: 0.04, to: 200 },
      { freq: 1000, at: 0.08, dur: 0.45, type: 'triangle', vol: 0.05, to: 150 },
      { freq: 1568, at: 0.55, dur: 0.08, type: 'square', vol: 0.06 },
      { freq: 2093, at: 0.64, dur: 0.1, type: 'square', vol: 0.06 },
    ]);
  }

  playParty(): void {
    this.run([523.25, 659.25, 783.99, 659.25, 783.99, 1046.5, 1318.5], 0.07, 0.09, 'square', 0.07);
  }

  playHeal(): void {
    this.run([523.25, 659.25, 783.99, 1046.5], 0.08, 0.12, 'triangle', 0.08);
  }

  playPoop(): void {
    this.play([{ freq: 180, at: 0, dur: 0.15, type: 'sawtooth', vol: 0.09, to: 70 }]);
  }

  playDeath(): void {
    this.run([400, 350, 300, 200], 0.12, 0.11, 'square', 0.09);
  }

  playRevive(): void {
    this.run([261.6, 329.6, 392.0, 523.25, 659.25, 783.99], 0.06, 0.09, 'square', 0.08);
  }

  /** Spooky resurrection: low minor chord swells, wobbles, then resolves upward. */
  playResurrection(): void {
    const chord = [110, 130.81, 164.81];
    const swell: Note[] = chord.map((freq) => ({ freq, at: 0, dur: 0.9, type: 'sawtooth', vol: 0.05, to: freq * 1.01 }));
    const rise: Note[] = [220, 261.63, 329.63, 440].map((freq, i) => ({
      freq,
      at: 0.7 + i * 0.1,
      dur: 0.35,
      type: 'triangle',
      vol: 0.07,
      to: freq * 1.5,
    }));
    this.play([...swell, ...rise, { freq: 55, at: 0, dur: 1.2, type: 'sine', vol: 0.1, to: 80 }]);
  }
}

export const soundSynth = new RetroSoundSynth();
