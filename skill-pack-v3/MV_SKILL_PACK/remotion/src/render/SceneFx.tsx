// Shared camera moves + effects for the editor preview AND its MP4 export (the export renders the same <Scene>).
// Pack moves come from Visuals.moveTransform; new/pro moves are defined here. Everything is CSS/SVG (GPU-light).
import React from "react";
import { moveTransform } from "./Visuals";
import { beatPulse, clamp, type Beat } from "../lib/core";

export type Strength = "weak" | "normal" | "strong";
export const STRENGTH: Record<Strength, { label: string; k: number }> = {
  weak: { label: "弱め（自然）", k: 0.45 }, normal: { label: "普通", k: 1 }, strong: { label: "強め", k: 1.6 },
};
export const kOf = (s?: string) => STRENGTH[(s as Strength) ?? "weak"]?.k ?? STRENGTH.weak.k;

const inOut = (p: number) => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }; // easeInOutCubic
const inOutQ = (p: number) => { p = clamp(p); return p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2; }; // quint
const outE = (p: number, k = 4) => 1 - Math.pow(1 - clamp(p), k);
const sm = (p: number) => { p = clamp(p); return p * p * (3 - 2 * p); };

/** raw camera pose: s scale, x/y fraction of W/H, r roll deg, ry yaw deg (2.5D), focus = extra defocus px. */
export interface Pose { s: number; x: number; y: number; r: number; ry?: number; focus?: number }
export interface Ctx { p: number; t: number; t0: number; dur: number; beat: Beat; seed: number; W: number }
type Move = { label: string; group: "基本" | "追加" | "プロ仕様"; f: (c: Ctx) => Pose };
const pack = (id: string, label: string): Move => ({ label, group: "基本", f: c => moveTransform(id, sm(c.p), c.seed, c.W) });
const noise = (t: number, seed: number, f: number) => Math.sin(t * f + seed) * 0.6 + Math.sin(t * f * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * f * 5.1 + seed * 0.3) * 0.1;

