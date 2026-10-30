// 立ち絵パーツアニメ (yukkuri / ボカロ系 cut-out puppet MV) — pure pose solver for 1-N rigs on one stage.
// Rig format = src/lib/rig.ts (full-canvas part images + pivot + parent + z + states{closed,a}).
// Extra part kind "prop" (guitar / staff). Motion per character: "guitar" (strum) | "staff" (swing) | "idle".
import { clamp, hash, type Beat, beatLen } from "./core";
import { blinkAt, mouthAt, secondary, type Mora, type PartPose, type Rig } from "./rig";

export interface TachieChar { id: string; rig: Rig; base: string; x: number; h: number; y?: number; flip?: boolean; motion?: "guitar" | "staff" | "dance" | "idle" | string; from?: "left" | "right" | "bottom"; routine?: Record<string, [string, number][]> /* v7 per-char choreography override (editable) */ }
export interface TachieStage { kind: "tachie"; chars: TachieChar[]; bg: "halftone" | "sunburst" | "grid"; palette: string[]; punch?: boolean; lines?: boolean; bubbles?: boolean; readings?: Record<string, string> /* lyric text -> kana (lip-sync mora count) */; stopAt?: number /* freeze time (s) */; bgs?: string[] /* bg cycle, one per bar */; vocal?: { fps: number; v: number[] }; singers?: Record<string, string[]> /* lyric id -> char ids */; singerIdx?: string[] /* v5.7: per line index: "black" | "black,cafe" | "all" */; floaters?: Floaters /* v5.8 */; win?: [number, number] /* v6.0: this stage only uses lyrics starting inside [a,b) (two-loop timeline) */; guests?: any /* v6.0 guest stickers */; pause?: any /* v6.0 interlude telop + guest lineup */; layout?: string /* v7: fixed cut layout for this stage/cut */; hits?: Hit[] /* v7: accent hits (Hey!/Ho!) */; moves?: Record<string, Key> /* v7: extra/override key poses */; routine?: Record<string, [string, number][]> /* v7: choreography override for all chars */; [k: string]: any }
/** v7 accent hit: at t, everyone snaps into `move` and holds it for `beats` (default 1). text/color = burst telop drawn by the stage. */
export interface Hit { t: number; move?: string; beats?: number; text?: string; color?: string; x?: number; y?: number; size?: number }
/** v5.8 floating stickers (no rig): a few frames swapped per beat, shown only inside listed time ranges at fixed lyric-free spots. */
export interface FloaterItem { id: string; frames: Record<string, string>; h: number /* height, fraction of H */; pattern: string[] /* frame per beat, loops */; blink?: string /* frame used for a 2-drawing blink */; ranges: { start: number; end: number; x: number; y: number }[]; phase?: number }
export interface Floaters { dir?: string; base?: string; items: FloaterItem[] }
/** where / how a floater is at time t (t already frozen at the stop time): null when hidden. stepped at ANIM_FPS. */
export function floaterAt(it: FloaterItem, t: number, beat: Beat) {
  const r = it.ranges.find((q) => t >= q.start && t < q.end); if (!r) return null;
  const tq = Math.floor(t * ANIM_FPS + 1e-6) / ANIM_FPS, ph = it.phase ?? 0, B = beatLen(beat);
  const a = (tq - r.start) / 0.25, b = (r.end - tq) / 0.25; // pop in / out over 3 drawings
  const pin = a < 1 / 3 ? 0.55 : a < 2 / 3 ? 1.12 : 1, pout = b < 1 / 3 ? 0.55 : b < 2 / 3 ? 0.9 : 1;
  const w = 2 * Math.PI * tq / 2.2 + ph;
  const bi = Math.floor((tq - beat.phase) / B), inBeat = (tq - beat.phase) / B - bi;
  let frame = it.pattern[((bi % it.pattern.length) + it.pattern.length) % it.pattern.length];
  if (it.blink && (hash(it.id, bi) % 3 === 0) && inBeat > 0.55 && inBeat < 0.55 + 2 / ANIM_FPS / B) frame = it.blink;
  return { x: r.x + Math.sin(w * 0.5) * 0.008, y: r.y + Math.sin(w) * 0.018, rot: Math.sin(w + 1) * 5, s: Math.min(pin, pout), frame: it.frames[frame] ? frame : Object.keys(it.frames)[0] };
}
/** v6.0: vocal envelope shifted so a repeated loop (offset s) reads the same frames. */
const _vs = new Map<string, { fps: number; v: number[] }>();
export function shiftVocal(v: { fps: number; v: number[] } | undefined, off: number) { if (!v || !(off > 0)) return v; const k = v.v.length + ":" + off; let r = _vs.get(k); if (!r) { r = { fps: v.fps, v: new Array(Math.round(off * v.fps)).fill(0).concat(v.v) }; _vs.set(k, r); } return r; }
/** v6.0: lyrics belonging to a stage window. */
export const lyricsInWin = <T extends { start: number }>(all: T[], win?: [number, number]) => win ? all.filter((l) => l.start >= win[0] && l.start < win[1]) : all;
export interface LyricLite { id: string; text: string; start: number; end: number }

