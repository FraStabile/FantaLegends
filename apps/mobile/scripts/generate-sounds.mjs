#!/usr/bin/env node
/**
 * Procedural sound effects for Asta Legends.
 *
 * Every sound is synthesised from scratch (oscillators, filtered noise, envelopes)
 * and written as a 16-bit mono WAV into assets/sounds/. No third-party samples,
 * no licensing issues: tweak the recipes below and re-run
 *
 *   node apps/mobile/scripts/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// ── tiny DSP toolkit ──────────────────────────────────────────────────────

let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 0xffffffff) * 2 - 1;
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** attack / decay envelope, times in seconds */
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** add a tone with an optional pitch glide, at `start` seconds */
function tone(buf, { start = 0, dur, freq, freqEnd = freq, gain = 0.5, attack = 0.005, decay = dur / 3, type = 'sine', vibrato = 0, vibratoRate = 6 }) {
  const n = Math.floor(dur * RATE);
  const off = Math.floor(start * RATE);
  let phase = 0;
  for (let i = 0; i < n && off + i < buf.length; i++) {
    const t = i / RATE;
    const f = freq + (freqEnd - freq) * (i / n) + vibrato * Math.sin(2 * Math.PI * vibratoRate * t);
    phase += (2 * Math.PI * f) / RATE;
    let s;
    switch (type) {
      case 'square': s = Math.sign(Math.sin(phase)) * 0.6; break;
      case 'triangle': s = (2 / Math.PI) * Math.asin(Math.sin(phase)); break;
      case 'saw': s = ((phase / Math.PI) % 2) - 1; break;
      default: s = Math.sin(phase);
    }
    buf[off + i] += s * gain * env(t, attack, decay);
  }
}

/** band-limited noise (biquad band-pass), with a custom gain curve g(t, progress) */
function noiseBand(buf, { start = 0, dur, center, q = 1, gain = 0.5, curve }) {
  const n = Math.floor(dur * RATE);
  const off = Math.floor(start * RATE);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n && off + i < buf.length; i++) {
    const c = typeof center === 'function' ? center(i / n) : center;
    const w = (2 * Math.PI * c) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    const x = noise();
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[off + i] += y * gain * curve(i / RATE, i / n);
  }
}

function normalize(buf, peak = 0.89) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max === 0) return buf;
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((buf[i] / max) * 1.2) * peak;
  // 4 ms fade in/out: no clicks
  const fade = Math.floor(0.004 * RATE);
  for (let i = 0; i < fade; i++) {
    buf[i] *= i / fade;
    buf[buf.length - 1 - i] *= i / fade;
  }
  return buf;
}

