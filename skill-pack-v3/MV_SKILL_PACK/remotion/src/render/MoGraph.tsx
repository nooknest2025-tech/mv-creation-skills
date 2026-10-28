// Motion-graphics layers driven by props.mograph (src/lib/mograph.ts):
//  MoGraphBg  - between the pictures and the lyrics: solid section colour (typo / mograph shots or no media), primitive shapes,
//               concentric bursts, particles on beat, line sweeps, parallax background text, HUD greebles.
//  MoGraphTop - above everything: section shape transitions, 2-frame invert flash on accents, grain / halftone.
//  accentTransform - lyric layer bump / camera rotate / held-scream shake + RGB split while an accent is hot.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { beatLen, clamp, hash, rng } from "../lib/core";
import { EASE, accentState, gridAnchor, heldScream } from "../lib/pro";
import type { MoSection } from "../lib/mograph";
import type { RenderProps } from "../lib/types";

const HEAVY = "'Dela Gothic One', 'Noto Sans JP', sans-serif";
const secAt = (p: RenderProps, t: number) => p.mograph?.sections.find((s) => t >= s.start && t < s.end) ?? p.mograph?.sections[p.mograph.sections.length - 1];
const shotAt = (p: RenderProps, t: number) => p.shots.find((s) => t >= s.start && t < s.end);
export const isSolid = (p: RenderProps, t: number) => !!p.mograph && (p.mograph.solo || ["typo", "mograph"].includes(shotAt(p, t)?.role ?? "") || !p.shots.some((s) => s.src));
const bgWord = (p: RenderProps, s: MoSection) => (s.type === "chorus" ? "CHORUS" : s.type === "pre_chorus" ? "BUILD UP" : s.type === "verse" ? "VERSE" : s.type === "bridge" ? "BRIDGE" : s.type.toUpperCase());