export const CAMERA_MOVES: Record<string, Move> = {
  none: { label: "固定（動かさない）", group: "基本", f: () => ({ s: 1, x: 0, y: 0, r: 0 }) },
  sway: { label: "ゆっくり左右（従来）", group: "基本", f: c => ({ s: 1.04, x: 0.03 * Math.sin((c.p - 0.5) * 1.4) * (c.seed % 2 ? -1 : 1), y: 0.01 * Math.sin(c.p * 2), r: 0 }) },
  kb_in: pack("kb_in", "ゆっくり寄る（ケンバーンズ）"), kb_out: pack("kb_out", "ゆっくり引く"),
  drift_l: pack("drift_l", "左へ流す"), drift_r: pack("drift_r", "右へ流す"),
  push: pack("push", "押し込む"), face_push: pack("face_push", "顔へ寄る"), slow_push: pack("slow_push", "ごくゆっくり寄る"),
  zoom_punch: pack("zoom_punch", "ズームパンチ"), whip_l: pack("whip_l", "ウィップ（左から）"), whip_r: pack("whip_r", "ウィップ（右から）"),
  crane_up: pack("crane_up", "クレーンアップ"), shake: pack("shake", "手ぶれ（強）"), parallax: pack("parallax", "パララックス"),
  orbit: { label: "回り込む（オービット風）", group: "追加", f: c => { const a = inOut(c.p) * Math.PI; return { s: 1.12 + 0.03 * Math.sin(a), x: 0.04 * Math.cos(a), y: 0, r: 1.2 * Math.cos(a), ry: -5 * Math.cos(a) }; } },
  diag_push: { label: "斜めに押し込む", group: "追加", f: c => { const e = inOut(c.p); return { s: 1.04 + 0.16 * e, x: 0.03 * e, y: -0.025 * e, r: 0 }; } },
  beat_pulse: { label: "拍でズーム脈動", group: "追加", f: c => ({ s: 1.06 + 0.05 * beatPulse(c.beat, c.t, 0.14), x: 0, y: 0, r: 0 }) },
  dutch: { label: "ダッチ（傾ける）", group: "追加", f: c => ({ s: 1.12, x: 0, y: 0, r: 4 * inOut(c.p) }) },
  rack_focus: { label: "ピント送り（ぼけ→くっきり）", group: "追加", f: c => ({ s: 1.04 + 0.03 * c.p, x: 0, y: 0, r: 0, focus: 7 * (1 - outE(c.p * 1.6, 3)) }) },
  slow_rotate: { label: "ゆっくり回転", group: "追加", f: c => ({ s: 1.14, x: 0, y: 0, r: -2.5 + 5 * inOut(c.p) }) },
  dolly_zoom: { label: "ドリーズーム（めまい）", group: "プロ仕様", f: c => { const e = inOutQ(c.p); return { s: 1.02 + 0.26 * e, x: 0, y: 0, r: 0, ry: 0, focus: 1.5 * Math.sin(e * Math.PI) }; } },
  arc: { label: "スローアーク（弧を描く）", group: "プロ仕様", f: c => { const e = inOut(c.p); return { s: 1.1 + 0.05 * e, x: -0.035 + 0.07 * e, y: 0.01 * Math.sin(e * Math.PI), r: -0.8 + 1.6 * e, ry: 7 - 14 * e }; } },
  handheld: { label: "手持ち（自然な微揺れ）", group: "プロ仕様", f: c => ({ s: 1.08, x: 0.006 * noise(c.t, c.seed, 1.3), y: 0.005 * noise(c.t, c.seed + 3, 1.1), r: 0.35 * noise(c.t, c.seed + 7, 0.9) }) },
  crash_zoom: { label: "クラッシュズーム（拍）", group: "プロ仕様", f: c => { const bar = 60 / c.beat.bpm * c.beat.beatsPerBar; const x = ((c.t - c.beat.phase) / bar) % 1; return { s: 1.04 + 0.2 * Math.exp(-x * bar / 0.12), x: 0, y: 0, r: 0 }; } },
  whip_in: { label: "ウィップパンで入る（場面転換）", group: "プロ仕様", f: c => { const a = clamp((c.t - c.t0) / 0.35); return { s: 1.12, x: 0.45 * (1 - outE(a, 5)) * (c.seed % 2 ? 1 : -1), y: 0, r: 0 }; } },
  crane_reveal: { label: "クレーン／ジブで見せる", group: "プロ仕様", f: c => { const e = inOutQ(c.p); return { s: 1.22 - 0.12 * e, x: 0, y: 0.07 - 0.1 * e, r: 0 }; } },
  face_in: { label: "顔へプッシュイン", group: "プロ仕様", f: c => { const e = inOut(c.p); return { s: 1.06 + 0.24 * e, x: 0, y: 0.03 * e, r: 0 }; } },
  depth_25d: { label: "2.5D奥行き移動", group: "プロ仕様", f: c => { const e = inOut(c.p); return { s: 1.12 + 0.04 * e, x: 0.03 - 0.06 * e, y: 0, r: 0, ry: -6 + 12 * e }; } },
  speed_ramp: { label: "スピードランプ（速→遅）", group: "プロ仕様", f: c => { const e = outE(c.p, 6); return { s: 1.04 + 0.18 * e, x: 0.05 * e * (c.seed % 2 ? 1 : -1), y: 0, r: 0 }; } },
  focus_move: { label: "ピント送り＋寄り", group: "プロ仕様", f: c => { const e = inOut(c.p); return { s: 1.03 + 0.12 * e, x: 0, y: 0, r: 0, focus: 6 * (1 - outE(c.p * 1.4, 3)) }; } },
  roll_drop: { label: "ドロップでロール", group: "プロ仕様", f: c => { const a = (c.t - c.t0); return { s: 1.12, x: 0, y: 0, r: 6 * Math.exp(-a * 3) * Math.sin(a * 9) + 1.5 * inOut(c.p) }; } },
};

