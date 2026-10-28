// Project config (mv.config.json) - zero-config defaults; every field optional.
import type { LyricStyleConfig, Section, StyleSpec } from "./types";

export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";
export const ASPECTS: Record<Aspect, { w: number; h: number; textY: number; safeBottom: number; ja: string }> = {
  "16:9": { w: 1920, h: 1080, textY: 0.84, safeBottom: 0.06, ja: "横長（YouTube）" },
  "9:16": { w: 1080, h: 1920, textY: 0.68, safeBottom: 0.2, ja: "縦長（ショート/TikTok/リール）" }, // keep lyrics above platform UI
  "1:1": { w: 1080, h: 1080, textY: 0.8, safeBottom: 0.08, ja: "正方形" },
  "4:5": { w: 1080, h: 1350, textY: 0.78, safeBottom: 0.1, ja: "縦長4:5（Instagram）" },
};

export interface Timing {
  cutLead?: number; // seconds: cuts happen this much BEFORE the beat (0.1 = 画は0.1秒前から)
  lyricIn?: number; // seconds added to every lyric line start (negative = earlier)
  lyricOut?: number; // seconds added to every line end
  bpm?: number; // BPM fix
  beatShift?: number; // shift the beat grid (seconds)
  beatShiftBeats?: number; // shift the beat grid in beats (e.g. 0.5 = half a beat)
  sections?: Section[]; // manual section boundaries (locked)
  perSection?: Record<string, { cutLead?: number; lyricIn?: number; lyricOut?: number; cutBeats?: number }>;
  perShot?: Record<string, { offset?: number; start?: number; end?: number; src?: string; kind?: "image" | "video"; clipFrom?: number; speed?: number; fit?: boolean; tail?: "auto" | "hold" | "loop"; clipTo?: number; segments?: { at: number; speed: number }[]; ease?: number; solve?: number; move?: string; transition?: string; ramp?: string; puppet?: Partial<import("./types").PuppetCfg>; lipsync?: import("./lipsync").LipsyncMeta; lipsyncHistory?: any[] }>;
  perLine?: Record<string, { offset?: number; start?: number; end?: number; text?: string }>;
  locked?: string[]; // which analysis fields are manual (kept on re-analysis): "bpm" | "beatShift" | "sections" | "lines"
}

export interface MVConfig {
  structure?: string; // hybrid MV structure id | "auto" | "none"
  critic?: boolean; // false = skip the pro QA pass
  title?: string;
  mode?: "omakase" | "genre" | "kodawari";
  genre?: string; // "auto" (default) | "none" | ballad | rock_edm | citypop_jazz | idol_pop | wa | hiphop
  preset?: string; // story | dance | lipsync | live | vocaloid | firsttake | auto
  aspect?: Aspect;
  aspects?: Aspect[]; // multi-ratio export
  scale?: number; // 1 = 1080p class, 2 = 4K (16:9 only)
  fps?: number;
  range?: { start?: number; end?: number }; // song seconds
  lyrics?: LyricStyleConfig;
  cutBeats?: Record<string, number>; // section label/type -> beats per cut
  timing?: Timing;
  grade?: Record<string, string>; // section -> preset grade name override (advanced)
  shake?: number; leaks?: number; particles?: number;
  media?: { src: string; focus?: [number, number] }[];
  highlight?: boolean; // also export a 9:16 chorus highlight
  sectionStyles?: Record<string, StyleSpec>; // shorthand alias of lyrics.sections
  subject?: string; // who/what the MV is about (used in generation prompts)
  puppet?: Partial<import("./types").PuppetCfg>; // 目パチ・口パク・呼吸・髪揺れ・ノリ (global)
  puppetSections?: Record<string, Partial<import("./types").PuppetCfg>>; // per section (type, label, verse#2...)
  visuals?: import("./types").VisualFx; // audio-reactive layers
  finish?: import("./types").FinishFx; // in-Remotion finishing
  ramps?: Record<string, string>; // section -> speed ramp
  gen?: { model?: string; perShot?: Record<string, string>; resolution?: string; takes?: number; capUSD?: number; provider?: string; budgetPerShot?: number; imageModel?: string; plans?: Record<string, string | { plan: string; remaining?: number }>; audio?: boolean; autoMerge?: boolean; keepCut?: string[]; scope?: "none" | "chorus" | "all" /* 動画化: which sections get AI video */ };
  pro?: boolean; // false = classic look (no pro director / motion-graphics layer)
  combo?: string[]; // show modes, multi-select: story | lipsync | dance | live | lyric_motion | typography | mograph
  density?: "slow" | "normal" | "fast"; // シーンの細かさ
  mograph?: { off?: boolean; look?: import("./mograph").Look | Record<string, import("./mograph").Look>; palette?: string; transition?: import("./mograph").Transition; accents?: boolean };
  parts?: { rig?: string /* rig.json path (project dir relative) */; rigData?: import("./rig").Rig; preset?: string | Record<string, string>; x?: number; h?: number; off?: boolean };
  taste?: "anime" | "photo" | "illust" | "graphic" | "own"; // 画像テイスト (generation prompts)
  semi?: { show?: string; taste?: string; density?: string; video?: string; lyric?: string }; // 半自動 answers (for the report)
  /** continuity sheet for AI video (character / wardrobe / locations / props) */
  continuity?: { character?: string; wardrobe?: string; location?: string; locations?: string[]; props?: string[]; refImages?: string[] };
}

export const DEFAULT_CONFIG: MVConfig = { mode: "omakase", preset: "auto", aspect: "16:9", fps: 30, lyrics: { default: "auto" } };
