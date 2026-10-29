// Pro lyric styles built on the pro motion core (src/lib/pro.ts): masked reveals instead of fades, expo-out / snappy / spring
// easing, pose-to-pose hold drift, syllable stagger, typographic hierarchy (key word big, particles small mincho),
// 3x3 grid anchors with diagonal flow, accelerated masked exits. Ids are new (pro_*) - existing ids are unchanged.
import React from "react";
import { clamp, hash } from "../lib/core";
import { EASE, exitOut, flowAnchor, gridAnchor, hierarchy, poseHold, springOver, syllables, tiltFor, trackingFor, unitStarts, type Tier } from "../lib/pro";
import { advOf } from "./layout";
import { exitP, kwMod, type Box, type Ctx, type StyleFn } from "./prims";

const HEAVY = "var(--lyric-font, 'Dela Gothic One'), 'Noto Sans JP', sans-serif";
const SANS = "var(--lyric-font, 'Noto Sans JP'), 'Noto Sans JP', sans-serif";
const MINCHO = "'Noto Serif JP', 'Noto Sans JP', serif";
const FG = "var(--lyric-fill, #f4f2ec)", AC = "var(--lyric-accent, #d7192a)", BG = "var(--lyric-stroke, #0b0b0c)";
const U = (c: Ctx) => Math.min(c.W, c.H);

