// Pro motion core (pure, Node + browser). Rules distilled from studying pro lyric-motion / motion-graphics work
// (see docs/PRO_DIRECTION_ja.md). No artwork is copied - only general timing / typography / layout rules.
import { clamp, hash, rng, type Beat, beatLen } from "./core";

// ---------- easing ----------
/** CSS-style cubic-bezier(x1,y1,x2,y2) as a function of progress p (0..1). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (p: number) => {
    p = clamp(p); if (p === 0 || p === 1) return p;
    let lo = 0, hi = 1, t = p;
    for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; if (bx(t) < p) lo = t; else hi = t; }
    return by(t);
  };
}
/** damped spring 0 -> 1 whose first peak is `over` (1.1-1.2 = pro "pop"). */
export function springOver(p: number, over = 1.15) {
  if (p <= 0) return 0; if (p >= 1) return 1;
  const w = 2 * Math.PI * 1.25, peak = Math.PI / w, d = -Math.log(Math.max(1e-3, over - 1)) / peak;
  return 1 - Math.exp(-d * p) * Math.cos(w * p);
}
export const EASE = {
  /** 90% of the travel in the first ~15% (cubic-bezier(0.1,1,0,1)) */
  expoOut: cubicBezier(0.1, 1, 0, 1),
  /** pose-to-pose snap (cubic-bezier(0.1,0.9,0.2,1)) */
  snappy: cubicBezier(0.1, 0.9, 0.2, 1),
  /** exits / covers accelerate away */
  in: cubicBezier(0.7, 0, 0.84, 0),
  inOut: cubicBezier(0.76, 0, 0.24, 1),
  spring: (p: number) => springOver(p, 1.15),
} as const;
export type EaseName = keyof typeof EASE;

/** pose-to-pose: travel with expo-out during `dur` seconds, then keep drifting slowly (never a dead freeze).
 *  returns >1 after the move (1 + drift * hold-progress). */
export function poseHold(age: number, dur: number, drift = 0.04, holdLen = 3) {
  if (age <= 0) return 0;
  if (age < dur) return EASE.expoOut(age / dur);
  return 1 + drift * Math.min(1, (age - dur) / holdLen);
}
/** progress of a masked exit (accelerating out) - replaces linear fades. */
export const exitOut = (p: number) => EASE.in(clamp(p));
/** blur that only exists while something moves (px), proportional to speed. */
export function motionBlur(prev: number, cur: number, k = 0.35, max = 24) {
  return Math.min(max, Math.abs(cur - prev) * k);
}

// ---------- syllables / stagger ----------
const SMALL = /[ゃゅょぁぃぅぇぉっゎャュョァィゥェォッヮー〜～]/;
/** group char indices into Japanese syllable units (small kana / long vowel attach to the previous char). Latin words stay whole. */
export function syllables(chars: string[]): number[][] {
  const out: number[][] = [];
  chars.forEach((ch, i) => {
    const prev = out[out.length - 1];
    if (prev && (SMALL.test(ch) || (/[A-Za-z']/.test(ch) && /[A-Za-z']/.test(chars[i - 1] ?? "")))) prev.push(i);
    else if (!/\s/.test(ch)) out.push([i]);
  });
  return out;
}
/** start time per char: real per-char timing when the song has it (word/char timestamps), else a 2-3 frame stagger. */
export function unitStarts(chars: { ch: string; t0: number }[], lineStart: number, fps = 30, perFrames = 2.5): number[] {
  const t = chars.map((c) => c.t0);
  const distinct = new Set(t.map((x) => Math.round(x * 100))).size;
  const timed = distinct >= Math.max(2, chars.length * 0.5);
  const syl = syllables(chars.map((c) => c.ch));
  const out = new Array(chars.length).fill(lineStart);
  syl.forEach((g, k) => { const s = timed ? Math.min(...g.map((i) => t[i])) : lineStart + (k * perFrames) / fps; g.forEach((i) => (out[i] = s)); });
  return out;
}
/** stagger delay for item i (seconds): chars 2-3f, lines 5-8f @60fps -> same seconds at any fps. */
export const staggerDelay = (i: number, unit: "char" | "line" = "char") => i * (unit === "char" ? 2.5 / 60 : 6.5 / 60);

