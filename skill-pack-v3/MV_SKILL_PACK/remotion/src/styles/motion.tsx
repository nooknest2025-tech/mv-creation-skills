// Composable lyric motion: a style = layout + enter + emphasis + idle + exit + stagger unit + easing + decoration.
// New mood styles (styles/moods.ts) are pure specs built from these parts, so Codex can author more by combining words.
import React from "react";
import { beatPulse, clamp, easeOut, easeOutBack, easeOutElastic, rng } from "../lib/core";
import { fontCss } from "../lib/fonts";
import { layoutH, layoutV, FONTS } from "./layout";
import { Glyph, kwMod, KwDecor, type Box, type Ctx, type StyleFn } from "./prims";

export type Enter = "fade" | "rise" | "drop" | "slideL" | "slideR" | "zoomIn" | "zoomOut" | "blur" | "track" | "flip" | "skew" | "cut" | "ink" | "rotate" | "squash" | "wipe";
export type Emph = "none" | "brighten" | "lift" | "accent" | "beat" | "glow" | "underline";
export type Idle = "none" | "float" | "breathe" | "sway" | "jitter" | "drift" | "flicker";
export type Exit = "fade" | "rise" | "fall" | "blur" | "slide" | "scatter" | "shrink" | "cut";
export type Deco = "underline" | "frame" | "band" | "brackets" | "bokeh" | "scanlines" | "vhs" | "brush" | "halo" | "rule" | "bubble" | "tape" | "redline" | "smoke" | "hanko" | "stars" | "caption" | "rec";
export type EaseName = "out" | "back" | "elastic" | "expo" | "soft";
export interface MotionSpec {
  layout?: "h" | "v" | "left" | "big" | "low" | "top";
  size?: number; font?: string; sw?: number; fill?: string; stroke?: string; track?: number;
  unit?: "char" | "word" | "line"; enter: Enter; enterDur?: number; ease?: EaseName;
  emph?: Emph; idle?: Idle; exit?: Exit; deco?: Deco[]; shadow?: "soft" | "hard" | "none" | "glow";
}
const EASE: Record<EaseName, (p: number) => number> = {
  out: (p) => easeOut(p, 3), back: (p) => easeOutBack(clamp(p), 1.4), elastic: (p) => easeOutElastic(clamp(p)),
  expo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p))), soft: (p) => { const q = clamp(p); return q * q * (3 - 2 * q); },
};
const ACC = "var(--lyric-accent, #ffd63c)";
interface St { a: number; dx: number; dy: number; s: number; sx: number; sy: number; rot: number; blur: number; fill?: string; shadow?: string; track: number; clip?: number }

function enterSt(e: Enter, p: number, px: number, i: number, seed: number): St {
  const q = 1 - p, r = rng(seed, "e", i);
  const S: St = { a: clamp(p * 1.6), dx: 0, dy: 0, s: 1, sx: 1, sy: 1, rot: 0, blur: 0, track: 0 };
  switch (e) {
    case "fade": S.a = p; break;
    case "rise": S.dy = q * px * 0.35; S.a = p; break;
    case "drop": S.dy = -q * px * 0.6; break;
    case "slideL": S.dx = -q * px * 1.2; S.a = p; break;
    case "slideR": S.dx = q * px * 1.2; S.a = p; break;
    case "zoomIn": S.s = 1 + q * 1.8; S.a = p; break;
    case "zoomOut": S.s = Math.max(0.01, p); break;
    case "blur": S.blur = q * px * 0.25; S.a = p; break;
    case "track": S.track = q * 0.9; S.a = p; break;
    case "flip": S.sx = Math.max(0.02, Math.abs(Math.cos(q * Math.PI / 2))); S.a = p > 0.05 ? 1 : 0; break;
    case "skew": S.rot = q * -14; S.dx = -q * px * 0.5; S.a = p; break;
    case "cut": S.a = p > 0 ? 1 : 0; break;
    case "ink": S.blur = q * px * 0.12; S.s = 0.92 + 0.08 * p; S.a = clamp(p * 1.3); break;
    case "rotate": S.rot = q * r.uniform(-25, 25); S.dy = q * px * 0.2; S.a = p; break;
    case "squash": S.sy = 0.4 + 0.6 * p; S.sx = 1 + 0.3 * q; break;
    case "wipe": S.clip = p; S.a = p > 0 ? 1 : 0; break;
  }
  return S;
}