const KATA = /[ァ-ヺー・]/, LATIN = /[A-Za-z0-9!?'’]/, NOSTART = /[、。，．・ー！？!?）)」』】〉ゃゅょっャュョッァィゥェォ]/;
/** line-break rule: never before closing punctuation / small kana, never inside a katakana word (ミスター・ヘンドレ) or a latin word. */
export function canBreak(chars: string[], i: number) {
  const a = chars[i - 1] ?? "", b = chars[i] ?? "";
  if (NOSTART.test(b) || /[（(「『【]/.test(a)) return false;
  if (KATA.test(a) && KATA.test(b)) return false;
  if (LATIN.test(a) && LATIN.test(b)) return false;
  return true;
}
export interface PItem { i: number; ch: string; x: number; y: number; px: number; adv: number; tier: Tier; t0: number }
/** hierarchy-aware layout at a grid anchor (or bottom-centre when anchor = "bottom"). */
export function proLayout(c: Ctx, size: number, o: { mix?: boolean; heavy?: boolean; anchor?: number | "bottom"; maxw?: number; particle?: number; key?: number } = {}) {
  const chars = c.L.chars.map((x) => x.ch);
  const tiers = hierarchy(chars, { mix: o.mix, particle: o.particle, key: o.key });
  const base = size * U(c) * 1.2 * c.k * Number(c.L.params.size ?? 1);
  const anchor = o.anchor ?? (c.P.anchor === "bottom" ? "bottom" : c.P.anchor !== undefined ? Number(c.P.anchor) : flowAnchor(c.L.li, hash(c.L.section)));
  const [ax, ay] = anchor === "bottom" ? [0.5, c.textY] : gridAnchor(anchor);
  const align = anchor === "bottom" ? 0 : ax < 0.4 ? -1 : ax > 0.6 ? 1 : 0;
  const maxw = (o.maxw ?? (align ? 0.62 : 0.86)) * c.W;
  let k = 1, rows: number[][] = [], widths: number[] = [], advs: number[] = [];
  for (let it = 0; it < 8; it++) {
    advs = chars.map((ch, i) => { const px = base * k * tiers[i].scale; return advOf(ch, px) * (1 + (o.heavy ? trackingFor(tiers[i].weight) : 0.02)) + (/\s/.test(ch) ? px * 0.1 : 0); });
    rows = []; widths = []; let cur: number[] = [], w = 0;
    chars.forEach((ch, i) => { if (cur.length && w + advs[i] > maxw && canBreak(chars, i)) { rows.push(cur); widths.push(w); cur = []; w = 0; } cur.push(i); w += advs[i]; });
    rows.push(cur); widths.push(w);
    if (rows.length <= 2 && Math.max(...widths) <= maxw * 1.001) break; k *= 0.88;
  }
  const lh = base * k * Math.max(...tiers.map((t) => t.scale)) * 1.12;
  const starts = unitStarts(c.L.chars, c.L.chars[0].t0, 30);
  const items: PItem[] = [];
  const cy0 = ay * c.H - (lh * (rows.length - 1)) / 2;
  rows.forEach((r, ri) => {
    let x = align < 0 ? ax * c.W - c.W * 0.14 : align > 0 ? ax * c.W + c.W * 0.14 - widths[ri] : ax * c.W - widths[ri] / 2;
    x = Math.max(c.W * 0.04, Math.min(c.W * 0.96 - widths[ri], x));
    const y = cy0 + ri * lh;
    r.forEach((i) => { const px = base * k * tiers[i].scale; items.push({ i, ch: chars[i], x: x + advs[i] / 2, y: y + (lh / 1.12 - px) * 0.42, px, adv: advs[i], tier: tiers[i], t0: starts[i] }); x += advs[i]; });
  });
  const box: Box = [Math.min(...items.map((p) => p.x - p.adv / 2)), Math.min(...items.map((p) => p.y - p.px / 2)), Math.max(...items.map((p) => p.x + p.adv / 2)), Math.max(...items.map((p) => p.y + p.px / 2))];
  return { items, box, base: base * k, anchor, align, rows };
}
const boxesOf = (items: PItem[]): Box[] => { const b: Box[] = []; items.forEach((p) => (b[p.i] = [p.x - p.adv / 2, p.y - p.px / 2, p.x + p.adv / 2, p.y + p.px / 2])); return b; };

/** one glyph inside a mask window (overflow hidden): the pro alternative to fading. */
function MaskGlyph({ p, dy = 0, dx = 0, s = 1, sx = 1, blur = 0, color = FG, font, weight, stroke, k, rot = 0, style }: { p: PItem; dy?: number; dx?: number; s?: number; sx?: number; blur?: number; color?: string; font: string; weight?: number; stroke?: string; k: React.Key; rot?: number; style?: React.CSSProperties }) {
  const w = p.adv * 1.25, h = p.px * 1.35;
  return <div key={k} style={{ position: "absolute", left: p.x - w / 2, top: p.y - h / 2, width: w, height: h, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${s * sx}, ${s})`,
      fontFamily: font, fontWeight: weight ?? p.tier.weight, fontSize: p.px, lineHeight: 1, color, whiteSpace: "pre", filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
      WebkitTextStroke: stroke, textShadow: stroke ? undefined : `0 ${p.px * 0.04}px ${p.px * 0.12}px rgba(0,0,0,0.35)`, ...style }}>{p.ch}</div>
  </div>;
}
const fontOf = (p: PItem, heavy: boolean) => (p.tier.mincho ? MINCHO : heavy ? HEAVY : SANS);
/** pose-to-pose line drift + accelerated masked exit (shared). */
function group(c: Ctx, items: PItem[], ox: number, oy: number, els: React.ReactNode, drift = 0.035, rot = 0) {
  const hold = poseHold(c.t - c.L.tOn, 0.5, drift, Math.max(1, c.L.tOff - c.L.tOn));
  const s = hold > 1 ? hold : 1;
  return <div style={{ position: "absolute", inset: 0, transformOrigin: `${ox}px ${oy}px`, transform: `rotate(${rot}deg) scale(${s})` }}>{els}</div>;
}
const exitDy = (c: Ctx, p: PItem) => -exitOut(exitP(c.L, c.t)) * p.px * 1.4;
/** English section/line labels are off by default (they read as stray lyrics); opt in with params.label=true. */
const labelsOn = (c: Ctx) => c.P?.label === true || c.P?.label === "on";
const decoLabel = (c: Ctx, box: Box, a: number) => {
  if (!labelsOn(c)) return null;
  const sz = U(c) * 0.014, txt = `${String(c.L.section ?? "").normalize("NFKC").replace(/[^\x20-\x7e]/g, "").toUpperCase() || String(c.L.sectionType ?? "").toUpperCase()} — ${String(c.L.li + 1).padStart(2, "0")}`;
  return <div style={{ position: "absolute", left: box[0], top: box[1] - sz * 2.6, fontFamily: "'Noto Sans JP', monospace", fontSize: sz, letterSpacing: sz * 0.5, color: FG, opacity: 0.55 * a, whiteSpace: "pre" }}>{txt}</div>;
};

export const PRO_STYLES: Record<string, StyleFn> = {};

/** masked slide reveal per syllable + hierarchy (mincho particles) + tiny wide-tracked label. */
PRO_STYLES.pro_slide = (c) => {
  const l = proLayout(c, 0.07, { mix: true });
  const ex = exitP(c.L, c.t);
  const els = l.items.map((p) => {
    const age = c.t - p.t0 + c.L.lead * 0.6, q = EASE.expoOut(clamp(age / 0.45)), m = kwMod(c, p.i);
    if (age <= 0) return null;
    return <MaskGlyph k={p.i} p={p} dy={(1 - q) * p.px * 1.1 + exitDy(c, p) + (m.dy ?? 0)} dx={m.dx ?? 0} font={m.font ?? fontOf(p, false)} color={m.fill ?? (p.tier.role === "key" ? FG : FG)} />;
  });
  const la = EASE.snappy(clamp((c.t - c.L.tOn) / 0.4)) * (1 - ex);
  return { el: group(c, l.items, (l.box[0] + l.box[2]) / 2, (l.box[1] + l.box[3]) / 2, <>{decoLabel(c, l.box, la)}<div style={{ position: "absolute", left: l.box[0], top: l.box[3] + U(c) * 0.012, width: (l.box[2] - l.box[0]) * la, height: Math.max(2, U(c) * 0.003), background: AC }} />{els}</>), boxes: boxesOf(l.items) };
};

/** smash: each word slams from 300-500 % to 100 % in ~4 frames, blur only while moving; heavy tight type + hollow offset duplicate. */
PRO_STYLES.pro_smash = (c) => {
  const l = proLayout(c, 0.085, { heavy: true, particle: 0.55, key: 1.45 });
  const fast = true, rot = c.P.tilt ?? tiltFor(fast, c.L.li);
  const els: React.ReactNode[] = [];
  const dur = 4 / 30;
  l.items.forEach((p) => {
    const age = c.t - p.t0 + 0.04; if (age <= 0) return;
    const q = clamp(age / dur), s = 1 + 3 * (1 - EASE.expoOut(q)), q2 = clamp((age - 1 / 30) / dur), s2 = 1 + 3 * (1 - EASE.expoOut(q2));
    const blur = q < 1 ? Math.abs(s - s2) * p.px * 0.06 : 0; const m = kwMod(c, p.i);
    const ex = exitOut(exitP(c.L, c.t)), color = p.tier.role === "key" ? AC : FG;
    const off = p.px * 0.07;
    els.push(<MaskGlyph k={`o${p.i}`} p={{ ...p, x: p.x + off, y: p.y + off }} s={s * (1 + ex * 0.6)} font={HEAVY} color="transparent" stroke={`${Math.max(2, p.px * 0.035)}px ${p.tier.role === "key" ? FG : AC}`} style={{ opacity: 0.9 * (1 - ex) }} />);
    els.push(<MaskGlyph k={p.i} p={p} s={s * (1 + ex * 0.6)} blur={blur} dx={m.dx ?? 0} dy={(m.dy ?? 0) + exitDy(c, p) * 0.3} font={m.font ?? HEAVY} color={m.fill ?? color} style={{ opacity: 1 - ex }} />);
  });
  const cx = (l.box[0] + l.box[2]) / 2, cy = (l.box[1] + l.box[3]) / 2;
  return { el: group(c, l.items, cx, cy, <>{els}</>, 0.05, rot), boxes: boxesOf(l.items) };
};

/** width stretch 300 % -> 100 % per char with a 2-3 frame stagger (snappy). */
PRO_STYLES.pro_stretch = (c) => {
  const l = proLayout(c, 0.078, { heavy: true });
  const els = l.items.map((p, n) => {
    const age = c.t - p.t0 + 0.05; if (age <= 0) return null;
    const q = EASE.snappy(clamp(age / 0.3)); const m = kwMod(c, p.i);
    return <MaskGlyph k={p.i} p={p} sx={1 + 2 * (1 - q)} s={1} dx={(1 - q) * p.px * 0.6 * (n % 2 ? 1 : -1)} dy={exitDy(c, p) + (m.dy ?? 0)} blur={(1 - q) * p.px * 0.05} font={m.font ?? fontOf(p, true)} color={m.fill ?? (p.tier.role === "key" ? AC : FG)} />;
  });
  return { el: group(c, l.items, (l.box[0] + l.box[2]) / 2, (l.box[1] + l.box[3]) / 2, <>{els}</>, 0.03, c.P.tilt ?? 0), boxes: boxesOf(l.items) };
};

/** line birth: a thin line expands, then the words are pulled up out from behind it. */
PRO_STYLES.pro_line = (c) => {
  const l = proLayout(c, 0.068, { mix: true });
  const a0 = c.t - c.L.tOn, lineP = EASE.expoOut(clamp(a0 / 0.35)), ex = exitOut(exitP(c.L, c.t));
  const ly = l.box[3] + U(c) * 0.006, x0 = l.box[0] - U(c) * 0.03, x1 = l.box[2] + U(c) * 0.03, cx = (x0 + x1) / 2;
  const els = l.items.map((p) => {
    const age = c.t - Math.max(p.t0, c.L.tOn + 0.2); if (age <= 0) return null;
    const q = EASE.expoOut(clamp(age / 0.5)); const m = kwMod(c, p.i);
    return <MaskGlyph k={p.i} p={p} dy={(1 - q) * p.px * 1.2 + ex * p.px * 1.3} font={m.font ?? fontOf(p, false)} color={m.fill ?? FG} />;
  });
  const lw = (x1 - x0) * lineP * (1 - ex);
  return { el: group(c, l.items, cx, ly, <>{els}<div style={{ position: "absolute", left: cx - lw / 2, top: ly, width: lw, height: Math.max(2, U(c) * 0.004), background: AC }} /></>, 0.025), boxes: boxesOf(l.items) };
};

/** box reveal: a solid box draws across the line, then shrinks away to reveal the text. */
PRO_STYLES.pro_box = (c) => {
  const l = proLayout(c, 0.07, { heavy: true });
  const a0 = c.t - c.L.tOn, grow = EASE.expoOut(clamp(a0 / 0.22)), shrink = EASE.inOut(clamp((a0 - 0.22) / 0.3)), ex = exitOut(exitP(c.L, c.t));
  const pad = U(c) * 0.012, [bx0, by0, bx1, by1] = l.box, w = bx1 - bx0 + pad * 2;
  const shown = a0 > 0.22;
  const els = shown ? l.items.map((p) => { const m = kwMod(c, p.i); return <MaskGlyph k={p.i} p={p} dy={exitDy(c, p) + (m.dy ?? 0)} font={m.font ?? fontOf(p, true)} color={m.fill ?? (p.tier.role === "key" ? AC : FG)} />; }) : null;
  const bw = w * (shown ? 1 - shrink : grow), bl = shown ? bx1 + pad - bw : bx0 - pad;
  return { el: group(c, l.items, (bx0 + bx1) / 2, (by0 + by1) / 2, <>{els}{bw > 0.5 && <div style={{ position: "absolute", left: bl, top: by0 - pad, width: bw, height: by1 - by0 + pad * 2, background: FG, opacity: 1 - ex }} />}</>), boxes: boxesOf(l.items) };
};

/** diagonal clip mask sweeping across a slightly tilted line. */
PRO_STYLES.pro_diag = (c) => {
  const l = proLayout(c, 0.074, { heavy: true });
  const a0 = c.t - c.L.tOn, q = EASE.snappy(clamp(a0 / 0.45)), ex = exitOut(exitP(c.L, c.t));
  const rot = c.P.tilt ?? -6;
  const [x0, y0, x1, y1] = l.box, w = x1 - x0, sl = (y1 - y0) * 0.6;
  const reveal = x0 - sl + (w + sl * 2) * q, hide = x0 - sl + (w + sl * 2) * ex;
  const clip = `polygon(${hide}px ${y0 - 40}px, ${reveal + sl}px ${y0 - 40}px, ${reveal - sl}px ${y1 + 40}px, ${hide - sl * 2}px ${y1 + 40}px)`;
  const els = l.items.map((p) => { const m = kwMod(c, p.i); return <MaskGlyph k={p.i} p={p} dx={m.dx ?? 0} dy={m.dy ?? 0} font={m.font ?? fontOf(p, true)} color={m.fill ?? (p.tier.role === "key" ? AC : FG)} />; });
  const edge = reveal < x1 + sl && q < 1;
  return { el: group(c, l.items, (x0 + x1) / 2, (y0 + y1) / 2, <><div style={{ position: "absolute", inset: 0, clipPath: clip }}>{els}</div>
    {edge && <div style={{ position: "absolute", left: reveal - sl, top: y0 - 30, width: Math.max(2, U(c) * 0.004), height: y1 - y0 + 60, background: AC, transform: `skewX(${-Math.atan2(sl * 2, y1 - y0 + 60) * 57.3}deg)` }} />}</>, 0.03, rot), boxes: boxesOf(l.items) };
};

/** label: an accent rect scales X 0 -> 1 a few frames before the text slides onto it (+ monospace greeble). */
PRO_STYLES.pro_label = (c) => {
  const l = proLayout(c, 0.064, { heavy: false });
  const a0 = c.t - c.L.tOn, r = EASE.snappy(clamp(a0 / 0.25)), ex = exitOut(exitP(c.L, c.t));
  const pad = U(c) * 0.014, [x0, y0, x1, y1] = l.box;
  const els = l.items.map((p) => { const age = c.t - Math.max(p.t0, c.L.tOn + 0.1); if (age <= 0) return null; const q = EASE.expoOut(clamp(age / 0.4)); const m = kwMod(c, p.i);
    return <MaskGlyph k={p.i} p={p} dx={-(1 - q) * p.px * 0.9} dy={m.dy ?? 0} font={m.font ?? fontOf(p, true)} color={m.fill ?? BG} weight={p.tier.role === "key" ? 900 : 700} style={{ textShadow: "none" }} />; });
  const rw = (x1 - x0 + pad * 2) * r * (1 - ex), gs = U(c) * 0.013;
  return { el: group(c, l.items, x0, (y0 + y1) / 2, <><div style={{ position: "absolute", left: x0 - pad + (x1 - x0 + pad * 2) * ex, top: y0 - pad * 0.6, width: rw, height: y1 - y0 + pad * 1.2, background: AC }} />
    <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${x0 - pad + (x1 - x0 + pad * 2) * ex}px)` }}>{els}</div>
    {labelsOn(c) && <div style={{ position: "absolute", left: x0 - pad, top: y1 + pad * 1.2, fontFamily: "monospace", fontSize: gs, letterSpacing: gs * 0.35, color: FG, opacity: 0.6 * r * (1 - ex) }}>{`[${String(c.L.li + 1).padStart(2, "0")}] ${c.L.start.toFixed(2)}s  //  ${c.L.sectionType.toUpperCase()}`}</div>}</>, 0.03), boxes: boxesOf(l.items) };
};