// ---------- typographic hierarchy ----------
export const PARTICLE = new Set([..."はがをにのへとも"]);
const KANJI = /[\u3400-\u9fff々〆]/, KATA = /[\u30a0-\u30ff]/, HIRA = /[\u3040-\u309f]/;
/** is char i a grammatical particle (hiragana は が を に の へ と も right after kanji/katakana)? */
export function isParticle(text: string[], i: number) {
  const c = text[i]; if (!PARTICLE.has(c)) return false;
  const p = text[i - 1] ?? "", n = text[i + 1] ?? "";
  return (KANJI.test(p) || KATA.test(p) || p === "ー") && !(HIRA.test(n) && !PARTICLE.has(n) && n !== "");
}
export interface Tier { scale: number; weight: number; role: "key" | "body" | "particle"; mincho: boolean }
/** per-char size tier: the key word (longest kanji/katakana run) big, particles 50-70 %, other kana body size. */
export function hierarchy(chars: string[], o: { particle?: number; key?: number; mix?: boolean } = {}): Tier[] {
  const pk = o.particle ?? 0.6, kk = o.key ?? 1.35;
  const runs: [number, number][] = []; let s = -1;
  chars.forEach((c, i) => { const k = KANJI.test(c) || KATA.test(c) || c === "ー"; if (k && s < 0) s = i; if (!k && s >= 0) { runs.push([s, i]); s = -1; } });
  if (s >= 0) runs.push([s, chars.length]);
  const key = runs.sort((a, b) => b[1] - b[0] - (a[1] - a[0]) || a[0] - b[0])[0];
  return chars.map((c, i) => {
    if (key && i >= key[0] && i < key[1]) return { scale: kk, weight: 900, role: "key", mincho: false };
    if (isParticle(chars, i)) return { scale: pk, weight: 400, role: "particle", mincho: !!o.mix };
    return { scale: 1, weight: 700, role: "body", mincho: false };
  });
}
/** heavy styles read better tight: negative tracking scales with weight. */
export const trackingFor = (weight: number) => (weight >= 800 ? -0.06 : weight >= 600 ? -0.02 : 0.02);

// ---------- layout ----------
/** 3x3 grid anchor (0..8, row-major) -> [x, y] fractions; keeps a safe margin. */
export function gridAnchor(k: number): [number, number] {
  const xs = [0.24, 0.5, 0.76], ys = [0.26, 0.5, 0.74];
  return [xs[((k % 9) + 9) % 3], ys[Math.floor((((k % 9) + 9) % 9) / 3)]];
}
const FLOWS = [[0, 4, 8], [2, 4, 6], [6, 4, 2], [0, 5, 7], [3, 1, 8], [6, 1, 5], [2, 3, 7]];
/** diagonal eye-flow for consecutive lines of a section; centre is used at most every third line. */
export function flowAnchor(lineInSection: number, seed: number): number {
  const f = FLOWS[hash("flow", seed) % FLOWS.length];
  return f[lineInSection % f.length];
}
/** small tilt for fast sections (-10, -5, +5, +15 deg), 0 for slow ones. */
export function tiltFor(fast: boolean, seed: number) { if (!fast) return 0; return [-10, -5, 5, 15, -5][hash("tilt", seed) % 5]; }

