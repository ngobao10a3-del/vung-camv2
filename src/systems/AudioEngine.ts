export interface AudioSettings {
  muted: boolean;
  volume: number;
}

export interface AmbienceContext {
  sceneId: string;
  activeEndingId: string | null;
  fogApproaching: boolean;
  fogBreached: boolean;
  powerMode: string;
  radioState: string;
  phoneDisconnected: boolean;
  lockerKnocking: boolean;
  identityExposed: boolean;
  identityOverwriteCount: number;
  redFilterInstalled: boolean;
  flashlightOn: boolean;
}

export type AudioCueKind =
  | "scene_transition"
  | "clue_discovery"
  | "item_pickup"
  | "puzzle_solved"
  | "puzzle_error"
  | "rule_violation"
  | "locker_knock"
  | "flashlight_toggle"
  | "radar_scan"
  | "filter_install";

const AUDIO_STORAGE_KEY = "vung_cam_audio_settings_v1";

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  volume: 0.35
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_SETTINGS.volume;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function loadAudioSettings(): AudioSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: Boolean(parsed.muted),
      volume: clampVolume(typeof parsed.volume === "number" ? parsed.volume : DEFAULT_AUDIO_SETTINGS.volume)
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({
        muted: Boolean(settings.muted),
        volume: clampVolume(settings.volume)
      })
    );
  } catch {
    // Ignore quota / private-browsing storage errors
  }
}

