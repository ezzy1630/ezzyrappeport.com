"use client";

/**
 * Lazy WebAudio manager. Loads nothing until the user enables sound.
 * Soft underwater bed: filtered noise + a barely-there low swell.
 * Hard-off under MotionPolicy (OS reduced-motion or site motion-off).
 * Preference persists in localStorage.
 */

import { readMotionPolicy } from "./motion-policy.ts";

const STORAGE_KEY = "portfolio.sound.enabled";

type SoundKind = "ambient" | "press" | "ripple" | "hover" | "shockwave";

export type SoundPlayOptions = {
  /** 0..1 — larger controls get a slightly deeper press pitch. */
  intensity?: number;
};

let audioCtx: AudioContext | null = null;
let lastHoverAt = 0;
const HOVER_COOLDOWN_MS = 120;
let ambientGain: GainNode | null = null;
let ambientLowpass: BiquadFilterNode | null = null;
let ambientNodes: AudioNode[] = [];
let enabled = false;
let unlocked = false;
let lastAmbientDepth = -1;

function soundAllowedByPolicy() {
  return readMotionPolicy().soundAllowed;
}

function ensureContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function createNoiseBuffer(ctx: AudioContext, seconds = 3) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    // Soft pink-ish noise: cheap one-pole filter on white.
    const white = Math.random() * 2 - 1;
    last = last * 0.92 + white * 0.08;
    data[i] = last * 0.55;
  }
  return buffer;
}

function startAmbient(ctx: AudioContext) {
  stopAmbient();
  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(ctx.destination);
  // Fade in gently so enabling sound never pops.
  ambientGain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 1.4);

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 4);
  noise.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 420;
  lowpass.Q.value = 0.5;
  ambientLowpass = lowpass;

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 55;
  highpass.Q.value = 0.4;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.7;

  noise.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(ambientGain);
  noise.start();

  // Barely-audible deep swell — not a musical tone.
  const swell = ctx.createOscillator();
  swell.type = "sine";
  swell.frequency.value = 46;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.18;
  const swellLfo = ctx.createOscillator();
  swellLfo.type = "sine";
  swellLfo.frequency.value = 0.07;
  const swellLfoGain = ctx.createGain();
  swellLfoGain.gain.value = 0.08;
  swellLfo.connect(swellLfoGain);
  swellLfoGain.connect(swellGain.gain);
  swell.connect(swellGain);
  swellGain.connect(ambientGain);
  swell.start();
  swellLfo.start();

  ambientNodes = [noise, lowpass, highpass, noiseGain, swell, swellGain, swellLfo, swellLfoGain];
  lastAmbientDepth = -1;
}

function stopAmbient() {
  if (ambientGain) {
    try {
      const ctx = ambientGain.context;
      ambientGain.gain.cancelScheduledValues(ctx.currentTime);
      ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    } catch {
      /* ignore */
    }
  }
  for (const node of ambientNodes) {
    try {
      if ("stop" in node && typeof (node as OscillatorNode).stop === "function") {
        (node as OscillatorNode).stop();
      }
      node.disconnect();
    } catch {
      /* already stopped */
    }
  }
  ambientNodes = [];
  ambientLowpass = null;
  lastAmbientDepth = -1;
  if (ambientGain) {
    try {
      ambientGain.disconnect();
    } catch {
      /* ignore */
    }
    ambientGain = null;
  }
}

/**
 * Tasteful depth-band bed: shallows stay open (~420 Hz), mid darkens,
 * basin muffles toward ~180 Hz with a slightly quieter floor.
 * No-op when ambient is off. Coarse depth steps avoid audio thrash.
 */
export function setAmbientDepth(depth: number) {
  if (!enabled || !ambientGain || !ambientLowpass || !soundAllowedByPolicy()) return;
  const clamped = Math.max(0, Math.min(1, depth));
  const band = clamped < 0.22 ? 0 : clamped < 0.48 ? 1 : clamped < 0.74 ? 2 : 3;
  if (band === lastAmbientDepth) return;
  lastAmbientDepth = band;
  const ctx = ambientGain.context;
  const now = ctx.currentTime;
  const hz = band === 0 ? 420 : band === 1 ? 340 : band === 2 ? 250 : 180;
  const level = band === 0 ? 0.012 : band === 1 ? 0.011 : band === 2 ? 0.0095 : 0.008;
  try {
    ambientLowpass.frequency.cancelScheduledValues(now);
    ambientLowpass.frequency.setValueAtTime(ambientLowpass.frequency.value, now);
    ambientLowpass.frequency.linearRampToValueAtTime(hz, now + 0.85);
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(Math.max(ambientGain.gain.value, 0.0001), now);
    ambientGain.gain.linearRampToValueAtTime(level, now + 0.85);
  } catch {
    /* ignore */
  }
}

