// 立ち絵パーツアニメ stage (editor preview + export). Plain <img>/<svg> only, so it runs in the editor without a Remotion context.
import React from "react";
import { hash, type Beat, beatLen } from "../lib/core";
import type { PartPose, Part } from "../lib/rig";
import { floaterAt, shiftVocal, lyricsInWin, stopTimeOf, freezeT, lastBeatOf, ANIM_FPS, moraOf, singersOf, slideIn, solveChar, stageCamera, type LyricLite, type TachieChar, type TachieStage } from "../lib/tachie";
import { combined, effectFilter, wantsEditorMotion, POSITION_XY, STAGE_STYLES } from "../lib/lyricEdits";
import FONT_OPTIONS from "../../editor/font-options.json";

const tf = (p: Part, q?: PartPose) => { const v = q ?? { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }; return { transformOrigin: `${p.pivot[0]}px ${p.pivot[1]}px`, transform: `translate(${v.dx}px,${v.dy}px) rotate(${v.rot}deg) scale(${v.sx},${v.sy})` }; };
function Puppet({ c, pose, base }: { c: TachieChar; pose: Record<string, PartPose>; base: string }) {
  const [W, H] = c.rig.size, byId = new Map(c.rig.parts.map((p) => [p.id, p]));
  const chain = (p: Part) => { const out: Part[] = []; let q: Part | undefined = p; const seen = new Set<string>(); while (q && !seen.has(q.id)) { seen.add(q.id); out.unshift(q); q = q.parent ? byId.get(q.parent) : undefined; } return out; };
  return <>{[...c.rig.parts].sort((a, b) => a.z - b.z).map((p) => {
    const q = pose[p.id], file = q?.state && p.states?.[q.state] ? p.states[q.state] : p.src;
    const img = <img src={base + c.base + file} draggable={false} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
    return <React.Fragment key={p.id}>{chain(p).reduceRight<React.ReactNode>((inner, a) => <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...tf(a, pose[a.id]) }}>{inner}</div>, img)}</React.Fragment>;
  })}</>;
}
function Bg({ st, t, W, H, beat, chorus, kind, bar }: { st: TachieStage; t: number; W: number; H: number; beat: Beat; chorus: boolean; kind: string; bar: number }) {
  const rot4 = (a: string[], n: number) => a.map((_, i) => a[(i + n) % a.length]);
  const [c0, c1, c2, c3] = rot4(st.palette, chorus ? bar % 4 : Math.floor(bar / 2) % 2 ? 1 : 0), // colour change per bar
 cx = W / 2, cy = H * 0.45, B = beatLen(beat), ph = ((t - beat.phase) / B) % 1;
  const pulse = Math.exp(-ph * 5);
  if (kind === "rings") { // concentric rings pulsing outward one ring per beat (stepped)
    const step = Math.floor((t - beat.phase) / B), g = 70;
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
      {Array.from({ length: 22 }, (_, i) => 22 - i).map((i) => <circle key={i} cx={cx} cy={cy} r={i * g + (step % 2) * g / 2} fill={i % 2 ? c1 : c0} />)}</svg>;
  }
  if (kind === "stripes") { // moving diagonal bands
    const g = 140, off = (t * 160) % (g * 2);
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
      <g transform={`skewX(-28)`}>{Array.from({ length: Math.ceil((W * 2) / g) + 4 }, (_, i) => <rect key={i} x={i * g * 2 - off - g * 2} y={0} width={g} height={H} fill={c1} />)}</g>
      <rect x={0} y={H * 0.83} width={W} height={H * 0.17} fill={c2} /><rect x={0} y={H * 0.83} width={W} height={10} fill={c3} />
      <circle cx={cx} cy={cy} r={H * (0.2 + 0.025 * pulse)} fill={c3} opacity={0.35} /></svg>;
  }
  if (kind === "checker") { // scrolling checkerboard, flips colour each beat
    const g = 90, ox = (t * 70) % (g * 2), oy = (t * 35) % (g * 2), flip = Math.floor((t - beat.phase) / B) % 2, out: React.ReactNode[] = [];
    for (let y = -2; y < H / g + 2; y++) for (let x = -2; x < W / g + 2; x++) if ((x + y + flip) % 2 === 0) out.push(<rect key={x + "_" + y} x={x * g + ox - g * 2} y={y * g + oy - g * 2} width={g} height={g} fill={c1} />);
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />{out}
      <rect width={W} height={H} fill={`url(#vg)`} /><defs><radialGradient id="vg"><stop offset="55%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.45} /></radialGradient></defs></svg>;
  }
  if (kind === "shapes") { // rotating stars / polygons, snapping a step each beat (limited animation)
    const step = Math.floor((t - beat.phase) / B), out: React.ReactNode[] = [];
    for (let i = 0; i < 14; i++) { const h = hash("sh", i), x = (h % 1000) / 1000 * W, y = ((h >> 10) % 1000) / 1000 * H, r = 30 + (h >> 20) % 70, n = 4 + (i % 3);
      const pts = Array.from({ length: n * 2 }, (_, k) => { const a = (k / (n * 2)) * 2 * Math.PI + (step * 15 + i * 20) * Math.PI / 180, rr = k % 2 ? r * 0.45 : r; return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`; }).join(" ");
      out.push(<polygon key={i} points={pts} fill={[c1, c2, c3][i % 3]} stroke="#111" strokeWidth={5} opacity={0.9} />); }
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
      <g transform={`rotate(${t * 8} ${cx} ${cy})`}>{Array.from({ length: 16 }, (_, i) => { const a0 = (i / 16) * 2 * Math.PI, a1 = ((i + 0.5) / 16) * 2 * Math.PI, R = W * 1.2; return <polygon key={i} points={`${cx},${cy} ${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}`} fill={c1} opacity={0.35} />; })}</g>{out}</svg>;
  }
  if (kind === "sunburst") {
    const n = 24, rot = t * (chorus ? 24 : 10);
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
      <g transform={`rotate(${rot} ${cx} ${cy})`}>{Array.from({ length: n }, (_, i) => { const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 0.5) / n) * 2 * Math.PI, R = W * 1.2; return <polygon key={i} points={`${cx},${cy} ${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}`} fill={c1} />; })}</g>
      <circle cx={cx} cy={cy} r={H * (0.22 + 0.03 * pulse)} fill={c2} opacity={0.9} />
      <Dots W={W} H={H} color={c3} t={t} op={0.35} /></svg>;
  }
  if (kind === "grid") {
    const g = 80, off = (t * 60) % g;
    return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
      {Array.from({ length: Math.ceil(W / g) + 2 }, (_, i) => <line key={"v" + i} x1={i * g - off} y1={0} x2={i * g - off} y2={H} stroke={c1} strokeWidth={3} />)}
      {Array.from({ length: Math.ceil(H / g) + 2 }, (_, i) => <line key={"h" + i} x1={0} y1={i * g - off} x2={W} y2={i * g - off} stroke={c1} strokeWidth={3} />)}
      {Array.from({ length: 14 }, (_, i) => <rect key={"s" + i} x={-W + i * 220 + ((t * 120) % 220)} y={H * 0.78} width={110} height={H} fill={c2} transform={`skewX(-30)`} opacity={0.85} />)}
      <rect y={H * 0.78} width={W} height={10} fill={c3} /></svg>;
  }
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><rect width={W} height={H} fill={c0} />
    <polygon points={`0,${H * 0.62} ${W},${H * 0.38} ${W},${H} 0,${H}`} fill={c1} />
    <Dots W={W} H={H} color={c2} t={t} op={0.55} />
    <rect x={0} y={H * (0.1 + 0.01 * pulse)} width={W} height={18} fill={c3} /></svg>;
}
/** halftone: dot size grows towards the bottom-right, drifting. */
function Dots({ W, H, color, t, op }: { W: number; H: number; color: string; t: number; op: number }) {
  const g = 48, off = (t * 20) % g, out: React.ReactNode[] = [];
  for (let y = -g; y < H + g; y += g) for (let x = -g; x < W + g; x += g) { const r = 3 + 13 * Math.max(0, (x / W + y / H) / 2); out.push(<circle key={x + "_" + y} cx={x + off + ((y / g) % 2 ? g / 2 : 0)} cy={y + off * 0.5} r={r} fill={color} />); }
  return <g opacity={op}>{out}</g>;
}
/** 集中線 (manga speed lines) flickering each frame. */
function SpeedLines({ W, H, t, seed }: { W: number; H: number; t: number; seed: number }) {
  const f = Math.floor(t * 15), cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{Array.from({ length: 70 }, (_, i) => { const h = hash("sl", seed, f, i), a = (h % 3600) / 3600 * 2 * Math.PI, r0 = R * (0.62 + ((h >> 12) % 100) / 400), w = 2 + ((h >> 4) % 7); return <polygon key={i} points={`${cx + Math.cos(a) * R * 1.1},${cy + Math.sin(a) * R * 1.1} ${cx + Math.cos(a + w / 600) * R * 1.1},${cy + Math.sin(a + w / 600) * R * 1.1} ${cx + Math.cos(a) * r0},${cy + Math.sin(a) * r0}`} fill="#111" opacity={0.75} />; })}</svg>;
}
/** manga speech bubble with a tail pointing at (tx,ty). */
function Bubble({ x, y, tx, ty, text, s, color }: { x: number; y: number; tx: number; ty: number; text: string; s: number; color: string }) {
  const w = 110 + Array.from(text).length * 34, h = 120;
  return <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width={1} height={1}>
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon points={`${-20},${h * 0.3} ${20},${h * 0.3} ${tx - x},${ty - y}`} fill="#fff" stroke="#111" strokeWidth={7} strokeLinejoin="round" />
      <ellipse rx={w / 2} ry={h / 2} fill="#fff" stroke="#111" strokeWidth={7} />
      <polygon points={`${-16},${h * 0.3} ${16},${h * 0.3} ${(tx - x) * 0.92},${(ty - y) * 0.92}`} fill="#fff" />
      <text textAnchor="middle" dominantBaseline="central" fontSize={54} fontWeight={900} fill={color} stroke="#111" strokeWidth={3} style={{ fontFamily: "'M PLUS Rounded 1c','Noto Sans JP',sans-serif" }}>{text}</text>
    </g></svg>;
}
/** falling confetti / music notes, stepped at ANIM_FPS. */
function Particles({ W, H, t, colors }: { W: number; H: number; t: number; colors: string[] }) {
  return <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{Array.from({ length: 26 }, (_, i) => { const h = hash("pt", i), sp = 60 + (h % 90), x = ((h >> 8) % 1000) / 1000 * W + Math.sin(t * 2 + i) * 20, y = ((((h >> 4) % 1000) / 1000) * (H + 80) + t * sp) % (H + 80) - 40, r = (t * 90 + i * 40) % 360;
    return i % 3 ? <rect key={i} x={x} y={y} width={18} height={9} fill={colors[i % colors.length]} stroke="#111" strokeWidth={2} transform={`rotate(${r} ${x} ${y})`} /> : <text key={i} x={x} y={y} fontSize={40} fontWeight={900} fill={colors[i % colors.length]} stroke="#111" strokeWidth={2}>♪</text>; })}</svg>;
}
// ---- v5: ほしあき-style direction ------------------------------------------------------------------------
// Studied from /workspace/ref (dense 2fps sheets): hard CUTS instead of camera easing; layout changes every 1-2 beats in the
// chorus (duo / bust close-up / clones row / split panels / inverted / letterbox); huge black keyword kanji BEHIND the
// character; vertical (tategaki) lines in jagged black balloons next to the singer; small sticker bubbles cloned in corners;
// concentric rings + speed lines; letterbox bars with a framed subtitle. Everything held, changing on beats (2s).
export type Layout = "duo" | "closeA" | "closeB" | "clones" | "split" | "invert" | "letterbox";
const CHORUS_LAYOUT: [Layout, number][] = [["duo", 2], ["closeA", 1], ["closeB", 1], ["clones", 2], ["split", 2], ["duo", 1], ["invert", 1], ["closeB", 2], ["letterbox", 2], ["closeA", 1], ["split", 1], ["clones", 1], ["invert", 1]];
const VERSE_LAYOUT: [Layout, number][] = [["duo", 8], ["letterbox", 4], ["closeA", 4], ["duo", 8], ["closeB", 4], ["split", 4]];
export function layoutAt(beatIdx: number, chorus: boolean, intro: boolean): Layout {
  if (intro) return "duo";
  const L = chorus ? CHORUS_LAYOUT : VERSE_LAYOUT, tot = L.reduce((a, x) => a + x[1], 0); let b = ((beatIdx % tot) + tot) % tot;
  for (const [l, n] of L) { if (b < n) return l; b -= n; } return "duo";
}
export type LyricMode = "bigBehind" | "tate" | "band" | "ghost" | "pop" | "center";
const MODES: LyricMode[] = ["tate", "bigBehind", "band", "pop", "ghost", "tate", "center", "bigBehind"];
/** v5.3: ONE style per lyric line, locked by line index (never by the current cut/layout). */
export const lyricModeOf = (i: number, _layout?: Layout): LyricMode => MODES[i % MODES.length];
/** v6.2: vertical-text columns: split at spaces/、 only; a column longer than 8 chars is split once more right after ・ (never mid-word). */
export function vertCols(text: string): string[] {
  const out: string[] = [];
  for (const c of text.split(/[\s　、]/).filter(Boolean)) { const a = Array.from(c), dot = a.indexOf("・"); if (a.length > 8 && dot > 0 && dot < a.length - 1) out.push(a.slice(0, dot + 1).join(""), a.slice(dot + 1).join("")); else out.push(c); }
  return out;
}
const KANJI = /[\u4e00-\u9fff\u30a0-\u30ffー]+/g;
export const keywordOf = (text: string) => (text.replace(/（.*?）|\(.*?\)/g, "").match(KANJI) ?? []).sort((a, b) => b.length - a.length)[0] ?? "";
const JP = "'Noto Sans JP','M PLUS Rounded 1c','Hiragino Sans',sans-serif", MIN = "'Noto Serif JP','Yu Mincho','Hiragino Mincho ProN',serif";
/** stepped reveal: how many characters are visible (12fps, char by char over 70% of the line). */
const revealN = (l: LyricLite, t: number, n: number) => { const tq = Math.floor(t * ANIM_FPS) / ANIM_FPS; return Math.max(1, Math.min(n, Math.ceil(((tq - l.start) / Math.max(0.2, (l.end - l.start) * 0.7)) * n))); };
/** v5.6: balloon size for vertical text: content (cols x maxLen) must fit the safe box; shrink font if the balloon would exceed 34%W x 86%H. */
export function tateBox(nCols: number, maxLen: number, fs0: number, W: number, H: number, SAFE = 0.6, CH = 1.12, CW = 1.45, WF = 0.34) {
  const cw = (f: number) => (nCols * CW - (CW - 1)) * f + f * 0.6, chh = (f: number) => maxLen * f * CH + f * 0.6;
  const fs = Math.min(fs0, (W * WF * SAFE) / ((nCols * CW - (CW - 1)) + 0.6), (H * 0.86 * SAFE) / (maxLen * CH + 0.6));
  return { fs, w: cw(fs) / SAFE, h: chh(fs) / SAFE, contentW: cw(fs), contentH: chh(fs) };
}
function Balloon({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: React.ReactNode }) {
  const pts = Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * 2 * Math.PI, r = i % 2 ? 0.86 : 1.08; return `${w / 2 + Math.cos(a) * w / 2 * r},${h / 2 + Math.sin(a) * h / 2 * r}`; }).join(" ");
  return <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h }}><svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}><polygon points={pts} fill="#111" stroke="#fff" strokeWidth={6} /></svg>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div></div>;
}
/** lines visible at t (short hold after end, cut off at the next line's start) -> never two lines at once. */
export const visibleLines = (lyrics: LyricLite[], t: number) => lyrics.filter((l, i) => t >= l.start && t < Math.min(l.end + 0.1, lyrics[i + 1]?.start ?? Infinity));
/** lyrics drawn INSIDE the stage so they can sit behind the characters. returns [behind, front]. */
function stageLyrics(st: TachieStage, lyrics: LyricLite[], t: number, W: number, H: number, layout: Layout): [React.ReactNode[], React.ReactNode[]] {
  const back: React.ReactNode[] = [], front: React.ReactNode[] = [];
  /* v6.5: built-in look = default; the editor's per-line edits (l.edited, diffed against original-source) always win. Untouched lines render exactly as before. */
  const wrap = (l: any, el: React.ReactNode, ax: number, ay: number) => {
    const ed: string[] = Array.isArray(l.edited) ? l.edited : [], has = (k: string) => ed.includes(k);
    if (!["position", "y", "scale", "angle", "effect", "effectOffset", "entrance", "departure", "transitionDuration"].some(has)) return el;
    const pxy = has("position") && l.position && l.position !== "manual" ? POSITION_XY[l.position] : undefined;
    const tx = pxy ? pxy[0] * W : ax, ty = pxy ? pxy[1] * H : has("y") && Number.isFinite(l.y) ? l.y * H : ay;
    const k = has("scale") && Number.isFinite(l.scale) ? l.scale / 0.72 : 1, ang = has("angle") ? l.angle ?? 0 : 0;
    return <div key={l.id} style={{ position: "absolute", inset: 0, transformOrigin: `${ax}px ${ay}px`, transform: `translate(${tx - ax}px,${ty - ay}px) rotate(${ang}deg) scale(${k})`, filter: has("effect") || has("effectOffset") ? effectFilter(l.effect ?? "none", l.effectOffset ?? 6) : undefined }}>{combined(el, l, t, ax, ay, W, H)}</div>;
  };
  for (const l of lyrics) {
    const i = lyrics.indexOf(l), next = lyrics[i + 1]?.start ?? Infinity, hold = Math.min(l.end + 0.1, next); // short hold, but never overlapping the next line
    if (!(t >= l.start && t < hold)) continue;
    if (wantsEditorMotion(l)) continue; // drawn by the editor's normal motion renderer (モーションの見本 picked for this line)
    const ed: string[] = Array.isArray((l as any).edited) ? (l as any).edited : [], lx = l as any;
    const FILL = ed.includes("fill") ? lx.fill : undefined, STROKE = ed.includes("stroke") ? lx.stroke : undefined, ACC = ed.includes("accent") ? lx.accent : undefined;
    const FONT = ed.includes("font") ? FONT_OPTIONS.find((f: any) => f.id === lx.font)?.family : undefined, FJP = FONT ? `'${FONT}',${JP}` : JP, FMIN = FONT ? `'${FONT}',${MIN}` : MIN;
    const text = l.text.replace(/（.*?）|\(.*?\)/g, ""), chars = Array.from(text), n = revealN(l, t, chars.length), shown = chars.slice(0, n).join("");
    const mode = (lx.stageStyle && lx.stageStyle !== "auto" && STAGE_STYLES[lx.stageStyle] ? lx.stageStyle : lyricModeOf(i, layout)) as LyricMode, kw = keywordOf(text), [c0, c1, c2, c3] = st.palette;
    const singer = singersOf(st, lyrics, l).map((id) => st.chars.find((c) => c.id === id)!).filter(Boolean)[0] ?? st.chars[0];
    const sideX = singer.x < 0.5 ? Math.min(W * 0.47, singer.x * W + W * 0.2) : Math.max(W * 0.53, singer.x * W - W * 0.2);
    const trio = st.chars.length >= 3 && (layout === "duo" || layout === "invert" || layout === "letterbox"), xs = st.chars.map((c) => c.x).sort((a, b) => a - b);
    const gap = singer.x <= xs[0] + 1e-6 ? (xs[0] + xs[1]) / 2 : (xs[xs.length - 2] + xs[xs.length - 1]) / 2; // v5.7: three on stage -> balloon sits in the gap next to the singer, never on a face
    const tsplit = st.chars.length >= 3 && layout === "split", seam = singer.x <= xs[0] + 1e-6 ? 0.335 : 0.64;
    const clo = st.chars.length >= 3 && layout === "clones"; // v5.8: row of three (black centre + cafe sides, or three copies) -> balloon in the gap beside the centre figure
    const closeUp = false, bx2 = clo ? W * (singer.x < 0.5 ? 0.34 : 0.66) : trio ? W * gap : tsplit ? W * seam : singer.x < 0.5 ? W * 0.14 : W * 0.86; void sideX; // fixed per line: screen edge on the singer's side (also clear of close-up faces) // never over a close-up face
    const stroke = (c: string, wpx: number) => ({ WebkitTextStroke: `${wpx}px ${STROKE ?? c}`, paintOrder: "stroke fill" } as any);
    if (mode === "bigBehind") { // v5.2: the WHOLE line (once) huge behind the characters, two rows split at the space; keyword in mincho
      const rows = text.split(/[　\s]/).filter(Boolean); let k = 0;
      back.push(wrap(l, <div key={l.id} style={{ position: "absolute", left: 0, right: 0, top: H * 0.06, textAlign: "center", fontFamily: FJP, fontWeight: 900, lineHeight: 1.02, color: FILL ?? "#111", opacity: 0.82 }}>{rows.map((r, j) => { const a2 = Array.from(r), m = Math.max(0, Math.min(a2.length, n - k)); k += a2.length + 1; return <div key={j} style={{ fontSize: Math.min(H * 0.36, (W * 0.92) / Math.max(1, a2.length)), whiteSpace: "nowrap" }}>{a2.slice(0, m).join("") || "\u00a0"}</div>; })}</div>, W / 2, H * 0.3));
    } else if (mode === "tate") { // vertical text in a jagged black balloon beside the singer's head
      // v5.6: measure every column of the FULL line first; text box = inscribed rectangle of the balloon (spikes excluded) + padding
      const cols = text.split(/[　\s、]/).filter(Boolean), maxLen = Math.max(1, ...cols.map((c) => Array.from(c).length)); let k = 0;
      const colsShown = cols.map((c) => { const a = Array.from(c), m = Math.max(0, Math.min(a.length, n - k)); k += a.length + 1; return a.slice(0, m).join(""); });
      const SAFE = 0.6, CH = 1.12, CW = 1.45; // safe-box / balloon ratio (inner spikes r=0.86 -> inscribed rect ~0.61); per-char height; per-column width
      const box = tateBox(cols.length, maxLen, H * 0.06, W, H, SAFE, CH, CW, trio ? 0.24 : tsplit || clo ? 0.2 : 0.34), fs = box.fs, w = box.w, h = box.h;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, bx2)), y = Math.max(h / 2 + 12, Math.min(H - h / 2 - 12, H * 0.42));
      front.push(wrap(l, <Balloon key={l.id} x={x} y={y} w={w} h={h}><div style={{ display: "flex", flexDirection: "row-reverse", gap: fs * (CW - 1), alignItems: "flex-start", height: maxLen * fs * CH }}>{colsShown.map((c, j) => <div key={j} style={{ writingMode: "vertical-rl", fontFamily: FJP, fontWeight: 900, fontSize: fs, lineHeight: 1, letterSpacing: fs * (CH - 1), color: FILL ?? "#fff", whiteSpace: "nowrap", width: fs, height: maxLen * fs * CH, textOrientation: "upright" as any }}>{c}</div>)}</div></Balloon>, x, y));
    } else if (mode === "band") { // letterbox subtitle
      front.push(wrap(l, <div key={l.id} style={{ position: "absolute", left: W * 0.1, right: W * 0.1, bottom: H * 0.02, height: H * 0.1, background: "#fff", border: `6px solid ${ACC ?? c3}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FJP, fontWeight: 900, fontSize: H * 0.058, color: FILL ?? "#111" }}>{shown}</div>, W / 2, H * 0.93));
    } else if (mode === "ghost") { // huge diagonal front text, semi-transparent so faces read through
      front.push(wrap(l, <div key={l.id} style={{ position: "absolute", left: -W * 0.05, right: -W * 0.05, top: H * 0.3, textAlign: "center", transform: "rotate(-9deg)", fontFamily: FJP, fontWeight: 900, fontSize: Math.min(H * 0.3, (W * 1.0) / Math.max(4, chars.length)), color: FILL ?? "#fff", opacity: 0.6, ...stroke("#111", 8), whiteSpace: "nowrap" }}>{shown}</div>, W / 2, H * 0.45));
    } else if (mode === "pop") { // v5.2: one line at the bottom, keyword enlarged INLINE (no second copy)
      const at = kw ? text.indexOf(kw) : -1, parts = at >= 0 ? [text.slice(0, at), kw, text.slice(at + kw.length)] : [text, "", ""]; let k = 0;
      front.push(wrap(l, <div key={l.id} style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.05, textAlign: "center", fontFamily: FJP, fontWeight: 900, color: FILL ?? "#fff", ...stroke("#111", 10), whiteSpace: "nowrap", transform: "rotate(-3deg)" }}>{parts.map((pt, j) => { const a2 = Array.from(pt), m = Math.max(0, Math.min(a2.length, n - k)); k += a2.length; return <span key={j} style={{ fontSize: H * (j === 1 ? 0.13 : 0.065), fontFamily: j === 1 ? FMIN : FJP, color: j === 1 ? ACC ?? c1 : FILL ?? "#fff" }}>{a2.slice(0, m).join("")}</span>; })}</div>, W / 2, H * 0.88));
    } else { // center: vertical stack between the characters. v6.2: explicit columns broken only at word boundaries (space / 、 / after ・), tops aligned, font shrinks to fit
      const cols = vertCols(text), maxLen = Math.max(1, ...cols.map((c) => Array.from(c).length)), fs = Math.min(H * 0.075, (H * 0.84) / (maxLen * 1.08)); let k = 0;
      const shownCols = cols.map((c) => { const a = Array.from(c), m = Math.max(0, Math.min(a.length, n - k)); k += a.length; return a.slice(0, m).join(""); });
      const cxw = W * (clo ? (singer.x < 0.5 ? 0.34 : 0.66) : trio ? gap : tsplit ? seam : 0.5);
      front.push(wrap(l, <div key={l.id} style={{ position: "absolute", left: cxw, top: H * 0.5, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "row-reverse", alignItems: "flex-start", gap: fs * 0.25 }}>{shownCols.map((c, j) => <div key={j} style={{ writingMode: "vertical-rl", fontFamily: FMIN, fontWeight: 900, fontSize: fs, lineHeight: 1.15, letterSpacing: fs * 0.08, color: /^ヘンドレ/.test(cols[j]) ? ACC ?? c3 : FILL ?? "#fff" /* v6.2: name in the scene accent (same as the Hey! text) */, ...stroke("#111", 10), whiteSpace: "nowrap", height: maxLen * fs * 1.08 }}>{c}</div>)}</div>, cxw, H * 0.5));
    }
  }
  return [back, front];
}
export function TachieStage({ st, t: t0raw, t0, data, base = "", W, H }: { st: TachieStage; t: number; t0: number; data: any; base?: string; W: number; H: number }) {
  const beat: Beat = { bpm: data.bpm ?? 120, phase: data.phase ?? 0, beatsPerBar: 4 }, B = beatLen(beat);
  // v5.1: everything (dance, camera, bg, bubbles, lyrics) stops at the end of the LAST LYRIC; final kime snaps there, then a still to the song end
  if (st.pause) return <PauseStage st={st} t={t0raw} data={data} base={base} W={W} H={H} beat={beat} />;
  const lyrics: LyricLite[] = lyricsInWin(data.lyrics ?? [], st.win); // v6.0: each loop's stages only see their own lines
  const end: number | undefined = stopTimeOf(lyrics, Number.isFinite(data.duration) ? Math.min(data.duration, st.win?.[1] ?? Infinity) : (data.sections ?? []).at?.(-1)?.end, st.stopAt, data.fps ?? 30);
  const vocal = shiftVocal(st.vocal, st.win?.[0] ?? 0);
  const t = freezeT(t0raw, beat, end), frozen = end != null && t0raw >= lastBeatOf(beat, end), tL = Math.min(t0raw, t); void tL;
  const sec = (data.sections ?? []).find((s: any) => t >= s.start && t < s.end) ?? (data.sections ?? []).at?.(-1);
  const chorus = sec ? /chorus|サビ/i.test(sec.type + sec.label) : !!st.punch, intro = !!sec && /intro|イントロ/i.test(sec.type + sec.label);
  const live = lyrics.filter((l) => t >= l.start - 0.05 && t < l.end + 0.05 && !frozen);
  const bx = (t - beat.phase) / B, bi = Math.floor(bx), bar = Math.floor(bx / 4), beatIn = bx - bi;
  const sinceSec = Math.floor((t - t0) / B), layout: Layout = frozen ? "duo" : t - t0 < 4 * B ? "duo" : layoutAt(sinceSec, chorus, intro);
  const bgs = st.bgs?.length ? st.bgs : [st.bg], kind = bgs[((bar % bgs.length) + bgs.length) % bgs.length];
  const seed = hash("stage", t0), cam = stageCamera(st, t, t0, beat, chorus, seed);
  const singNow = live.flatMap((l) => singersOf(st, lyrics, l));
  const focusA = st.chars.find((c) => singNow.includes(c.id)) ?? st.chars[bar % st.chars.length], focusB = st.chars.find((c) => c !== focusA) ?? focusA;
  const silhouette = chorus && !frozen && ((bar % 8) + 8) % 8 === 7 && bi % 4 === 3;
  const bubbles: React.ReactNode[] = [];
  const poses = new Map(st.chars.map((c) => { const mine = live.filter((l) => singersOf(st, lyrics, l).includes(c.id)), singing = mine.length > 0 && !frozen;
    return [c.id, solveChar(c, { t, beat, chorus, singing, mora: mine.flatMap((l) => moraOf({ ...l, text: st.readings?.[l.text] ?? l.text })), seed: hash(c.id) % 1000, section: sec ? String(sec.type ?? sec.label) : undefined, vocal, end })]; }));
  /** one puppet at stage position (x = centre fraction, h = height fraction, y = feet fraction). */
  const puppet = (c: TachieChar, key: string, x0: number, h0: number, y0: number, i: number, extra = "", poseOv?: Record<string, PartPose>) => {
    { const e = c as any; if (e.hide) return null; if (e.dx) x0 += e.dx; if (e.dy) y0 += e.dy; if (e.k && e.k !== 1) h0 *= e.k; } // v6.6 editor: per-cut character offset / size / hide (applies in every layout)
    const sc = (H * h0) / c.rig.size[1], w = c.rig.size[0] * sc;
    const pt = Math.floor((t - t0 - i * 0.15) * ANIM_FPS) / ANIM_FPS, pp = clamp01(pt / 0.3), pop = pp <= 0 ? 0 : pp < 0.5 ? 0.6 : pp < 1 ? 1.12 : 1;
    if (pop <= 0) return null;
    const f = pop === 0.6 ? 0.85 : pop > 1 ? 1.06 : 1, Hs = c.rig.size[1] * sc, x = x0 * W - w / 2, y = H * y0 - Hs + (1 - Math.min(1, pop)) * H * 0.5;
    return <div key={key} style={{ position: "absolute", left: x, top: y, width: c.rig.size[0], height: c.rig.size[1], transformOrigin: "0 0", transform: `translate(0px,${Hs * (1 - f)}px) scale(${sc * (c.flip ? -1 : 1)},${sc * f})`, filter: (silhouette && layout !== "invert" ? "brightness(0) " : "") + extra + "drop-shadow(5px 0 0 #fff) drop-shadow(-5px 0 0 #fff) drop-shadow(0 5px 0 #fff) drop-shadow(0 -5px 0 #fff) drop-shadow(14px 14px 0 rgba(0,0,0,.45))" }}>
      <Puppet c={c} pose={poseOv ?? poses.get(c.id)!} base={base} /></div>;
  };
  const layoutNow = layout;
  for (const c of st.chars) { if (st.bubbles === false) break; for (const l of live.filter((l) => singersOf(st, lyrics, l).includes(c.id))) { const call = l.text.match(/[（(]([^）)]+)[）)]/)?.[1]; const tc = l.end - 0.75; if (call && t > tc) {
    // sticker clones: the call pops in all four corners, one more each 2 frames
    const k = Math.floor((t - tc) * ANIM_FPS / 2) + 1; (layoutNow === "clones" ? [[0.1, 0.11], [0.9, 0.11]] : [[0.14, 0.18], [0.86, 0.2], [0.12, 0.8], [0.88, 0.78]]).slice(0, k).forEach(([sx, sy], j) => bubbles.push(<Bubble key={c.id + l.id + j} x={sx * W} y={sy * H} tx={sx * W + (sx < 0.5 ? 60 : -60)} ty={sy * H + 70} text={call} s={0.9} color={st.palette[3]} />)); } } }
  const [lyrBack, lyrFront] = stageLyrics(st, lyrics, t, W, H, layout);
  const bgEl = (k2 = kind, pal?: string[]) => <Bg st={pal ? { ...st, palette: pal } : st} t={t} W={W} H={H} beat={beat} chorus={chorus} kind={k2} bar={bar} />;
  let scene: React.ReactNode;
  if (layout === "closeA" || layout === "closeB") { // hard cut to a bust shot of the singer (or the other one), rings behind
    const c = layout === "closeA" ? focusA : focusB;
    scene = <>{bgEl("rings")}{lyrBack}{puppet(c, "close", 0.5, 1.75, 1.62, 0)}</>;
  } else if (layout === "clones") { // the singer copied in a row, alternately mirrored
    const blk = st.chars.find((c) => c.id === "black"), cafe = st.chars.find((c) => c.id === "cafe");
    if (blk && cafe && focusA === blk) { // v5.8: black in the centre, the cafe girl on both sides (not mirrored so the CAFE MONDAY logo stays readable; right one dances half a beat late; lips stay on time)
      const cafeLate = { ...solveChar(cafe, { t: t - B / 2, beat, chorus, singing: false, mora: [], seed: (hash("cafe") + 77) % 1000, section: sec ? String(sec.type ?? sec.label) : undefined, vocal, end }) };
      const on = poses.get(cafe.id)!; for (const p of cafe.rig.parts) if (p.kind === "mouth") cafeLate[p.id] = on[p.id];
      scene = <>{bgEl("checker")}{lyrBack}
        <div key="cl0" style={{ position: "absolute", inset: 0 }}>{puppet(cafe, "cl0", 0.18, 0.64, 1.0, 0)}</div>
        <div key="cl2" style={{ position: "absolute", inset: 0 }}>{puppet(cafe, "cl2", 0.82, 0.64, 1.0, 0, "", cafeLate)}</div>
        <div key="cl1" style={{ position: "absolute", inset: 0 }}>{puppet(blk, "cl1", 0.5, 0.8, 1.0, 0)}</div></>;
    } else
    scene = <>{bgEl("checker")}{lyrBack}{[0.18, 0.5, 0.82].map((x, j) => <div key={j} style={{ position: "absolute", inset: 0, transform: j === 1 ? undefined : `scaleX(-1)`, transformOrigin: `${x * W}px 0` }}>{puppet(focusA, "cl" + j, x, j === 1 ? 0.8 : 0.62, 1.0, 0)}</div>)}</>;
  } else if (layout === "split") { // diagonal split panels, each character in its own colour panel
    const p2 = [st.palette[1], st.palette[0], st.palette[3], st.palette[2]];
    if (st.chars.length >= 3) { // v5.7: three slanted panels, one dancer each (screen order), seams in white+black
      const ord = [...st.chars].sort((p, q) => p.x - q.x), P = [[0, 0, 38, 28], [38, 28, 69, 59], [69, 59, 100, 100]], ks = ["stripes", "halftone", "checker"];
      scene = <>{ord.map((c, j) => { const [a1, b1, a2, b2] = P[j]; return <div key={j} style={{ position: "absolute", inset: 0, clipPath: `polygon(${a1}% 0,${a2}% 0,${b2}% 100%,${b1}% 100%)` }}>{bgEl(ks[j], j === 1 ? [st.palette[1], st.palette[0], st.palette[3], st.palette[2]] : undefined)}{puppet(c, "s" + j, ((a1 + a2 + b1 + b2) / 4) / 100, 0.8, 1.02, j)}</div>; })}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{[[38, 28], [69, 59]].map(([u, v], j) => <g key={j}><line x1={W * u / 100} y1={0} x2={W * v / 100} y2={H} stroke="#fff" strokeWidth={22} /><line x1={W * u / 100} y1={0} x2={W * v / 100} y2={H} stroke="#111" strokeWidth={8} /></g>)}</svg><div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>{lyrBack}</div></>;
    } else
    scene = <><div style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0,58% 0,42% 100%,0 100%)" }}>{bgEl("stripes")}{puppet(st.chars[0], "s0", 0.25, 0.85, 1.02, 0)}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: "polygon(58% 0,100% 0,100% 100%,42% 100%)" }}>{bgEl("halftone", p2)}{puppet(st.chars[1] ?? st.chars[0], "s1", 0.75, 0.85, 1.02, 1)}</div>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}><line x1={W * 0.58} y1={0} x2={W * 0.42} y2={H} stroke="#fff" strokeWidth={22} /><line x1={W * 0.58} y1={0} x2={W * 0.42} y2={H} stroke="#111" strokeWidth={8} /></svg><div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>{lyrBack}</div></>;
  } else { // duo / invert / letterbox
    scene = <>{bgEl()}{(chorus || kind === "shapes") && <Particles W={W} H={H} t={t} colors={st.palette} />}{lyrBack}{st.chars.map((c, i) => puppet(c, c.id, c.x, c.h, c.y ?? 1, i))}</>;
  }
  const flash = chorus && !frozen && bi % 4 === 0 && beatIn * B < 2 / ANIM_FPS;
  const wipe = clamp01((t - t0) / 0.35), wq = Math.floor(wipe * 6) / 6;
  const zoomed = layout !== "duo" && layout !== "invert" && layout !== "letterbox";
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", filter: layout === "invert" ? "invert(1) hue-rotate(180deg)" : undefined }}>
    <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 55%", transform: zoomed ? undefined : `translate(${cam.dx}px,${cam.dy}px) rotate(${cam.r}deg) scale(${cam.s})` }}>
      {scene}
      {silhouette && <div style={{ position: "absolute", inset: 0, background: st.palette[1], mixBlendMode: "multiply", opacity: 0.6 }} />}
    </div>
    {st.lines !== false && (chorus || layout === "closeA" || layout === "closeB") && layout !== "split" && <SpeedLines W={W} H={H} t={t} seed={seed} />}
    {layout === "letterbox" && <><div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H * 0.11, background: "#111" }} /><div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.14, background: "#111" }} /></>}
    {floaters(st, t, beat, W, H, base, frozen)}
    {st.guests && <GuestLayer G={st.guests} t={t} beat={beat} W={W} H={H} base={base} stop={end} layout={layout} />}
    {lyrFront}
    {bubbles}
    {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.55 }} />}
    {wq < 1 && <div style={{ position: "absolute", inset: 0, background: st.palette[2], clipPath: `polygon(${wq * 130}% 0, 130% 0, 130% 100%, ${wq * 130 - 30}% 100%)` }} />}
  </div>;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** v5.8: seal / puppy stickers floating in lyric-free corners for a few sections each. Stepped bob at 12fps (on twos), frame swaps per beat + blinks. Drawn under the lyrics. */