/** spring pop (overshoot ~1.15) per syllable on colour block plates. */
PRO_STYLES.pro_pop = (c) => {
  const l = proLayout(c, 0.074, { heavy: true, particle: 0.65 });
  const ex = exitOut(exitP(c.L, c.t));
  const syl = syllables(c.L.chars.map((x) => x.ch));
  const els: React.ReactNode[] = [];
  l.items.forEach((p) => {
    const age = c.t - p.t0 + 0.05; if (age <= 0) return;
    const s = springOver(clamp(age / 0.42), 1.16) * (1 - ex); const m = kwMod(c, p.i);
    const k = syl.findIndex((g) => g.includes(p.i));
    els.push(<div key={`b${p.i}`} style={{ position: "absolute", left: p.x - p.adv * 0.55, top: p.y - p.px * 0.62, width: p.adv * 1.1, height: p.px * 1.24, background: k % 3 === 0 ? AC : k % 3 === 1 ? FG : BG, transform: `scale(${s}) rotate(${(k % 2 ? 3 : -3) * (1 - s)}deg)` }} />);
    els.push(<div key={p.i} style={{ position: "absolute", left: p.x, top: p.y, transform: `translate(-50%,-50%) scale(${s})`, fontFamily: HEAVY, fontSize: p.px, lineHeight: 1, color: k % 3 === 1 ? BG : "#ffffff", whiteSpace: "pre", ...(m.fill ? { color: m.fill } : {}) }}>{p.ch}</div>);
  });
  return { el: group(c, l.items, (l.box[0] + l.box[2]) / 2, (l.box[1] + l.box[3]) / 2, <>{els}</>, 0.03), boxes: boxesOf(l.items) };
};

