// QC: empty / pure-black regions. A pixel block counts as "empty" when it is near-black AND flat (no texture), so dark
// artwork does not trip it. Frames inside a scene's intentional impact effects (comp.fx windows) are allowed.
export type BlackHit = { frame: number; t: number; frac: number; cell?: number };
/** fraction of WxH grey frame covered by flat near-black 8x8 blocks (mean < lum, std < flat). */
export function blackFraction(g: Uint8Array, W: number, H: number, lum = 8, flat = 1.5) {
  let bad = 0, n = 0;
  for (let by = 0; by + 8 <= H; by += 8) for (let bx = 0; bx + 8 <= W; bx += 8) {
    let s = 0, s2 = 0;
    for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const v = g[y * W + x]; s += v; s2 += v * v; }
    const m = s / 64, sd = Math.sqrt(Math.max(0, s2 / 64 - m * m)); n++; if (m < lum && sd < flat) bad++;
  }
  return n ? bad / n : 0;
}
/** largest share of flat near-black blocks inside any cell of a grid×grid split: an empty black コマ (a box, a wipe
 *  strip, a gap between panels) fails even when the whole-frame share stays small. Also counts very dark blocks (mean < dark)
 *  so crushed-black footage reads as empty too. */
export function blackCellMax(g: Uint8Array, W: number, H: number, grid = 4, lum = 8, flat = 1.5) {
  const cw = Math.floor(W / grid), ch = Math.floor(H / grid); let worst = 0;
  for (let cy = 0; cy < grid; cy++) for (let cx = 0; cx < grid; cx++) {
    const sub = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) sub[y * cw + x] = g[(cy * ch + y) * W + cx * cw + x];
    worst = Math.max(worst, blackFraction(sub, cw, ch, lum, flat));
  }
  return worst;
}
/** seconds where black is intentional: every comp.fx window (+1 frame either side). */
export function impactWindows(data: any): [number, number][] {
  const fps = data?.fps ?? 30, out: [number, number][] = [];
  for (const s of data?.scenes ?? []) for (const x of s?.comp?.fx ?? []) out.push([s.start + x.t - 1 / fps, s.start + x.t + x.d + 1 / fps]);
  return out;
}
export const isIntentional = (t: number, w: [number, number][]) => w.some(([a, b]) => t >= a && t <= b);