function floaters(st: TachieStage, t: number, beat: Beat, W: number, H: number, base: string, frozen: boolean) {
  const fl = st.floaters; if (!fl?.items?.length) return null;
  return <>{fl.items.flatMap((it) => { const r = floaterAt(it, t, beat); if (!r) return [];
    const ow = Math.max(3, Math.round(H * 0.0042)); void frozen;
    return [<img key={it.id} src={base + (fl.base ?? "") + it.frames[r.frame]} draggable={false} style={{ position: "absolute", left: r.x * W, top: r.y * H, height: it.h * H * r.s, transform: `translate(-50%,-50%) rotate(${r.rot}deg)`, transformOrigin: "50% 50%",
      filter: `drop-shadow(${ow}px 0 0 #fff) drop-shadow(-${ow}px 0 0 #fff) drop-shadow(0 ${ow}px 0 #fff) drop-shadow(0 -${ow}px 0 #fff) drop-shadow(${ow * 2.5}px ${ow * 2.5}px 0 rgba(0,0,0,.45))` }} />]; })}</>;
}

// ---- v6.0 guests --------------------------------------------------------------------------------------------
const GJP = "'Noto Sans JP','M PLUS Rounded 1c','Hiragino Sans',sans-serif";
const q12 = (t: number) => Math.floor(t * ANIM_FPS + 1e-6) / ANIM_FPS;
/** one guest sticker: bottom-centre at (cx, by) in px, height h px; frame switches on the beat (pattern). Art already has its white outline -> only the drop shadow is added. */
function GuestImg({ G, id, t, beat, cx, by, h, base, rot = 0, flip = false, scale = 1, cy }: { G: any; id: string; t: number; beat: Beat; cx: number; by: number; h: number; base: string; rot?: number; flip?: boolean; scale?: number; cy?: boolean }) {
  const it = G.items[id]; if (!it) return null; const [w0, h0] = G.sizes?.[id] ?? [1, 1], w = (h * w0) / h0;
  const bi = Math.floor((q12(t) - beat.phase) / beatLen(beat)), pat: string[] = it.pattern ?? Object.keys(it.frames), f = it.frames[pat[((bi % pat.length) + pat.length) % pat.length]] ?? Object.values(it.frames)[0];
  const top = cy ? by - h / 2 : by - h;
  return <img src={base + (G.base ?? "") + f} draggable={false} style={{ position: "absolute", left: cx - w / 2, top, width: w, height: h, transformOrigin: cy ? "50% 50%" : "50% 100%", transform: `rotate(${rot}deg) scale(${scale * (flip ? -1 : 1)},${scale})`, filter: "drop-shadow(10px 10px 0 rgba(0,0,0,.4))" }} />;
}
/** stepped pop: 0 before t0, then 0.55 -> 1.12 -> 1 over three drawings (12fps). */
const popAt = (t: number, t0: number) => { const f = Math.floor((t - t0) * ANIM_FPS + 1e-6); return t < t0 ? 0 : f <= 0 ? 0.55 : f === 1 ? 1.12 : 1; };
/** "GUEST <name>" telop in the MV lyric style (heavy JP, white with black stroke, colour tag), revealed char by char at 12fps. */
function GuestTelop({ name, t, t0, x, y, H, accent, G }: { name: string; t: number; t0: number; x: number; y: number; H: number; accent: string; G?: any }) {
  if (G?.tagsOff) return null; accent = G?.tagColor ?? accent; const tag = G?.tag ?? "GUEST", k = G?.tagSize ?? 1; H = H * k;
  if (t < t0) return null; const ch = Array.from(name), n = Math.min(ch.length, Math.floor((t - t0) * ANIM_FPS / 1) + 1);
  return <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%) rotate(-4deg)", display: "flex", flexDirection: "column", alignItems: "center", gap: H * 0.004, whiteSpace: "nowrap" }}>
    {tag !== "" && <span style={{ background: "#111", color: accent, fontFamily: GJP, fontWeight: 900, fontSize: H * 0.032, padding: `${H * 0.004}px ${H * 0.012}px`, border: "4px solid #fff", letterSpacing: 2 }}>{tag}</span>}
    <span style={{ fontFamily: GJP, fontWeight: 900, fontSize: H * 0.07, color: "#fff", WebkitTextStroke: "10px #111", paintOrder: "stroke fill" } as any}>{ch.slice(0, n).join("")}</span></div>;
}
/** loop 2 overlay: Dalmei name telop, beat peek-ins from the side edges, final group shot at the dancers' feet. */
function GuestLayer({ G, t, beat, W, H, base, stop, layout }: { G: any; t: number; beat: Beat; W: number; H: number; base: string; stop?: number; layout?: string }) {
  const out: React.ReactNode[] = [], B = beatLen(beat), tq = q12(t);
  if (G.off) return null; // v6.6 editor: all guests off
  const on = (id: string) => !G.items?.[id]?.off, gk = (id: string) => G.items?.[id]?.scale ?? 1; // per-guest on/off and size
  if (G.dalmeiTelop && !G.dalmeiTelop.off && on("dalmei") && t >= G.dalmeiTelop.start && t < G.dalmeiTelop.end) out.push(<GuestTelop key="dt" G={G} name={G.items.dalmei?.name ?? "ダルメイ"} t={t} t0={G.dalmeiTelop.start} x={W * (G.dalmeiTelop.x ?? 0.5)} y={H * (G.dalmeiTelop.y ?? 0.9)} H={H} accent="#ffd400" />);
  for (const [j, nt] of (G.telops ?? []).entries()) if (!nt.off && t >= nt.start && t < nt.end) out.push(<GuestTelop key={"nt" + j} G={G} name={nt.text ?? G.items?.[nt.id]?.name ?? ""} t={t} t0={nt.start} x={W * (nt.x ?? 0.5)} y={H * (nt.y ?? 0.9)} H={H} accent="#ffd400" />); // extra name telops added in the editor
  const groupOn = stop != null && t >= stop - 0.5 && !G.groupOff;
  const edgeFree = !layout || layout === "duo" || layout === "invert" || layout === "letterbox"; // peeks only when the screen edges are clear of dancers (not in close-ups / split / clone rows)
  if (!groupOn && (edgeFree || G.peeksAnyCut) && !G.peeksOff) for (const p of G.peeks ?? []) { const d = (p.beats ?? 2) * B; if (p.off || !on(p.id) || tq < p.t || tq >= p.t + d) continue;
    const f = Math.floor((tq - p.t) * ANIM_FPS + 1e-6), last = Math.floor(d * ANIM_FPS) - 1, v = f === 0 || f === last ? 0.5 : 1; // slide in 2 drawings, hold, slide out
    // v6.1 entry directions: l / r (side, pos = y), t (hangs upside-down from the top, pos = x), b (rises from the bottom, pos = x), tl/tr/bl/br (diagonal from a corner)
    const dir: string = p.dir ?? p.side ?? "l", corner = dir.length === 2, h = H * (corner ? 0.26 : 0.3) * (p.scale ?? 1) * gk(p.id), [w0, h0] = G.sizes?.[p.id] ?? [1, 1], w = (h * w0) / h0, pos = p.pos ?? p.y ?? 0.5;
    let cx = 0, cy = 0, rot = 0;
    if (dir === "l" || dir === "r") { const show = Math.min(0.62 * w, W * 0.085) * v; cx = dir === "l" ? -w / 2 + show : W + w / 2 - show; cy = H * pos; rot = p.id === "snowmen" ? 0 : dir === "l" ? 14 : -14; }
    else if (dir === "t" || dir === "b") { const show = Math.min(0.7 * h, H * 0.2) * v; cx = W * pos; cy = dir === "t" ? -h / 2 + show : H + h / 2 - show; rot = dir === "t" ? 180 : 0; }
    else { const sx = dir[1] === "l" ? -1 : 1, sy = dir[0] === "t" ? -1 : 1, R = Math.hypot(w, h) / 2, show = Math.min(0.8 * Math.min(w, h), W * 0.11) * v * Math.SQRT2;
      cx = (sx < 0 ? 0 : W) + sx * (R - show) / Math.SQRT2; cy = (sy < 0 ? 0 : H) + sy * (R - show) / Math.SQRT2; rot = dir === "tl" ? 135 : dir === "tr" ? -135 : dir === "bl" ? 45 : -45; }
    out.push(<GuestImg key={"pk" + p.t + dir} G={G} id={p.id} t={t} beat={beat} cx={cx} by={cy} h={h} base={base} cy rot={rot} flip={p.id === "snowmen" ? dir === "l" : dir === "r" || dir === "tr" || dir === "br"} />); }
  if (groupOn) { const k = Math.min(1, Math.max(0, Math.floor((t - (stop! - 0.5)) * ANIM_FPS + 1e-6) / (0.5 * ANIM_FPS))); // gather (stepped rise) and hold from the freeze
    (G.group ?? []).forEach((g: any, i: number) => { const kk = Math.min(1, Math.max(0, k * 1.6 - i * 0.3)); if (kk <= 0 || g.off || !on(g.id)) return; out.push(<GuestImg key={"g" + g.id} G={G} id={g.id} t={Math.min(t, stop!)} beat={beat} cx={W * g.x} by={H * ((g.y ?? 0.995) + (1 - kk) * 0.25)} h={H * g.h * gk(g.id)} base={base} />); }); }
  return <>{out}</>;
}
/** v6.0 interlude between the loops: telop 「次はゲストと一緒に」 then each guest pops in on the beat with a GUEST name telop. */
function PauseStage({ st, t, data, base, W, H, beat }: { st: TachieStage; t: number; data: any; base: string; W: number; H: number; beat: Beat }) {
  const P = st.pause, G = st.guests, B = beatLen(beat), bar = Math.floor((t - beat.phase) / B / 4), tq = q12(t);
  const T0 = P.telopStart ?? P.start, ch = Array.from(String(P.telop ?? "")), n = tq >= (P.telopEnd ?? Infinity) ? 0 : Math.max(0, Math.min(ch.length, Math.floor((tq - T0 - 0.08) * ANIM_FPS) + 1));
  const ty = P.telopY ?? 0.17, tk = P.telopSize ?? 1, GO = G && !G.off; // v6.6 editor: telop text / timing / position / size / colours; guests on-off
  const sizeH: Record<string, number> = { seal: 0.4, puppy: 0.46, snowmen: 0.3, dalmei: 0.5 };
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <Bg st={st} t={t} W={W} H={H} beat={beat} chorus={false} kind={st.bg} bar={bar} />
    {!P.telopOff && !P.bandOff && <div style={{ position: "absolute", left: 0, right: 0, top: H * (P.telopY == null ? 0.07 : ty - 0.1), height: H * 0.2 * tk, background: P.bandColor ?? "#111", transform: "skewY(-3deg)", borderTop: `10px solid ${P.lineColor ?? st.palette[2]}`, borderBottom: `10px solid ${P.lineColor ?? st.palette[2]}` }} />}
    {!P.telopOff && <div style={{ position: "absolute", left: 0, right: 0, top: H * (P.telopY == null && tk === 1 ? 0.17 : ty - 0.1 + 0.1 * tk), transform: "translateY(-50%) rotate(-3deg)", textAlign: "center", fontFamily: P.telopFont ? `'${P.telopFont}',${GJP}` : GJP, fontWeight: 900, fontSize: H * 0.1 * tk, color: P.telopColor ?? "#fff", whiteSpace: "nowrap", WebkitTextStroke: `12px ${P.telopStroke ?? st.palette[3]}`, paintOrder: "stroke fill" } as any}>{ch.slice(0, n).join("")}</div>}
    {GO && (P.intro ?? []).map((g: any) => { const s = popAt(tq, g.t); if (!s || g.off || G.items?.[g.id]?.off) return null; const bob = Math.sin(2 * Math.PI * (tq - g.t) / (2 * B)) * H * 0.01;
      return <React.Fragment key={g.id}><GuestImg G={G} id={g.id} t={t} beat={beat} cx={W * g.x} by={H * (g.y ?? 0.8) + bob} h={H * (sizeH[g.id] ?? 0.3) * (g.scale ?? 1) * (G.items?.[g.id]?.scale ?? 1)} base={base} scale={s} />
        <GuestTelop G={G} name={G.items[g.id]?.name ?? g.id} t={tq} t0={g.t} x={W * g.x} y={H * (g.y == null ? 0.89 : g.y + 0.09)} H={H} accent="#ffd400" /></React.Fragment>; })}
  </div>;
}