/** tanzaku: vertical mincho in a thin paper strip, linear mask wipe top -> bottom, long hold. */
PRO_STYLES.pro_tanzaku = (c) => {
  const n = c.L.chars.length, colX = Number(c.P.x ?? (c.L.li % 2 ? 0.2 : 0.8)) * c.W;
  const px = Math.min(U(c) * 0.062 * c.k * Number(c.L.params.size ?? 1), (c.H * 0.72) / Math.max(1, n));
  const top = c.H * 0.5 - (n * px * 1.08) / 2, pad = px * 0.5, h = n * px * 1.08;
  const a0 = c.t - c.L.tOn, frame = EASE.expoOut(clamp(a0 / 0.6)), ex = exitOut(exitP(c.L, c.t));
  const starts = unitStarts(c.L.chars, c.L.chars[0].t0, 30, 4);
  const lastT = Math.max(c.L.end, starts[n - 1] + 0.3);
  const wipe = clamp((c.t - starts[0] + 0.1) / Math.max(0.3, lastT - starts[0])); // linear by design (slow mode)
  const boxes: Box[] = [];
  const els = c.L.chars.map((ch, i) => { const y = top + px * 1.08 * (i + 0.5); boxes[i] = [colX - px / 2, y - px / 2, colX + px / 2, y + px / 2]; const m = kwMod(c, i);
    const rot = /[ー〜～…「」『』（）]/.test(ch.ch) ? 90 : 0;
    return <div key={i} style={{ position: "absolute", left: colX, top: y, transform: `translate(-50%,-50%) rotate(${rot}deg)`, fontFamily: m.font ?? MINCHO, fontWeight: 600, fontSize: px, lineHeight: 1, color: m.fill ?? FG }}>{ch.ch}</div>; });
  const drift = (poseHold(a0, 0.6, 0.02, 4) - 1) * px * 3;
  return { el: <div style={{ position: "absolute", inset: 0, transform: `translateY(${-drift}px)`, opacity: 1 - ex }}>
    <div style={{ position: "absolute", left: colX - px / 2 - pad, top: top - pad, width: px + pad * 2, height: (h + pad * 2) * frame, border: `${Math.max(1, px * 0.03)}px solid ${FG}`, opacity: 0.55, background: "rgba(0,0,0,0.18)" }} />
    <div style={{ position: "absolute", left: colX - px / 2 - pad * 0.6, top: top - pad - px * 0.6, width: Math.max(2, px * 0.06), height: px * 0.4, background: AC }} />
    <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)`, WebkitMaskImage: undefined }}>{els}</div></div>, boxes };
};

/** vertical text pillar: the key word as a tall heavy column at the edge, the full line small and horizontal. */
PRO_STYLES.pro_pillar = (c) => {
  const chars = c.L.chars.map((x) => x.ch), tiers = hierarchy(chars);
  const key = chars.map((ch, i) => (tiers[i].role === "key" ? i : -1)).filter((i) => i >= 0);
  const kws = key.length ? key : [0];
  const right = c.L.li % 2 === 0, px = Math.min(U(c) * 0.16, (c.H * 0.8) / kws.length);
  const X = right ? c.W * 0.9 : c.W * 0.1, top = c.H * 0.5 - (kws.length * px) / 2;
  const a0 = c.t - c.L.tOn, ex = exitOut(exitP(c.L, c.t));
  const els: React.ReactNode[] = kws.map((i, n) => { const q = EASE.expoOut(clamp((a0 - n * 0.05) / 0.5)); const y = top + px * (n + 0.5);
    return <div key={`k${i}`} style={{ position: "absolute", left: X - px * 0.6, top: y - px * 0.55, width: px * 1.2, height: px * 1.1, overflow: "hidden" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${((1 - q) - ex) * px * 1.1}px)`, fontFamily: HEAVY, fontSize: px, lineHeight: 1, color: AC }}>{chars[i]}</div></div>; });
  const sub = PRO_STYLES.pro_slide({ ...c, P: { ...c.P, anchor: right ? 3 : 5 } });
  return { el: <>{els}{sub.el}</>, boxes: sub.boxes };
};

