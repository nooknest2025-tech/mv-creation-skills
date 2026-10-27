// Drawing primitives shared by all styles.
import React from "react";
import { clamp, easeOut, rng } from "../lib/core";
import type { Beat } from "../lib/core";
import type { ResolvedLine } from "../lib/types";
import { FONTS, type LayoutH } from "./layout";
import { fontCss } from "../lib/fonts";

export interface Ctx { L: ResolvedLine; t: number; P: Record<string, any>; W: number; H: number; beat: Beat; k: number; textY: number }
export type Box = [number, number, number, number];
export interface StyleOut { el: React.ReactNode; boxes: Box[] }
export type StyleFn = (c: Ctx) => StyleOut;

export const CREAM = "#f2e8d5", CRIM = "#b01428", BLK = "#0c0909", WHITE = "#ffffff", PINK = "#ff46a0", CYAN = "#28e6ff", YELLOW = "#ffd63c", MINT = "#5affbe";
export const CANDY = ["#ff69aa", "#ffbe46", "#78dcff", "#aa82ff", "#6eebaa"];

export const exitP = (L: ResolvedLine, t: number) => clamp((t - L.tOff) / Math.max(1e-3, L.exit));
export const charAge = (L: ResolvedLine, i: number, t: number) => t - L.chars[i].t0;
export const sungP = (L: ResolvedLine, i: number, t: number) => { const c = L.chars[i]; return clamp((t - c.t0) / Math.max(0.06, c.t1 - c.t0)); };
export const wordText = (L: ResolvedLine, w: { i0: number; i1: number }) => L.chars.slice(w.i0, w.i1).map((c) => c.ch).join("");

export interface GlyphOpts {
  x: number; y: number; ch: string; px: number; font?: string; fill?: string; stroke?: string; sw?: number; // sw = stroke width relative to px
  a?: number; s?: number; sx?: number; sy?: number; rot?: number; ay?: number; blur?: number; shadow?: string; style?: React.CSSProperties; k?: string | number;
}
/** one glyph centred at (x, y); ay = vertical anchor for scale (0.5 centre, 0.85 near baseline). */
// palette hook: default text colours become CSS variables set per line (genre recipe / config palette)
const PAL = (c: string | undefined, kind: "fill" | "stroke") => {
  if (kind === "stroke") return c === undefined || c === BLK ? `var(--lyric-stroke, ${BLK})` : c;
  if (c === undefined || c === CREAM || c === WHITE) return `var(--lyric-fill, ${c ?? CREAM})`;
  if (c === YELLOW || c === PINK) return `var(--lyric-accent, ${c})`;
  return c;
};
export function Glyph(o: GlyphOpts) {
  const { px } = o;
  const sw = (o.sw ?? 0) * px;
  const tf = `translate(-50%, -50%) rotate(${o.rot ?? 0}deg) scale(${(o.s ?? 1) * (o.sx ?? 1)}, ${(o.s ?? 1) * (o.sy ?? 1)})`;
  return (
    <div key={o.k} style={{
      position: "absolute", left: o.x, top: o.y, transform: tf, transformOrigin: `50% ${(o.ay ?? 0.5) * 100}%`,
      fontFamily: FONTS[o.font ?? "lyrics"] ?? o.font, fontSize: px, lineHeight: 1, whiteSpace: "pre", color: PAL(o.fill, "fill"),
      WebkitTextStroke: sw > 0 ? `${sw * 2}px ${PAL(o.stroke, "stroke")}` : undefined, paintOrder: "stroke fill",
      opacity: clamp(o.a ?? 1), filter: o.blur && o.blur > 0.3 ? `blur(${o.blur}px)` : undefined, textShadow: o.shadow, ...o.style,
    }}>{o.ch}</div>
  );
}
export const dropShadow = (px: number) => `0 ${px * 0.05}px ${px * 0.06}px rgba(0,0,0,0.55)`;

