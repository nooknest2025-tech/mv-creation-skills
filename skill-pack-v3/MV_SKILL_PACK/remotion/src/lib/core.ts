// Shared math helpers: easing, deterministic RNG, beat grid. Pure functions only (safe in Node + browser).
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const easeOut = (p: number, k = 3) => 1 - Math.pow(1 - clamp(p), k);
export const easeOutBack = (p: number, s = 1.70158) => {
  const q = clamp(p) - 1;
  return 1 + q * q * ((s + 1) * q + s);
};
export const easeOutElastic = (p: number) => {
  p = clamp(p);
  if (p === 0 || p === 1) return p;
  return Math.pow(2, -10 * p) * Math.sin(((p * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
};
export const spring = (a: number, k = 24, d = 6.5) => (a >= 0 ? Math.exp(-a * d) * Math.sin(a * k) : 0);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** 32-bit string/number hash (FNV-1a) -> deterministic seed. */
export function hash(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const c of parts.join("|")) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** mulberry32 RNG seeded from parts; every call to the returned fn gives the next value in [0,1). */
export function rng(...parts: (string | number)[]) {
  let a = hash(...parts);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    uniform: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo) * next()),
    normal: (mu = 0, sd = 1) => {
      const u = Math.max(1e-9, next()), v = next();
      return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length) % arr.length],
  };
}

export interface Beat { bpm: number; phase: number; beatsPerBar: number }
export const beatLen = (b: Beat) => 60 / b.bpm;
export const beatX = (b: Beat, t: number) => (t - b.phase) / beatLen(b);
/** exponential pulse right after each beat (1 at the beat, decays with `decay` seconds). */
export function beatPulse(b: Beat, t: number, decay = 0.09, div = 1) {
  const B = beatLen(b) * div;
  const x = (t - b.phase) / B;
  return Math.exp((-(x - Math.floor(x)) * B) / decay);
}
/** beat-stepped counter: jumps forward one unit per beat with an ease-out. */
export function beatStep(b: Beat, t: number, t0: number, ease = 0.35) {
  const x = (t - t0) / beatLen(b);
  const k = Math.floor(x);
  return k + (1 - Math.pow(1 - Math.min(1, (x - k) / ease), 3));
}
