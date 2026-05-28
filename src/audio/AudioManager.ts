import { AUDIO_ASSETS } from '../content/audio';
import { MusicSequencer } from './MusicSequencer';

type MusicMode = 'off' | 'menu' | 'lobby' | 'match';

interface ActiveVoice {
  stop: () => void;
}

export interface GunshotOptions {
  pan?: number;
  distance?: number;
  maxDistance?: number;
  isOwnShot?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

async function loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${url}`);
  }
  const data = await response.arrayBuffer();
  return ctx.decodeAudioData(data);
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private gunshotBuffer: AudioBuffer | null = null;
  private assetsPromise: Promise<void> | null = null;
  private musicSequencer: MusicSequencer | null = null;
  private musicSessionGain: GainNode | null = null;
  private musicVoice: ActiveVoice | null = null;
  private musicMode: MusicMode = 'off';
  private musicGeneration = 0;
  private musicEnabled = true;
  private masterVolume = 0.85;
  private paused = false;
  private lastGunshotByOwner = new Map<number, number>();

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1);
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.refreshMusicGain();
  }

  setMusicEnabled(enabled: boolean) {
    if (this.musicEnabled === enabled) return;
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
      return;
    }
    if (this.musicMode !== 'off') {
      this.setMusicMode(this.musicMode, { force: true });
    }
  }

  async ensureReady() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.noiseBuffer = createNoiseBuffer(this.ctx, 0.25);
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.sfxGain.gain.value = 0.75;
      this.musicGain.gain.value = 0.7;
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    await this.loadAssets();
    this.refreshMusicGain();
  }

  setMusicMode(mode: MusicMode, options?: { force?: boolean }) {
    if (!this.musicEnabled) {
      this.musicMode = mode;
      this.stopMusic();
      return;
    }
    if (!options?.force && this.musicMode === mode && this.musicVoice) return;
    this.musicMode = mode;
    this.stopMusic();
    if (mode === 'off') return;

    const generation = this.musicGeneration;
    void this.ensureReady().then(() => {
      if (this.musicGeneration !== generation || this.musicMode !== mode) return;
      this.startMusic(mode, generation);
    });
  }

  /** Call after the browser unlocks audio (first click/key). */
  onUnlocked() {
    void this.ensureReady().then(() => {
      if (this.musicMode === 'off') return;
      this.setMusicMode(this.musicMode, { force: true });
    });
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.gunshotBuffer = null;
    this.musicSequencer = null;
    this.musicSessionGain = null;
    this.assetsPromise = null;
    this.musicGeneration = 0;
    this.lastGunshotByOwner.clear();
  }

  playGunshot(options: GunshotOptions = {}) {
    const {
      pan = 0,
      distance = 0,
      maxDistance = 900,
      isOwnShot = false,
    } = options;

    const attenuation = distanceAttenuation(distance, maxDistance);
    if (attenuation <= 0.02) {
      return;
    }

    const pitch = 0.94 + Math.random() * 0.12;
    const baseVolume = isOwnShot ? 0.62 : 0.48;
    const volume = baseVolume * attenuation;

    void this.playSample({
      buffer: this.gunshotBuffer,
      volume,
      pan,
      playbackRate: pitch,
      lowpassHz: lowpassForDistance(distance, maxDistance),
    });
  }

  playFootstep(pan = 0, volume = 0.12) {
    void this.playTone({
      frequency: 110,
      duration: 0.07,
      volume: volume * 0.35,
      pan,
      type: 'triangle',
      attack: 0.002,
      decay: 0.05,
    });
  }

  playHitTaken(volume = 0.45) {
    void this.playNoiseBurst({
      duration: 0.08,
      decay: 0.03,
      volume: volume * 0.35,
      filterType: 'bandpass',
      filterFreq: 420,
    });
    void this.playTone({
      frequency: 92,
      duration: 0.12,
      volume: volume * 0.25,
      type: 'sine',
      attack: 0.001,
      decay: 0.1,
    });
  }

  playHitDealt(volume = 0.3) {
    void this.playTone({
      frequency: 760,
      duration: 0.05,
      volume: volume * 0.22,
      type: 'square',
      attack: 0.001,
      decay: 0.04,
    });
  }

  playReload(volume = 0.35) {
    void this.playTone({
      frequency: 420,
      duration: 0.04,
      volume: volume * 0.18,
      type: 'square',
      attack: 0.001,
      decay: 0.035,
    });
    window.setTimeout(() => {
      void this.playTone({
        frequency: 280,
        duration: 0.05,
        volume: volume * 0.16,
        type: 'square',
        attack: 0.001,
        decay: 0.04,
      });
    }, 70);
  }

  playSpawn(volume = 0.4) {
    void this.playSweep({
      startHz: 220,
      endHz: 880,
      duration: 0.18,
      volume: volume * 0.2,
    });
  }

  playExplosion(pan = 0, volume = 0.55, distance = 0, maxDistance = 900) {
    const attenuation = distanceAttenuation(distance, maxDistance);
    if (attenuation <= 0.02) return;
    const scaled = volume * attenuation;
    void this.playNoiseBurst({
      duration: 0.35,
      decay: 0.12,
      volume: scaled * 0.5,
      pan,
      filterType: 'lowpass',
      filterFreq: lowpassForDistance(distance, maxDistance),
    });
    void this.playTone({
      frequency: 58,
      duration: 0.28,
      volume: scaled * 0.35,
      pan,
      type: 'sine',
      attack: 0.002,
      decay: 0.24,
    });
  }

  playKill(volume = 0.45) {
    void this.playTone({
      frequency: 660,
      duration: 0.08,
      volume: volume * 0.2,
      type: 'triangle',
      attack: 0.001,
      decay: 0.07,
    });
    window.setTimeout(() => {
      void this.playTone({
        frequency: 990,
        duration: 0.12,
        volume: volume * 0.24,
        type: 'triangle',
        attack: 0.001,
        decay: 0.1,
      });
    }, 70);
  }

  playDeath(volume = 0.5) {
    void this.playSweep({
      startHz: 420,
      endHz: 90,
      duration: 0.45,
      volume: volume * 0.28,
    });
  }

  playMatchStart(volume = 0.4) {
    void this.playTone({
      frequency: 440,
      duration: 0.12,
      volume: volume * 0.22,
      type: 'triangle',
      attack: 0.002,
      decay: 0.1,
    });
    window.setTimeout(() => {
      void this.playTone({
        frequency: 660,
        duration: 0.18,
        volume: volume * 0.24,
        type: 'triangle',
        attack: 0.002,
        decay: 0.16,
      });
    }, 120);
  }

  playMatchEnd(won: boolean, volume = 0.45) {
    const base = won ? 740 : 220;
    void this.playTone({
      frequency: base,
      duration: 0.2,
      volume: volume * 0.24,
      type: 'triangle',
      attack: 0.002,
      decay: 0.18,
    });
    window.setTimeout(() => {
      void this.playTone({
        frequency: won ? 990 : 140,
        duration: 0.35,
        volume: volume * 0.22,
        type: 'triangle',
        attack: 0.002,
        decay: 0.3,
      });
    }, 160);
  }

  playAbilityCharge(pan = 0, volume = 0.3, distance = 0, maxDistance = 900) {
    const attenuation = distanceAttenuation(distance, maxDistance);
    if (attenuation <= 0.02) return;
    void this.playTone({
      frequency: 320,
      duration: 0.14,
      volume: volume * 0.16 * attenuation,
      pan,
      type: 'sawtooth',
      attack: 0.01,
      decay: 0.12,
    });
  }

  shouldPlayGunshot(ownerId: number, isOwnShot: boolean): boolean {
    const now = performance.now();
    const cooldown = isOwnShot ? 35 : 55;
    const last = this.lastGunshotByOwner.get(ownerId) ?? 0;
    if (now - last < cooldown) {
      return false;
    }
    this.lastGunshotByOwner.set(ownerId, now);
    return true;
  }

  private async loadAssets() {
    if (!this.ctx) return;
    if (this.assetsPromise) {
      await this.assetsPromise;
      return;
    }

    const ctx = this.ctx;
    this.assetsPromise = (async () => {
      try {
        this.gunshotBuffer = await loadAudioBuffer(ctx, AUDIO_ASSETS.gunshot);
      } catch (error) {
        console.warn('[audio] gunshot sample failed to load', error);
      }
    })();

    await this.assetsPromise;
  }

  private refreshMusicGain() {
    if (!this.musicGain) return;
    const base =
      this.musicMode === 'match' ? 0.78 : this.musicMode === 'lobby' ? 0.68 : 0.6;
    this.musicGain.gain.value = this.paused ? base * 0.4 : base;
  }

  private stopMusic() {
    this.musicGeneration += 1;
    this.musicVoice?.stop();
    this.musicVoice = null;
    this.musicSequencer?.stop();
    this.musicSequencer = null;
    if (this.musicSessionGain) {
      try {
        this.musicSessionGain.disconnect();
      } catch {
        // Already disconnected.
      }
      this.musicSessionGain = null;
    }
  }

  private startMusic(mode: Exclude<MusicMode, 'off'>, generation: number) {
    if (!this.ctx || !this.musicGain) return;
    if (this.musicGeneration !== generation) return;

    const ctx = this.ctx;
    const sessionGain = ctx.createGain();
    sessionGain.gain.value = 1;
    sessionGain.connect(this.musicGain);
    this.musicSessionGain = sessionGain;

    const isActive = () => this.musicGeneration === generation;
    const sequencer = new MusicSequencer(ctx, sessionGain, isActive);
    sequencer.start(mode);
    this.musicSequencer = sequencer;
    this.refreshMusicGain();

    this.musicVoice = {
      stop: () => {
        sequencer.stop();
      },
    };
  }

  private async playSample(options: {
    buffer: AudioBuffer | null;
    volume: number;
    pan?: number;
    playbackRate?: number;
    lowpassHz?: number;
  }) {
    await this.ensureReady();
    if (!this.ctx || !this.sfxGain || !options.buffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = options.buffer;
    source.playbackRate.value = options.playbackRate ?? 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, options.volume), now);

    let tail: AudioNode = gain;
    source.connect(gain);

    if (options.lowpassHz) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = options.lowpassHz;
      gain.connect(filter);
      tail = filter;
    }

    if (options.pan !== undefined && 'createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      tail.connect(panner);
      tail = panner;
    }

    tail.connect(this.sfxGain);
    source.start(now);
    source.stop(now + options.buffer.duration / (options.playbackRate ?? 1) + 0.05);
  }

  private async playNoiseBurst(options: {
    duration: number;
    decay: number;
    volume: number;
    pan?: number;
    filterType?: BiquadFilterType;
    filterFreq?: number;
  }) {
    await this.ensureReady();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = false;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume), now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.decay);

    let tail: AudioNode = gain;
    if (options.filterType && options.filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = options.filterType;
      filter.frequency.value = options.filterFreq;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    if (options.pan !== undefined && 'createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      gain.connect(panner);
      tail = panner;
    }

    tail.connect(this.sfxGain);
    source.start(now);
    source.stop(now + options.duration);
  }

  private async playTone(options: {
    frequency: number;
    duration: number;
    volume: number;
    pan?: number;
    type?: OscillatorType;
    attack?: number;
    decay?: number;
  }) {
    await this.ensureReady();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = options.type ?? 'sine';
    osc.frequency.value = options.frequency;
    const attack = options.attack ?? 0.003;
    const decay = options.decay ?? options.duration;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(gain);

    let tail: AudioNode = gain;
    if (options.pan !== undefined && 'createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      gain.connect(panner);
      tail = panner;
    }

    tail.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + options.duration + 0.02);
  }

  private async playSweep(options: {
    startHz: number;
    endHz: number;
    duration: number;
    volume: number;
    pan?: number;
  }) {
    await this.ensureReady();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(options.startHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.endHz), now + options.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    osc.connect(gain);

    let tail: AudioNode = gain;
    if (options.pan !== undefined && 'createStereoPanner' in this.ctx) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(options.pan, -1, 1);
      gain.connect(panner);
      tail = panner;
    }

    tail.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + options.duration + 0.02);
  }
}

export function distanceAttenuation(distance: number, maxDistance: number): number {
  if (maxDistance <= 0) return 1;
  const t = clamp(1 - distance / maxDistance, 0, 1);
  return t * t;
}

function lowpassForDistance(distance: number, maxDistance: number): number {
  const attenuation = distanceAttenuation(distance, maxDistance);
  return 600 + attenuation * 7800;
}
