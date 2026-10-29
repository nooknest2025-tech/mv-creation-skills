// Text layout (no DOM measuring: deterministic width estimate tuned for Japanese fonts).
import type { ResolvedLine } from "../lib/types";

export const FONTS: Record<string, string> = {
  lyrics: "var(--lyric-font, 'Reggae One'), 'Noto Sans JP', sans-serif",
  stamp: "var(--lyric-font, 'Dela Gothic One'), 'Noto Sans JP', sans-serif",
  round: "var(--lyric-font, 'RocknRoll One'), 'Noto Sans JP', sans-serif",
  sans: "var(--lyric-font, 'Noto Sans JP'), 'Noto Sans JP', sans-serif",
  serif: "var(--lyric-font, 'Noto Serif JP'), 'Noto Sans JP', serif",
};
const WIDE = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uff60\uf900-\ufaff々〆〜]/;
export const advOf = (ch: string, px: number, mono = false) => (mono ? px * 0.92 : WIDE.test(ch) ? px * 1.0 : /[A-Z0-9]/.test(ch) ? px * 0.68 : px * 0.56);

export interface LayoutH { pos: [number, number][]; adv: number[]; rows: number[][]; px: number; lh: number; rowW: number[]; box: [number, number, number, number] }
export function layoutH(L: ResolvedLine, W: number, H: number, o: { size?: number; v?: number; maxw?: number; track?: number; mono?: boolean; k?: number } = {}): LayoutH {
  const size = o.size ?? 0.075, v = o.v ?? 0.8, maxw = o.maxw ?? 0.86, track = o.track ?? 0;
  let px = Math.round(size * Math.min(W, H) * 1.2 * (o.k ?? 1) * Number(L.params.size ?? 1));
  const chars = L.chars;
  const noWrap = !!L.params?.noWrap; // editor 「改行しない」: one row, shrink to fit instead of breaking (e.g. a name like ミスター・ヘンドレ)
  let adv: number[] = [], rows: number[][] = [], gaps: number[] = [];
  if (noWrap) {
    adv = chars.map((c) => advOf(c.ch, px, o.mono) + track * px);
    gaps = chars.map((c, i) => (i && /\s/.test(L.text.slice(chars[i - 1].idx + 1, c.idx)) ? px * 0.35 : 0));
    const w = adv.reduce((a, b) => a + b, 0) + gaps.slice(1).reduce((a, b) => a + b, 0);
    if (w > maxw * W) { const k = (maxw * W) / w; px = Math.floor(px * k); adv = chars.map((c) => advOf(c.ch, px, o.mono) + track * px); gaps = gaps.map((g) => g * k); }
    rows = [chars.map((_, i) => i)];
  } else
  for (let it = 0; it < 8; it++) {
    adv = chars.map((c) => advOf(c.ch, px, o.mono) + track * px);
    gaps = chars.map((c, i) => (i && /\s/.test(L.text.slice(chars[i - 1].idx + 1, c.idx)) ? px * 0.35 : 0));
    rows = []; let cur: number[] = [], x = 0;
    for (let i = 0; i < chars.length; i++) {
      const w = adv[i] + (cur.length ? gaps[i] : 0);
      if (cur.length && x + w > maxw * W) { rows.push(cur); cur = []; x = 0; }
      x += cur.length ? w : adv[i];
      cur.push(i);
    }
    rows.push(cur);
    if (rows.length <= 2) break;
    px = Math.round(px * 0.88);
  }
  const lh = px * 1.3;
  const tot = lh * rows.length;
  const yTop = v * H - tot / 2;
  const pos: [number, number][] = new Array(chars.length);
  const rowW: number[] = [];
  rows.forEach((r, ri) => {
    const w = r.reduce((s, i, k) => s + adv[i] + (k ? gaps[i] : 0), 0);
    rowW.push(w);
    let x = W / 2 - w / 2;
    r.forEach((i, k) => { if (k) x += gaps[i]; pos[i] = [x + adv[i] / 2, yTop + lh * (ri + 0.5)]; x += adv[i]; });
  });
  const mw = Math.max(...rowW);
  return { pos, adv, rows, px, lh, rowW, box: [W / 2 - mw / 2, yTop, W / 2 + mw / 2, yTop + tot] };
}

const VROT = new Set([..."ー〜～…‥―-－「」『』（）()【】〈〉《》[]"]);
const SMALL = new Set([..."ゃゅょっぁぃぅぇぉゎャュョッァィゥェォヮヵヶ"]);
export function layoutV(L: ResolvedLine, W: number, H: number, o: { size?: number; x?: number; top?: number; bottom?: number; k?: number } = {}) {
  const size = o.size ?? 0.07, X = o.x ?? 0.84, top = o.top ?? 0.1, bottom = o.bottom ?? 0.92;
  let px = Math.round(size * Math.min(W, H) * 1.2 * (o.k ?? 1) * Number(L.params.size ?? 1));
  let step = px * 1.02;
  const n = L.chars.length;
  let per = Math.max(1, Math.floor(((bottom - top) * H) / step));
  if (L.params?.noWrap && per < n) { px = Math.floor((px * per) / n); step = px * 1.02; per = n; } // 「改行しない」: one column
  else if (per < n && n <= per + 4) { px = Math.floor((px * per) / n); step = px * 1.02; per = n; }
  else if (n > per) per = Math.ceil(n / Math.ceil(n / per));
  const pos: [number, number][] = [], rot: number[] = [];
  L.chars.forEach((c, i) => {
    const col = Math.floor(i / per), k = i % per;
    let cx = X * W - col * px * 1.3, cy = top * H + step * (k + 0.5);
    if (SMALL.has(c.ch)) { cx += px * 0.12; cy -= px * 0.12; }
    if ("、。，．".includes(c.ch)) { cx += px * 0.32; cy -= px * 0.32; }
    pos.push([cx, cy]);
    rot.push(VROT.has(c.ch) ? 90 : 0);
  });
  return { pos, rot, px, per, cols: Math.ceil(n / per) };
}