export function boxesH(lay: LayoutH): Box[] {
  return lay.pos.map(([x, y], i) => [x - lay.adv[i] / 2, y - lay.lh / 2, x + lay.adv[i] / 2, y + lay.lh / 2]);
}

export interface CharState { a?: number; dx?: number; dy?: number; s?: number; rot?: number; sx?: number; sy?: number; ay?: number; fill?: string; blur?: number; shadow?: string; style?: React.CSSProperties; font?: string }
/** keyword effect -> per-char modifier (applied by drawH and by styles that draw per char). */
export function kwMod(c: Ctx, i: number): CharState {
  const { L, t } = c;
  const out: CharState = {};
  for (const h of L.kw) {
    if (i < h.i0 || i >= h.i1) continue;
    if (h.effect.startsWith("font:")) { out.font = fontCss(h.effect.slice(5)); continue; }
    const age = t - L.chars[h.i0].t0;
    if (age < 0) continue;
    const px = c.H * 0.08;
    const r = rng(L.seed, i, Math.floor(t * 30));
    switch (h.effect) {
      case "shake": out.dx = r.uniform(-1, 1) * px * 0.06; out.dy = r.uniform(-1, 1) * px * 0.06; break;
      case "wave": out.dy = Math.sin(t * 7 - i * 0.9) * px * 0.12; out.rot = Math.cos(t * 7 - i * 0.9) * 6; break;
      case "blur": out.blur = 2 + 3 * (0.5 + 0.5 * Math.sin(t * 3 + i)); break;
      case "red": out.fill = "#d4102a"; out.shadow = `0 0 ${px * 0.2}px rgba(255,0,30,0.8)`; break;
      case "glow": out.shadow = `0 0 ${px * (0.15 + 0.15 * Math.max(0, Math.sin(t * 6)))}px #fff6c8, 0 0 ${px * 0.5}px rgba(255,210,90,0.9)`; out.fill = "#fffbe8"; break;
      case "melt": { const m = clamp((age - 0.2) / 0.8); out.sy = 1 + 0.35 * m; out.ay = 0.15; out.fill = "#ffb6d5"; break; }
      case "crack": { const m = clamp((age - 0.15) / 0.12); out.dx = (i % 2 ? 1 : -1) * m * px * 0.06; out.rot = (i % 2 ? 4 : -4) * m; break; }
      case "heart": out.fill = "#ff8fc0"; break;
      case "sparks": out.fill = "#fff2a0"; break;
    }
  }
  return out;
}