// ---------- beat sync ----------
export type Sync = "off" | "beat" | "beat2" | "bar" | "accent";
export const SYNC: Record<Sync, string> = { off: "乗せない（なめらか）", beat: "毎拍", beat2: "2拍ごと", bar: "小節ごと", accent: "アクセントだけ" };
const divOf = (s: Sync, b: Beat) => s === "beat2" ? 2 : s === "bar" ? b.beatsPerBar : s === "accent" ? b.beatsPerBar : 1;
/** 1 right on the synced hit, decaying to 0. accent = bar downbeats (+ listed accent times when given). */
export function syncPulse(sync: string | undefined, b: Beat, t: number, accents?: number[], decay = 0.12) {
  if (!sync || sync === "off") return 0;
  if (sync === "accent" && accents?.length) { let v = 0; for (const a of accents) if (t >= a && t - a < 1) v = Math.max(v, Math.exp(-(t - a) / decay)); return v; }
  return beatPulse(b, t, decay, divOf(sync as Sync, b));
}
/** beat-stepped progress: the move advances in eased steps on each synced hit instead of gliding. */
export function syncProgress(sync: string | undefined, b: Beat, t: number, t0: number, dur: number) {
  if (!sync || sync === "off" || sync === "accent") return clamp((t - t0) / dur);
  const L = (60 / b.bpm) * divOf(sync as Sync, b), n = Math.max(1, Math.round(dur / L)), x = (t - t0) / L, k = Math.floor(x);
  return clamp((k + outE(clamp((x - k) / 0.4), 3)) / n);
}

export function cameraPose(id: string | undefined, c: Ctx & { sync?: string; accents?: number[] }, strength?: string): Pose & { blur: number } {
  const m = CAMERA_MOVES[id ?? "sway"] ?? CAMERA_MOVES.sway, k = kOf(strength);
  if (c.sync && c.sync !== "off") c = { ...c, p: syncProgress(c.sync, c.beat, c.t, c.t0, c.dur) };
  const kick = syncPulse(c.sync, c.beat, c.t, c.accents) * 0.035 * k;
  const sc = (q: Pose): Pose => ({ s: 1 + (q.s - 1) * k, x: q.x * k, y: q.y * k, r: q.r * k, ry: (q.ry ?? 0) * k, focus: (q.focus ?? 0) * Math.min(1.3, k + 0.3) });
  const a = sc(m.f(c));
  const dt = 1 / 30, b = sc(m.f({ ...c, t: c.t + dt, p: clamp(c.p + dt / Math.max(0.1, c.dur)) }));
  const speed = Math.hypot((b.x - a.x) * c.W, (b.y - a.y) * c.W * 0.56, (b.s - a.s) * c.W * 0.5); // px per frame
  a.s += kick;
  return { ...a, blur: Math.min(14, Math.max(0, speed - 6) * 0.35) }; // motion blur only on fast moves
}

// ---------- effects ----------
export interface FxUse { id: string; amount?: Strength; sync?: Sync; beat?: boolean }
export interface FxCtx { t: number; W: number; H: number; a: number; seed: number; t0: number; t1: number; frame: number; bg: (style: React.CSSProperties) => React.ReactNode }
type Fx = { label: string; group: "基本" | "高級"; filter?: (c: FxCtx) => string; layer?: (c: FxCtx) => React.ReactNode; shake?: (c: FxCtx) => string; beatDefault?: boolean; under?: boolean };
const abs: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
const Dots: React.FC<{ c: FxCtx; n: number; blur: number; size: number; color: string; op: number }> = ({ c, n, blur, size, color, op }) =>
  <svg width={c.W} height={c.H} style={{ ...abs, filter: `blur(${blur}px)` }}>{Array.from({ length: n }, (_, i) => { const x = ((i * 271.3 + c.seed) % c.W + c.t * (8 + i % 5) * 3) % c.W, y = ((i * 137.9) % c.H - c.t * (4 + i % 3) * 3 + c.H * 4) % c.H; return <circle key={i} cx={x} cy={y} r={size * (0.5 + (i % 4) / 3)} fill={color} opacity={op * c.a * (0.4 + 0.6 * Math.abs(Math.sin(c.t * 0.7 + i)))} />; })}</svg>;

