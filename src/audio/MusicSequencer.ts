type MusicMode = 'menu' | 'lobby' | 'match';

interface TrackConfig {
  tempo: number;
  rootHz: number;
  pattern: number[];
  kickEvery: number;
  padGain: number;
  leadGain: number;
  kickGain: number;
}

const TRACKS: Record<MusicMode, TrackConfig> = {
  menu: {
    tempo: 88,
    rootHz: 110,
    pattern: [0, 4, 7, 12, 7, 4],
    kickEvery: 0,
    padGain: 0.11,
    leadGain: 0.07,
    kickGain: 0,
  },
  lobby: {
    tempo: 104,
    rootHz: 98,
    pattern: [0, 3, 7, 10, 7, 3, 0, 5],
    kickEvery: 2,
    padGain: 0.1,
    leadGain: 0.08,
    kickGain: 0.09,
  },
  match: {
    tempo: 126,
    rootHz: 82.4,
    pattern: [0, 7, 12, 7, 3, 7, 10, 3],
    kickEvery: 1,
    padGain: 0.09,
    leadGain: 0.1,
    kickGain: 0.13,
  },
};

function semitoneToHz(rootHz: number, semitones: number): number {
  return rootHz * 2 ** (semitones / 12);
}

export class MusicSequencer {
  private cancelled = false;
  private timer: number | null = null;
  private step = 0;

  constructor(
    private ctx: AudioContext,
    private output: GainNode,
    private isActive: () => boolean,
  ) {}

  start(mode: MusicMode) {
    this.cancelled = false;
    this.step = 0;
    this.schedule(mode);
  }

  stop() {
    this.cancelled = true;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(mode: MusicMode) {
    if (this.cancelled || !this.isActive()) return;

    const track = TRACKS[mode];
    const beatSec = 60 / track.tempo;
    const stepSec = beatSec * 0.5;
    const now = this.ctx.currentTime + 0.02;
    const semitone = track.pattern[this.step % track.pattern.length] ?? 0;
    const freq = semitoneToHz(track.rootHz, semitone);

    this.playPad(freq, track.padGain, now, stepSec * 0.9);
    this.playLead(freq * 2, track.leadGain, now + stepSec * 0.08, stepSec * 0.55);

    if (track.kickEvery > 0 && this.step % track.kickEvery === 0) {
      this.playKick(track.kickGain, now);
    }

    this.step += 1;
    this.timer = window.setTimeout(() => this.schedule(mode), stepSec * 1000 - 8);
  }

  private playPad(frequency: number, volume: number, start: number, duration: number) {
    if (!this.isActive()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.output);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private playLead(frequency: number, volume: number, start: number, duration: number) {
    if (!this.isActive()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.output);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private playKick(volume: number, start: number) {
    if (!this.isActive()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, start);
    osc.frequency.exponentialRampToValueAtTime(48, start + 0.1);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
    osc.connect(gain);
    gain.connect(this.output);
    osc.start(start);
    osc.stop(start + 0.16);
  }
}
