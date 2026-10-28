// Cinematographer-level shot spec builder (model-agnostic). videoModels.ts turns a ShotSpec into each model's syntax.
import type { Shot } from "./types";

export type ShotSize = "EWS" | "WS" | "MS" | "MCU" | "CU" | "ECU" | "INSERT";
export interface Move { id: string; en: string; speed: "static" | "slow" | "medium" | "fast"; motivation: string; mm: "push" | "pull" | "pan" | "truck" | "tilt" | "pedestal" | "orbit" | "track" | "zoom" | "shake" | "static" | "crane" }
export interface Continuity { character?: string; wardrobe?: string; location?: string; refImages?: string[] }
export interface ShotSpec {
  shot: string; section: string; sectionType: string; role: string;
  seconds: number; beatSec: number; // beat-matched target length
  size: ShotSize; sizeEn: string; lens: string;
  move: Move; action: string; performance?: "lipsync" | "dance" | "none";
  lighting: string; timeOfDay: string; palette: string[]; atmosphere: string;
  composition: string; safeSpace: "top" | "bottom" | "left" | "right";
  continuity: Continuity;
  startFrame?: string; endFrame?: string; matchCutTo?: string;
  negatives: string[];
  refImage?: string | null;
}

/** section colour script: one palette per section type (keeps the film's arc readable). */
export const COLOR_SCRIPT: Record<string, { palette: string[]; light: string; time: string; atmos: string }> = {
  intro: { palette: ["deep navy", "cold teal", "a single warm practical"], light: "low-key, soft rim light, one practical lamp in frame", time: "blue hour", atmos: "light haze, slow drifting dust" },
  verse: { palette: ["muted beige", "soft grey", "skin tones"], light: "soft window key from camera left, gentle fill, naturalistic", time: "late afternoon", atmos: "clean air, subtle film grain" },
  pre_chorus: { palette: ["amber", "dusky magenta"], light: "warming key, stronger backlight starting to flare", time: "sunset", atmos: "thin haze catching the backlight" },
  chorus: { palette: ["saturated magenta", "electric cyan", "bright white highlights"], light: "high-contrast hard key, strong colored rim lights, flashing practicals", time: "night", atmos: "dense haze, light beams, floating particles" },
  bridge: { palette: ["desaturated lavender", "pale gold"], light: "diffused overhead soft light, dreamy bloom", time: "dawn", atmos: "mist, slow-motion particles" },
  outro: { palette: ["warm gold", "fading blue"], light: "low sun backlight, gentle flare, fading", time: "golden hour", atmos: "soft haze, lens bloom" },
  other: { palette: ["neutral"], light: "motivated soft key", time: "day", atmos: "light haze" },
};

const SIZE_EN: Record<ShotSize, [string, string]> = {
  EWS: ["extreme wide shot", "18mm wide-angle lens, deep focus"], WS: ["wide shot", "24mm lens, deep focus"], MS: ["medium shot", "35mm lens"],
  MCU: ["medium close-up", "50mm lens, shallow depth of field"], CU: ["close-up", "85mm portrait lens, shallow depth of field, creamy bokeh"],
  ECU: ["extreme close-up", "100mm macro lens, very shallow focus"], INSERT: ["insert detail shot", "macro lens, shallow focus"],
};

