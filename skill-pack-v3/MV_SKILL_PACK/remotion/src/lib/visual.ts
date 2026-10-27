// Picture-aware text: where to put lyrics (avoid faces & busy areas) and which colour reads on that background (WCAG contrast).
import type { FaceRig } from "./types";
export interface Band { lum: number; busy: number; rgb: [number, number, number] }
export interface VisFeat { bands: Record<"top" | "mid" | "bottom", Band>; dominant: string[]; colorful: number; brightness: number; contrast: number; art: string; motion: number }
const BANDY = { top: 0.16, mid: 0.5, bottom: 0.84 } as const;

export function relLum(hex: string): number {
  const m = hex.replace("#", ""); const v = m.length === 3 ? m.split("").map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((k) => parseInt(m.slice(k, k + 2), 16));
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
}
export const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** fraction of the band [y-0.11, y+0.11] covered by the face box (eyes..mouth, padded). */
export function faceOverlap(face: FaceRig | undefined, y: number): number {
  if (!face?.eyes?.length) return 0;
  const ys = face.eyes.map((e) => [e[1] - e[3] * 3, e[1] + e[3] * 3]).flat();
  if (face.mouth) ys.push(face.mouth[1] + face.mouth[3] * 2);
  const top = Math.min(...ys) - 0.08, bot = Math.max(...ys) + 0.1; // forehead .. chin
  const a = Math.max(top, y - 0.11), b = Math.min(bot, y + 0.11);
  return Math.max(0, b - a) / 0.22;
}

export interface Placement { textY: number; band: "top" | "mid" | "bottom"; why: string; cost: Record<string, number> }
export function placeText(vis: VisFeat | undefined, face: FaceRig | undefined, defY: number): Placement {
  if (!vis) return { textY: defY, band: "bottom", why: "画像解析なし→既定位置", cost: {} };
  const cost: Record<string, number> = {};
  for (const k of ["bottom", "top", "mid"] as const) {
    const y = k === "bottom" ? defY : BANDY[k];
    cost[k] = vis.bands[k].busy * 3 + faceOverlap(face, y) * 10 + (k === "top" ? 0.35 : k === "mid" ? 0.9 : 0);
  }
  const best = (Object.keys(cost) as ("top" | "mid" | "bottom")[]).sort((a, b) => cost[a] - cost[b])[0];
  const fo = faceOverlap(face, defY);
  const why = best === "bottom" ? "下が空いている→字幕位置" : `${fo > 0.2 ? "下に顔がかかる" : "下がごちゃついている"}→${best === "top" ? "上" : "中央"}へ`;
  return { textY: best === "bottom" ? defY : BANDY[best], band: best, why, cost };
}

/** keep the palette fill if it reads (>= 4.5:1 against the band); otherwise switch to white/near-black with an opposite outline. */
export function readableFill(bg: Band, fill = "#ffffff"): { fill: string; stroke: string; ratio: number; changed: boolean } {
  const Lb = 0.2126 * ((bg.rgb[0] / 255) ** 2.2) + 0.7152 * ((bg.rgb[1] / 255) ** 2.2) + 0.0722 * ((bg.rgb[2] / 255) ** 2.2);
  const lbg = Number.isFinite(bg.lum) ? bg.lum : Lb;
  const r0 = contrast(relLum(fill), lbg);
  if (r0 >= 4.5) return { fill, stroke: lbg > 0.4 ? "#ffffff" : "#0c0909", ratio: r0, changed: false };
  const w = contrast(1, lbg), k = contrast(relLum("#141014"), lbg);
  return w >= k ? { fill: "#ffffff", stroke: "#0c0909", ratio: w, changed: true } : { fill: "#141014", stroke: "#ffffff", ratio: k, changed: true };
}
