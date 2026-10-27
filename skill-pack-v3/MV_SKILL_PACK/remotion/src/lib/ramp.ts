// Speed ramps: remap shot progress u (0..1) -> source progress F(u) (0..1). F(0)=0, F(1)=1, monotone.
// Video shots use it as time remapping (Freeze on the remapped frame); stills use it for the camera move.
export const RAMPS = ["none", "in", "out", "punch", "smooth"] as const;
export type Ramp = (typeof RAMPS)[number];
const speed = (k: string, u: number) => {
  switch (k) {
    case "in": return 0.35 + 1.6 * u; // slow -> fast
    case "out": return 1.95 - 1.6 * u; // fast -> slow
    case "punch": return u < 0.35 ? 2.2 : 0.3; // rush in, then slow-motion hold
    case "smooth": return Math.sin(Math.PI * Math.min(1, Math.max(0, u))) + 0.05; // ease in-out
    default: return 1;
  }
};
const cache = new Map<string, Float64Array>();
export function rampProgress(kind: string | undefined, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  if (!kind || kind === "none") return x;
  let tab = cache.get(kind);
  if (!tab) {
    const n = 128; tab = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) tab[i] = tab[i - 1] + speed(kind, (i - 0.5) / n) / n;
    const tot = tab[n]; for (let i = 0; i <= n; i++) tab[i] /= tot;
    cache.set(kind, tab);
  }
  const f = x * 128, i = Math.floor(f);
  return i >= 128 ? 1 : tab[i] + (tab[i + 1] - tab[i]) * (f - i);
}