// ---------- colour ----------
export interface Palette { id: string; ja: string; bg: string; fg: string; accent: string; sub: string }
export const PALETTES: Record<string, Palette> = {
  mono_red: { id: "mono_red", ja: "白黒＋赤", bg: "#0b0b0c", fg: "#f2f0ea", accent: "#d7192a", sub: "#6d6d70" },
  paper_red: { id: "paper_red", ja: "紙白＋墨＋朱", bg: "#efe9dc", fg: "#141214", accent: "#b3121f", sub: "#8a8478" },
  neon: { id: "neon", ja: "ネオン", bg: "#07060f", fg: "#f4f3ff", accent: "#00e5ff", sub: "#ff2bd6" },
  acid: { id: "acid", ja: "黒＋蛍光黄", bg: "#0a0a0a", fg: "#f5f5f0", accent: "#d8ff1e", sub: "#5a5a5a" },
  pop: { id: "pop", ja: "ポップ", bg: "#ffe14d", fg: "#161320", accent: "#ff4f81", sub: "#2f5bff" },
  candy: { id: "candy", ja: "キャンディ", bg: "#ff8fb8", fg: "#2b1d6b", accent: "#ffffff", sub: "#ffd84a" },
  dusk: { id: "dusk", ja: "夕暮れ", bg: "#121628", fg: "#ece6d8", accent: "#d9a85b", sub: "#5b6386" },
  ink_blue: { id: "ink_blue", ja: "藍", bg: "#0e1a2b", fg: "#e9eef2", accent: "#7fb2d9", sub: "#33475e" },
  sakura: { id: "sakura", ja: "桜", bg: "#f6ece9", fg: "#2b2326", accent: "#d9667f", sub: "#a99a96" },
  city: { id: "city", ja: "シティ", bg: "#1b1340", fg: "#fff4e6", accent: "#ff7a59", sub: "#58d3c8" },
};
/** lyric-literal colour: colour words recolour the accent; monochrome words desaturate. */
export function literalColor(text: string): { accent?: string; mono?: boolean; why?: string } | null {
  const T: [RegExp, string, string][] = [[/赤|紅|血|炎/, "#d7192a", "赤"], [/青|蒼|海|空/, "#2f7bff", "青"], [/金|黄金/, "#e8b84a", "金"], [/桜|ピンク/, "#ff7aa8", "桜色"], [/緑|森/, "#2fbf71", "緑"], [/紫/, "#9a5cff", "紫"]];
  if (/モノクロ|白黒|灰色|色褪せ|色のない|無色/.test(text)) return { mono: true, why: "歌詞「色がない」→モノクロ" };
  for (const [re, c, w] of T) if (re.test(text)) return { accent: c, why: `歌詞の「${w}」→差し色` };
  return null;
}
/** WCAG relative luminance helper for palette sanity tests. */
export function lum(hex: string) { const n = parseInt(hex.slice(1), 16), f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); }
export const contrastRatio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------- beat accents ----------
export type AccentKind = "invert" | "bump" | "rotate" | "shake";
export interface Accent { t: number; kind: AccentKind; amt: number }
/** accents from the beat grid (kick ~ beats 1/3, snare ~ 2/4: an approximation, not drum detection).
 *  density 0 = none, 1 = every bar, 2 = every beat, 3 = 8th notes. */
export function beatAccents(b: Beat, t0: number, t1: number, density: number, kinds: AccentKind[] = ["invert", "bump"], seed = 1): Accent[] {
  if (density <= 0 || b.bpm <= 0) return [];
  const B = beatLen(b), step = density >= 3 ? B / 2 : density >= 2 ? B : B * b.beatsPerBar;
  const out: Accent[] = []; const r = rng("acc", seed);
  const first = b.phase + Math.ceil((t0 - b.phase) / step - 1e-9) * step;
  for (let t = first, k = 0; t < t1; t += step, k++) {
    const bar = Math.round((t - b.phase) / B) % b.beatsPerBar === 0;
    const kind = bar && kinds.includes("invert") ? "invert" : kinds.filter((x) => x !== "invert")[Math.floor(r.next() * Math.max(1, kinds.length - 1))] ?? "bump";
    out.push({ t: +t.toFixed(4), kind, amt: bar ? 1 : 0.6 });
  }
  return out;
}
/** state of accents at time t: invert lasts exactly 2 frames; bump/rotate decay fast. */
export function accentState(acc: Accent[], t: number, fps: number) {
  let invert = false, bump = 0, rot = 0, shake = 0;
  for (const a of acc) {
    const age = t - a.t; if (age < 0 || age > 0.5) continue;
    if (a.kind === "invert" && age < 2 / fps - 1e-6) invert = true;
    const d = Math.exp(-age / 0.09) * a.amt;
    if (a.kind === "bump" || a.kind === "invert") bump = Math.max(bump, 0.04 * d);
    if (a.kind === "rotate") rot += 2.5 * d * (hash(a.t) % 2 ? 1 : -1);
    if (a.kind === "shake") shake = Math.max(shake, d);
  }
  return { invert, bump, rot, shake };
}
/** held scream: a char held > 0.8 s in a loud section gets a wiggle amount 0..1. */
export function heldScream(chars: { t0: number; t1: number }[], t: number, energy: number) {
  if (energy < 0.7) return 0;
  for (const c of chars) if (c.t1 - c.t0 > 0.8 && t > c.t0 + 0.25 && t < c.t1) return clamp((t - c.t0 - 0.25) / 0.4);
  return 0;
}
