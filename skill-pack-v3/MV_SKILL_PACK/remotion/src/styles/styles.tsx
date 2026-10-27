// All 32 lyric motion styles. Timings/easing ported from mvengine/lyricfx.py (the author's earlier Python engine);
// pixel effects (glyph contours, shards, glitch slices) are re-expressed with CSS/SVG primitives.
import React from "react";
import { beatLen, beatPulse, beatStep, beatX, clamp, easeOut, easeOutBack, easeOutElastic, rng, spring } from "../lib/core";
import { FONTS, layoutH, layoutV, advOf } from "./layout";
import { BLK, CANDY, CREAM, CRIM, CYAN, Glyph, MINT, PINK, WHITE, YELLOW, boxesH, charAge, drawH, dropShadow, exitP, kwMod, sungP, wordText, type Box, type Ctx, type StyleFn } from "./prims";

const U = (c: Ctx) => Math.min(c.W, c.H);
const lay = (c: Ctx, size: number, v?: number, extra: Record<string, any> = {}) => layoutH(c.L, c.W, c.H, { size, v: v ?? c.textY, k: c.k, ...extra });
const A = (style: React.CSSProperties): React.CSSProperties => ({ position: "absolute", ...style });

export const STYLES: Record<string, StyleFn> = {};

STYLES.simple = (c) => {
  const film = c.P.variant === "film";
  const l = lay(c, film ? 0.052 : 0.068, film ? Math.max(c.textY, 0.86) : c.textY + 0.04, { maxw: film ? 0.8 : 0.86 });
  const aLine = easeOut(clamp((c.t - c.L.tOn) / (film ? 0.25 : 0.15)));
  const sung = c.P.sung_color ?? YELLOW;
  return drawH(c, l, (i, age) => ({ a: aLine, fill: film ? "#ffffff" : age >= 0 ? sung : WHITE, font: film ? "sans" : "lyrics", shadow: film ? "0 2px 6px rgba(0,0,0,0.7)" : undefined }),
    { sw: film ? 0.0 : 0.09, font: film ? "sans" : "lyrics", fill: WHITE, stroke: BLK });
};

STYLES.reveal = (c) => {
  const l = lay(c, 0.075);
  const en = +c.P.enter, rise = +c.P.rise * l.px * 4;
  return drawH(c, l, (i, age) => { const p = clamp((age + 0.06) / en); return p <= 0 ? null : { a: easeOut(p, 2), dy: (1 - easeOut(p)) * rise }; });
};

STYLES.bounce = (c) => {
  const l = lay(c, 0.078);
  const en = +c.P.enter, drop = +c.P.drop * c.H, hop = +c.P.beat_hop * l.px * 4;
  return drawH(c, l, (i, age) => {
    const p = clamp((age + 0.04) / en);
    if (p <= 0) return null;
    const s = 0.7 + 0.3 * easeOutBack(p, 2.6);
    const b = age > en ? beatPulse(c.beat, c.t, 0.12) * (i % 2 ? 0.5 : 1) : 0;
    const sq = 1 + 0.12 * b;
    return { a: clamp(p * 3), dy: -(1 - easeOut(p, 2)) * drop - b * hop * 0.35, s, sx: sq, sy: 2 - sq, ay: 0.85 };
  }, { font: "round" });
};