const base = (): PartPose => ({ rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 });
/** who sings a lyric line: explicit map, else chorus-ish lines (ミスター / Hey / Ho) = everyone, else alternate. */
export function singersOf(st: TachieStage, lyrics: LyricLite[], l: LyricLite): string[] {
  if (st.singers?.[l.id]) return st.singers[l.id];
  { const i = lyrics.indexOf(l), s = (st as any).singerIdx?.[i]; if (s) return (s === "all" ? st.chars.map((c) => c.id) : String(s).split(",")).filter((id: string) => st.chars.some((c) => c.id === id)); }
  if (/ミスター|hey|ho!|！/i.test(l.text)) return st.chars.map((c) => c.id);
  const i = Math.max(0, lyrics.indexOf(l));
  return [st.chars[i % st.chars.length].id];
}
/** mora list (uniform split of the line, punctuation/brackets skipped) for lips. */
export function moraOf(l: LyricLite): Mora[] {
  // v3: spaces/、 inside a line are breaths (weight 0.7 of a mora, mouth shut); punctuation/brackets skipped
  const ch = Array.from(l.text.replace(/（.*?）|\(.*?\)/g, "")).filter((c) => !/[・「」『』？！?!。]/.test(c));
  const w = ch.map((c) => (/[\s　、]/.test(c) ? 0.7 : /[ゃゅょァィゥェォャュョっッー]/.test(c) ? 0.5 : 1)), tot = w.reduce((a, b) => a + b, 0) || 1, d = (l.end - l.start) / tot;
  const out: Mora[] = []; let acc = 0;
  ch.forEach((c, i) => { const t0 = l.start + acc * d; acc += w[i]; if (!/[\s　、]/.test(c)) out.push({ ch: c, t0, t1: t0 + w[i] * d * 0.85 }); });
  return out;
}
export interface PoseCtx { t: number; beat: Beat; chorus: boolean; singing: boolean; mora: Mora[]; seed: number; section?: string; vocal?: { fps: number; v: number[] } /* vocal-band (300-3000Hz) RMS 0..1 per frame */; end?: number /* song end (s): final kime on the last beat, frozen after */; hits?: Hit[]; moves?: Record<string, Key>; routine?: Record<string, [string, number][]>; finale?: string }