/** pack move id -> cinematic move (speed + motivation). Unknown moves fall back to a slow push. */
export const MOVES: Record<string, Omit<Move, "id">> = {
  kb_in: { en: "slow push-in", speed: "slow", motivation: "draws us into the singer's feeling", mm: "push" },
  slow_push: { en: "very slow push-in on a locked-off dolly", speed: "slow", motivation: "builds quiet tension", mm: "push" },
  face_push: { en: "gentle push-in toward the face", speed: "slow", motivation: "lands on the key lyric", mm: "push" },
  push: { en: "fast push-in", speed: "fast", motivation: "hits the downbeat", mm: "push" },
  kb_out: { en: "slow pull-back", speed: "slow", motivation: "reveals the space / loneliness", mm: "pull" },
  drift_l: { en: "lateral truck left", speed: "slow", motivation: "follows the flow of the melody", mm: "truck" },
  drift_r: { en: "lateral truck right", speed: "slow", motivation: "follows the flow of the melody", mm: "truck" },
  parallax: { en: "parallax tracking move past foreground objects", speed: "medium", motivation: "adds depth and travel", mm: "track" },
  whip_l: { en: "whip pan left", speed: "fast", motivation: "energetic transition on the beat", mm: "pan" },
  whip_r: { en: "whip pan right", speed: "fast", motivation: "energetic transition on the beat", mm: "pan" },
  crane_up: { en: "crane up rising above the subject", speed: "medium", motivation: "lifts with the chorus", mm: "crane" },
  zoom_punch: { en: "punch-in zoom on the beat", speed: "fast", motivation: "accents the drum hit", mm: "zoom" },
  shake: { en: "handheld with energetic shake", speed: "fast", motivation: "live, raw energy", mm: "shake" },
  orbit: { en: "slow orbit around the subject", speed: "slow", motivation: "shows the subject from all sides at the peak", mm: "orbit" },
  static: { en: "locked-off static camera", speed: "static", motivation: "lets the performance breathe", mm: "static" },
};

export const NEGATIVES_BASE = ["morphing faces", "face distortion", "extra fingers", "deformed hands", "extra limbs", "text", "subtitles", "watermark", "logo", "garbled letters", "flicker", "jitter", "warping background", "low resolution", "blurry"];

const ROLE_ACTION: Record<string, { action: string; perf: ShotSpec["performance"] }> = {
  lipsync: { action: "{subject} sings the line directly to camera, clear natural mouth movement, emotional eyes", perf: "lipsync" },
  dance: { action: "{subject} dances with sharp, on-beat choreography, full body visible", perf: "dance" },
  live: { action: "{subject} performs with the band, hair moving, crowd lights behind", perf: "lipsync" },
  story: { action: "{subject} acts a quiet story moment: walks, pauses, looks back", perf: "none" },
  flashback: { action: "a memory of {subject}, slow gentle movement, nostalgic", perf: "none" },
  cutaway: { action: "an evocative environment detail, small natural motion (curtains, light, leaves)", perf: "none" },
  insert: { action: "close detail of a meaningful object, subtle motion", perf: "none" },
  lyric: { action: "{subject} in a calm pose, minimal motion, space reserved for lyrics", perf: "none" },
};

export function sizeFor(s: Shot, i: number, all: Shot[]): ShotSize {
  const first = i === 0 || all[i - 1].section !== s.section;
  const role = s.role ?? "";
  if (role === "insert") return "INSERT";
  if (role === "cutaway") return first ? "EWS" : "WS";
  if (role === "dance") return first ? "WS" : "MS";
  if (role === "lipsync" || role === "live") return s.move === "face_push" ? "CU" : (i % 2 ? "MCU" : "CU");
  const t = s.sectionType ?? "other";
  if (first) return t === "chorus" ? "WS" : t === "intro" ? "EWS" : "WS";
  const cyc: ShotSize[] = t === "chorus" ? ["CU", "MS", "ECU", "WS", "MCU"] : ["MS", "MCU", "CU", "WS"];
  return cyc[i % cyc.length];
}

const beatSnap = (sec: number, bpm: number) => { const bar = 60 / Math.max(40, bpm || 120); return Math.max(bar, Math.round(sec / bar) * bar); };

export interface SpecCtx { subject?: string; continuity?: Continuity; bpm?: number; textY?: number; width?: number; height?: number }