STYLES.karaoke = (c) => {
  const l = lay(c, 0.072);
  const col = c.P.fill_color ?? "#ff5a8c";
  const a = easeOut(clamp((c.t - c.L.tOn) / 0.15)) * (1 - easeOut(exitP(c.L, c.t), 2));
  const els = l.pos.map(([x, y], i) => {
    const p = sungP(c.L, i, c.t), m = kwMod(c, i);
    const common = { x: x + (m.dx ?? 0), y: y + (m.dy ?? 0), ch: c.L.chars[i].ch, px: l.px, sw: 0.1, a };
    return <React.Fragment key={i}>
      <Glyph {...common} fill={WHITE} stroke={BLK} shadow={dropShadow(l.px)} />
      {p > 0 && <Glyph {...common} fill={m.fill ?? col} stroke={WHITE} style={{ clipPath: `inset(-20% ${(1 - p) * 100}% -20% -20%)` }} />}
    </React.Fragment>;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

/** SVG glyph for stroke-drawing styles. */
function SvgGlyph({ x, y, ch, px, font, stroke, sw, draw, fillA, fill, seq, a }: { x: number; y: number; ch: string; px: number; font: string; stroke: string; sw: number; draw: number; fillA: number; fill: string; seq?: boolean; a: number }) {
  const D = px * 9; // dash budget (approximate outline length of one glyph)
  const s = px * 1.6;
  return <svg style={A({ left: x - s / 2, top: y - s / 2, overflow: "visible", opacity: a })} width={s} height={s}>
    <text x={s / 2} y={s / 2} textAnchor="middle" dominantBaseline="central" fontSize={px}
      fill={fill} fillOpacity={fillA} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
      strokeDasharray={`${D} ${D}`} strokeDashoffset={D * (1 - draw)}
      style={{ fontFamily: FONTS[font] ?? font, filter: seq ? `drop-shadow(3px 3px 0 rgba(20,10,20,0.75))` : "drop-shadow(2px 2px 0 rgba(0,0,0,0.8))" }}>{ch}</text>
  </svg>;
}
STYLES.outline_fill = (c) => {
  const l = lay(c, 0.076);
  const dr = +c.P.draw, fl = +c.P.fill, ex = easeOut(exitP(c.L, c.t), 2);
  const els = l.pos.map(([x, y], i) => {
    const age = charAge(c.L, i, c.t) + 0.1;
    if (age <= 0) return null;
    const pd = clamp(age / dr), pf = clamp((age - dr * 0.7) / fl), m = kwMod(c, i);
    return <SvgGlyph key={i} x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" stroke={CREAM} sw={Math.max(2, l.px * 0.035)} draw={easeOut(pd, 2)} fillA={easeOut(pf, 2)} fill={m.fill ?? CREAM} a={1 - ex} />;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};
STYLES.handwriting = (c) => {
  const l = lay(c, 0.08);
  const dr = +c.P.draw, ex = easeOut(exitP(c.L, c.t), 2), ink = c.P.ink ?? CREAM, ch = c.L.chars;
  const els = l.pos.map(([x, y], i) => {
    const age = charAge(c.L, i, c.t) + 0.05;
    if (age <= 0) return null;
    const nxt = i + 1 < ch.length ? ch[i + 1].t0 - ch[i].t0 : dr;
    const d = Math.max(0.12, Math.min(dr, nxt * 1.4 + 0.05));
    const p = clamp(age / d), m = kwMod(c, i);
    // diagonal ink flood follows the pen (mask gradient)
    const flood = `linear-gradient(135deg, #000 ${p * 125 - 8}%, transparent ${p * 125 + 2}%)`;
    return <React.Fragment key={i}>
      <SvgGlyph x={x} y={y} ch={ch[i].ch} px={l.px} font="lyrics" stroke={ink} sw={Math.max(2, l.px * 0.05)} draw={p} fillA={0} fill={ink} seq a={1 - ex} />
      <Glyph x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={ch[i].ch} px={l.px} fill={m.fill ?? ink} stroke="#19121e" sw={0.07} a={1 - ex} style={p < 1 ? { WebkitMaskImage: flood, maskImage: flood } : undefined} />
    </React.Fragment>;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

function glitchStrength(c: Ctx) {
  let sp = 0;
  for (const w of c.L.words) { const dt = c.t - w.t; if (dt >= -0.02 && dt < 0.5) sp = Math.max(sp, Math.exp(-Math.max(0, dt) / 0.07)); }
  return clamp(Math.max(sp * +c.P.amount, beatPulse(c.beat, c.t, 0.06) * +c.P.beat_amount * 0.6, exitP(c.L, c.t) * 1.2), 0, 1.4);
}
STYLES.glitch = (c) => {
  const l = lay(c, 0.078);
  if (exitP(c.L, c.t) > 0.75) return { el: null, boxes: boxesH(l) }; // hard glitch-out
  const base = drawH(c, l, (i, age) => (age < -0.03 ? null : { a: 1 }), { font: "stamp", sw: 0.07, exit: "none" });
  const s = glitchStrength(c);
  const q = Math.floor(c.t * 24), r = rng(c.L.seed, q);
  const k = Math.round(l.px * 0.08 * s) + 1;
  const [x0, y0, x1, y1] = l.box, h = y1 - y0;
  const slices: React.ReactNode[] = [];
  if (s > 0.02) {
    const n = Math.floor(2 + 5 * s);
    for (let j = 0; j < n; j++) {
      const ya = r.uniform(0, 0.9), hh = r.uniform(0.04, 0.18), sh = r.normal(0, l.px * 0.22 * s);
      slices.push(<div key={`sl${j}`} style={A({ inset: 0, transform: `translateX(${sh}px)`, clipPath: `inset(${(y0 + ya * h) / c.H * 100}% 0 ${100 - (y0 + (ya + hh) * h) / c.H * 100}% 0)` })}>{base.el}</div>);
    }
    for (let j = 0; j < Math.floor(6 * s); j++) {
      slices.push(<div key={`bn${j}`} style={A({ left: r.uniform(x0, x1), top: r.uniform(y0, y1), width: r.uniform(8, l.px * 0.9), height: r.uniform(2, l.px * 0.12), background: r.pick([CYAN, PINK, WHITE]), opacity: r.uniform(0.35, 0.8) * Math.min(1, s) })} />);
    }
  }
  const flick = r.next() < +c.P.flicker * (1 + 2 * s) ? 0.35 : 1;
  return {
    el: <div style={A({ inset: 0, opacity: flick })}>
      <div style={A({ inset: 0, transform: `translateX(${-k}px)`, opacity: 0.85, filter: "sepia(1) saturate(8) hue-rotate(-50deg)" })}>{base.el}</div>
      <div style={A({ inset: 0, transform: `translateX(${k}px)`, opacity: 0.85, filter: "sepia(1) saturate(8) hue-rotate(160deg)" })}>{base.el}</div>
      {base.el}{slices}
    </div>, boxes: base.boxes,
  };
};

STYLES.chromatic_trail = (c) => {
  const l = lay(c, 0.074);
  const n = +c.P.trail, dt = +c.P.dt, ex = exitP(c.L, c.t);
  const xoff = (age: number, e: number) => (1 - easeOut(clamp((age + 0.05) / 0.28), 4)) * c.W * 0.16 - easeOut(e, 3) * c.W * 0.2;
  const els: React.ReactNode[] = [];
  l.pos.forEach(([x, y], i) => {
    const age = charAge(c.L, i, c.t);
    if (age < -0.05) return;
    for (let k = n; k >= 1; k--) {
      const ak = age - k * dt, exk = exitP(c.L, c.t - k * dt);
      if (ak < -0.05 || exk > 0) continue;
      if (Math.abs(xoff(ak, exk) - xoff(age, ex)) < 1.5 && k > 1) continue;
      els.push(<Glyph k={`${i}t${k}`} x={x + xoff(ak, exk)} y={y} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={k % 2 ? CYAN : PINK} a={0.55 * (1 - k / (n + 1))} style={{ mixBlendMode: "screen" }} />);
    }
    const m = kwMod(c, i);
    els.push(<Glyph k={i} x={x + xoff(age, ex) + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={m.fill ?? CREAM} sw={0.07} a={clamp((age + 0.05) / 0.08) * (1 - ex)} shadow={dropShadow(l.px)} />);
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.particles = (c) => {
  const l = lay(c, 0.08);
  const ga = +c.P.gather, spread = +c.P.spread, ang = (+c.P.flow_deg * Math.PI) / 180, ex = exitP(c.L, c.t);
  const pal = [CREAM, "#ffa0be", YELLOW];
  const els: React.ReactNode[] = [];
  l.pos.forEach(([x, y], i) => {
    const age = charAge(c.L, i, c.t), p = clamp((age + ga) / ga);
    if (p <= 0) return;
    const r = rng(c.L.seed, i), col = pal[i % 3], N = 26, ds = Math.max(3, l.px * 0.05);
    const m = kwMod(c, i);
    let glyphA = p >= 1 ? 1 : p > 0.8 ? (p - 0.8) / 0.2 : 0;
    if (ex > 0) glyphA = clamp(1 - ex * 3);
    for (let k = 0; k < N; k++) {
      const tx = x + r.uniform(-0.42, 0.42) * l.px, ty = y + r.uniform(-0.42, 0.42) * l.px;
      const sx = r.normal(0, 1) * spread * c.W * 0.5, sy = r.normal(0, 1) * spread * c.H * 0.5, sw = r.uniform(-1, 1) * l.px, sp = r.uniform(0.3, 1);
      let px_ = tx, py_ = ty, a = 0;
      if (ex > 0) { const d = easeOut(ex, 2) * c.W * 0.35 * sp; px_ = tx + d * Math.cos(ang) + r.normal(0, 1) * ex * l.px * 0.6; py_ = ty + d * Math.sin(ang); a = 1 - ex; }
      else if (p < 1) { const e = easeOut(p, 3); px_ = tx + sx * (1 - e) + sw * (1 - e); py_ = ty + sy * (1 - e) - sw * 0.5 * (1 - e); a = clamp(p * 2); }
      else continue;
      els.push(<div key={`${i}p${k}`} style={A({ left: px_, top: py_, width: ds, height: ds, background: col, opacity: a, boxShadow: `0 0 ${ds}px ${col}` })} />);
    }
    const tw = p >= 1 && ex === 0 ? beatPulse(c.beat, c.t, 0.15) : 0;
    if (glyphA > 0) els.push(<Glyph k={i} x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={m.fill ?? CREAM} sw={0.06} a={glyphA} shadow={tw > 0.05 ? `0 0 ${l.px * 0.25}px ${col}` : dropShadow(l.px)} />);
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.extrude3d = (c) => {
  const l = lay(c, 0.085);
  const depth = +c.P.depth * l.px, n = 12, ang = ((35 + 25 * Math.sin((c.t - c.L.tOn) * 0.9)) * Math.PI) / 180, ex = easeOut(exitP(c.L, c.t), 2);
  const els: React.ReactNode[] = [];
  l.pos.forEach(([x, y], i) => {
    const p = clamp((charAge(c.L, i, c.t) + 0.06) / 0.22);
    if (p <= 0) return;
    const s = 1.25 - 0.25 * easeOut(p), a = clamp(p * 2) * (1 - ex), dd = depth * easeOut(p) * (1 - ex * 0.5), m = kwMod(c, i);
    for (let k = n; k >= 1; k--) {
      const f = k / n;
      const col = `rgb(${Math.round(176 * (1 - f * 0.75) + 10 * f)},${Math.round(20 * (1 - f * 0.75) + 10 * f)},${Math.round(40 * (1 - f * 0.75) + 10 * f)})`;
      els.push(<Glyph k={`${i}e${k}`} x={x + Math.cos(ang) * dd * f} y={y + Math.sin(ang) * dd * f} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={col} s={s} a={a ** 4} />);
    }
    els.push(<Glyph k={i} x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={m.fill ?? CREAM} stroke="#5a0a14" sw={0.03} s={s} a={a} />);
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.fly3d = (c) => {
  const l = lay(c, 0.08);
  const z0 = +c.P.from_z, fly = +c.P.fly, vx = c.W / 2, vy = c.H * 0.45, ex = exitP(c.L, c.t);
  const order = l.pos.map((_, i) => i).sort((a, b) => charAge(c.L, b, c.t) - charAge(c.L, a, c.t));
  const els = order.map((i) => {
    const [x, y] = l.pos[i], age = charAge(c.L, i, c.t), p = clamp((age + fly) / fly);
    if (p <= 0) return null;
    const e = easeOut(p, 3);
    let z = z0 + (1 - z0) * e;
    if (p >= 1) z = 1 - 0.03 * Math.sin(clamp(age / 0.25) * Math.PI);
    if (ex > 0) z = 1 - 0.85 * Math.pow(easeOut(ex, 2), 1.5);
    const sx = vx + (x - vx) / z, sy = vy + (y - vy) / z, fog = z > 1 ? clamp((z - 1) / (z0 - 1)) : 0, m = kwMod(c, i);
    return <Glyph k={i} x={sx + (m.dx ?? 0)} y={sy + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={m.fill ?? CREAM} sw={0.07} s={1 / z} rot={(1 - e) * (i % 2 ? 20 : -20)}
      a={clamp(p * 1.6) * (1 - easeOut(ex, 3)) * (1 - 0.5 * fog)} blur={fog > 0.05 ? 1 + 4 * fog : 0} shadow={dropShadow(l.px)} />;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.flip3d = (c) => {
  const l = lay(c, 0.078);
  const fl = +c.P.flip, ex = exitP(c.L, c.t), bar = 4 * beatLen(c.beat);
  const els = l.pos.map(([x, y], i) => {
    const p = clamp((charAge(c.L, i, c.t) + 0.05) / fl);
    if (p <= 0) return null;
    let th = (1 - easeOutBack(p, 1.3)) * 90;
    if (p >= 1) { const xb = (c.t - c.beat.phase) / bar, ph = (xb - Math.floor(xb)) * bar - i * 0.035; if (ph >= 0 && ph < 0.3) th = 360 * easeOut(ph / 0.3, 2); }
    if (ex > 0) { const pe = clamp(ex * 1.6 - i * 0.05); th = -90 * easeOut(pe, 2); if (pe >= 1) return null; }
    const back = Math.cos((th * Math.PI) / 180) < 0, m = kwMod(c, i);
    return <Glyph k={i} x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="stamp" fill={back ? CRIM : m.fill ?? CREAM} sw={0.07} a={clamp(p * 2)} shadow={dropShadow(l.px)}
      style={{ transform: `translate(-50%,-50%) perspective(${l.px * 6}px) rotateY(${th}deg)` }} />;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.typewriter = (c) => {
  const l = lay(c, 0.06, c.textY + 0.02, { mono: true, maxw: 0.8 });
  const col = c.P.color ?? "#ebf5eb", ex = exitP(c.L, c.t), ch = c.L.chars;
  let nVis = ch.filter((x) => c.t >= x.t0 - 0.02).length;
  if (ex > 0) nVis = Math.floor(ch.length * (1 - ex));
  const [x0, y0, x1, y1] = l.box, pad = l.px * 0.35;
  const barA = 0.55 * clamp((c.t - c.L.tOn) / 0.1) * (1 - clamp(ex * 3 - 2));
  const els: React.ReactNode[] = [<div key="bar" style={A({ left: x0 - pad, top: y0 - pad * 0.4, width: x1 - x0 + pad * 3, height: y1 - y0 + pad * 0.8, background: "#08080c", opacity: barA })} />];
  for (let i = 0; i < Math.min(nVis, ch.length); i++) {
    const [x, y] = l.pos[i], k = ex === 0 ? clamp((c.t - ch[i].t0) / 0.07) : 1, m = kwMod(c, i);
    els.push(<Glyph k={i} x={x + (m.dx ?? 0)} y={y - (1 - k) * l.px * 0.08 + (m.dy ?? 0)} ch={ch[i].ch} px={l.px} font="round" fill={m.fill ?? col} s={1.18 - 0.18 * k} a={0.5 + 0.5 * k} shadow={m.shadow} />);
  }
  if (c.P.caret !== false) {
    const lastKey = Math.max(c.L.tOn, ...ch.filter((x) => x.t0 <= c.t).map((x) => x.t0));
    const on = c.t - lastKey < 0.18 || (beatX(c.beat, c.t) * 2) % 1 < 0.5;
    if (on) {
      const j = Math.max(0, Math.min(nVis, ch.length) - 1), [xi, yi] = l.pos[j];
      const xc = nVis > 0 ? xi + l.adv[j] / 2 + 4 : xi - l.adv[0] / 2;
      els.push(<div key="caret" style={A({ left: xc, top: yi - l.px * 0.45, width: Math.max(3, l.px * 0.09), height: l.px * 0.95, background: "#78ff96", opacity: 0.95 * (1 - ex) })} />);
    }
  }
  return { el: <>{els}</>, boxes: boxesH(l) };
};

function flickerOn(seed: number, i: number, t: number, tIgn: number) {
  const a = t - tIgn;
  if (a < 0) return 0;
  if (a < 0.3) return rng(seed, i, Math.floor(a * 40)).next() < 0.25 + a * 2.2 ? 1 : 0.15;
  return rng(seed, i, "drop", Math.floor(t * 12)).next() < 0.012 ? 0.3 : 1;
}
STYLES.neon = (c) => {
  const l = lay(c, 0.078);
  const gl = +c.P.glow, cols: string[] = c.P.colors ?? [PINK, CYAN, "#ff783c", MINT], ex = exitP(c.L, c.t), bp = beatPulse(c.beat, c.t, 0.12);
  let wi = 0;
  const els = l.pos.map(([x, y], i) => {
    while (wi + 1 < c.L.words.length && i >= c.L.words[wi + 1].i0) wi++;
    const col = cols[(wi + c.L.seed) % cols.length];
    const aLine = clamp((c.t - c.L.tOn) / 0.1) * (1 - easeOut(ex, 2));
    let on = flickerOn(c.L.seed, i, c.t, c.L.chars[i].t0 - 0.04);
    if (ex > 0 && rng(c.L.seed, i, Math.floor(c.t * 30)).next() < ex) on = 0;
    const g = gl * on * (0.75 + 0.45 * bp), m = kwMod(c, i);
    return <React.Fragment key={i}>
      <Glyph x={x} y={y} ch={c.L.chars[i].ch} px={l.px} font="round" fill="#3c323c" stroke="#1e191e" sw={0.06} a={0.55 * aLine} />
      {on > 0 && <Glyph x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="round" fill="#fffafa" stroke={col} sw={0.06} a={on * aLine}
        shadow={`0 0 ${l.px * 0.09}px ${col}, 0 0 ${l.px * 0.28 * g}px ${col}, 0 0 ${l.px * 0.6 * g}px ${col}`} />}
    </React.Fragment>;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

// 3x3 grid -> 18 jittered triangles (percent coords) for shatter
function shards(seed: number) {
  const r = rng(seed, "sh"), P: [number, number][][] = [];
  for (let j = 0; j <= 3; j++) { P.push([]); for (let i = 0; i <= 3; i++) P[j].push([(i / 3) * 100 + (i % 3 ? r.uniform(-10, 10) : 0), (j / 3) * 100 + (j % 3 ? r.uniform(-10, 10) : 0)]); }
  const out: [number, number][][] = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = P[j][i], b = P[j][i + 1], cc = P[j + 1][i + 1], d = P[j + 1][i];
    out.push(...((i + j) % 2 ? [[a, b, cc], [a, cc, d]] : [[a, b, d], [b, cc, d]]) as [number, number][][]);
  }
  return out;
}
STYLES.shatter = (c) => {
  const l = lay(c, 0.08);
  const ex = exitP(c.L, c.t);
  const els: React.ReactNode[] = [];
  l.pos.forEach(([x, y], i) => {
    const p = clamp((charAge(c.L, i, c.t) + 0.04) / 0.16);
    if (p <= 0) return;
    const m = kwMod(c, i);
    const g = { x: x + (m.dx ?? 0), y: y + (m.dy ?? 0), ch: c.L.chars[i].ch, px: l.px, font: "stamp", fill: m.fill ?? CREAM, sw: 0.07 };
    if (ex <= 0) { els.push(<Glyph k={i} {...g} s={1.3 - 0.3 * easeOut(p, 4)} a={clamp(p * 2.5)} shadow={dropShadow(l.px)} />); return; }
    const te = ex * c.L.exit, r = rng(c.L.seed, i, "v");
    shards(c.L.seed + i).forEach((tri, k) => {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 / 100 - 0.5, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 / 100 - 0.5;
      const vx = cx * l.px * r.uniform(4, 9) + r.normal(0, 1) * l.px * 1.5, vy = cy * l.px * r.uniform(4, 9) - r.uniform(0.5, 2.5) * l.px;
      const spin = r.normal(0, 400);
      els.push(<Glyph k={`${i}s${k}`} {...g} x={g.x + vx * te} y={g.y + vy * te + 0.5 * c.H * 2.2 * te * te} rot={spin * te} s={1 - 0.3 * ex} a={1 - easeOut(ex, 3) ** 2}
        style={{ clipPath: `polygon(${tri.map(([a, b]) => `${a}% ${b}%`).join(",")})` }} />);
    });
    if (ex < 0.12) els.push(<Glyph k={`${i}f`} {...g} fill={WHITE} a={0.8 * (1 - ex / 0.12)} />);
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.scatter = (c) => {
  const l = lay(c, 0.078);
  const fly = +c.P.fly, ex = exitP(c.L, c.t), cols = [CREAM, "#ffaac8", "#aae6ff", YELLOW];
  const els = l.pos.map(([x, y], i) => {
    const p = clamp((charAge(c.L, i, c.t) + fly * 0.7) / fly);
    if (p <= 0) return null;
    const r = rng(c.L.seed, i, "sc");
    const fx = r.uniform(0.05, 0.95) * c.W, fy = r.uniform(0.08, 0.92) * c.H, tx = r.next() * c.W, ty = r.next() * c.H, rot0 = r.uniform(-180, 180), rot1 = r.uniform(-120, 120);
    const e = easeOut(p, 3);
    let cx = fx + (x - fx) * e, cy = fy + (y - fy) * e, rot = rot0 * (1 - e), s = 0.6 + 0.4 * e, a = clamp(p * 2);
    if (ex > 0) { const q = easeOut(ex, 2) ** 1.4; cx = x + (tx - x) * q; cy = y + (ty - y) * q; rot = rot1 * q; s = 1 - 0.4 * q; a *= 1 - ex; }
    const m = kwMod(c, i);
    return <Glyph k={i} x={cx + (m.dx ?? 0)} y={cy + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={l.px} font="round" fill={m.fill ?? cols[i % 4]} sw={0.09} s={s} rot={rot} a={a} shadow={dropShadow(l.px)} />;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.tategaki = (c) => {
  const portrait = c.H > c.W;
  const lv = layoutV(c.L, c.W, c.H, { size: 0.068, x: portrait ? 0.82 : +c.P.x, top: portrait ? 0.14 : 0.17, bottom: portrait ? 0.7 : 0.93, k: c.k });
  const flow = +c.P.flow * c.H, ex = easeOut(exitP(c.L, c.t), 2), scroll = -(c.t - c.L.tOn) * flow - ex * flow * 3, px = lv.px;
  const boxes: Box[] = [];
  const els = lv.pos.map(([x, y], i) => {
    const p = clamp((charAge(c.L, i, c.t) + 0.05) / 0.2), yy = y + scroll;
    boxes.push([x - px * 0.55, yy - px * 0.55, x + px * 0.55, yy + px * 0.55]);
    if (p <= 0) return null;
    const m = kwMod(c, i);
    return <Glyph k={i} x={x + (m.dx ?? 0)} y={yy - (1 - easeOut(p)) * px * 0.3 + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={px} fill={m.fill ?? CREAM} sw={0.09} rot={lv.rot[i]} a={easeOut(p, 2) * (1 - ex)} shadow={dropShadow(px)} />;
  });
  const nOn = c.L.chars.slice(0, lv.per).filter((_, i) => charAge(c.L, i, c.t) > -0.05).length;
  const xr = lv.pos[0][0] + px * 0.78, yt = lv.pos[0][1] + scroll - px * 0.6;
  els.push(<div key="guide" style={A({ left: xr, top: yt, width: Math.max(2, px * 0.05), height: nOn * px * 1.02 + px * 0.1, background: CRIM, opacity: 0.9 * (1 - ex) })} />);
  return { el: <>{els}</>, boxes };
};

STYLES.wave = (c) => {
  const l = lay(c, 0.08);
  const amp = +c.P.amp * l.px * 2.2, bp = beatPulse(c.beat, c.t, 0.2);
  return drawH(c, l, (i, age) => {
    const p = clamp((age + 0.06) / 0.2);
    if (p <= 0) return null;
    const ph = 2 * Math.PI * (c.t * 0.85) - i * 0.62;
    return { a: easeOut(p, 2), dy: Math.sin(ph) * amp * (1 + 0.8 * bp) + (1 - easeOut(p)) * l.px * 0.3, rot: Math.cos(ph) * 8, fill: CANDY[(i + c.L.seed) % CANDY.length] };
  }, { font: "round", stroke: WHITE, sw: 0.1 });
};

STYLES.jelly = (c) => {
  const l = lay(c, 0.082);
  const amp = +c.P.amp, xb = beatX(c.beat, c.t), tb = (xb - Math.floor(xb)) * beatLen(c.beat);
  return drawH(c, l, (i, age) => {
    if (age < -0.04) return null;
    const a1 = Math.max(0, age + 0.04);
    const sq = amp * 1.6 * spring(a1) + (a1 > 0.3 ? amp * 0.45 * spring(tb - i * 0.012) : 0), sy = 1 + sq;
    return { a: clamp(a1 / 0.05), s: clamp(a1 / 0.08, 0.2, 1), sy, sx: 1 / Math.max(0.5, sy), ay: 0.82, fill: i % 2 ? "#ffafcd" : "#ff82af" };
  }, { font: "round", stroke: WHITE, sw: 0.11 });
};

function Seal({ word, px, col, seed }: { word: string; px: number; col: string; seed: number }) {
  const n = [...word].length, vertical = n >= 2 && n <= 4;
  const cols = vertical ? (n === 4 ? [word.slice(0, 2), word.slice(2)] : [word]) : null;
  const fs = px * (n <= 1 ? 0.95 : vertical ? 0.62 : 0.8);
  const r = rng(seed, word);
  const grain = `radial-gradient(circle at ${r.uniform(10, 90)}% ${r.uniform(10, 90)}%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at ${r.uniform(10, 90)}% ${r.uniform(10, 90)}%, rgba(0,0,0,0.25), transparent 35%)`;
  return <div style={{ position: "relative", padding: fs * 0.3, background: `${grain}, ${col}`, borderRadius: fs * 0.18, display: "flex", flexDirection: "row-reverse", gap: fs * 0.02, fontFamily: FONTS.stamp, color: "#faf0e1", fontSize: fs, lineHeight: 1.02 }}>
    <div style={A({ inset: fs * 0.09, border: `${Math.max(2, fs * 0.04)}px solid #faf0e1`, borderRadius: fs * 0.12 })} />
    {cols ? cols.map((cc, k) => <div key={k} style={{ display: "flex", flexDirection: "column" }}>{[...cc].map((ch, j) => <span key={j}>{ch}</span>)}</div>) : <span style={{ whiteSpace: "nowrap" }}>{word}</span>}
  </div>;
}
const sealSize = (word: string, px: number): [number, number] => {
  const n = [...word].length, vertical = n >= 2 && n <= 4;
  const fs = px * (n <= 1 ? 0.95 : vertical ? 0.62 : 0.8);
  if (vertical) { const nc = n === 4 ? 2 : 1, nr = n === 4 ? 2 : n; return [fs * 1.02 * nc + fs * 0.6, fs * 1.02 * nr + fs * 0.6]; }
  return [[...word].reduce((s, ch) => s + advOf(ch, fs), 0) + fs * 0.6, fs * 1.62];
};
STYLES.stamp = (c) => {
  const px = +c.P.size * U(c) * c.k, col = c.P.color ?? "#c81824", ex = easeOut(exitP(c.L, c.t), 2);
  const words = c.L.words.map((w) => ({ w, s: wordText(c.L, w) }));
  const sizes = words.map(({ s }) => sealSize(s, px)), gap = px * 0.25;
  const tot = sizes.reduce((a, b) => a + b[0], 0) + gap * (words.length - 1), sc = Math.min(1, (c.W * 0.9) / Math.max(1, tot));
  let x = c.W / 2 - (tot * sc) / 2;
  const yc = c.H * Math.min(0.8, c.textY - 0.04);
  const boxes: Box[] = new Array(c.L.chars.length);
  const els: React.ReactNode[] = [];
  words.forEach(({ w, s }, k) => {
    const [sw, sh] = [sizes[k][0] * sc, sizes[k][1] * sc], cx = x + sw / 2;
    x += sw + gap * sc;
    for (let i = w.i0; i < w.i1; i++) boxes[i] = [cx - sw / 2, yc - sh / 2, cx + sw / 2, yc + sh / 2];
    const age = c.t - w.t;
    if (age < -0.03) return;
    const p = clamp((age + 0.03) / 0.12), r = rng(c.L.seed, k), rot = r.uniform(-7, 7), scl = (1.7 - 0.7 * p * p) * sc, a = clamp(p * 1.5) * (1 - ex);
    els.push(<div key={k} style={A({ left: cx, top: yc, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scl})`, opacity: a })}><Seal word={s} px={px} col={col} seed={c.L.seed} /></div>);
    if (p >= 1 && age < 0.5) {
      const q = (age - 0.12) / 0.38;
      for (let d = 0; d < 9; d++) {
        const an = r.uniform(0, Math.PI * 2), dist = (sw * 0.55 + r.uniform(0, px * 0.8)) * easeOut(q), sz = r.uniform(4, 12);
        els.push(<div key={`${k}i${d}`} style={A({ left: cx + Math.cos(an) * dist, top: yc + Math.sin(an) * dist * 0.7, width: sz, height: sz, borderRadius: "50%", background: col, opacity: (1 - q) * a })} />);
      }
    }
  });
  return { el: <>{els}</>, boxes };
};

STYLES.mask_wipe = (c) => {
  const l = lay(c, 0.08);
  const ex = exitP(c.L, c.t), px = l.px, slant = +c.P.slant, ch = c.L.chars;
  const els: React.ReactNode[] = [];
  l.rows.forEach((row, ri) => {
    const done = row.map((i) => { const [x] = l.pos[i], hw = l.adv[i] / 2, p = clamp((c.t - ch[i].t0 + 0.08) / Math.max(0.1, Math.min(0.35, ch[i].t1 - ch[i].t0))); return p > 0 ? x - hw + 2 * hw * p : null; }).filter((v) => v !== null) as number[];
    const y = l.pos[row[0]][1], left0 = l.pos[row[0]][0] - l.adv[row[0]] / 2 - px;
    const xEdge = done.length ? Math.max(...done) : left0;
    const xLeft = ex > 0 ? left0 + easeOut(ex, 2) * (l.rowW[ri] + 3 * px) : -1e5;
    const y0 = y - l.lh * 0.62, y1 = y + l.lh * 0.62, d = slant * (y1 - y0) / 2;
    const poly = `polygon(${xLeft + d}px ${y0}px, ${xEdge + d}px ${y0}px, ${xEdge - d}px ${y1}px, ${xLeft - d}px ${y1}px)`;
    els.push(<div key={`r${ri}`} style={A({ left: 0, top: 0, width: c.W, height: c.H, clipPath: poly })}>
      {row.map((i) => { const m = kwMod(c, i); return <Glyph k={i} x={l.pos[i][0] + (m.dx ?? 0)} y={l.pos[i][1] + (m.dy ?? 0)} ch={ch[i].ch} px={px} font="stamp" fill={m.fill ?? WHITE} sw={0.07} shadow={dropShadow(px)} />; })}
    </div>);
    const moving = done.length && c.t - ch[row[row.length - 1]].t0 < 0.4 && ex === 0;
    if (moving || (ex > 0 && ex < 1)) {
      const xe = ex === 0 ? xEdge : xLeft;
      els.push(<div key={`b${ri}`} style={A({ left: xe - px * 0.05, top: y0, width: px * 0.1, height: y1 - y0, background: PINK, transform: `skewX(${-Math.atan(slant) * 57.3}deg)`, boxShadow: `0 0 ${px * 0.2}px ${PINK}` })} />);
    }
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.split_reveal = (c) => {
  const l = lay(c, 0.08);
  const op = +c.P.open, ex = exitP(c.L, c.t), px = l.px, aLine = easeOut(clamp((c.t - c.L.tOn) / 0.18));
  const els: React.ReactNode[] = [];
  l.rows.forEach((row, ri) => {
    const yl = l.pos[row[0]][1], half = l.rowW[ri] / 2 + px * 0.6, grow = easeOut(clamp((c.t - c.L.tOn) / 0.22), 3) * (1 - easeOut(ex, 2));
    const flash = Math.max(0, ...row.filter((i) => c.t >= c.L.chars[i].t0).map((i) => Math.exp(-(c.t - c.L.chars[i].t0) / 0.12)));
    const th = Math.max(2, px * 0.03);
    els.push(<div key={`l${ri}`} style={A({ left: c.W / 2 - half * grow, top: yl - th / 2, width: 2 * half * grow, height: th, background: WHITE, opacity: 0.6 + 0.4 * flash, boxShadow: flash > 0.05 ? `0 0 ${px * 0.15}px ${PINK}` : undefined })} />);
    row.forEach((i) => {
      let p = clamp((charAge(c.L, i, c.t) + 0.04) / op);
      if (p <= 0) return;
      p = easeOut(p, 3) * (1 - easeOut(ex, 2));
      const [x] = l.pos[i], hh = px * 0.62, m = kwMod(c, i);
      const g = { ch: c.L.chars[i].ch, px, font: "stamp", fill: m.fill ?? CREAM, sw: 0.07, a: aLine };
      // top half emerges upward out of the line, bottom half downward
      els.push(<div key={`t${i}`} style={A({ left: x - px, top: yl - hh, width: px * 2, height: hh, overflow: "hidden" })}><Glyph {...g} x={px} y={hh + (1 - p) * hh} /></div>);
      els.push(<div key={`b${i}`} style={A({ left: x - px, top: yl, width: px * 2, height: hh, overflow: "hidden" })}><Glyph {...g} x={px} y={-(1 - p) * hh} /></div>);
    });
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.blur_in = (c) => {
  const l = lay(c, 0.074);
  const en = +c.P.enter, ex = exitP(c.L, c.t), L = c.L;
  const prog = clamp((c.t - L.tOn) / Math.max(0.3, L.chars[L.chars.length - 1].t0 - L.tOn + en));
  const track = 0.22 * (1 - easeOut(prog, 2)) + 0.25 * easeOut(ex, 2);
  return drawH(c, l, (i, age) => {
    const p = clamp((age + en * 0.5) / en);
    if (p <= 0 && ex === 0) return null;
    const x = l.pos[i][0];
    return { dx: (x - c.W / 2) * track, s: 1 + 0.08 * (1 - p), a: easeOut(p, 2), blur: (1 - easeOut(p, 2)) * l.px * 0.22 + ex * l.px * 0.3 };
  });
};

STYLES.scale_pop = (c) => {
  const l = lay(c, 0.082);
  const en = +c.P.enter, cols = ["#ff5c96", YELLOW, CYAN, "#96ff78", "#ff963c"], bp = beatPulse(c.beat, c.t, 0.1);
  return drawH(c, l, (i, age) => {
    const p = clamp((age + 0.03) / en);
    if (p <= 0) return null;
    const r = rng(c.L.seed, i, "sp");
    return { a: clamp(p * 4), s: easeOutElastic(p) * (1 + 0.08 * bp), rot: r.uniform(-9, 9) * (1 - p * 0.5), fill: cols[(i + c.L.seed) % cols.length] };
  }, { font: "stamp", sw: 0.12 });
};

STYLES.circular = (c) => {
  const R = +c.P.radius * U(c), n = c.L.chars.length, circ = 2 * Math.PI * R;
  const px = Math.min(0.07 * U(c) * c.k, (circ * 0.92) / Math.max(1, n) / 0.95);
  const cx = c.W / 2, cy = c.H * 0.5, ex = exitP(c.L, c.t);
  const rot = beatStep(c.beat, c.t, c.L.tOn) * 12 + easeOut(ex, 2) * 90;
  const step = n * px * 1.05 > circ * 0.6 ? 360 / Math.max(n, 1) : ((px * 1.05) / R) * 57.2958;
  const aLine = clamp((c.t - c.L.tOn) / 0.2) * (1 - easeOut(ex, 2));
  const els: React.ReactNode[] = [
    <div key="r1" style={A({ left: cx - (R - px * 0.75), top: cy - (R - px * 0.75), width: 2 * (R - px * 0.75), height: 2 * (R - px * 0.75), borderRadius: "50%", border: `${Math.max(1, px * 0.04)}px solid ${CRIM}`, opacity: 0.85 * aLine, boxSizing: "border-box" })} />,
    <div key="r2" style={A({ left: cx - (R + px * 0.75), top: cy - (R + px * 0.75), width: 2 * (R + px * 0.75), height: 2 * (R + px * 0.75), borderRadius: "50%", border: `${Math.max(1, px * 0.03)}px dashed ${CREAM}`, opacity: 0.7 * aLine, transform: `rotate(${-rot * 0.5}deg)`, boxSizing: "border-box" })} />,
  ];
  const boxes: Box[] = [];
  const start = -90 - (step * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const ang = ((start + i * step + rot) * Math.PI) / 180, x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
    boxes.push([x - px * 0.6, y - px * 0.6, x + px * 0.6, y + px * 0.6]);
    const p = clamp((charAge(c.L, i, c.t) + 0.05) / 0.2);
    if (p <= 0) continue;
    const m = kwMod(c, i);
    els.push(<Glyph k={i} x={x + (m.dx ?? 0)} y={y + (m.dy ?? 0)} ch={c.L.chars[i].ch} px={px} font="stamp" fill={m.fill ?? CREAM} sw={0.08} s={0.6 + 0.4 * easeOutBack(p)} rot={(ang * 180) / Math.PI + 90} a={easeOut(p) * aLine} shadow={dropShadow(px)} />);
  }
  return { el: <>{els}</>, boxes };
};

STYLES.ticker = (c) => {
  const sp = +c.P.speed * c.W, ex = easeOut(exitP(c.L, c.t), 2), aLine = clamp((c.t - c.L.tOn) / 0.15) * (1 - ex), bh = U(c) * 0.075;
  const portrait = c.H > c.W;
  const unit = c.L.text.replace(/ /g, "　") + "　★　";
  const unitW = [...unit].reduce((s, ch) => s + advOf(ch, bh * 0.62), 0);
  const bands = ([[c.H * (portrait ? 0.16 : 0.085), -1, YELLOW, "#0e0a0c"], [c.H * (portrait ? 0.7 : 0.915), 1, "#0e0a0c", YELLOW]] as const).map(([yc, dir, fill, bg], k) => {
    const off = (((dir * sp * (c.t - c.L.tOn)) % unitW) + unitW) % unitW;
    const reps = Math.ceil(c.W / unitW) + 2;
    return <div key={`band${k}`} style={A({ left: 0, top: yc - bh / 2, width: c.W, height: bh, background: bg, opacity: 0.88 * aLine, overflow: "hidden" })}>
      <div style={A({ left: off - unitW, top: 0, height: bh, display: "flex", alignItems: "center", whiteSpace: "pre", fontFamily: FONTS.stamp, fontSize: bh * 0.62, color: fill })}>{unit.repeat(reps)}</div>
    </div>;
  });
  const l = layoutH(c.L, c.W, c.H, { size: 0.08, v: portrait ? 0.45 : 0.5, k: c.k });
  const mid = drawH(c, l, (i, age) => { if (age < -0.03) return null; const p = clamp((age + 0.03) / 0.1); return { a: 1, sy: Math.max(0.05, easeOut(p, 2)) }; }, { font: "stamp", sw: 0.08 });
  return { el: <>{bands}{mid.el}</>, boxes: mid.boxes };
};

const PAPER = ["#f2e8d5", "#ffd63c", "#ff78aa", "#78dcff", "#fafafa", "#141012", "#b01428"];
STYLES.collage = (c) => {
  const l = lay(c, 0.085, c.textY - 0.04, { track: 0.18, maxw: 0.9 });
  const ex = exitP(c.L, c.t);
  const els = l.pos.map(([x, y], i) => {
    const age = charAge(c.L, i, c.t);
    if (age < -0.02) return null;
    const r = rng(c.L.seed * 31 + i, c.L.chars[i].ch), bg = r.pick(PAPER);
    const lum = parseInt(bg.slice(1, 3), 16) * 0.3 + parseInt(bg.slice(3, 5), 16) * 0.59 + parseInt(bg.slice(5, 7), 16) * 0.11;
    let fg = lum > 140 ? "#0f0c0e" : "#f5eee1";
    if (r.next() < 0.25 && bg !== "#b01428" && lum > 140) fg = CRIM;
    const font = r.pick(["lyrics", "stamp", "round"]), size = l.px * r.uniform(0.85, 1.2), rot = r.uniform(-13, 13);
    const pts = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]].map(([a, b]) => `${a + r.uniform(-7, 7)}% ${b + r.uniform(-7, 7)}%`).join(",");
    const r2 = rng(c.L.seed, i, "cg"), dy = r2.uniform(-0.12, 0.12) * l.px;
    if (ex > 0 && r2.next() < ex * 1.3) return null;
    const snap = age < 1 / 30 ? 1.35 : 1;
    const m = kwMod(c, i);
    return <div key={i} style={A({ left: x + (m.dx ?? 0), top: y + dy + (m.dy ?? 0), transform: `translate(-50%,-50%) rotate(${rot + (age < 1 / 15 ? 4 : 0)}deg) scale(${snap})`, filter: "drop-shadow(5px 6px 0 rgba(0,0,0,0.45))" })}>
      <div style={{ clipPath: `polygon(${pts})`, background: bg, padding: `${size * 0.22}px ${size * 0.25}px`, fontFamily: FONTS[font], fontSize: size, lineHeight: 1, color: m.fill ?? fg }}>{c.L.chars[i].ch}</div>
    </div>;
  });
  return { el: <>{els}</>, boxes: boxesH(l) };
};

STYLES.burst = (c) => {
  const l = lay(c, 0.08);
  const cnt = +c.P.count, cols = [PINK, YELLOW, CYAN, WHITE, "#aa78ff", MINT];
  const base = drawH(c, l, (i, age) => { const p = clamp((age + 0.03) / 0.16); return p <= 0 ? null : { a: clamp(p * 3), s: 0.5 + 0.5 * easeOutBack(p, 2.2) }; }, { font: "round", fill: WHITE, stroke: "#ff4696", sw: 0.12 });
  const ex = exitP(c.L, c.t), els: React.ReactNode[] = [];
  c.L.words.forEach((w, k) => {
    const age = c.t - w.t;
    if (age < 0 || age > 1) return;
    const xs = l.pos.slice(w.i0, w.i1).map((p) => p[0]), cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = l.pos[w.i0][1];
    const r = rng(c.L.seed, k, "b");
    for (let j = 0; j < cnt; j++) {
      const ang = r.uniform(0, Math.PI * 2), v = r.uniform(0.35, 1) * c.H * 0.75, shape = r.pick(["★", "♥", "✦", "●"]), size = r.uniform(0.25, 0.6) * l.px, col = r.pick(cols), spin = r.uniform(-500, 500);
      const dist = (v * (1 - Math.exp(-age * 3.2))) / 3.2;
      els.push(<div key={`${k}b${j}`} style={A({ left: cx + Math.cos(ang) * dist, top: cy + Math.sin(ang) * dist + 0.5 * c.H * 0.6 * age * age, transform: `translate(-50%,-50%) rotate(${spin * age}deg) scale(${1 - 0.6 * age})`, color: col, fontSize: size, fontFamily: FONTS.sans, opacity: (1 - age * age) * (1 - ex), textShadow: `0 0 ${size * 0.3}px ${col}` })}>{shape}</div>);
    }
  });
  return { el: <>{els}{base.el}</>, boxes: base.boxes };
};

STYLES.word_stack = (c) => {
  const bw = +c.P.width * c.W * (c.H > c.W ? 2 : 1), ex = exitP(c.L, c.t), base = U(c) * 0.1;
  const words = c.L.words.map((w) => wordText(c.L, w));
  const advs = words.map((s) => [...s].reduce((a, ch) => a + advOf(ch, base), 0));
  const scales = advs.map((a) => Math.min(bw / Math.max(1, a), 2.6)), hs = scales.map((s) => base * 1.05 * s * 0.92);
  const tot = hs.reduce((a, b) => a + b, 0), fit = Math.min(1, (c.H * 0.7) / Math.max(1, tot));
  let y = c.H * 0.47 - (tot * fit) / 2;
  const boxes: Box[] = new Array(c.L.chars.length), els: React.ReactNode[] = [];
  c.L.words.forEach((w, k) => {
    const s = scales[k] * fit, hh = hs[k] * fit, cy = y + hh / 2;
    y += hh;
    for (let i = w.i0; i < w.i1; i++) boxes[i] = [c.W / 2 - (bw * fit) / 2, cy - hh / 2, c.W / 2 + (bw * fit) / 2, cy + hh / 2];
    const age = c.t - w.t;
    if (age < -0.03) return;
    const p = clamp((age + 0.03) / 0.18), side = k % 2 === 0 ? -1 : 1;
    let dx = side * (1 - easeOut(p, 4)) * c.W * 0.7;
    const sq = 1 + 0.25 * spring(Math.max(0, age - 0.15), 30, 9);
    if (ex > 0) dx = -side * easeOut(ex, 3) * c.W * 0.8 * (0.6 + 0.1 * k);
    const m = kwMod(c, w.i0);
    els.push(<Glyph k={k} x={c.W / 2 + dx + (m.dx ?? 0)} y={cy - ex * c.H * 0.05 + (m.dy ?? 0)} ch={words[k]} px={base} font="stamp" fill={m.fill ?? [CREAM, CRIM, WHITE][k % 3]} sw={0.06} s={s} sx={sq} sy={1 / sq} shadow={dropShadow(base)} />);
  });
  return { el: <>{els}</>, boxes };
};

const KANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテト";
STYLES.letter_rain = (c) => {
  const dens = +c.P.density, ex = exitP(c.L, c.t), env = clamp((c.t - c.L.tOn) / 0.3) * (1 - easeOut(ex, 2));
  const ncol = Math.floor(26 * dens * (c.W / Math.max(c.W, c.H))), spx = U(c) * 0.032, pool = [...c.L.chars.map((x) => x.ch), ...KANA];
  const els: React.ReactNode[] = [];
  for (let col = 0; col < ncol; col++) {
    const r = rng(c.L.seed, "col", col), x = ((col + r.uniform(0.1, 0.9)) / ncol) * c.W, sp = r.uniform(0.25, 0.6) * c.H, off = r.uniform(0, c.H * 1.5), n = r.int(4, 9);
    const head = ((off + sp * c.t) % (c.H * 1.5)) - c.H * 0.2;
    for (let k = 0; k < n; k++) {
      const y = head - k * spx * 1.15;
      if (y < -spx || y > c.H + spx) continue;
      const chs = pool[rng(c.L.seed, col, k, Math.floor(c.t * 6 + k)).int(0, pool.length)];
      els.push(<Glyph k={`${col}-${k}`} x={x} y={y} ch={chs} px={spx} font="round" fill={k === 0 ? "#ff8cbe" : CREAM} a={env * (k === 0 ? 0.55 : 0.32 * (1 - k / n))} />);
    }
  }
  const l = lay(c, 0.08, Math.min(0.62, c.textY));
  const main = drawH(c, l, (i, age) => {
    const p = clamp((age + 0.35) / 0.35);
    if (p <= 0) return null;
    const y = l.pos[i][1], fall = (1 - p) ** 2 * (y + l.px);
    const bounce = age > 0 ? Math.abs(Math.sin(clamp(age / 0.22) * Math.PI)) * l.px * 0.12 * (1 - clamp(age / 0.22)) : 0;
    return { a: 1, dy: -fall - bounce };
  }, { font: "stamp", sw: 0.08 });
  return { el: <>{els}{main.el}</>, boxes: main.boxes };
};

function Dialog({ word, px, accent, title }: { word: string; px: number; accent: string; title: string }) {
  const tb = px * 0.48;
  return <div style={{ minWidth: px * 3.2, padding: 0, background: "#ece9f0", border: "2px solid #14101e", boxShadow: `${px * 0.12}px ${px * 0.12}px 0 rgba(0,0,0,0.6)`, fontFamily: FONTS.stamp, color: "#14101e" }}>
    <div style={{ height: tb, background: `linear-gradient(90deg, #281478, ${accent})`, color: "#fff", fontFamily: FONTS.round, fontSize: px * 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${px * 0.12}px` }}>
      <span>{title}</span><span style={{ background: "#ece9f0", color: "#14101e", border: "1px solid #14101e", width: tb * 0.7, height: tb * 0.7, lineHeight: `${tb * 0.66}px`, textAlign: "center", fontSize: px * 0.28 }}>×</span>
    </div>
    <div style={{ fontSize: px, lineHeight: 1, padding: `${px * 0.25}px ${px * 0.6}px ${px * 0.15}px`, textAlign: "center", whiteSpace: "nowrap" }}>{word}</div>
    <div style={{ display: "flex", justifyContent: "center", paddingBottom: px * 0.14 }}><span style={{ fontFamily: FONTS.round, fontSize: px * 0.26, border: "1px solid #14101e", background: "#d2cdd7", padding: `0 ${px * 0.3}px` }}>OK</span></div>
  </div>;
}
STYLES.ui_window = (c) => {
  const px = U(c) * 0.075 * c.k, ex = exitP(c.L, c.t), n = c.L.words.length;
  const accents = ["#ff50a0", "#3ca0ff", "#ffaa28", "#8c5aff"], titles = ["error.exe", "warning", "♡.txt", "noise.exe", "candy.app"];
  const sx = c.W * (c.H > c.W ? 0.05 : 0.075), sy = c.H * 0.085 * (c.H > c.W ? 0.6 : 1);
  const cx0 = c.W / 2 - (sx * (n - 1)) / 2, cy0 = c.H * 0.42 - (sy * (n - 1)) / 2;
  const boxes: Box[] = new Array(c.L.chars.length), els: React.ReactNode[] = [];
  c.L.words.forEach((w, k) => {
    const r = rng(c.L.seed, k, "w"), cx = cx0 + sx * k + r.uniform(-0.03, 0.03) * c.W, cy = cy0 + sy * k + r.uniform(-0.02, 0.02) * c.H;
    const ww = Math.max(px * 3.2, [...wordText(c.L, w)].reduce((s, ch) => s + advOf(ch, px), 0) + px * 1.2), hh = px * 2.1;
    for (let i = w.i0; i < w.i1; i++) boxes[i] = [cx - ww / 2, cy - hh / 2 + px * 0.5, cx + ww / 2, cy + hh / 2];
    const age = c.t - w.t;
    if (age < -0.02) return;
    if (ex > 0 && ex * (n + 1) > n - k) return;
    const p = clamp((age + 0.02) / 0.09);
    els.push(<div key={k} style={A({ left: cx, top: cy, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * easeOut(p, 2)})`, opacity: p > 0.3 ? 1 : p / 0.3 })}>
      <Dialog word={wordText(c.L, w)} px={px} accent={accents[(k + c.L.seed) % 4]} title={titles[(k + c.L.seed) % 5]} /></div>);
  });
  return { el: <>{els}</>, boxes };
};

/** kinetic: word chunks slam in big (scale 2.4 -> 1 with overshoot), crimson bands behind, tilted block, beat shake. */
STYLES.kinetic = (c) => {
  const words = c.L.words, ex = exitP(c.L, c.t), base = U(c) * 0.13 * c.k;
  const tilt = (rng(c.L.seed, "tilt").next() - 0.5) * 12;
  // two rows max, sizes alternate big/small for rhythm
  const sizes = words.map((_, k) => base * (k % 3 === 0 ? 1.15 : k % 3 === 1 ? 0.75 : 0.95));
  const ws = words.map((w, k) => [...wordText(c.L, w)].reduce((s, ch) => s + advOf(ch, sizes[k]), 0));
  const rows: number[][] = [[]];
  let acc = 0;
  ws.forEach((w, k) => { if (acc + w > c.W * 0.8 && rows[rows.length - 1].length) { rows.push([]); acc = 0; } rows[rows.length - 1].push(k); acc += w + base * 0.15; });
  const rowH = rows.map((r) => Math.max(...r.map((k) => sizes[k])) * 1.12);
  const totH = rowH.reduce((a, b) => a + b, 0);
  let y = c.H * 0.5 - totH / 2;
  const boxes: Box[] = new Array(c.L.chars.length), els: React.ReactNode[] = [];
  const shake = beatPulse(c.beat, c.t, 0.08) * base * 0.03;
  rows.forEach((r, ri) => {
    const rw = r.reduce((s, k) => s + ws[k], 0) + base * 0.15 * (r.length - 1);
    let x = c.W / 2 - rw / 2;
    const cy = y + rowH[ri] / 2;
    y += rowH[ri];
    r.forEach((k) => {
      const w = words[k], cx = x + ws[k] / 2;
      x += ws[k] + base * 0.15;
      for (let i = w.i0; i < w.i1; i++) boxes[i] = [cx - ws[k] / 2, cy - sizes[k] / 2, cx + ws[k] / 2, cy + sizes[k] / 2];
      const age = c.t - w.t;
      if (age < -0.02) return;
      const p = clamp((age + 0.02) / 0.14), s = 2.4 - 1.4 * easeOutBack(p, 2.0);
      const band = clamp((age - 0.04) / 0.12), m = kwMod(c, w.i0);
      const fill = k % 2 ? CREAM : YELLOW;
      const exitDx = ex > 0 ? (k % 2 ? 1 : -1) * easeOut(ex, 3) * c.W * 0.6 : 0;
      els.push(<div key={`band${k}`} style={A({ left: cx - (ws[k] / 2 + base * 0.12) + exitDx, top: cy - sizes[k] * 0.42, width: (ws[k] + base * 0.24) * easeOut(band, 3), height: sizes[k] * 0.84, background: k % 2 ? CRIM : "#111", transform: `skewX(-12deg)`, opacity: 0.92 * (1 - ex) })} />);
      els.push(<Glyph k={`w${k}`} x={cx + exitDx + (m.dx ?? 0) + rng(c.L.seed, k, Math.floor(c.t * 30)).uniform(-1, 1) * shake} y={cy + (m.dy ?? 0)} ch={wordText(c.L, w)} px={sizes[k]} font="stamp" fill={m.fill ?? fill} sw={0.05} s={s} a={clamp(p * 4) * (1 - ex)} shadow={m.shadow ?? `${sizes[k] * 0.05}px ${sizes[k] * 0.05}px 0 #000`} />);
    });
  });
  return { el: <div style={A({ inset: 0, transform: `rotate(${tilt}deg)` })}>{els}</div>, boxes };
};

// styles made with `npm run style:new`
import { CUSTOM_STYLES } from "./custom";
Object.assign(STYLES, CUSTOM_STYLES);