export function motionStyle(m: MotionSpec): StyleFn {
  const ease = EASE[m.ease ?? "out"];
  return (c: Ctx) => {
    const { L, t, W, H, P } = c;
    const size = Number(P.size_base ?? m.size ?? 0.07);
    const vert = m.layout === "v";
    const vpos = m.layout === "low" ? 0.86 : m.layout === "top" ? 0.16 : m.layout === "big" ? 0.5 : c.textY;
    let pos: [number, number][], px: number, rot: number[] = [], box: [number, number, number, number];
    if (vert) {
      const l = layoutV(L, W, H, { size, x: Number(P.x ?? 0.82), k: c.k }); pos = l.pos; px = l.px; rot = l.rot;
      const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]); box = [Math.min(...xs) - px / 2, Math.min(...ys) - px / 2, Math.max(...xs) + px / 2, Math.max(...ys) + px / 2];
    } else {
      const l = layoutH(L, W, H, { size: m.layout === "big" ? size * 1.7 : size, v: vpos, k: c.k, maxw: m.layout === "big" ? 0.9 : 0.84, track: m.track ?? 0 });
      pos = l.pos.map((p) => [...p] as [number, number]); px = l.px; box = [...l.box] as any;
      if (m.layout === "left") { const sh = W * 0.08 - l.box[0]; pos.forEach((p) => (p[0] += sh)); box[0] += sh; box[2] += sh; }
    }
    // stagger unit: each glyph starts at its own char / its word's first char / the line start
    const words: number[] = []; { let w = 0; L.chars.forEach((ch, i) => { if (i && /\s/.test(L.text.slice(L.chars[i - 1].idx + 1, ch.idx))) w++; words.push(w); }); }
    const firstOf = (i: number) => (m.unit === "word" ? L.chars.findIndex((_, k) => words[k] === words[i]) : i);
    const t0 = (i: number) => (m.unit === "line" ? L.tOn + 0.04 : L.chars[firstOf(i)].t0 - Number(P.lead_in ?? 0.06));
    const dur = Number(P.enter ?? m.enterDur ?? 0.3);
    const exP = clamp((t - L.tOff) / Math.max(1e-3, L.exit)), ex = m.exit === "cut" ? (exP > 0 ? 1 : 0) : easeOut(exP, 2);
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const els: React.ReactNode[] = [], boxes: Box[] = [];
    const font = m.font ?? "sans";
    pos.forEach(([x, y], i) => {
      const age = t - t0(i);
      if (age < -0.001) { boxes.push([x - px / 2, y - px / 2, x + px / 2, y + px / 2]); return; }
      const p = ease(clamp(age / dur));
      const S = enterSt(m.enter, p, px, i, L.seed);
      const sung = clamp((t - L.chars[i].t0) / Math.max(0.06, L.chars[i].t1 - L.chars[i].t0));
      const singing = sung > 0 && t < L.chars[i].t1 + 0.12;
      switch (m.emph) {
        case "brighten": S.a *= 0.55 + 0.45 * (sung > 0 ? 1 : 0); break;
        case "lift": S.dy -= (singing ? 1 : 0) * px * 0.08 * Math.sin(Math.PI * sung); break;
        case "accent": if (sung > 0) S.fill = ACC; break;
        case "beat": S.s *= 1 + 0.06 * beatPulse(c.beat, t, 0.12); break;
        case "glow": if (singing) S.shadow = `0 0 ${px * 0.35}px ${ACC}`; break;
      }
      const ph = t * 1.3 + i * 0.45;
      switch (m.idle) {
        case "float": S.dy += Math.sin(ph) * px * 0.04; break;
        case "breathe": S.s *= 1 + 0.018 * Math.sin(t * 2.1); break;
        case "sway": S.rot += Math.sin(ph) * 2.2; break;
        case "jitter": { const r = rng(L.seed, i, Math.floor(t * 12)); S.dx += r.uniform(-1, 1) * px * 0.02; S.dy += r.uniform(-1, 1) * px * 0.02; break; }
        case "drift": S.dx += (t - L.tOn) * px * 0.06; break;
        case "flicker": S.a *= rng(L.seed, i, Math.floor(t * 20)).uniform(0, 1) < 0.06 ? 0.35 : 1; break;
      }
      if (ex > 0) {
        const r = rng(L.seed, "x", i);
        switch (m.exit ?? "fade") {
          case "rise": S.dy -= ex * px * 0.3; break;
          case "fall": S.dy += ex * ex * px * 1.2; S.rot += ex * r.uniform(-20, 20); break;
          case "blur": S.blur += ex * px * 0.3; break;
          case "slide": S.dx += ex * px * 1.5; break;
          case "scatter": S.dx += ex * r.uniform(-1, 1) * px * 3; S.dy += ex * r.uniform(-1, 1) * px * 2; S.rot += ex * r.uniform(-90, 90); break;
          case "shrink": S.s *= 1 - ex; break;
        }
        S.a *= 1 - ex;
      }
      const km = kwMod(c, i);
      const tx = (x - cx) * S.track;
      const shadow = km.shadow ?? S.shadow ?? (m.shadow === "none" ? undefined : m.shadow === "glow" ? `0 0 ${px * 0.25}px ${ACC}` : m.shadow === "hard" ? `${px * 0.06}px ${px * 0.06}px 0 rgba(0,0,0,0.85)` : `0 ${px * 0.04}px ${px * 0.12}px rgba(0,0,0,0.6)`);
      const clipStyle: React.CSSProperties | undefined = S.clip !== undefined && S.clip < 1 ? { clipPath: `inset(0 ${(1 - S.clip) * 100}% 0 0)` } : undefined;
      els.push(<Glyph k={i} x={x + S.dx + tx + (km.dx ?? 0)} y={y + S.dy + (km.dy ?? 0)} ch={L.chars[i].ch} px={px} font={km.font ?? FONTS[font] ?? fontCss(font)}
        fill={km.fill ?? S.fill ?? m.fill} stroke={m.stroke} sw={m.sw ?? 0.05} a={S.a} s={S.s} sx={S.sx} sy={S.sy * (km.sy ?? 1)} rot={S.rot + (rot[i] ?? 0) + (km.rot ?? 0)}
        blur={S.blur + (km.blur ?? 0)} shadow={shadow} style={clipStyle} />);
      boxes.push([x - px / 2, y - px / 2, x + px / 2, y + px / 2]);
    });
    const on = clamp((t - L.tOn) / 0.35) * (1 - ex);
    const deco = (m.deco ?? []).map((d, k) => <Decor key={k} d={d} c={c} box={box} px={px} on={on} vert={vert} />);
    const under = deco.filter((_, k) => ["band", "brush", "bubble", "tape", "halo", "bokeh", "smoke", "hanko"].includes(m.deco![k]));
    const over = deco.filter((_, k) => !["band", "brush", "bubble", "tape", "halo", "bokeh", "smoke", "hanko"].includes(m.deco![k]));
    return { el: <>{under}{els}{over}<KwDecor c={c} boxes={boxes} /></>, boxes };
  };
}

