// Genre presets + generic "hit MV direction recipes" (see docs/hit_direction_playbook_ja.md).
// Every preset bundles: cut rhythm per section (in beats), camera moves, transitions, colour grade per section,
// lyric-style mapping and shot-prompt templates. Original parameters - no third-party designs copied.
import type { FinishFx, Grade, LyricStyleConfig, PuppetCfg, SectionType, VisualFx } from "./types";

export type Beats = 8 | 4 | 2 | 1 | 0.5 | 0.25 | 0; // 0 = one long take
export interface Preset {
  id: string;
  ja: string;
  desc: string;
  cuts: Record<SectionType, Beats>;
  moves: Record<SectionType, string[]>;
  transitions: Record<SectionType, string>; // transition at section starts
  grades: Record<SectionType, Grade>;
  lyric: LyricStyleConfig;
  textY: number;
  shake: number; // beat camera shake amount 0..1
  leaks: number; // light-leak intensity 0..1
  particles: number;
  promptTemplate: string; // {subject} {section} {mood} {move}
  recipes: Recipes;
  // what makes presets look different beyond colour:
  puppet: PuppetCfg; // native blink / mouth / breathing / hair / sway / bounce
  visuals: VisualFx; // audio-reactive layers
  finish: FinishFx; // glow, letterbox, grain ...
  textSize: number; // lyric size multiplier (layout)
  ramps?: Partial<Record<SectionType, string>>; // speed ramps per section
}
export interface Recipes {
  coldOpen: boolean; // hook: start with the strongest (chorus) image + big first line
  preChorusBreak: boolean; // one beat of hold/black right before each chorus
  chorusEscalation: boolean; // later choruses cut faster + stronger grade
  breathing: boolean; // bridge / quiet sections hold longer
  loopEnding: boolean; // last shot returns to the first image, clean tail without lyrics
  matchCut: boolean; // keep zoom direction/scale continuous across cuts within a section
  thumbnailPick: boolean;
}

const G = (name: string, filter: string, vignette = 0.35, grain = 0.06, tint?: string): Grade => ({ name, filter, vignette, grain, tint });
const all = <T,>(v: T): Record<SectionType, T> => ({ intro: v, verse: v, pre_chorus: v, chorus: v, bridge: v, outro: v, other: v });
const R = (o: Partial<Recipes> = {}): Recipes => ({ coldOpen: true, preChorusBreak: true, chorusEscalation: true, breathing: true, loopEnding: true, matchCut: true, thumbnailPick: true, ...o });