/** cropped huge text as a shape behind a readable line (key word bleeds off the frame at low opacity). */
PRO_STYLES.pro_crop = (c) => {
  const chars = c.L.chars.map((x) => x.ch), tiers = hierarchy(chars);
  const word = chars.filter((_, i) => tiers[i].role === "key").join("") || chars.slice(0, 2).join("");
  const a0 = c.t - c.L.tOn, ex = exitOut(exitP(c.L, c.t)), q = EASE.expoOut(clamp(a0 / 0.6));
  const px = c.H * 0.78, drift = (poseHold(a0, 0.6, 0.06, 3) - 1);
  const sub = PRO_STYLES.pro_smash({ ...c, P: { ...c.P, anchor: c.L.li % 2 ? 6 : 8, tilt: 0 } });
  return { el: <><div style={{ position: "absolute", left: c.W * (c.L.li % 2 ? 0.55 : -0.1) - drift * c.W, top: c.H * 0.5 - px * 0.55, fontFamily: HEAVY, fontSize: px, lineHeight: 1.1, whiteSpace: "pre", color: "transparent",
    WebkitTextStroke: `${Math.max(2, px * 0.006)}px ${FG}`, opacity: 0.35 * q * (1 - ex), letterSpacing: -px * 0.06, transform: `translateX(${(1 - q) * c.W * 0.15}px)` }}>{word}</div>{sub.el}</>, boxes: sub.boxes };
};