export function buildSpecs(shots: Shot[], ctx: SpecCtx = {}): ShotSpec[] {
  const subject = ctx.continuity?.character ?? ctx.subject ?? "the singer";
  const out = shots.map((s, i) => {
    const t = s.sectionType ?? "other", cs = COLOR_SCRIPT[t] ?? COLOR_SCRIPT.other;
    const size = sizeFor(s, i, shots), [sizeEn, lens] = SIZE_EN[size];
    const mv = MOVES[s.move] ?? MOVES.kb_in;
    const r = ROLE_ACTION[s.role ?? ""] ?? (t === "chorus" ? ROLE_ACTION.lipsync : ROLE_ACTION.story);
    const ty = s.textY ?? ctx.textY ?? 0.82;
    const safe: ShotSpec["safeSpace"] = ty < 0.4 ? "top" : "bottom";
    const comp = `${safe === "bottom" ? "subject framed in the upper two-thirds" : "subject framed in the lower two-thirds"}, rule of thirds, clean negative space at the ${safe} of frame for lyrics`;
    const neg = [...NEGATIVES_BASE];
    if (r.perf === "lipsync") neg.push("out-of-sync lips", "frozen mouth");
    if (r.perf === "dance") neg.push("broken limbs", "sliding feet", "duplicated body");
    const sec = s.end - s.start;
    return {
      shot: s.id, section: s.section ?? "", sectionType: t, role: s.role ?? (r === ROLE_ACTION.lipsync ? "lipsync" : "story"),
      seconds: +sec.toFixed(2), beatSec: +beatSnap(sec, ctx.bpm ?? 120).toFixed(2),
      size, sizeEn, lens, move: { id: s.move, ...mv }, action: r.action.replace("{subject}", subject), performance: r.perf,
      lighting: cs.light, timeOfDay: cs.time, palette: cs.palette, atmosphere: cs.atmos, composition: comp, safeSpace: safe,
      continuity: { character: subject, wardrobe: ctx.continuity?.wardrobe, location: ctx.continuity?.location, refImages: ctx.continuity?.refImages },
      negatives: neg, refImage: s.kind === "image" && s.src ? s.src : null,
    } as ShotSpec;
  });
  // match cuts: when the next shot chains zoom (z0) or a whip, describe end -> start frames
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1], sb = shots[i + 1];
    if (sb.z0 || /whip/.test(a.move.id) || sb.transition === "match") {
      a.endFrame = `ends on a ${b.sizeEn} composition with the subject centered, matching the next shot`;
      b.startFrame = `starts from the same framing as the end of ${a.shot}`;
      a.matchCutTo = b.shot;
    }
  }
  return out;
}

/** model-agnostic natural-language prompt (adapters reorder / trim it). */
export function proseOf(sp: ShotSpec, o: { motionOnly?: boolean } = {}) {
  const c = sp.continuity;
  const who = [c.character, c.wardrobe && `wearing ${c.wardrobe}`].filter(Boolean).join(", ");
  const parts = o.motionOnly
    ? [`${sp.move.en} (${sp.move.speed}, ${sp.move.motivation})`, sp.action, sp.atmosphere]
    : [`${sp.sizeEn}, ${sp.lens}`, who && sp.action.includes(c.character ?? "") ? sp.action + (c.wardrobe ? `, wearing ${c.wardrobe}` : "") : sp.action,
       c.location && `in ${c.location}`, `camera: ${sp.move.en}, ${sp.move.speed}, ${sp.move.motivation}`,
       `lighting: ${sp.lighting}, ${sp.timeOfDay}`, `color palette: ${sp.palette.join(", ")}`, `atmosphere: ${sp.atmosphere}`, sp.composition];
  if (sp.startFrame) parts.push(sp.startFrame);
  if (sp.endFrame) parts.push(sp.endFrame);
  return parts.filter(Boolean).join(". ") + ".";
}