export const PRESETS: Record<string, Preset> = {
  story: {
    id: "story", ja: "ストーリー", desc: "物語MV。Aメロは引きでゆっくり、サビで寄りと色の解放。映画的な字幕寄りの歌詞。",
    cuts: { intro: 8, verse: 8, pre_chorus: 4, chorus: 2, bridge: 8, outro: 8, other: 8 },
    moves: { ...all(["kb_in", "drift_l", "kb_out", "drift_r"]), chorus: ["push", "kb_in", "parallax"], bridge: ["parallax", "kb_out"] },
    transitions: { ...all("fade"), chorus: "flash", pre_chorus: "cut" },
    grades: {
      intro: G("cool-dawn", "saturate(0.8) contrast(1.05) brightness(0.95) hue-rotate(-8deg)", 0.5, 0.08, "rgba(40,70,120,0.18)"),
      verse: G("muted", "saturate(0.85) contrast(1.05)", 0.4, 0.07),
      pre_chorus: G("warming", "saturate(1.0) contrast(1.1)", 0.35, 0.06, "rgba(255,150,80,0.08)"),
      chorus: G("release", "saturate(1.25) contrast(1.12) brightness(1.04)", 0.25, 0.05, "rgba(255,190,120,0.10)"),
      bridge: G("memory", "saturate(0.6) sepia(0.25) contrast(1.0)", 0.55, 0.1),
      outro: G("afterglow", "saturate(0.9) brightness(0.95)", 0.5, 0.08, "rgba(255,170,120,0.12)"),
      other: G("neutral", "none", 0.3, 0.05),
    },
    lyric: { default: "auto", sections: { verse: "reveal", intro: "blur_in", outro: "blur_in" } },
    textY: 0.84, shake: 0.05, leaks: 0.5, particles: 0.4,
    promptTemplate: "cinematic film still, {subject}, {mood}, {section} scene, natural light, 35mm, shallow depth of field, {move}",
    puppet: { blink: 1, mouth: 0.6, breath: 1, hair: 0.8, sway: 0, bounce: 0 }, visuals: {}, finish: { letterbox: 1, glow: 0.25, halation: 0.3, grain: 0.07 }, textSize: 0.8, ramps: { chorus: "smooth" },
    recipes: R(),
  },
  dance: {
    id: "dance", ja: "ダンス", desc: "拍の強いダンスMV。全身フレーミング、サビは1/2〜1/4拍カット、拍でカメラが跳ねる。",
    cuts: { intro: 2, verse: 2, pre_chorus: 1, chorus: 1, bridge: 2, outro: 4, other: 2 },
    moves: { ...all(["push", "whip_l", "zoom_punch", "whip_r"]), verse: ["drift_l", "drift_r", "push"], chorus: ["zoom_punch", "whip_l", "shake", "whip_r", "push"] },
    transitions: { ...all("whip"), chorus: "flash", bridge: "zoom" },
    grades: {
      ...all(G("punch", "saturate(1.3) contrast(1.18)", 0.3, 0.04)),
      verse: G("street", "saturate(1.1) contrast(1.15) hue-rotate(-6deg)", 0.35, 0.05, "rgba(60,120,255,0.08)"),
      chorus: G("neon-pop", "saturate(1.45) contrast(1.22) brightness(1.05)", 0.25, 0.03, "rgba(255,60,180,0.10)"),
      bridge: G("strobe-mono", "grayscale(0.7) contrast(1.3)", 0.4, 0.08),
    },
    lyric: { default: "auto", sections: { verse: "bounce" } },
    textY: 0.8, shake: 0.7, leaks: 0.3, particles: 0.5,
    promptTemplate: "full-body shot of {subject} dancing, dynamic pose, {mood}, studio with colored lights, wide angle, motion, {move}",
    puppet: { blink: 1, mouth: 0.8, breath: 0.4, hair: 1.2, sway: 1, bounce: 1 }, visuals: { audioParticles: 0.7, spectrum: "bars" }, finish: { glow: 0.35, chroma: 0.6 }, textSize: 1.15, ramps: { chorus: "punch", pre_chorus: "in" },
    recipes: R({ breathing: true }),
  },
  lipsync: {
    id: "lipsync", ja: "リップシンク", desc: "口元・顔のアップ中心。歌詞1行ごとに寄りを切り替え（行同期カット）。",
    cuts: { intro: 4, verse: 2, pre_chorus: 2, chorus: 1, bridge: 4, outro: 4, other: 2 },
    moves: { ...all(["face_push", "kb_in", "drift_l"]), chorus: ["face_push", "zoom_punch", "kb_in"] },
    transitions: { ...all("cut"), chorus: "flash" },
    grades: { ...all(G("skin", "saturate(1.05) contrast(1.06) brightness(1.03)", 0.35, 0.05, "rgba(255,200,170,0.06)")), chorus: G("skin-pop", "saturate(1.2) contrast(1.12)", 0.3, 0.04) },
    lyric: { default: "auto", sections: { verse: "karaoke" } },
    textY: 0.9, shake: 0.1, leaks: 0.35, particles: 0.2,
    promptTemplate: "close-up portrait of {subject} singing, mouth slightly open, {mood}, soft key light, 85mm, {move}",
    puppet: { blink: 1, mouth: 1.3, breath: 0.6, hair: 0.6, sway: 0.3, bounce: 0 }, visuals: {}, finish: { glow: 0.2, grain: 0.04 }, textSize: 0.85,
    recipes: R(),
  },
  live: {
    id: "live", ja: "ライブ", desc: "ステージ照明・観客・マルチカメラ感。拍でストロボ、サビは寄り引きを交互に。",
    cuts: { intro: 4, verse: 4, pre_chorus: 2, chorus: 2, bridge: 4, outro: 4, other: 4 },
    moves: { ...all(["crane_up", "drift_l", "push", "drift_r"]), chorus: ["zoom_punch", "crane_up", "shake", "kb_out"] },
    transitions: { ...all("flash"), verse: "cut" },
    grades: {
      ...all(G("stage", "saturate(1.2) contrast(1.2) brightness(0.95)", 0.5, 0.07, "rgba(120,60,255,0.12)")),
      chorus: G("stage-hot", "saturate(1.4) contrast(1.25)", 0.45, 0.06, "rgba(255,80,40,0.12)"),
    },
    lyric: { default: "auto", sections: { chorus: "neon", verse: "reveal" } },
    textY: 0.86, shake: 0.5, leaks: 0.8, particles: 0.7,
    promptTemplate: "live concert photo of {subject} on stage, spotlights, haze, crowd silhouettes, {mood}, telephoto, {move}",
    puppet: { blink: 1, mouth: 1, breath: 0.6, hair: 1, sway: 0.6, bounce: 0.4 }, visuals: { audioParticles: 0.4, trails: 0.3 }, finish: { glow: 0.8, halation: 0.6, chroma: 0.3, grain: 0.08 }, textSize: 1, ramps: { chorus: "out" },
    recipes: R(),
  },
  vocaloid: {
    id: "vocaloid", ja: "ボカロ", desc: "アニメ調・高コントラスト・タイポ主役のリリックPV。文字が画面の主役で、サビでタイポが最大化。",
    cuts: { intro: 2, verse: 2, pre_chorus: 1, chorus: 1, bridge: 4, outro: 4, other: 2 },
    moves: { ...all(["kb_in", "zoom_punch", "drift_r"]), chorus: ["zoom_punch", "shake", "whip_l", "kb_in"] },
    transitions: { ...all("glitch"), verse: "cut", chorus: "flash" },
    grades: {
      ...all(G("anime-hicon", "saturate(1.35) contrast(1.3)", 0.3, 0.03)),
      verse: G("anime-cool", "saturate(1.2) contrast(1.3) hue-rotate(-12deg)", 0.35, 0.03, "rgba(40,200,255,0.08)"),
      chorus: G("anime-burn", "saturate(1.5) contrast(1.35)", 0.25, 0.02, "rgba(255,40,120,0.10)"),
      bridge: G("anime-mono", "grayscale(1) contrast(1.5)", 0.4, 0.06),
    },
    lyric: { default: "auto", sections: { verse: "typewriter", pre_chorus: "glitch", chorus: "kinetic", bridge: "tategaki" } },
    textY: 0.5, shake: 0.45, leaks: 0.2, particles: 0.4,
    promptTemplate: "anime illustration of {subject}, high contrast, bold flat colors, {mood}, graphic composition, negative space for typography, {move}",
    puppet: { blink: 1, mouth: 0.7, breath: 0.5, hair: 0.8, sway: 0.4, bounce: 0.5 }, visuals: { bg: "plasma", bgOpacity: 0.3, spectrum: "ring", trails: 0.6 }, finish: { glow: 0.4, chroma: 0.8 }, textSize: 1.35,
    recipes: R(),
  },
  firsttake: {
    id: "firsttake", ja: "ファーストテイク風", desc: "一発撮り風。白いスタジオ・1本の長回し・ゆっくり寄るだけ。歌詞は小さな字幕、速いカット無し。",
    cuts: all(0),
    moves: all(["slow_push"]),
    transitions: all("none"),
    grades: all(G("white-studio", "saturate(0.92) contrast(1.02) brightness(1.04)", 0.12, 0.03)),
    lyric: { default: { style: "simple", variant: "film" } },
    textY: 0.9, shake: 0, leaks: 0, particles: 0,
    promptTemplate: "{subject} singing into a single studio microphone, seen in profile, seamless white studio, soft large window light, documentary photo, 50mm, quiet",
    puppet: { blink: 1, mouth: 0.9, breath: 1, hair: 0.4, sway: 0, bounce: 0 }, visuals: {}, finish: { grain: 0.03, vignette: 0.1 }, textSize: 0.75,
    recipes: R({ coldOpen: false, preChorusBreak: false, chorusEscalation: false, matchCut: false }),
  },
};
export const PRESET_IDS = Object.keys(PRESETS);