function playShockwave(ctx: AudioContext, options: SoundPlayOptions = {}) {
  const now = ctx.currentTime;
  const intensity = Math.max(0, Math.min(1, options.intensity ?? 1));
  const pitchJitter = 1 + (Math.random() * 0.2 - 0.1);

  // Primary plunk — deeper and longer than press; restrained, not splashy.
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sine";
  filter.type = "bandpass";
  filter.Q.value = 1;
  const startHz = (138 - intensity * 16) * pitchJitter;
  const endHz = Math.max(40, 54 - intensity * 12);
  osc.frequency.setValueAtTime(startHz, now);
  osc.frequency.exponentialRampToValueAtTime(endHz, now + 0.34);
  filter.frequency.setValueAtTime(260 - intensity * 30, now);
  filter.frequency.exponentialRampToValueAtTime(105, now + 0.34);
  gain.gain.setValueAtTime(0.022 * (0.32 + intensity * 0.68), now);
  gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.4);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.44);

  // Soft secondary ring tick — arrives ~80–120 ms after impact.
  const ringDelay = 0.08 + Math.random() * 0.04;
  const ringStart = now + ringDelay;
  const ringOsc = ctx.createOscillator();
  const ringFilter = ctx.createBiquadFilter();
  const ringGain = ctx.createGain();
  const ringJitter = 1 + (Math.random() * 0.14 - 0.07);
  ringOsc.type = "sine";
  ringFilter.type = "bandpass";
  ringFilter.Q.value = 1.35;
  const ringHz = (182 - intensity * 22) * ringJitter;
  ringOsc.frequency.setValueAtTime(ringHz, ringStart);
  ringOsc.frequency.exponentialRampToValueAtTime(Math.max(92, ringHz * 0.52), ringStart + 0.11);
  ringFilter.frequency.setValueAtTime(400 - intensity * 45, ringStart);
  ringFilter.frequency.exponentialRampToValueAtTime(195, ringStart + 0.11);
  ringGain.gain.setValueAtTime(0.0065 * (0.38 + intensity * 0.62), ringStart);
  ringGain.gain.exponentialRampToValueAtTime(0.0004, ringStart + 0.15);
  ringOsc.connect(ringFilter);
  ringFilter.connect(ringGain);
  ringGain.connect(ctx.destination);
  ringOsc.start(ringStart);
  ringOsc.stop(ringStart + 0.19);
}

function playTick(
  ctx: AudioContext,
  kind: Exclude<SoundKind, "ambient" | "shockwave">,
  options: SoundPlayOptions = {},
) {
  const now = ctx.currentTime;
  const intensity = Math.max(0, Math.min(1, options.intensity ?? 0.35));
  const pitchJitter = 1 + (Math.random() * 0.3 - 0.15);
  // Soft filtered click — more bubble / water than UI beep.
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sine";
  filter.type = "bandpass";
  filter.Q.value = 1.1;
  if (kind === "press") {
    const startHz = (168 - intensity * 22) * pitchJitter;
    const endHz = Math.max(52, 72 - intensity * 18);
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(endHz, now + 0.22);
    filter.frequency.setValueAtTime(320 - intensity * 40, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.22);
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
  } else if (kind === "hover") {
    const startHz = 236 * pitchJitter;
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(148, now + 0.08);
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0.0042, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);
  } else {
    osc.frequency.setValueAtTime(210 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
  }
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

export function readSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  if (!soundAllowedByPolicy()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(next: boolean) {
  if (!soundAllowedByPolicy()) {
    enabled = false;
    stopAmbient();
    return false;
  }
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  const ctx = ensureContext();
  if (!ctx) return false;
  if (next) {
    void ctx.resume().then(() => {
      unlocked = true;
      startAmbient(ctx);
    });
  } else {
    stopAmbient();
  }
  return enabled;
}

export function playSound(kind: SoundKind, options: SoundPlayOptions = {}) {
  if (!enabled || !soundAllowedByPolicy()) return;
  const ctx = ensureContext();
  if (!ctx || !unlocked) return;
  if (kind === "ambient") {
    startAmbient(ctx);
    return;
  }
  if (kind === "hover") {
    const now = performance.now();
    if (now - lastHoverAt < HOVER_COOLDOWN_MS) return;
    lastHoverAt = now;
  }
  if (kind === "shockwave") {
    playShockwave(ctx, options);
    return;
  }
  playTick(ctx, kind, options);
}

export function initSoundFromStorage() {
  if (readSoundPreference()) {
    // Do not autoplay: wait for a user gesture to unlock.
    enabled = true;
  }
}

export function isSoundEnabled() {
  return enabled && soundAllowedByPolicy();
}