interface ActiveLayerHandle {
  key: string;
  layerGain: GainNode;
  stop: () => void;
}

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export class StationAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings;
  private currentLayer: ActiveLayerHandle | null = null;
  private fadeTimeoutIds = new Set<number>();
  private lastContext: AmbienceContext | null = null;
  private unlockCleanup: (() => void) | null = null;
  private disposed = false;

  constructor(initialSettings?: AudioSettings) {
    this.settings = initialSettings
      ? { muted: Boolean(initialSettings.muted), volume: clampVolume(initialSettings.volume) }
      : loadAudioSettings();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setSettings(next: AudioSettings): void {
    this.settings = {
      muted: Boolean(next.muted),
      volume: clampVolume(next.volume)
    };
    saveAudioSettings(this.settings);
    this.applyMasterGain();
  }

  public registerAutoplayUnlock(): void {
    if (this.disposed || typeof window === "undefined" || this.unlockCleanup) return;

    const handleGesture = () => {
      if (this.disposed) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const finishUnlock = () => {
        if (this.lastContext && !this.currentLayer) {
          this.rebuildAmbience(this.lastContext);
        }
        if (ctx.state === "running" && this.unlockCleanup) {
          this.unlockCleanup();
          this.unlockCleanup = null;
        }
      };

      if (ctx.state === "suspended") {
        void ctx.resume().then(finishUnlock).catch(() => {
          // Keep listener if browser refused resume on this event
        });
      } else {
        finishUnlock();
      }
    };

    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });

    this.unlockCleanup = () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }

  public unlockAndSync(): void {
    if (this.disposed || typeof window === "undefined") return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        if (this.lastContext && !this.currentLayer) {
          this.rebuildAmbience(this.lastContext);
        }
      }).catch(() => {});
    } else if (this.lastContext && !this.currentLayer) {
      this.rebuildAmbience(this.lastContext);
    }
  }

  public updateAmbience(context: AmbienceContext): void {
    if (this.disposed) return;
    this.lastContext = { ...context };

    if (!this.ctx || this.ctx.state !== "running") {
      return;
    }

    const nextKey = this.buildLayerKey(context);
    if (this.currentLayer?.key === nextKey) {
      return;
    }
    this.rebuildAmbience(context);
  }

  public playCue(kind: AudioCueKind): void {
    if (this.disposed || typeof window === "undefined") return;
    if (this.settings.muted || this.settings.volume <= 0) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        if (!this.disposed && ctx.state === "running") {
          this.triggerCueNow(ctx, kind);
        }
      }).catch(() => {});
      return;
    }

    this.triggerCueNow(ctx, kind);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.unlockCleanup) {
      this.unlockCleanup();
      this.unlockCleanup = null;
    }

    for (const tid of this.fadeTimeoutIds) {
      window.clearTimeout(tid);
    }
    this.fadeTimeoutIds.clear();

    if (this.currentLayer) {
      this.currentLayer.stop();
      this.currentLayer = null;
    }

    if (this.ctx) {
      const closing = this.ctx;
      this.ctx = null;
      this.masterGain = null;
      this.brownNoiseBuffer = null;
      this.whiteNoiseBuffer = null;
      void closing.close().catch(() => {});
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;

    const AudioCtor =
      window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtor) return null;

    try {
      const ctx = new AudioCtor();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(
        this.settings.muted ? 0 : this.settings.volume,
        ctx.currentTime
      );
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.brownNoiseBuffer = this.createNoiseBuffer(ctx, "brown", 2.5);
      this.whiteNoiseBuffer = this.createNoiseBuffer(ctx, "white", 2.0);
      return ctx;
    } catch {
      return null;
    }
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.settings.muted ? 0 : this.settings.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    color: "brown" | "white",
    seconds: number
  ): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (color === "white") {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = Math.max(-1, Math.min(1, lastOut * 3.2));
    }
    return buffer;
  }

  private buildLayerKey(c: AmbienceContext): string {
    if (c.activeEndingId) {
      return `ENDING:${c.activeEndingId}`;
    }
    return [
      c.sceneId,
      c.fogApproaching ? "fa" : "fd",
      c.fogBreached ? "fb" : "fc",
      c.powerMode,
      c.radioState,
      c.phoneDisconnected ? "pd" : "pc",
      c.lockerKnocking ? "lk" : "lq",
      c.identityExposed ? "ie" : "ic",
      c.redFilterInstalled ? "rf" : "rw"
    ].join("|");
  }

  private rebuildAmbience(context: AmbienceContext): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.disposed) return;

    const prev = this.currentLayer;
    const nextKey = this.buildLayerKey(context);
    const now = ctx.currentTime;

    if (prev) {
      prev.layerGain.gain.setTargetAtTime(0, now, 0.24);
      const fadingLayer = prev;
      const tid = window.setTimeout(() => {
        this.fadeTimeoutIds.delete(tid);
        fadingLayer.stop();
      }, 950);
      this.fadeTimeoutIds.add(tid);
      this.currentLayer = null;
    }

    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.0001, now);
    layerGain.gain.setTargetAtTime(1, now, 0.32);
    layerGain.connect(master);

    const stopCallbacks: Array<() => void> = [];
    const timerIds: number[] = [];

    const addNode = (stopFn: () => void) => {
      stopCallbacks.push(stopFn);
    };

    const addInterval = (fn: () => void, intervalMs: number) => {
      const id = window.setInterval(() => {
        if (!this.disposed && this.currentLayer?.key === nextKey && ctx.state === "running") {
          fn();
        }
      }, intervalMs);
      timerIds.push(id);
    };

    if (context.activeEndingId) {
      this.buildEndingAmbience(ctx, layerGain, context.activeEndingId, addNode);
    } else {
      switch (context.sceneId) {
        case "SC-01":
          this.buildSC01Ambience(ctx, layerGain, context, addNode, addInterval);
          break;
        case "SC-02":
          this.buildSC02Ambience(ctx, layerGain, context, addNode, addInterval);
          break;
        case "SC-03":
          this.buildSC03Ambience(ctx, layerGain, context, addNode, addInterval);
          break;
        case "SC-04":
          this.buildSC04Ambience(ctx, layerGain, context, addNode);
          break;
        case "SC-05":
          this.buildSC05Ambience(ctx, layerGain, context, addNode, addInterval);
          break;
        case "SC-06":
          this.buildSC06Ambience(ctx, layerGain, context, addNode);
          break;
        default:
          break;
      }
    }

    let stopped = false;
    this.currentLayer = {
      key: nextKey,
      layerGain,
      stop: () => {
        if (stopped) return;
        stopped = true;
        for (const id of timerIds) {
          window.clearInterval(id);
        }
        for (const fn of stopCallbacks) {
          try {
            fn();
          } catch {
            // Ignore cleanup errors on already-stopped nodes
          }
        }
        try {
          layerGain.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    };
  }

  private startNoiseLoop(
    ctx: AudioContext,
    dest: AudioNode,
    color: "brown" | "white",
    filterType: BiquadFilterType,
    freq: number,
    q: number,
    gainValue: number,
    addNode: (stopFn: () => void) => void
  ): { filter: BiquadFilterNode; gain: GainNode } | null {
    const buffer = color === "brown" ? this.brownNoiseBuffer : this.whiteNoiseBuffer;
    if (!buffer) return null;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(0, Math.random() * 0.8);

    addNode(() => {
      src.stop();
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    });

    return { filter, gain };
  }

  private startOscillator(
    ctx: AudioContext,
    dest: AudioNode,
    type: OscillatorType,
    freq: number,
    gainValue: number,
    addNode: (stopFn: () => void) => void
  ): { osc: OscillatorNode; gain: GainNode } {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);

    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    addNode(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    });

    return { osc, gain };
  }

  private buildSC01Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void,
    addInterval: (fn: () => void, ms: number) => void
  ): void {
    const windLevel = context.fogBreached ? 0.24 : context.fogApproaching ? 0.19 : 0.14;
    const wind = this.startNoiseLoop(ctx, dest, "brown", "lowpass", 310, 0.7, windLevel, addNode);

    if (wind) {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.11, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(115, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(wind.filter.frequency);
      lfo.start();
      addNode(() => {
        lfo.stop();
        lfo.disconnect();
        lfoGain.disconnect();
      });
    }

    // Subtle sea mist hiss
    this.startNoiseLoop(
      ctx,
      dest,
      "white",
      "bandpass",
      950,
      0.9,
      context.fogBreached ? 0.022 : 0.011,
      addNode
    );

    if (context.fogApproaching || context.fogBreached) {
      addInterval(() => {
        this.playDistantFoghorn(ctx, dest);
      }, 11500);
    }
  }

  private buildSC02Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void,
    addInterval: (fn: () => void, ms: number) => void
  ): void {
    // Low indoor station hush
    this.startNoiseLoop(ctx, dest, "brown", "lowpass", 170, 0.5, 0.06, addNode);

    if (context.radioState === "broadcasting") {
      this.startNoiseLoop(ctx, dest, "white", "bandpass", 1550, 1.4, 0.028, addNode);
      this.startOscillator(ctx, dest, "sine", 420, 0.008, addNode);
    } else if (context.radioState === "paused") {
      this.startNoiseLoop(ctx, dest, "white", "bandpass", 1100, 1.2, 0.007, addNode);
    }

    if (!context.phoneDisconnected) {
      addInterval(() => {
        if (this.settings.muted) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(425, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.58);
      }, 6200);
    }
  }

  private buildSC03Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void,
    addInterval: (fn: () => void, ms: number) => void
  ): void {
    // Tight enclosed room resonance
    this.startOscillator(ctx, dest, "sine", 56, 0.024, addNode);
    this.startNoiseLoop(ctx, dest, "brown", "lowpass", 140, 0.6, 0.055, addNode);

    if (context.lockerKnocking) {
      addInterval(() => {
        if (!this.settings.muted) {
          this.playLockerKnockBurst(ctx, dest, 0.85);
        }
      }, 9200);
    }
  }

  private buildSC04Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void
  ): void {
    const isLow = context.powerMode === "low";
    const isOverload = context.powerMode === "overload";
    const baseFreq = isLow ? 50 : isOverload ? 64 : 55;
    const droneGain = isLow ? 0.024 : isOverload ? 0.052 : 0.038;

    this.startOscillator(ctx, dest, "triangle", baseFreq, droneGain, addNode);
    this.startOscillator(
      ctx,
      dest,
      "sine",
      isOverload ? baseFreq * 2.04 : baseFreq * 2,
      isOverload ? 0.024 : 0.011,
      addNode
    );

    if (isOverload) {
      this.startNoiseLoop(ctx, dest, "white", "bandpass", 1900, 2.2, 0.018, addNode);
    } else {
      this.startNoiseLoop(ctx, dest, "brown", "lowpass", 190, 0.6, 0.045, addNode);
    }
  }

  private buildSC05Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void,
    addInterval: (fn: () => void, ms: number) => void
  ): void {
    const isLowPower = context.powerMode === "low";
    this.startNoiseLoop(
      ctx,
      dest,
      "white",
      "bandpass",
      isLowPower ? 720 : 1480,
      isLowPower ? 0.9 : 1.6,
      isLowPower ? 0.008 : 0.024,
      addNode
    );

    if (context.identityExposed) {
      this.startOscillator(ctx, dest, "sine", 78, 0.018, addNode);
    }

    addInterval(() => {
      if (this.settings.muted) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isLowPower ? 980 : 860, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(isLowPower ? 0.028 : 0.016, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.36);
    }, 3400);
  }

  private buildSC06Ambience(
    ctx: AudioContext,
    dest: AudioNode,
    context: AmbienceContext,
    addNode: (stopFn: () => void) => void
  ): void {
    const red = context.redFilterInstalled;
    // Fresnel chamber air & mechanism rotation hum
    this.startNoiseLoop(ctx, dest, "brown", "lowpass", red ? 210 : 290, 0.6, 0.09, addNode);
    this.startOscillator(ctx, dest, "sine", red ? 73.4 : 82.4, red ? 0.024 : 0.032, addNode);
    this.startOscillator(ctx, dest, "sine", red ? 110 : 123.5, red ? 0.012 : 0.016, addNode);

    if (context.identityOverwriteCount > 0 && !red) {
      this.startOscillator(ctx, dest, "triangle", 164.8, 0.009, addNode);
    }
  }

  private buildEndingAmbience(
    ctx: AudioContext,
    dest: AudioNode,
    endingId: string,
    addNode: (stopFn: () => void) => void
  ): void {
    if (endingId === "END-01" || endingId === "END-02") {
      this.startNoiseLoop(ctx, dest, "brown", "lowpass", 220, 0.5, 0.08, addNode);
      this.startOscillator(ctx, dest, "sine", 110, 0.014, addNode);
    } else {
      this.startNoiseLoop(ctx, dest, "white", "bandpass", 920, 1.1, 0.018, addNode);
      this.startOscillator(ctx, dest, "sine", 58, 0.025, addNode);
    }
  }

  private playDistantFoghorn(ctx: AudioContext, dest: AudioNode): void {
    if (this.settings.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(98, now);
    osc.frequency.linearRampToValueAtTime(92, now + 2.2);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 2.45);
  }

  private playLockerKnockBurst(ctx: AudioContext, dest: AudioNode, scale = 1): void {
    const now = ctx.currentTime;
    const offsets = [0, 0.34, 0.72];
    for (const offset of offsets) {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(165, start);
      osc.frequency.exponentialRampToValueAtTime(62, start + 0.09);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.11 * scale, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + 0.16);
    }
  }

  private triggerCueNow(ctx: AudioContext, kind: AudioCueKind): void {
    const dest = this.masterGain;
    if (!dest) return;
    const now = ctx.currentTime;

    switch (kind) {
      case "scene_transition": {
        if (this.brownNoiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.brownNoiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(420, now);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          src.start(now);
          src.stop(now + 0.25);
        }
        break;
      }
      case "clue_discovery": {
        [392, 523.25].forEach((freq, idx) => {
          const t = now + idx * 0.09;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.065, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.45);
        });
        break;
      }
      case "item_pickup": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case "puzzle_solved": {
        [293.66, 440, 587.33].forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.075, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(t);
          osc.stop(t + 0.5);
        });
        break;
      }
      case "puzzle_error": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(88, now + 0.18);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case "rule_violation": {
        [73.42, 103.83].forEach(freq => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.linearRampToValueAtTime(freq * 0.94, now + 0.65);
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(280, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.095, now + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.78);
        });
        break;
      }
      case "locker_knock": {
        this.playLockerKnockBurst(ctx, dest, 1.15);
        break;
      }
      case "flashlight_toggle": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.035);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.045, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
      case "radar_scan": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.5, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.46);
        break;
      }
      case "filter_install": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(310, now);
        osc.frequency.exponentialRampToValueAtTime(195, now + 0.28);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.36);
        break;
      }
    }
  }
}