export const EFFECT_FX: Record<string, Fx> = {
  grade_warm: { label: "色調：暖かく", group: "基本", filter: c => `sepia(${0.25 * c.a}) saturate(${1 + 0.15 * c.a}) brightness(${1 + 0.03 * c.a})` },
  grade_cool: { label: "色調：涼しく", group: "基本", filter: c => `hue-rotate(${-12 * c.a}deg) saturate(${1 - 0.1 * c.a}) brightness(${1 - 0.02 * c.a})` },
  grain: { label: "フィルム粒子", group: "基本", layer: c => <div style={{ ...abs, opacity: 0.22 * c.a, mixBlendMode: "overlay", backgroundImage: `repeating-radial-gradient(circle at ${17 + (c.frame * 37) % 60}% ${23 + (c.frame * 53) % 50}%, rgba(255,255,255,.6) 0 1px, transparent 1px 3px)` }} /> },
  glitch: { under: true, label: "グリッチ（RGBずれ）", group: "基本", beatDefault: true, layer: c => { const o = 10 * c.a; return <>{c.bg({ mixBlendMode: "screen", opacity: 0.5 * c.a, transform: `translateX(${o}px)`, filter: "sepia(1) saturate(6) hue-rotate(-50deg)" })}{c.bg({ mixBlendMode: "screen", opacity: 0.5 * c.a, transform: `translateX(${-o}px)`, filter: "sepia(1) saturate(6) hue-rotate(150deg)" })}<div style={{ ...abs, top: `${(c.frame * 37) % 90}%`, bottom: "auto", height: 14 * c.a, background: "rgba(255,255,255,.12)" }} /></>; } },
  flash: { label: "フラッシュ／ストロボ", group: "基本", beatDefault: true, layer: c => <div style={{ ...abs, background: "#fff", opacity: 0.35 * c.a }} /> },
  vignette: { label: "ビネット（周辺減光）", group: "基本", layer: c => <div style={{ ...abs, background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${0.55 * c.a}))` }} /> },
  letterbox: { label: "シネマ帯（レターボックス）", group: "基本", layer: c => { const h = c.H * 0.11 * Math.min(1, c.a); return <><div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h, background: "#000" }} /><div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h, background: "#000" }} /></>; } },
  leak: { label: "光漏れ（ライトリーク）", group: "基本", layer: c => <div style={{ ...abs, mixBlendMode: "screen", opacity: 0.45 * c.a, background: `radial-gradient(circle at ${20 + 60 * (0.5 + 0.5 * Math.sin(c.t * 0.5 + c.seed))}% 30%, rgba(255,140,60,.9), transparent 45%)` }} /> },
  halation: { under: true, label: "ハレーション／ブルーム", group: "基本", layer: c => c.bg({ mixBlendMode: "screen", opacity: 0.4 * c.a, filter: "blur(10px) brightness(.9) contrast(2) sepia(1) saturate(3) hue-rotate(-30deg)" }) },
  vhs: { label: "VHS／走査線", group: "基本", filter: c => `saturate(${1 - 0.2 * c.a}) contrast(${1 + 0.1 * c.a})`, layer: c => <div style={{ ...abs, opacity: 0.35 * c.a, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.5) 0 1px, transparent 1px 3px)", transform: `translateY(${c.frame % 3}px)` }} /> },
  blur: { label: "ぼかし", group: "基本", filter: c => `blur(${4 * c.a}px)` },
  particles: { label: "粒子（パーティクル）", group: "基本", layer: c => <Dots c={c} n={30} blur={0} size={2.5} color="#fff6dc" op={0.8} /> },
  invert: { label: "反転", group: "基本", beatDefault: true, filter: c => `invert(${Math.min(1, c.a)})` },
  shake: { label: "画面シェイク", group: "基本", beatDefault: true, shake: c => `translate(${Math.sin(c.t * 61) * 8 * c.a}px, ${Math.cos(c.t * 47) * 6 * c.a}px)` },
  // 高級
  anamorphic: { label: "アナモルフィック・フレア", group: "高級", layer: c => { const x = 30 + 40 * (0.5 + 0.5 * Math.sin(c.t * 0.35 + c.seed)); return <div style={{ ...abs, mixBlendMode: "screen", opacity: 0.7 * c.a, background: `radial-gradient(ellipse 60% 1.6% at ${x}% 38%, rgba(140,200,255,.95), transparent), radial-gradient(circle at ${x}% 38%, rgba(200,230,255,.6), transparent 6%)` }} />; } },
  bloom: { under: true, label: "シネマ・ブルーム", group: "高級", layer: c => c.bg({ mixBlendMode: "screen", opacity: 0.45 * c.a, filter: "blur(18px) brightness(1.05) contrast(1.7)" }) },
  dof: { under: true, label: "被写界深度（周辺ぼけ）", group: "高級", layer: c => c.bg({ filter: `blur(${6 * c.a}px)`, WebkitMaskImage: "radial-gradient(ellipse 45% 50% at 50% 48%, transparent 55%, #000 100%)", maskImage: "radial-gradient(ellipse 45% 50% at 50% 48%, transparent 55%, #000 100%)" }) },
  god_rays: { label: "光芒（ゴッドレイ）", group: "高級", layer: c => <div style={{ ...abs, mixBlendMode: "screen", opacity: 0.35 * c.a, filter: "blur(6px)", background: `repeating-conic-gradient(from ${200 + 6 * Math.sin(c.t * 0.3)}deg at 18% -10%, rgba(255,240,200,.55) 0deg 2deg, transparent 2deg 7deg)`, WebkitMaskImage: "linear-gradient(170deg,#000,transparent 75%)", maskImage: "linear-gradient(170deg,#000,transparent 75%)" }} /> },
  prism: { under: true, label: "プリズム分光", group: "高級", layer: c => { const o = 4 * c.a; return <>{c.bg({ mixBlendMode: "screen", opacity: 0.35 * c.a, transform: `translate(${o}px,${-o / 2}px) scale(1.004)`, filter: "sepia(1) saturate(5) hue-rotate(160deg)" })}{c.bg({ mixBlendMode: "screen", opacity: 0.35 * c.a, transform: `translate(${-o}px,${o / 2}px)`, filter: "sepia(1) saturate(5) hue-rotate(-40deg)" })}</>; } },
  film_burn: { label: "フィルムバーン（場面の頭）", group: "高級", layer: c => { const a = clamp(1 - (c.t - c.t0) / 0.8); return a > 0 ? <div style={{ ...abs, mixBlendMode: "screen", opacity: a * c.a, background: `radial-gradient(circle at ${70 + 10 * Math.sin(c.seed)}% 60%, rgba(255,230,180,1), rgba(255,110,30,.85) 25%, rgba(120,20,0,.4) 55%, transparent 80%)` }} /> : null; } },
  teal_orange: { label: "グレード：ティール＆オレンジ", group: "高級", filter: c => `contrast(${1 + 0.12 * c.a}) saturate(${1 + 0.15 * c.a})`, layer: c => <div style={{ ...abs, mixBlendMode: "soft-light", opacity: 0.55 * c.a, background: "linear-gradient(180deg, rgba(0,120,140,.9), rgba(255,140,60,.8))" }} /> },
  bleach: { label: "グレード：ブリーチバイパス", group: "高級", filter: c => `saturate(${1 - 0.45 * c.a}) contrast(${1 + 0.3 * c.a}) brightness(${1 + 0.03 * c.a})` },
  film_look: { label: "グレード：フィルム調", group: "高級", filter: c => `sepia(${0.12 * c.a}) contrast(${1 + 0.08 * c.a}) saturate(${1 - 0.08 * c.a})`, layer: c => <div style={{ ...abs, mixBlendMode: "overlay", opacity: 0.12 * c.a, backgroundImage: `repeating-radial-gradient(circle at ${(c.frame * 29) % 80}% ${(c.frame * 41) % 70}%, rgba(255,255,255,.6) 0 1px, transparent 1px 3px)` }} /> },
  glass: { label: "ガラス屈折（ゆらぎ）", group: "高級", filter: () => "url(#mvfx-glass)" },
  bokeh: { label: "ダスト＆ボケ", group: "高級", layer: c => <><Dots c={c} n={14} blur={6} size={14} color="#ffe2b0" op={0.35} /><Dots c={c} n={40} blur={0.4} size={1.2} color="#ffffff" op={0.5} /></> },
  light_sweep: { label: "光のスイープ（文字を横切る）", group: "高級", layer: c => { const x = ((c.t - c.t0) / 2.2 % 1) * 160 - 30; return <div style={{ ...abs, mixBlendMode: "overlay", opacity: 0.8 * c.a, background: `linear-gradient(105deg, transparent ${x - 8}%, rgba(255,255,255,.9) ${x}%, transparent ${x + 8}%)`, WebkitMaskImage: "linear-gradient(transparent 58%, #000 70%, #000 95%, transparent)", maskImage: "linear-gradient(transparent 58%, #000 70%, #000 95%, transparent)" }} />; } },
};
export const GlassDefs: React.FC<{ t: number }> = ({ t }) => <svg width={0} height={0} style={{ position: "absolute" }}><filter id="mvfx-glass"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves={2} seed={3}><animate /></feTurbulence><feDisplacementMap in="SourceGraphic" scale={8 + 4 * Math.sin(t)} /></filter></svg>;

/** strength 0..~1.6, beat-synced fx pulse on each beat (1 → ~0). */
export function fxAmount(u: FxUse, t: number, beat: Beat, accents?: number[]) {
  const k = kOf(u.amount), sync = u.sync ?? (u.beat ? "beat" : "off");
  return sync === "off" ? k : k * syncPulse(sync, beat, t, accents);
}
export const groupsOf = <T extends { group: string }>(m: Record<string, T>) => [...new Set(Object.values(m).map(v => v.group))];

/** Shared stage: picture (with grade filters) → picture-based fx → foreground (lyrics etc.) → overlay fx. */
export const FxStage: React.FC<{ W: number; H: number; t: number; frame: number; fx: FxUse[]; t0: number; t1: number; seed: number; beat: Beat; accents?: number[];
  picture: (style: React.CSSProperties) => React.ReactNode; children?: React.ReactNode }> = ({ W, H, t, frame, fx, t0, t1, seed, beat, accents, picture, children }) => {
  const on = fx.map(u => ({ u, d: EFFECT_FX[u.id], a: fxAmount(u, t, beat, accents) })).filter(x => x.d && x.a > 0.002);
  const ctx = (a: number): FxCtx => ({ t, W, H, a, seed, t0, t1, frame, bg: st => <div style={{ ...abs, ...st }}>{picture({})}</div> });
  const filter = on.map(x => x.d.filter?.(ctx(x.a))).filter(Boolean).join(" ");
  const shake = on.map(x => x.d.shake?.(ctx(x.a))).filter(Boolean).join(" ");
  return <div style={{ ...abs, transform: shake || undefined }}>
    {on.some(x => x.u.id === "glass") && <GlassDefs t={t} />}
    <div style={{ ...abs, filter: filter || undefined }}>{picture({})}</div>
    {on.filter(x => x.d.under && x.d.layer).map((x, i) => <React.Fragment key={"u" + i}>{x.d.layer!(ctx(x.a))}</React.Fragment>)}
    {children}
    {on.filter(x => !x.d.under && x.d.layer).map((x, i) => <React.Fragment key={"o" + i}>{x.d.layer!(ctx(x.a))}</React.Fragment>)}
  </div>;
};
/** effects active at t: the scene's own + any time-range entries (e.g. only the chorus). */
export function activeFx(sceneFx: FxUse[] | undefined, ranges: (FxUse & { start: number; end: number })[] | undefined, t: number): FxUse[] {
  return [...(sceneFx ?? []), ...(ranges ?? []).filter(r => t >= r.start && t < r.end)];
}
