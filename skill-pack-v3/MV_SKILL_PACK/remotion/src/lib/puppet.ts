// Native puppet animation signals (pure, deterministic, testable): blink schedule, mouth openness from
// lyric mora timings x loudness, breathing, hair sway, beat sway/bounce. Rendering lives in render/Puppet.tsx.
import { clamp, hash, rng, beatPulse, type Beat } from "./core";
import type { PuppetCfg, ResolvedLine } from "./types";

export const PUPPET_OFF: PuppetCfg = { blink: 0, mouth: 0, breath: 0, hair: 0, sway: 0, bounce: 0 };

/** 0 = open, 0.5 = half, 1 = closed. Blinks every 2-4.5 s (rate scales with `amount`), ~0.13 s long. */
export function blinkState(key: string, t: number, amount = 1): number {
  if (amount <= 0) return 0;
  const r = rng("blink", hash(key));
  const period = 1 / Math.max(0.2, amount); // amount 1 -> 2..4.5 s gaps
  let tb = r.uniform(0.2, 1.2);
  // walk the schedule up to t (bounded)
  for (let i = 0; i < 4000 && tb <= t; i++) {
    const d = t - tb;
    if (d >= 0 && d < 0.14) { const q = d / 0.14; return q < 0.25 || q >= 0.75 ? 0.5 : 1; }
    tb += r.uniform(2.0, 4.5) * period;
    if (r.next() < 0.12) tb = tb - r.uniform(1.6, 2.0) * period + 0.3; // occasional double blink
  }
  return 0;
}

const SMALL = new Set([..."ゃゅょャュョっッァィゥェォぁぃぅぇぉー"]);
/** mouth openness 0..1 from per-character timings (one flap per mora) x loudness. */
export function mouthOpen(lines: ResolvedLine[], t: number, energy?: number[], energyHz = 0): number {
  let env = 0;
  const tt = t + 0.03; // mouth leads the sound slightly
  for (const L of lines) {
    if (tt < L.start - 0.1 || tt > L.end + 0.15) continue;
    for (const c of L.chars) {
      if (SMALL.has(c.ch) || /\s/.test(c.ch)) continue;
      const a = c.t0, b = Math.max(c.t1, c.t0 + 0.09);
      if (tt >= a && tt < b) { const ph = (tt - a) / (b - a); env = Math.max(env, 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(Math.PI * ph)), 0.8)); }
      else if (tt >= b && tt < b + 0.1) env = Math.max(env, 0.25 * (1 - (tt - b) / 0.1));
    }
  }
  if (env <= 0) return 0;
  const e = energy && energy.length && energyHz ? clamp(energy[Math.min(energy.length - 1, Math.floor(t * energyHz))] ?? 0.7, 0.45, 1) : 0.8;
  return clamp(env * e);
}

export const breath = (t: number, bpm: number) => Math.sin((2 * Math.PI * t) / ((60 / (bpm || 120)) * 8));
export const hairPhase = (t: number, bpm: number) => {
  const b = 60 / (bpm || 120);
  return Math.sin((2 * Math.PI * t) / (b * 8)) + 0.5 * Math.sin((2 * Math.PI * t) / (b * 6) + 1.3);
};
/** beat-driven body sway (deg) + bounce (fraction of H). */
export function bodyMotion(beat: Beat, t: number, sway: number, bounce: number) {
  const b = 60 / beat.bpm, x = (t - beat.phase) / b;
  const swing = Math.sin(Math.PI * x); // one side per beat
  return { rot: sway * 0.6 * swing, dy: -bounce * 0.008 * beatPulse(beat, t, 0.12) };
}

/** merge puppet settings: preset < global cfg < section < shot. */
export function resolvePuppet(base: PuppetCfg, ...over: (Partial<PuppetCfg> | undefined)[]): PuppetCfg {
  const o = { ...base };
  for (const p of over) if (p) for (const k of Object.keys(p) as (keyof PuppetCfg)[]) if (typeof p[k] === "number") o[k] = clamp(p[k]!, 0, 2);
  return o;
}