const PRESET_WORDS: [RegExp, string][] = [
  [/ファースト\s*テイク|first\s*take|一発撮り|白いスタジオ|長回し/i, "firsttake"],
  [/ボカロ|ボーカロイド|vocaloid|リリックpv|歌詞pv/i, "vocaloid"],
  [/ダンス|dance|踊/i, "dance"],
  [/リップ\s*シンク|lip\s*sync|口パク|口元/i, "lipsync"],
  [/ライブ|live|ステージ|コンサート/i, "live"],
  [/ストーリー|物語|story|ドラマ/i, "story"],
];
export function presetFromText(text: string): string | null {
  for (const [re, id] of PRESET_WORDS) if (re.test(text)) return id;
  return PRESET_IDS.includes(text) ? text : null;
}

/** auto pick from analysis: tempo + energy contrast + lyric density + media kinds. */
export function autoPreset(a: { bpm: number; energyMean: number; energyContrast: number; linesPerMin: number; hasVideo: boolean }): { id: string; why: string } {
  const { bpm, energyMean, energyContrast, linesPerMin } = a;
  if (bpm < 92 && energyMean < 0.45) return { id: "firsttake", why: `BPM${bpm}でエネルギー低め→しっとり長回し` };
  if (linesPerMin > 24 && bpm >= 140) return { id: "vocaloid", why: `BPM${bpm}・歌詞密度${linesPerMin.toFixed(0)}行/分→タイポ主役` };
  if (bpm >= 118 && energyMean >= 0.5) return { id: "dance", why: `BPM${bpm}・エネルギー高→ビート重視` };
  if (energyContrast > 0.35) return { id: "story", why: "静と動の差が大きい→物語型" };
  return { id: bpm >= 125 ? "live" : "story", why: `BPM${bpm}→汎用` };
}