// ---- dance-move system (ほしあき系 pose-to-pose) ----------------------------------------------------
// Reference study (/workspace/ref): characters do NOT move with continuous sine waves. They snap between
// held key poses on the beat (1-2 drawn-frame transition, limited animation on 2s ≈ 12fps), with a small
// overshoot only on the hit, then a dead hold until the next change. Poses change every 1-2 beats
// (verse: every 2 beats / half-time, chorus: every beat + a held "kime" pose at bar end).
/** one key pose. dx/dy are fractions of rig height, angles in degrees. */
export interface Key { b?: number; bx?: number; by?: number; sq?: number; h?: number; hy?: number; l?: number; r?: number; p?: number; hr?: number /* v7 hips rot */; sl?: number; sr?: number /* v7 foot x offset (fraction of H; - = screen left) */; fl?: number; fr?: number /* v7 foot lift (fraction of H) */; el?: number; er?: number /* v8 elbow bend (deg, + = forearm folds in/up) */ }
// v7 legs rigs (rig.legs = true): hips translate (bx/by), torso turns at the waist (b), legs aim at planted feet (sl/sr/fl/fr), a jump (by<0) lifts the feet too.
// l / r = how far each arm is RAISED (deg, + = up/outward) — converted to a rotation per side in primary().
export const MOVES: Record<string, Key> = {
  neutral: {},
  sway_l: { b: -4, bx: -0.015, h: 7, l: 25, r: -10 },
  sway_r: { b: 4, bx: 0.015, h: -7, l: -10, r: 25 },
  step_l: { b: -6, bx: -0.035, by: 0.004, sq: 0.03, h: 9, l: 45, r: -15 },
  step_r: { b: 6, bx: 0.035, by: 0.004, sq: 0.03, h: -9, l: -15, r: 45 },
  crouch: { by: 0.03, sq: 0.07, h: 4, l: -25, r: -25 },
  jump: { by: -0.06, sq: -0.06, h: -5, l: 80, r: 80, p: 4 },
  arms_up: { by: -0.015, sq: -0.04, h: -6, l: 85, r: 85 },
  pump_l: { b: -3, by: -0.008, h: 6, l: 90, r: -20 },
  pump_r: { b: 3, by: -0.008, h: -6, l: -20, r: 90 },
  wave_a: { b: -2, h: 8, l: 60, r: 60 },
  wave_b: { b: 2, h: -8, l: 30, r: 30 },
  point_l: { b: -8, bx: -0.02, h: 12, l: 40, r: -25, p: -6 },
  point_r: { b: 8, bx: 0.02, h: -12, l: -25, r: 40, p: 6 },
  hit_l: { b: -9, bx: -0.02, by: -0.01, sq: -0.03, h: 14, hy: -0.004, l: 75, r: 10, p: -5 },
  hit_r: { b: 9, bx: 0.02, by: -0.01, sq: -0.03, h: -14, hy: -0.004, l: 10, r: 75, p: 5 },
  twist_l: { b: -11, h: 12, l: -30, r: 50 },
  twist_r: { b: 11, h: -12, l: 50, r: -30 },
  nod: { by: 0.008, sq: 0.02, h: 0, hy: 0.01, l: 10, r: 10 },
  tilt: { b: 2, h: 16, l: 35, r: -5 },
  finale: { b: -7, bx: -0.01, by: -0.012, sq: -0.04, h: 13, hy: -0.004, l: 95, r: 70, p: 6 },
  // ---- v7 whole-body moves (legs rigs; on upper-body rigs the leg fields are ignored) ----
  side_l: { b: -5, bx: -0.045, by: 0.01, sq: 0.02, h: 8, l: 40, r: -12, sl: -0.075, sr: -0.015, hr: -3 },
  side_r: { b: 5, bx: 0.045, by: 0.01, sq: 0.02, h: -8, l: -12, r: 40, sl: 0.015, sr: 0.075, hr: 3 },
  hip_l: { b: 9, bx: -0.03, by: 0.012, h: -6, l: -20, r: 55, sl: -0.03, sr: 0.03, hr: -7 },
  hip_r: { b: -9, bx: 0.03, by: 0.012, h: 6, l: 55, r: -20, sl: -0.03, sr: 0.03, hr: 7 },
  swing_l: { b: -7, bx: -0.02, h: 10, l: 120, r: -25, sl: -0.04, sr: 0.02 },
  swing_r: { b: 7, bx: 0.02, h: -10, l: -25, r: 120, sl: -0.02, sr: 0.04 },
  kick_l: { b: 6, bx: 0.02, by: -0.01, h: -6, l: 70, r: 35, sl: -0.09, fl: 0.07 },
  kick_r: { b: -6, bx: -0.02, by: -0.01, h: 6, l: 35, r: 70, sr: 0.09, fr: 0.07 },
  squat: { by: 0.06, sq: 0.03, h: 0, hy: 0.004, l: 70, r: 70, sl: -0.07, sr: 0.07 },
  star: { by: -0.1, sq: -0.05, h: -4, l: 150, r: 150, sl: -0.07, sr: 0.07, fl: 0.03, fr: 0.03 },
  hey: { b: -5, bx: -0.01, by: -0.09, sq: -0.05, h: 10, l: 170, r: 20, sl: -0.05, sr: 0.04, fl: 0.02, fr: 0.06 },
  ho: { b: 5, bx: 0.01, by: -0.09, sq: -0.05, h: -10, l: 20, r: 170, sl: -0.04, sr: 0.05, fl: 0.06, fr: 0.02 },
  point_up_l: { b: -6, bx: -0.015, h: 12, hy: -0.004, l: 155, r: -15, sl: -0.04, sr: 0.03 },
  point_up_r: { b: 6, bx: 0.015, h: -12, hy: -0.004, l: -15, r: 155, sl: -0.03, sr: 0.04 },
  vee: { by: -0.01, sq: -0.02, h: 0, l: 135, r: 135, sl: -0.03, sr: 0.03 },
  lean_l: { b: -14, bx: -0.03, h: 12, l: 95, r: -30, sl: -0.06, sr: 0.01, hr: -4 },
  lean_r: { b: 14, bx: 0.03, h: -12, l: -30, r: 95, sl: -0.01, sr: 0.06, hr: 4 },
  bounce: { by: 0.025, sq: 0.03, h: 4, hy: 0.006, l: 15, r: 15, sl: -0.02, sr: 0.02 },
  shrug: { by: -0.006, h: -10, l: 45, r: 45, sl: -0.02, sr: 0.02 },
  kime: { b: -9, bx: -0.025, by: 0.015, sq: 0.01, h: 14, hy: -0.004, l: 165, r: -22, sl: -0.085, sr: 0.055, hr: -5 },
};
/** a phrase = list of [move, beats held]. Loops over the section. */
type Phrase = [string, number][];
export const ROUTINES: Record<string, Record<string, Phrase>> = {
  guitar: {
    intro: [["neutral", 2], ["arms_up", 2]],
    verse: [["sway_l", 2], ["sway_r", 2], ["point_l", 2], ["tilt", 2]],          // half-time; right hand strums, left arm gestures
    pre: [["pump_l", 1], ["sway_r", 1], ["pump_l", 1], ["sway_l", 1], ["crouch", 2], ["jump", 2]],
    chorus: [["arms_up", 1], ["pump_l", 1], ["pump_r", 1], ["hit_r", 1], ["wave_a", 1], ["wave_b", 1], ["crouch", 1], ["jump", 1]],
  },
  staff: {
    intro: [["neutral", 2], ["point_r", 2]],
    verse: [["tilt", 2], ["point_r", 2], ["sway_l", 2], ["nod", 2]],
    pre: [["sway_l", 1], ["pump_r", 1], ["sway_r", 1], ["pump_r", 1], ["crouch", 2], ["hit_r", 2]],
    chorus: [["hit_r", 1], ["pump_l", 1], ["point_r", 1], ["arms_up", 1], ["twist_r", 1], ["twist_l", 1], ["crouch", 1], ["jump", 1]],
  },
  dance: { // v5.7 cafe girl: no prop, both arms free all song
    intro: [["neutral", 2], ["wave_a", 2]],
    verse: [["nod", 2], ["sway_r", 2], ["tilt", 2], ["point_l", 2]],
    pre: [["pump_r", 1], ["sway_l", 1], ["pump_l", 1], ["sway_r", 1], ["crouch", 2], ["arms_up", 2]],
    chorus: [["pump_r", 1], ["arms_up", 1], ["hit_l", 1], ["pump_l", 1], ["twist_l", 1], ["twist_r", 1], ["jump", 1], ["crouch", 1]],
  },
  // v7 pop dance (legs rigs): whole-body pose-to-pose (side steps, hip twists, arm swings, jumps into poses). motion: "pop_dance"
  pop_dance: {
    intro: [["neutral", 2], ["shrug", 1], ["neutral", 1]],
    verse: [["side_l", 1], ["side_r", 1], ["hip_l", 1], ["point_up_r", 1], ["side_r", 1], ["side_l", 1], ["hip_r", 1], ["swing_l", 1]],
    pre: [["bounce", 1], ["lean_l", 1], ["bounce", 1], ["lean_r", 1], ["kick_r", 1], ["kick_l", 1], ["squat", 1], ["vee", 1]],
    chorus: [["star", 1], ["squat", 1], ["swing_l", 1], ["swing_r", 1], ["side_l", 1], ["point_up_l", 1], ["side_r", 1], ["point_up_r", 1]],
  },
  idle: { intro: [["neutral", 4]], verse: [["sway_l", 2], ["sway_r", 2]], pre: [["pump_l", 1], ["pump_r", 1]], chorus: [["arms_up", 1], ["pump_l", 1], ["pump_r", 1], ["hit_l", 1]] },
};
export const ANIM_FPS = 12, SNAP = 2 / ANIM_FPS; // limited animation on 2s; pose change takes ~2 drawn frames
const sectionKey = (x: PoseCtx) => { const s = (x.section ?? "").toLowerCase(); return x.chorus || /chorus|サビ/.test(s) ? "chorus" : /pre|build|bメロ/.test(s) ? "pre" : /intro|イントロ/.test(s) ? "intro" : "verse"; };
/** which move is active at beat index bx plus the previous one and time since change (s). */
export function moveAt(motion: string, x: PoseCtx, bx: number, own?: Record<string, Phrase>) {
  const sk0 = sectionKey(x), ph = own?.[sk0]?.length ? own[sk0] : x.routine?.[sk0]?.length ? x.routine[sk0] : (ROUTINES[motion] ?? ROUTINES.idle)[sk0] ?? ROUTINES.idle.verse, total = ph.reduce((a, p) => a + p[1], 0);
  const lb = ((Math.floor(bx) % total) + total) % total; let acc = 0, i = 0;
  for (; i < ph.length; i++) { if (lb < acc + ph[i][1]) break; acc += ph[i][1]; }
  const sinceBeats = bx - (Math.floor(bx) - lb + acc);
  return { cur: ph[i][0], prev: ph[(i - 1 + ph.length) % ph.length][0], since: sinceBeats * beatLen(x.beat) };
}
/** snap curve: 0 -> 1 within SNAP seconds with one overshoot frame, then dead hold. stepped at ANIM_FPS. */
export function snap(since: number) { if (since >= SNAP * 1.5) return 1; const f = Math.floor(since * ANIM_FPS); return f <= 0 ? 0.55 : f === 1 ? 1.12 : 1; }
const lerpK = (a: Key, b: Key, k: number) => { const o: Record<string, number> = {}; for (const n of ["b", "bx", "by", "sq", "h", "hy", "l", "r", "p", "hr", "sl", "sr", "fl", "fr", "el", "er"]) o[n] = ((a as any)[n] ?? 0) + (((b as any)[n] ?? 0) - ((a as any)[n] ?? 0)) * k; return o as Required<Key>; };
/** last beat at/before the song end: the final hit lands here, everything holds from here to the end (and after). */
export function lastBeatOf(beat: Beat, end: number) { void beat; return end; } // v5.1: final kime snaps exactly at the stop time (= end of the last lyric)
/** time used by every animated layer: frozen once the final hit has settled (no motion after the music). */
/** stop time for a stage: end of the last lyric if any, else the song end. */
export function stopTimeOf(lyrics: { end: number }[] | undefined, songEnd?: number, stopAt?: number, fps?: number, freezeAt?: number) {
  if (freezeAt != null && Number.isFinite(freezeAt)) return freezeAt; // v8: explicit freeze time (stage.freezeAt) wins over lyric end / stopAt
  // v5.2: explicit vocal end (stage.stopAt, from the vocal-band envelope) wins if earlier; result floored to a video frame so the freeze is never late
  const e = Math.max(-Infinity, ...(lyrics ?? []).map((l) => l.end).filter(Number.isFinite)); let r = Number.isFinite(e) ? e : songEnd;
  if (stopAt != null && Number.isFinite(stopAt)) r = r == null ? stopAt : Math.min(r, stopAt);
  return r != null && fps ? Math.floor(r * fps + 1e-6) / fps : r;
}
export function freezeT(t: number, beat: Beat, end?: number) { if (end == null || !Number.isFinite(end)) return t; return Math.min(t, lastBeatOf(beat, end)); }
/** big-part pose for one character at time t (all angles in degrees, px in rig space). */
function primary(c: TachieChar, x: PoseCtx) {
  const H = c.rig.size[1], B = beatLen(x.beat), tq = Math.floor(x.t * ANIM_FPS + 1e-6) / ANIM_FPS; // limited animation
  const bx = (tq - x.beat.phase) / B, motion = c.motion ?? "idle";
  const MV = (n: string): Key => x.moves?.[n] ?? MOVES[n] ?? {};
  const m = moveAt(motion, x, bx, c.routine), lb = x.end != null ? lastBeatOf(x.beat, x.end) : Infinity, fin = x.t >= lb - 1e-6;
  // v7 accent hits: snap into the hit pose at the hit time, hold `beats`, then back to the routine (which snaps again)
  const hit = (x.hits ?? []).filter((h) => h.move && tq >= Math.floor(h.t * ANIM_FPS + 1e-6) / ANIM_FPS - 1e-6 && tq < h.t + (h.beats ?? 1) * B).at(-1);
  // v5 outro: last 4 beats before the final hit = double-time arm pumps (half-beat snaps) so nobody looks stopped
  const outro = false && tq >= lb - 4 * B, /* v5.1: pre-end flurry removed */ hb = Math.floor((tq - (lb - 4 * B)) / (B / 2)), OUT = ["pump_l", "pump_r", "pump_l", "pump_r", "arms_up", "crouch", "pump_r", "jump"];
  const k = outro ? lerpK(MOVES[OUT[(hb + 7) % 8]], MOVES[OUT[hb % 8]], snap((tq - (lb - 4 * B)) - hb * (B / 2))) : fin ? lerpK(MV(moveAt(motion, x, (lb - x.beat.phase) / B - 0.01, c.routine).cur), MV(x.finale ?? "finale"), 1) /* hard snap to the kime at the stop time, then still */ : hit ? lerpK(MV(m.prev), MV(hit.move!), snap(tq - h0(hit.t))) : lerpK(MV(m.prev), MV(m.cur), snap(m.since));
  const e = x.chorus ? 1 : 0.8, sk = sectionKey(x);
  const body: PartPose = { ...base(), rot: k.b * e, dx: k.bx * H * e, dy: k.by * H * e, sy: 1 - k.sq * e, sx: 1 + k.sq * 0.6 * e };
  const head: PartPose = { ...base(), rot: k.h * e - body.rot * 0.4 + (x.singing ? 2 : 0), dy: k.hy * H };
  // screen-left arm raises clockwise (+), screen-right arm raises counter-clockwise (-). Per-rig range (rig.armRange) caps it.
  const [lo, hi] = (c.rig as any).armRange ?? [-35, 95];
  const as = (c.rig as any).armScale ?? 1; // v5.9: per-rig arm amplitude (cafe girl: relaxed arms, no T-pose)
  const up = (v: number) => clamp(v * e * as, lo, hi);
  let armL: PartPose = { ...base(), rot: up(k.l) }, armR: PartPose = { ...base(), rot: -up(k.r) }, prop: PartPose = { ...base(), rot: k.p };
  if (motion === "guitar") {
    // verse/pre: right hand strums (only fast part, stepped 8ths), left arm keeps dancing. chorus/finale: both arms free, guitar swings on its strap.
    const strumOn = !fin && !x.chorus && (x.singing || sk === "pre");
    if (strumOn) { const down = Math.floor(bx * 2) % 2 === 0; armR = { ...base(), rot: 20 + (down ? 12 : -4) }; prop = { ...base(), rot: down ? 1 : 0 }; }
    else if (!x.chorus && !fin) { armR = { ...base(), rot: 20 }; }
    else prop = { ...base(), rot: -body.rot * 1.6 + (k.by < 0 ? 5 : -2), dy: -k.by * H * 0.3 };
  } else if (motion === "staff") {
    prop = { ...base(), rot: k.p * 0.6 - armR.rot * 0.15 }; // staff rides in the fist (child of arm_r)
  }
  if ((c.rig as any).legs) { // v7 legs rig: hips carry the translation, torso only turns/squashes at the waist
    const hips: PartPose = { ...base(), dx: body.dx, dy: body.dy, rot: (k.hr ?? 0) * e };
    const torso: PartPose = { ...base(), rot: k.b * e, sy: 1 - k.sq * 0.6 * e, sx: 1 + k.sq * 0.35 * e };
    const foreL: PartPose = { ...base(), rot: -clamp(k.el * e, -130, 145) }, foreR: PartPose = { ...base(), rot: clamp(k.er * e, -130, 145) };
    return { body: torso, hips, head, armL, armR, foreL, foreR, prop, legs: { sl: k.sl * e, sr: k.sr * e, fl: k.fl, fr: k.fr, by: k.by * e } };
  }
  return { body, head, armL, armR, prop };
}
const h0 = (t: number) => Math.floor(t * ANIM_FPS + 1e-6) / ANIM_FPS;
/** v7: rigid leg aimed from the (moved) hip joint at its planted foot. returns the leg pose + the foot counter-rotation. */
function legPose(c: TachieChar, side: "l" | "r", now: any, p: { pivot: [number, number]; foot?: [number, number] }) {
  const H = c.rig.size[1], hips: PartPose = now.hips, L = now.legs;
  const foot0: [number, number] = p.foot ?? [p.pivot[0], (c.rig as any).floorY ?? H * 0.835];
  const L0 = Math.hypot(foot0[0] - p.pivot[0], foot0[1] - p.pivot[1]) || 1;
  // hip joint after the hips transform (rotation about the hips pivot)
  const hp = (c.rig.parts.find((q) => q.kind === ("hips" as any))?.pivot ?? p.pivot) as [number, number], a = (hips.rot * Math.PI) / 180;
  const rx = p.pivot[0] - hp[0], ry = p.pivot[1] - hp[1], jx = hp[0] + hips.dx + rx * Math.cos(a) - ry * Math.sin(a), jy = hp[1] + hips.dy + rx * Math.sin(a) + ry * Math.cos(a);
  const air = Math.max(0, -(L.by ?? 0) * H * 0.9); // jump: feet leave the floor with the body
  const fx = foot0[0] + (side === "l" ? L.sl : L.sr) * H, fy = foot0[1] - air - (side === "l" ? L.fl : L.fr) * H;
  const vx = fx - jx, vy = fy - jy, d = Math.hypot(vx, vy), rot = (Math.atan2(-vx, vy) * 180) / Math.PI;
  const sy = clamp(d / L0, 0.84, 1.06);
  const kn = (p as any).knee as [number, number] | undefined;
  if (kn) { // v8.1 two-bone leg (body-v5 hip -> knee -> ankle): knee bends outward when the hip comes closer to the planted foot
    const l1 = Math.hypot(kn[0] - p.pivot[0], kn[1] - p.pivot[1]), l2 = Math.hypot(foot0[0] - kn[0], foot0[1] - kn[1]), dd = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - 0.01);
    const along = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), off = Math.sqrt(Math.max(0, l1 * l1 - along * along)) * (side === "l" ? -1 : 1);
    const ux = vx / d, uy = vy / d, kx = jx + ux * along + uy * off * -1 * -1, ky = jy + uy * along - ux * off;
    const KX = jx + ux * along + (-uy) * -off, KY = jy + uy * along + ux * -off; void kx; void ky;
    const thigh = (Math.atan2(-(KX - jx), KY - jy) * 180) / Math.PI, shinAbs = (Math.atan2(-(fx - KX), fy - KY) * 180) / Math.PI;
    return { leg: { rot: thigh, dx: jx - p.pivot[0], dy: jy - p.pivot[1], sx: 1, sy: 1 } as PartPose, shin: { ...base(), rot: shinAbs - thigh } as PartPose, foot: { ...base(), rot: -shinAbs * 0.9 } as PartPose };
  }
  return { leg: { rot, dx: jx - p.pivot[0], dy: jy - p.pivot[1], sx: 1, sy } as PartPose, foot: { ...base(), rot: -rot * 0.85, sy: 1 / sy } as PartPose };
}
/** lip-sync: mora gate from lyric timing (open per sung syllable, shut in gaps) x vocal-band loudness -> closed | half(i) | open(a). closed when no lyric. */
export function lipAt(x: PoseCtx): "closed" | "i" | "a" {
  if (!x.singing) return "closed";
  const m = mouthAt(x.mora, x.t); if (m.open <= 0.05) return "closed";
  const lv = x.vocal ? x.vocal.v[Math.max(0, Math.min(x.vocal.v.length - 1, Math.round(x.t * x.vocal.fps)))] ?? 0 : 0.7;
  const o = m.open * (0.3 + 0.9 * lv);
  return o > 0.55 ? "a" : o > 0.16 ? "i" : "closed";
}
export function solveChar(c: TachieChar, x0: PoseCtx): Record<string, PartPose> {
  const x = { ...x0, t: freezeT(x0.t, x0.beat, x0.end) }, ended = x0.end != null && x.t >= lastBeatOf(x.beat, x0.end);
  if (ended) { x.singing = false; }
  const now = primary(c, x), out: Record<string, PartPose> = {};
  const blink = !ended && (blinkAt(x.t, x.seed) > 0.4 || (x.chorus && x.singing && ((x.t * 2) % 7) < 0.12));
  const m = lipAt(x);
  for (const p of c.rig.parts) {
    let q = base();
    const kd = p.kind as string, nw = now as any;
    if (nw.legs && kd === "hips") q = nw.hips;
    else if (nw.legs && (kd === "leg_l" || kd === "leg_r")) q = legPose(c, kd === "leg_l" ? "l" : "r", nw, p as any).leg;
    else if (nw.legs && (kd === "shin_l" || kd === "shin_r")) { const lp = c.rig.parts.find((z) => z.id === p.parent); q = lp ? (legPose(c, kd === "shin_l" ? "l" : "r", nw, lp as any) as any).shin ?? base() : base(); }
    else if (nw.legs && (kd === "foot_l" || kd === "foot_r") && (c.rig.parts.find((z) => z.id === p.parent)?.kind as string)?.startsWith("shin")) { const sp = c.rig.parts.find((z) => z.id === p.parent), lp = sp && c.rig.parts.find((z) => z.id === sp.parent); q = lp ? legPose(c, kd === "foot_l" ? "l" : "r", nw, lp as any).foot : base(); }
    else if (nw.legs && (kd === "foot_l" || kd === "foot_r")) { const lp = c.rig.parts.find((z) => z.id === p.parent); q = lp ? legPose(c, kd === "foot_l" ? "l" : "r", nw, lp as any).foot : base(); }
    else if (kd === "sleeve_l" || kd === "sleeve_r") q = { ...base(), rot: (kd === "sleeve_l" ? now.armL.rot : now.armR.rot) * ((p as any).follow ?? 1) };
    else if (p.kind === "body") q = now.body; else if (p.kind === "head") q = now.head;
    else if (p.kind === "arm_l" || p.kind === "arm_r") q = p.kind === "arm_l" ? now.armL : now.armR;
    else if (kd === "fore_l" || kd === "fore_r") q = (kd === "fore_l" ? nw.foreL : nw.foreR) ?? base(); // v8: forearm, child of the upper arm, turns at the elbow
    else if (p.kind === "hand_l" || p.kind === "hand_r") { const arm = p.kind === "hand_l" ? now.armL : now.armR, fore = (p.kind === "hand_l" ? nw.foreL : nw.foreR) as PartPose | undefined, pk = c.rig.parts.find((z) => z.id === p.parent)?.kind as string | undefined, child = !!pk && (pk === p.kind.replace("hand", "arm") || pk === p.kind.replace("hand", "fore")); // v7: a hand parented to its arm only switches drawing (raised -> open palm)
      const tot = Math.abs(arm.rot + (pk && pk.startsWith("fore") && fore ? fore.rot : 0)); q = child ? { ...base(), state: p.states?.up && tot > ((c.rig as any).handUpAt ?? 70) ? "up" : undefined } : arm; }
    else if ((p.kind as string) === "prop") q = now.prop;
    else if (p.spring) q = { ...base(), rot: secondary((tt) => primary(c, { ...x, t: tt }).head.rot + primary(c, { ...x, t: tt }).body.rot, x.t, p.spring) };
    if (p.kind === "eye_l" || p.kind === "eye_r" || p.kind === "eyes") { const bv = ended ? 0 : blinkAt(x.t, x.seed); q = { ...q, state: blink && p.states?.closed ? "closed" : p.states?.half && (bv > 0.12 || (x.singing && m === "a" && !x.chorus)) ? "half" : undefined }; } // v5.7: half-lid frame around blinks (rigs with a half state only)
    if (p.kind === "mouth") q = { ...q, state: m === "a" && p.states?.a ? "a" : m !== "closed" ? (p.states?.i ? "i" : p.states?.a ? "a" : undefined) : undefined };
    out[p.id] = q;
  }
  // v8.1 per-pose layer order (rig.zArm opt-in): when the forearm folds across the body (|elbow| > zArm.bend deg) the whole arm comes in front of
  // the torso: torso < upper arm < sleeve < forearm < hand. Otherwise (arm at the side) the upper arm / forearm / hand stay behind the torso edge and
  // only the sleeve is in front. Values are rig z numbers.
  const ZA = (c.rig as any).zArm, nw2 = now as any;
  if (ZA && nw2.foreL) for (const p of c.rig.parts) { const kd = p.kind as string, sd = kd.endsWith("_l") ? "l" : kd.endsWith("_r") ? "r" : "", role = kd.replace(/_[lr]$/, "");
    if (!sd || !["arm", "fore", "hand", "sleeve"].includes(role)) continue;
    const fr = Math.abs((sd === "l" ? nw2.foreL : nw2.foreR).rot) > (ZA.bend ?? 45), z = (fr ? ZA.front : ZA.side)?.[role];
    if (z != null) out[p.id] = { ...out[p.id], z } as any; }
  return out;
}
/** camera for the stage: slide-in at scene start, beat punch-in on chorus bars, shake on chorus downbeats. */
export function stageCamera(st: TachieStage, t: number, t0: number, beat: Beat, chorus: boolean, seed: number) {
  const B = beatLen(beat), bx = (t - beat.phase) / B, ph = bx - Math.floor(bx), bar = Math.floor(bx / 4), inBar = bx / 4 - bar;
  let s = 1, dx = 0, dy = 0, r = 0;
  if (st.punch && chorus) { const k = Math.exp(-inBar * 4 * 3); s += 0.12 * k + 0.02 * Math.exp(-ph * 6); const side = hash("p", seed, bar) % 3 - 1; dx = side * 120 * k; r = side * 1.5 * k; }
  if (chorus && Math.floor(bx) % 4 === 0 && ph < 0.25) { const f = Math.floor(t * ANIM_FPS); dx += (f % 2 ? 6 : -6); dy += (f % 2 ? -4 : 4); } // 2-frame hit shake on bar downbeat only
  return { s, dx, dy, r };
}
export const slideIn = (t: number, t0: number, i: number) => { const p = clamp((t - t0 - i * 0.12) / 0.45); return 1 - Math.pow(1 - p, 3) + Math.sin(Math.PI * p) * 0.06; };