function wav(buf) {
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** referee whistle: high sine with a fast trill ("pea" rattle) */
function whistle(buf, start, dur, gain = 0.6) {
  tone(buf, { start, dur, freq: 2900, freqEnd: 2750, gain, attack: 0.015, decay: dur * 3, vibrato: 140, vibratoRate: 32 });
  noiseBand(buf, { start, dur, center: 2900, q: 8, gain: gain * 0.5, curve: (t) => env(t, 0.015, dur * 3) });
}

/** stadium crowd: several noise bands, `shape(progress)` drives the intensity */
function crowd(buf, start, dur, gain, shape, brightness = 1) {
  for (const [center, q, g] of [[450, 0.8, 1], [900, 1.2, 0.7], [1700 * brightness, 1.5, 0.35]]) {
    noiseBand(buf, { start, dur, center, q, gain: gain * g, curve: (_t, p) => shape(p) * (0.85 + 0.15 * Math.sin(p * 90 + center)) });
  }
}

// ── recipes ───────────────────────────────────────────────────────────────

const SOUNDS = {
  // auction
  lot_open: () => {
    const b = buffer(0.55);
    tone(b, { dur: 0.35, freq: 880, gain: 0.5, decay: 0.12, type: 'triangle' });
    tone(b, { start: 0.12, dur: 0.43, freq: 1318.5, gain: 0.55, decay: 0.16, type: 'triangle' });
    return b;
  },
  bid: () => {
    const b = buffer(0.14);
    tone(b, { dur: 0.14, freq: 620, freqEnd: 980, gain: 0.7, attack: 0.002, decay: 0.035 });
    return b;
  },
  bid_mine: () => {
    const b = buffer(0.28);
    tone(b, { dur: 0.12, freq: 988, gain: 0.5, attack: 0.002, decay: 0.05, type: 'triangle' });
    tone(b, { start: 0.07, dur: 0.21, freq: 1480, gain: 0.55, attack: 0.002, decay: 0.07, type: 'triangle' });
    return b;
  },
  outbid: () => {
    const b = buffer(0.42);
    tone(b, { dur: 0.18, freq: 740, gain: 0.5, decay: 0.08, type: 'square' });
    tone(b, { start: 0.16, dur: 0.26, freq: 523, freqEnd: 480, gain: 0.5, decay: 0.1, type: 'square' });
    return b;
  },
  tick: () => {
    const b = buffer(0.07);
    tone(b, { dur: 0.07, freq: 1900, gain: 0.5, attack: 0.001, decay: 0.012 });
    noiseBand(b, { dur: 0.03, center: 4000, q: 2, gain: 0.3, curve: (t) => env(t, 0.001, 0.006) });
    return b;
  },
  sold: () => {
    const b = buffer(1.1);
    // gavel: low thump + wooden knock
    tone(b, { dur: 0.25, freq: 160, freqEnd: 70, gain: 0.9, attack: 0.001, decay: 0.06 });
    noiseBand(b, { dur: 0.08, center: 1200, q: 3, gain: 0.8, curve: (t) => env(t, 0.001, 0.015) });
    // short brass chord
    for (const f of [392, 493.9, 587.3]) tone(b, { start: 0.18, dur: 0.9, freq: f, gain: 0.25, attack: 0.02, decay: 0.35, type: 'saw' });
    return b;
  },
  sold_mine: () => {
    const b = buffer(1.5);
    tone(b, { dur: 0.25, freq: 160, freqEnd: 70, gain: 0.9, attack: 0.001, decay: 0.06 });
    noiseBand(b, { dur: 0.08, center: 1200, q: 3, gain: 0.8, curve: (t) => env(t, 0.001, 0.015) });
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(b, { start: 0.15 + i * 0.1, dur: 0.6, freq: f, gain: 0.4, decay: 0.2, type: 'triangle' }));
    for (const f of [523.3, 659.3, 784]) tone(b, { start: 0.55, dur: 0.95, freq: f, gain: 0.22, attack: 0.02, decay: 0.4, type: 'saw' });
    return b;
  },
  unsold: () => {
    const b = buffer(0.5);
    tone(b, { dur: 0.5, freq: 220, freqEnd: 150, gain: 0.6, decay: 0.18, type: 'triangle' });
    return b;
  },

  // match
  whistle: () => {
    const b = buffer(0.5);
    whistle(b, 0, 0.45);
    return b;
  },
  whistle_end: () => {
    const b = buffer(1.6);
    whistle(b, 0, 0.3);
    whistle(b, 0.42, 0.3);
    whistle(b, 0.84, 0.7);
    return b;
  },
  goal: () => {
    const b = buffer(3.2);
    crowd(b, 0, 3.2, 0.9, (p) => (p < 0.08 ? p / 0.08 : Math.exp(-(p - 0.08) * 1.6)), 1.3);
    // stadium horn
    for (const f of [233, 349]) tone(b, { start: 0.05, dur: 1.4, freq: f, gain: 0.18, attack: 0.05, decay: 0.9, type: 'saw' });
    return b;
  },
  chance: () => {
    const b = buffer(1.3);
    crowd(b, 0, 1.3, 0.7, (p) => Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 1.5);
    return b;
  },
  miss: () => {
    const b = buffer(1.2);
    // the "aaah" of a near miss: bright onset, falling pitch
    noiseBand(b, { dur: 1.2, center: (p) => 900 - p * 450, q: 1.2, gain: 0.8, curve: (t, p) => (p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9) });
    noiseBand(b, { dur: 1.2, center: 400, q: 0.8, gain: 0.5, curve: (t, p) => (p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9) });
    return b;
  },
  post: () => {
    const b = buffer(1.0);
    for (const [f, g] of [[520, 0.5], [1310, 0.3], [2270, 0.2], [3400, 0.1]]) tone(b, { dur: 1.0, freq: f, gain: g, attack: 0.001, decay: 0.25 });
    crowd(b, 0.1, 0.9, 0.35, (p) => Math.sin(Math.PI * p));
    return b;
  },
  card: () => {
    const b = buffer(0.35);
    whistle(b, 0, 0.12, 0.7);
    whistle(b, 0.16, 0.18, 0.7);
    return b;
  },
  crowd_loop: () => {
    // 4 s ambience that loops seamlessly (the tail is cross-faded into the head)
    const len = 4, fade = 0.5;
    const b = buffer(len + fade);
    crowd(b, 0, len + fade, 0.25, (p) => 0.8 + 0.2 * Math.sin(p * Math.PI * 6), 0.8);
    const n = Math.floor(len * RATE), f = Math.floor(fade * RATE);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = b[i];
    for (let i = 0; i < f; i++) out[i] = b[i] * (i / f) + b[n + i] * (1 - i / f);
    let max = 0;
    for (const s of out) max = Math.max(max, Math.abs(s));
    for (let i = 0; i < n; i++) out[i] = (out[i] / max) * 0.6;
    return out;
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  const buf = name === 'crowd_loop' ? make() : normalize(make());
  writeFileSync(join(OUT, `${name}.wav`), wav(buf));
  console.log(`✓ ${name}.wav  ${(buf.length / RATE).toFixed(2)}s`);
}