/** editor edits of the mograph layer (whole video: data.mographEdit, per scene: scene.mograph). Unset = the built-in plan, pixel-identical. */
export interface MoEdit { off?: boolean; look?: MoSection["look"]; colors?: Partial<Record<"bg" | "fg" | "accent" | "sub", string>>; intensity?: number; speed?: number; density?: number; transition?: MoSection["transition"] }
/** the section as edited (same object when there is no look/colour edit). */
export const editSec = (s: MoSection | undefined, ed?: MoEdit): MoSection | undefined => !s || !ed || (!ed.look && !ed.colors && !ed.transition) ? s : { ...s, look: ed.look ?? s.look, transition: ed.transition ?? s.transition, palette: ed.colors ? { ...s.palette, ...ed.colors } : s.palette };
export const MoGraphBg: React.FC<{ p: RenderProps }> = ({ p }) => {
  const frame = useCurrentFrame(); const { width: W, height: H, fps } = useVideoConfig();
  return <>{moBg(p, p.startAt + frame / fps, W, H)}</>;
};
/** the background mograph layer at time t (pure: shared by the Remotion render and the editor preview / export). */
export function moBg(p: Pick<RenderProps, "mograph" | "shots" | "beat">, t: number, W: number, H: number, ed?: MoEdit): React.ReactElement | null {
  const s = editSec(secAt(p as RenderProps, t), ed);
  if (!p.mograph || !s) return null;
  const solid = isSolid(p as RenderProps, t), U = Math.min(W, H), pal = s.palette, B = beatLen(p.beat);
  const SP = ed?.speed ?? 1, IN = ed?.intensity ?? 1, DN = ed?.density ?? 1, cnt = (n: number) => Math.max(0, Math.round(n * DN));
  if (ed?.off) return <AbsoluteFill style={{ overflow: "hidden" }}>{solid && <AbsoluteFill style={{ background: pal.bg }} />}</AbsoluteFill>;
  const bx = ((t - p.beat.phase) / B) * SP, beatI = Math.floor(bx), beatF = bx - beatI, barI = Math.floor(bx / p.beat.beatsPerBar);
  const role = shotAt(p as RenderProps, t)?.role;
  const strong = (solid ? 1 : role === "lyric" ? 0.7 : 0.45) * IN; // over pictures the graphics stay secondary
  const els: React.ReactNode[] = [];
  // pose-to-pose helper: move to a new pose on every beat with snappy easing, slow drift in the hold
  const pose = (key: string, k: number) => { const a = rng(key, k), b = rng(key, k + 1); const q = EASE.snappy(clamp(beatF / 0.35)); return { x: a.next() + (b.next() - a.next()) * q, y: a.next() + (b.next() - a.next()) * q, r: (a.next() - 0.5) * 90 + ((b.next() - 0.5) * 90 - (a.next() - 0.5) * 90) * q, d: beatF * 0.02 }; };
  if (s.parallax) { // large low-opacity background text, slow parallax
    const word = bgWord(p as RenderProps, s), px = H * 0.42;
    els.push(<div key="bgt" style={{ position: "absolute", left: -((t - s.start) * SP * W * 0.02) - W * 0.05, top: H * 0.5 - px * 0.6, fontFamily: HEAVY, fontSize: px, whiteSpace: "pre", color: pal.fg, opacity: 0.07 * (solid ? 1 : 0.6) * IN, letterSpacing: -px * 0.04 }}>{word} {word}</div>);
  }
  if (s.look === "blocks") for (let k = 0; k < cnt(3); k++) {
    const r = rng("blk", barI, k), q = EASE.snappy(clamp(((bx / p.beat.beatsPerBar) % 1) * 4 - k * 0.15));
    const w = W * r.uniform(0.18, 0.4), h = H * r.uniform(0.12, 0.3), x = W * r.uniform(-0.05, 0.8), y = H * r.uniform(0, 0.8);
    els.push(<div key={`b${k}`} style={{ position: "absolute", left: x, top: y, width: w * q, height: h, background: [pal.accent, pal.sub, pal.fg][k % 3], opacity: strong * (k === 2 ? 0.25 : 0.9) }} />);
  }
  if (s.look === "geo" || s.look === "burst") {
    const shapes = Array.from({ length: cnt(4) }, (_, k) => ["circle", "tri", "rect", "line"][k % 4]);
    shapes.forEach((sh, k) => { const o = pose(`geo${k}`, Math.floor(beatI / (k + 1))), sz = U * (0.12 + (k % 4) * 0.05), x = (0.1 + o.x * 0.8) * W, y = (0.1 + o.y * 0.8) * H;
      const st: React.CSSProperties = { position: "absolute", left: x - sz / 2, top: y - sz / 2, width: sz, height: sh === "line" ? Math.max(2, U * 0.004) : sz, transform: `rotate(${o.r}deg) scale(${1 + o.d})`, opacity: strong * 0.85 };
      if (sh === "circle") els.push(<div key={`g${k}`} style={{ ...st, borderRadius: "50%", border: `${Math.max(2, U * 0.005)}px solid ${pal.accent}` }} />);
      else if (sh === "rect") els.push(<div key={`g${k}`} style={{ ...st, border: `${Math.max(2, U * 0.005)}px solid ${pal.fg}` }} />);
      else if (sh === "line") els.push(<div key={`g${k}`} style={{ ...st, width: sz * 2.5, background: pal.sub }} />);
      else els.push(<svg key={`g${k}`} style={st} viewBox="0 0 100 100"><polygon points="50,6 96,90 4,90" fill="none" stroke={pal.sub} strokeWidth={4} /></svg>); });
  }
  if (s.look === "burst" || s.particlesOnBeat) { // concentric burst + particles from the beat
    const q = EASE.expoOut(clamp(beatF / 0.9)), [cx, cy] = gridAnchor(hash("burst", beatI) % 9).map((v, i) => v * (i ? H : W));
    if (s.look === "burst") for (let k = 0; k < cnt(4); k++) { const r = U * (0.08 + q * 0.9) * (1 - k * 0.18); els.push(<div key={`r${k}`} style={{ position: "absolute", left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${Math.max(2, U * 0.006 * (1 - q))}px solid ${k % 2 ? pal.accent : pal.fg}`, opacity: strong * (1 - q) }} />); }
    const rr = rng("pt", beatI);
    for (let k = 0; k < cnt(14); k++) { const a = rr.uniform(0, Math.PI * 2), d = U * rr.uniform(0.1, 0.45) * q, sz = U * rr.uniform(0.006, 0.016);
      els.push(<div key={`p${k}`} style={{ position: "absolute", left: cx + Math.cos(a) * d, top: cy + Math.sin(a) * d, width: sz, height: sz, background: k % 3 ? pal.accent : pal.fg, transform: `rotate(${a * 57}deg)`, opacity: strong * (1 - q) }} />); }
  }
  if (s.look === "mono") { // diagonal line sweep on every bar
    const q = EASE.inOut(clamp(((bx / p.beat.beatsPerBar) % 1) * 2));
    for (let k = 0; k < cnt(3); k++) els.push(<div key={`sw${k}`} style={{ position: "absolute", left: -W * 0.3 + q * W * 1.6 - k * U * 0.05, top: -H * 0.2, width: Math.max(2, U * (0.004 + k * 0.004)), height: H * 1.4, background: k === 1 ? pal.accent : pal.fg, transform: "rotate(25deg)", opacity: strong * 0.7 }} />);
  }
  if (s.look === "hud") { // fg UI: crosshair, frame corners, monospace greeble
    const [cx, cy] = (() => { const o = pose("hud", Math.floor(beatI / 2)); return [(0.25 + o.x * 0.5) * W, (0.25 + o.y * 0.5) * H]; })();
    const L = U * 0.06, th = Math.max(1, U * 0.0025), gs = U * 0.012;
    els.push(<div key="ch" style={{ position: "absolute", left: cx - L, top: cy - th / 2, width: L * 2, height: th, background: pal.accent }} />, <div key="cv" style={{ position: "absolute", left: cx - th / 2, top: cy - L, width: th, height: L * 2, background: pal.accent }} />,
      <div key="cc" style={{ position: "absolute", left: cx - L * 0.6, top: cy - L * 0.6, width: L * 1.2, height: L * 1.2, borderRadius: "50%", border: `${th}px solid ${pal.fg}`, opacity: 0.8 }} />);
    for (const [x, y, rx, ry] of [[0.04, 0.06, 1, 1], [0.96, 0.06, -1, 1], [0.04, 0.94, 1, -1], [0.96, 0.94, -1, -1]]) els.push(<div key={`c${x}${y}`} style={{ position: "absolute", left: x * W - (rx < 0 ? L : 0), top: y * H - (ry < 0 ? L : 0), width: L, height: L, borderTop: ry > 0 ? `${th}px solid ${pal.fg}` : undefined, borderBottom: ry < 0 ? `${th}px solid ${pal.fg}` : undefined, borderLeft: rx > 0 ? `${th}px solid ${pal.fg}` : undefined, borderRight: rx < 0 ? `${th}px solid ${pal.fg}` : undefined, opacity: 0.7 }} />);
    els.push(<div key="gr" style={{ position: "absolute", left: W * 0.05, top: H * 0.09, fontFamily: "monospace", fontSize: gs, letterSpacing: gs * 0.3, color: pal.fg, opacity: 0.6 * IN, whiteSpace: "pre", lineHeight: 1.6 }}>{`T+${t.toFixed(2)}  BPM ${Math.round(p.beat.bpm)}  BAR ${String(barI + 1).padStart(3, "0")}\nX ${(cx / W).toFixed(3)}  Y ${(cy / H).toFixed(3)}`}</div>);
  }
  if (s.look === "tanzaku") { // slow, flat, looping
    for (let k = 0; k < cnt(5); k++) { const x = ((k / 5 + (t - s.start) * SP * 0.006) % 1) * W; els.push(<div key={`v${k}`} style={{ position: "absolute", left: x, top: H * 0.08, width: Math.max(1, U * 0.0015), height: H * 0.84, background: pal.fg, opacity: 0.18 * IN }} />); }
    const r = U * 0.16; els.push(<div key="sun" style={{ position: "absolute", left: W * 0.5 - r + Math.sin(t * SP * 0.2) * U * 0.02, top: H * 0.3 - r, width: r * 2, height: r * 2, borderRadius: "50%", background: pal.accent, opacity: 0.22 * (solid ? 1 : 0.5) * IN }} />);
  }
  const tex = s.textures.includes("halftone") ? <AbsoluteFill style={{ backgroundImage: `radial-gradient(${pal.fg} 22%, transparent 24%)`, backgroundSize: `${U * 0.012}px ${U * 0.012}px`, opacity: 0.07 }} /> : null;
  return <AbsoluteFill style={{ overflow: "hidden", filter: s.mono ? "grayscale(1)" : undefined }}>
    {solid && <AbsoluteFill style={{ background: pal.bg }} />}
    {tex}{els}
  </AbsoluteFill>;
}

/** lyric-layer transform for beat accents (bump / camera rotate / scream shake) and RGB split while hot. */
export function accentStyle(p: RenderProps, t: number): React.CSSProperties {
  if (!p.mograph) return {};
  const a = accentState(p.mograph.accents, t, p.fps), s = secAt(p, t);
  const live = p.lines.filter((L) => t >= L.tOn && t < L.tEnd);
  const scream = Math.max(0, ...live.map((L) => heldScream(L.chars, t, L.sectionType === "chorus" ? 0.9 : 0.5)));
  const r = rng("scr", Math.floor(t * p.fps)), sh = scream * Math.min(p.width, p.height) * 0.006;
  const split = (a.bump > 0.015 || a.invert) && s && (s.textures.includes("rgb") || s.textures.includes("anaglyph")) ? Math.min(p.width, p.height) * 0.004 * (a.bump / 0.04) : 0;
  return { transform: `translate(${r.uniform(-1, 1) * sh}px, ${r.uniform(-1, 1) * sh}px) rotate(${a.rot}deg) scale(${1 + a.bump})`,
    filter: split > 0.5 ? `drop-shadow(${split}px 0 0 rgba(255,0,60,0.75)) drop-shadow(${-split}px 0 0 rgba(0,230,255,0.75))` : undefined };
}

export const MoGraphTop: React.FC<{ p: RenderProps }> = ({ p }) => {
  const frame = useCurrentFrame(); const { width: W, height: H, fps } = useVideoConfig();
  return <>{moTop(p, p.startAt + frame / fps, W, H, frame, fps)}</>;
};
/** the top mograph layer (section transitions, accent flash, grain). edFor(i) = edit of the section starting the transition. */
export function moTop(p: Pick<RenderProps, "mograph" | "lines">, t: number, W: number, H: number, frame: number, fps: number, edAt?: (t: number) => MoEdit | undefined): React.ReactElement | null {
  const m = p.mograph;
  if (!m) return null;
  const U = Math.min(W, H), D = Math.hypot(W, H), els: React.ReactNode[] = [];
  m.sections.forEach((s0, i) => {
    const ed = edAt?.(s0.start), s = editSec(s0, ed)!;
    if (i === 0 || s.transition === "cut" || ed?.off) return;
    const B = s.start, prev = m.sections[i - 1], col = s.palette.bg, cin = 0.34, cout = 0.3, slow = s.transition === "slow_wipe" ? 2.2 : 1;
    if (t < B - cin * slow || t > B + cout * slow) return;
    const qi = EASE.in(clamp((t - (B - cin * slow)) / (cin * slow))), qo = EASE.expoOut(clamp((t - B) / (cout * slow))), cover = t < B;
    const [ox, oy] = gridAnchor(hash("tr", i) % 9).map((v, k) => v * (k ? H : W));
    const full = (style: React.CSSProperties = {}) => <AbsoluteFill key={`tr${i}`} style={{ background: col, ...style }} />;
    const hole = (r: number) => ({ WebkitMaskImage: `radial-gradient(circle at ${ox}px ${oy}px, transparent ${r}px, #000 ${r + 1}px)`, maskImage: `radial-gradient(circle at ${ox}px ${oy}px, transparent ${r}px, #000 ${r + 1}px)` });
    const word = (p.lines.find((L) => L.start >= s.start && L.start < s.end)?.text ?? s.label).replace(/\s/g, "");
    switch (s.transition) {
      case "circle": els.push(cover ? <div key={`tr${i}`} style={{ position: "absolute", left: ox - D * qi, top: oy - D * qi, width: D * 2 * qi, height: D * 2 * qi, borderRadius: "50%", background: col }} /> : full(hole(D * qo))); break;
      case "rect": els.push(cover ? <div key={`tr${i}`} style={{ position: "absolute", left: 0, top: 0, width: W * qi, height: H, background: col }} /> : <div key={`tr${i}`} style={{ position: "absolute", left: W * qo, top: 0, width: W * (1 - qo), height: H, background: col }} />); break;
      case "ripple": for (let k = 0; k < 4; k++) { const q = cover ? EASE.in(clamp((t - (B - cin) - k * 0.05) / (cin - 0.15))) : 1; if (!cover) { els.push(full({ ...hole(D * qo) })); break; }
        els.push(<div key={`tr${i}${k}`} style={{ position: "absolute", left: ox - D * q, top: oy - D * q, width: D * 2 * q, height: D * 2 * q, borderRadius: "50%", background: k % 2 ? prev.palette.accent : col, opacity: k === 3 ? 1 : 0.9 }} />); } break;
      case "cloud": for (let k = 0; k < 9; k++) { const r0 = rng("cl", i, k), cx = r0.uniform(-0.05, 1.05) * W, cy = r0.uniform(-0.05, 1.05) * H, R = D * 0.42 * (cover ? EASE.in(clamp(qi * 1.3 - k * 0.03)) : 1 - EASE.expoOut(clamp(qo * 1.2 - k * 0.02)));
        els.push(<div key={`tr${i}${k}`} style={{ position: "absolute", left: cx - R, top: cy - R, width: R * 2, height: R * 2, borderRadius: "50%", background: col }} />); } break;
      case "glyph_zoom": { const ch = [...word][0] ?? "■";
        if (cover) { const sc = 1 + 60 * qi ** 3; els.push(<AbsoluteFill key={`tr${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: HEAVY, fontSize: H * 0.6, lineHeight: 1, color: col, transform: `scale(${sc})`, transformOrigin: "50% 55%" }}>{ch}</div></AbsoluteFill>);
          if (qi > 0.8) els.push(full({ opacity: (qi - 0.8) / 0.2 })); }
        else els.push(full(hole(D * qo))); break; }
      case "push_text": { const x = cover ? W * (1 - qi) : -W * qo * 1.05, px = H * 0.5;
        els.push(<div key={`tr${i}`} style={{ position: "absolute", left: x, top: 0, width: W * 1.05, height: H, background: col, overflow: "hidden" }}><div style={{ position: "absolute", left: W * 0.04, top: H * 0.5 - px * 0.55, fontFamily: HEAVY, fontSize: px, whiteSpace: "pre", color: s.palette.accent, letterSpacing: -px * 0.05 }}>{word.slice(0, 4)}</div></div>); break; }
      case "diag_sweep": for (let k = 0; k < 5; k++) { const q = cover ? EASE.in(clamp(qi * 1.4 - k * 0.08)) : 1 + EASE.expoOut(clamp(qo * 1.3 - k * 0.06)); const x = -W * 0.8 + q * W * 1.1;
        els.push(<div key={`tr${i}${k}`} style={{ position: "absolute", left: x + k * W * 0.08, top: -H * 0.3, width: W * 0.75, height: H * 1.6, background: k % 2 ? s.palette.accent : col, transform: "skewX(-24deg)" }} />); } break;
      case "slow_wipe": { const q = cover ? qi * 0.5 : 0.5 + qo * 0.5; const x = (q * 1.4 - 0.2) * W; els.push(<div key={`tr${i}`} style={{ position: "absolute", left: x - W * 0.2, top: 0, width: W * 0.2, height: H, background: `linear-gradient(90deg, transparent, ${s.palette.fg}55 70%, ${s.palette.fg})`, opacity: 0.6 }} />, <div key={`tr${i}l`} style={{ position: "absolute", left: x, top: 0, width: Math.max(2, U * 0.003), height: H, background: s.palette.accent }} />); break; }
    }
  });
  const edNow = edAt?.(t), a = edNow?.off ? { invert: false } : accentState(m.accents, t, fps), s = edNow?.off ? undefined : secAt(p as RenderProps, t);
  const grain = s?.textures.includes("grain");
  return <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
    {els}
    {a.invert && <AbsoluteFill style={{ background: "#fff", mixBlendMode: "difference" }} />}
    {grain && <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.09, mixBlendMode: "overlay" }}><filter id="gr"><feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={frame % 97} /></filter><rect width={W} height={H} filter="url(#gr)" /></svg>}
  </AbsoluteFill>;
}