// ---- critic for the shot list (variety / coverage / arc / repeated moves) ----
export interface ShotIssue { rule: string; at?: string; msg: string; fixed: boolean }
const ORDER: ShotSize[] = ["EWS", "WS", "MS", "MCU", "CU", "ECU", "INSERT"];
export const SIZE_JA: Record<string, string> = { EWS: "かなり引きの画", WS: "引きの画", MS: "中くらいの画（腰から上）", MCU: "やや寄りの画（胸から上）", CU: "寄りの画（顔）", ECU: "かなり寄りの画（目元など）", INSERT: "小物のアップ" };
export const MM_JA: Record<string, string> = { push: "寄り", pull: "引き", pan: "首振り（パン）", truck: "横移動", tilt: "上下の首振り", pedestal: "上下移動", orbit: "回り込み", track: "追いかけ", zoom: "ズーム", static: "固定", handheld: "手持ち", shake: "揺れ", crane: "クレーン（上下の大きな移動）", roll: "傾き" };
const mmJa = (m: string) => MM_JA[m] ?? m;
/** names: shot id -> friendly 「シーン2（Aメロ 0:12〜）」. */
export function reviewShotList(specs: ShotSpec[], locked: Set<string> = new Set(), names: Record<string, string> = {}): { issues: ShotIssue[]; score: number } {
  const issues: ShotIssue[] = [];
  const nm = (id: string) => names[id] ?? id.replace(/^S0*(\d+)$/i, "シーン$1");
  const fix = (sp: ShotSpec, rule: string, msg: string, apply: () => void) => {
    if (locked.has(sp.shot)) issues.push({ rule, at: sp.shot, msg: msg + "（手動ロック中のため提案のみ）", fixed: false });
    else { apply(); issues.push({ rule, at: sp.shot, msg, fixed: true }); }
  };
  for (let i = 1; i < specs.length; i++) {
    const a = specs[i - 1], b = specs[i];
    if (a.size === b.size && a.section === b.section) fix(b, "same-size", `${nm(b.shot)}: 前と同じ${SIZE_JA[b.size] ?? "画"}が続く → 画の大きさを変えます`, () => {
      const k = ORDER.indexOf(b.size), n = ORDER[k <= 2 ? k + 2 : k - 2]; b.size = n; b.sizeEn = SIZE_EN[n][0]; b.lens = SIZE_EN[n][1]; });
    if (a.move.mm === b.move.mm && a.move.mm !== "static") fix(b, "same-move", `${nm(b.shot)}: 同じカメラの動き（${mmJa(b.move.mm)}）が続く → 別の動きにします`, () => {
      const alt = b.move.mm === "push" ? MOVES.drift_r : MOVES.kb_in; b.move = { id: b.move.mm === "push" ? "drift_r" : "kb_in", ...alt }; });
  }
  // coverage: each section should open with an establishing (WS/EWS) and contain a CU-ish shot
  const secs = [...new Set(specs.map((s) => s.section))];
  for (const sec of secs) {
    const ss = specs.filter((s) => s.section === sec);
    if (ss.length >= 3 && !ss.some((s) => ["WS", "EWS"].includes(s.size))) fix(ss[0], "no-establishing", `${sec}: 引きの画（状況説明）がない → 頭をワイドに`, () => { ss[0].size = "WS"; ss[0].sizeEn = SIZE_EN.WS[0]; ss[0].lens = SIZE_EN.WS[1]; });
    if (ss.length >= 3 && !ss.some((s) => ["CU", "ECU", "MCU"].includes(s.size))) fix(ss[ss.length - 1], "no-closeup", `${sec}: 寄りの画（感情）がない → 最後を寄りに`, () => { const z = ss[ss.length - 1]; z.size = "CU"; z.sizeEn = SIZE_EN.CU[0]; z.lens = SIZE_EN.CU[1]; });
  }
  // arc: chorus should be closer / faster on average than verse
  const avg = (t: string) => { const z = specs.filter((s) => s.sectionType === t); return z.length ? z.reduce((a, s) => a + ORDER.indexOf(s.size === "INSERT" ? "ECU" : s.size), 0) / z.length : null; };
  const v = avg("verse"), c = avg("chorus");
  if (v !== null && c !== null && c < v - 0.5) issues.push({ rule: "arc", msg: "サビの方がAメロより引きの画が多い → サビで寄り・速い動きを増やすと盛り上がりが伝わります", fixed: false });
  const sizes = new Set(specs.map((s) => s.size));
  if (specs.length >= 6 && sizes.size < 3) issues.push({ rule: "variety", msg: `画の大きさ（引き・寄りなど）が${sizes.size}種類しかなく単調です`, fixed: false });
  const score = Math.max(0, 100 - issues.filter((x) => !x.fixed).length * 10 - issues.filter((x) => x.fixed).length * 3);
  return { issues, score };
}