function Decor({ d, c, box, px, on, vert }: { d: Deco; c: Ctx; box: number[]; px: number; on: number; vert: boolean }) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, t = c.t, L = c.L;
  const grow = easeOut(clamp((t - L.tOn) / 0.6));
  const A = (s: React.CSSProperties): React.CSSProperties => ({ position: "absolute", opacity: on, pointerEvents: "none", ...s });
  switch (d) {
    case "underline": return <div style={A({ left: x0, top: y1 + px * 0.12, width: w * grow, height: Math.max(2, px * 0.05), background: ACC })} />;
    case "redline": return <div style={A({ left: x0 - px * 0.2, top: cy + px * 0.05, width: (w + px * 0.4) * grow, height: Math.max(2, px * 0.07), background: "#e0182d", transform: "rotate(-2deg)" })} />;
    case "frame": return <div style={A({ left: x0 - px * 0.5, top: y0 - px * 0.35, width: w + px, height: h + px * 0.7, border: `${Math.max(1.5, px * 0.035)}px solid ${ACC}`, clipPath: `inset(0 ${(1 - grow) * 100}% 0 0)` })} />;
    case "band": return <div style={A({ left: x0 - px * 0.4, top: y0 - px * 0.15, width: (w + px * 0.8) * grow, height: h + px * 0.3, background: "var(--lyric-stroke, #0c0909)", opacity: on * 0.82 })} />;
    case "brackets": { const b = Math.max(2, px * 0.05), s = px * 0.45; const C = (l: number, tp: number, bl: boolean, bt: boolean) => <div style={A({ left: l, top: tp, width: s, height: s, borderLeft: bl ? `${b}px solid ${ACC}` : undefined, borderRight: !bl ? `${b}px solid ${ACC}` : undefined, borderTop: bt ? `${b}px solid ${ACC}` : undefined, borderBottom: !bt ? `${b}px solid ${ACC}` : undefined })} />;
      return <>{C(x0 - px * 0.6, y0 - px * 0.4, true, true)}{C(x1 + px * 0.6 - s, y1 + px * 0.4 - s, false, false)}</>; }
    case "bokeh": { const r = rng(L.seed, "bk"); return <>{[...Array(9)].map((_, k) => { const s = px * r.uniform(0.4, 1.4); return <div key={k} style={A({ left: cx + r.uniform(-1, 1) * (w / 2 + px * 2) + Math.sin(t * 0.4 + k) * px * 0.3, top: cy + r.uniform(-1.6, 1.6) * px + Math.cos(t * 0.3 + k) * px * 0.2, width: s, height: s, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,236,200,0.45), transparent 70%)`, opacity: on * 0.8 })} />; })}</>; }
    case "scanlines": return <div style={A({ left: x0 - px, top: y0 - px * 0.5, width: w + px * 2, height: h + px, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 5px)", mixBlendMode: "multiply" })} />;
    case "vhs": { const r = rng(L.seed, Math.floor(t * 8)); return <div style={A({ left: 0, top: cy + r.uniform(-1, 1) * px, width: c.W, height: Math.max(2, px * 0.06), background: "rgba(255,255,255,0.25)", opacity: on * (r.uniform(0, 1) < 0.5 ? 1 : 0) })} />; }
    case "brush": return <div style={A({ left: x0 - px * 0.6, top: cy - h * 0.45, width: (w + px * 1.2) * grow, height: h * 0.9, background: "var(--lyric-stroke, #1a1010)", borderRadius: `${px}px ${px * 0.3}px ${px}px ${px * 0.4}px`, filter: `blur(${px * 0.04}px)`, opacity: on * 0.85, transform: "skewX(-8deg)" })} />;
    case "halo": return <div style={A({ left: cx, top: cy, width: w + px * 3, height: h + px * 2.5, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,240,215,0.28), transparent 65%)" })} />;
    case "rule": return vert ? <div style={A({ left: x1 + px * 0.35, top: y0, width: Math.max(1.5, px * 0.03), height: h * grow, background: ACC })} /> : <div style={A({ left: x0, top: y0 - px * 0.3, width: w * grow, height: Math.max(1.5, px * 0.03), background: ACC })} />;
    case "bubble": return <div style={A({ left: x0 - px * 0.6, top: y0 - px * 0.35, width: w + px * 1.2, height: h + px * 0.7, borderRadius: px * 0.7, background: "rgba(255,255,255,0.92)", transform: `scale(${easeOutBack(grow, 1.6)})`, boxShadow: `0 ${px * 0.08}px 0 ${ACC}` })} />;
    case "tape": return <div style={A({ left: x0 - px * 0.5, top: y0 - px * 0.1, width: w + px, height: h + px * 0.2, background: "var(--lyric-accent, #ffd63c)", opacity: on * 0.75, transform: "rotate(-1.5deg)" })} />;
    case "smoke": { const r = rng(L.seed, "sm"); return <>{[...Array(6)].map((_, k) => <div key={k} style={A({ left: x0 + w * r.uniform(0, 1), top: cy + px * r.uniform(-0.6, 0.6) - (t - L.tOn) * px * 0.15, width: px * 2.2, height: px * 1.4, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(150,140,170,0.25), transparent 70%)", filter: `blur(${px * 0.2}px)` })} />)}</>; }
    case "hanko": return <div style={A({ left: (vert ? x0 - px * 1.2 : x1 + px * 0.4), top: (vert ? y1 - px : y1 - px * 0.9), width: px * 0.9, height: px * 0.9, border: `${px * 0.06}px solid #c8102e`, borderRadius: px * 0.12, color: "#c8102e", fontSize: px * 0.5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.serif, transform: `scale(${1 + 0.6 * (1 - grow)})` })}>印</div>;
    case "stars": { const r = rng(L.seed, "st"); return <>{[...Array(7)].map((_, k) => { const tw = 0.5 + 0.5 * Math.sin(t * 5 + k * 2); return <div key={k} style={A({ left: cx + r.uniform(-1, 1) * (w / 2 + px), top: cy + r.uniform(-1.3, 1.3) * px, color: ACC, fontSize: px * r.uniform(0.25, 0.45), transform: `translate(-50%,-50%) scale(${tw})`, opacity: on * tw, fontFamily: FONTS.sans })}>✦</div>; })}</>; }
    case "caption": return <div style={A({ left: x0, top: y1 + px * 0.25, color: ACC, fontSize: px * 0.28, letterSpacing: px * 0.08, fontFamily: FONTS.sans, opacity: on * 0.85 })}>{String(L.section ?? "").toUpperCase()}</div>;
    case "rec": return <div style={A({ left: c.W * 0.05, top: c.H * 0.06, color: "#fff", fontSize: Math.min(c.W, c.H) * 0.03, fontFamily: "monospace", opacity: on * 0.85 })}><span style={{ color: "#ff3030", opacity: Math.sin(t * 6) > 0 ? 1 : 0.2 }}>●</span> REC</div>;
  }
  return null;
}