/** keyword decorations (drawn on top, positioned from the style's boxes). */
export function KwDecor({ c, boxes }: { c: Ctx; boxes: Box[] }) {
  const { L, t } = c;
  const els: React.ReactNode[] = [];
  L.kw.forEach((h, hk) => {
    const bs = boxes.slice(h.i0, h.i1).filter(Boolean);
    if (!bs.length) return;
    const x0 = Math.min(...bs.map((b) => b[0])), y0 = Math.min(...bs.map((b) => b[1])), x1 = Math.max(...bs.map((b) => b[2])), y1 = Math.max(...bs.map((b) => b[3]));
    const age = t - L.chars[h.i0].t0;
    if (age < 0) return;
    const ex = exitP(L, t), fade = 1 - easeOut(ex, 2);
    const w = x1 - x0, hh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const r = rng(L.seed, "kw", hk);
    if (h.effect === "crack") {
      const m = clamp((age - 0.12) / 0.1);
      const pts: string[] = [];
      let x = x0 + w * 0.5, y = y0;
      for (let k = 0; k <= 6; k++) { pts.push(`${x},${y}`); x = cx + r.uniform(-0.25, 0.25) * w; y = y0 + (hh * (k + 1)) / 6; }
      els.push(<svg key={`c${hk}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={c.W} height={c.H}>
        <polyline points={pts.join(" ")} fill="none" stroke="#fff" strokeWidth={hh * 0.05} strokeDasharray={hh * 3} strokeDashoffset={hh * 3 * (1 - m)} opacity={fade} />
        <polyline points={pts.join(" ")} fill="none" stroke={CRIM} strokeWidth={hh * 0.02} strokeDasharray={hh * 3} strokeDashoffset={hh * 3 * (1 - m)} opacity={fade} />
      </svg>);
    } else if (h.effect === "melt") {
      for (let k = 0; k < 5; k++) {
        const dx = x0 + w * r.uniform(0.1, 0.9), len = clamp((age - 0.2 - k * 0.07) / 1.0) * hh * r.uniform(0.4, 1.1);
        els.push(<div key={`m${hk}${k}`} style={{ position: "absolute", left: dx, top: y1 - hh * 0.2, width: hh * 0.07, height: len, borderRadius: hh, background: "linear-gradient(#ffb6d5,#ff5fa8)", opacity: fade }} />);
      }
    } else if (h.effect === "sparks" || h.effect === "heart" || h.effect === "glow") {
      const n = h.effect === "glow" ? 6 : 10;
      for (let k = 0; k < n; k++) {
        const ang = r.uniform(0, Math.PI * 2), sp = r.uniform(0.6, 1.4) * hh, life = (age * r.uniform(0.8, 1.3) + k * 0.13) % 1.2;
        const x = cx + Math.cos(ang) * sp * life * (h.effect === "heart" ? 0.5 : 1.2), y = cy + Math.sin(ang) * sp * life * 0.8 - (h.effect === "heart" ? life * hh * 1.2 : 0);
        const ch = h.effect === "heart" ? "♥" : h.effect === "glow" ? "✦" : "•";
        const col = h.effect === "heart" ? "#ff6fae" : h.effect === "glow" ? "#fff6c8" : r.pick([YELLOW, "#ff9a3c", WHITE]);
        els.push(<div key={`s${hk}${k}`} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", color: col, fontSize: hh * (h.effect === "heart" ? 0.35 : 0.28), opacity: (1 - life / 1.2) * fade, textShadow: `0 0 ${hh * 0.1}px ${col}`, fontFamily: FONTS.sans }}>{ch}</div>);
      }
    }
  });
  return <>{els}</>;
}

/** generic per-char horizontal draw with fade+rise exit and keyword modifiers. */
export function drawH(c: Ctx, lay: LayoutH, fn: (i: number, age: number) => CharState | null, o: { font?: string; fill?: string; stroke?: string; sw?: number; exit?: "fade" | "none" } = {}): StyleOut {
  const ex = exitP(c.L, c.t);
  const els: React.ReactNode[] = [];
  lay.pos.forEach(([x, y], i) => {
    const age = charAge(c.L, i, c.t);
    const st = fn(i, age);
    if (!st) return;
    const m = kwMod(c, i);
    let a = st.a ?? 1, dy = (st.dy ?? 0) + (m.dy ?? 0);
    if (ex > 0 && (o.exit ?? "fade") === "fade") { a *= 1 - easeOut(ex, 2); dy -= easeOut(ex, 2) * lay.px * 0.18; }
    els.push(<Glyph k={i} x={x + (st.dx ?? 0) + (m.dx ?? 0)} y={y + dy} ch={c.L.chars[i].ch} px={lay.px} font={m.font ?? st.font ?? o.font} fill={m.fill ?? st.fill ?? o.fill ?? CREAM}
      stroke={o.stroke ?? BLK} sw={o.sw ?? 0.09} a={a} s={st.s} sx={st.sx} sy={(st.sy ?? 1) * (m.sy ?? 1)} rot={(st.rot ?? 0) + (m.rot ?? 0)} ay={m.ay ?? st.ay}
      blur={(st.blur ?? 0) + (m.blur ?? 0)} shadow={m.shadow ?? st.shadow ?? dropShadow(lay.px)} style={st.style} />);
  });
  return { el: <>{els}</>, boxes: boxesH(lay) };
}
