export type SectionType = "intro" | "verse" | "pre_chorus" | "chorus" | "bridge" | "outro" | "other";
export interface Section { label: string; type: SectionType; start: number; end: number }
export interface Char { ch: string; t0: number; t1: number; idx: number /* index in line text */ }
export interface Word { i0: number; i1: number; t: number }
export interface LyricLine { text: string; start: number; end: number; chars: Char[]; words: Word[] }
export interface Song {
  title: string;
  duration: number;
  fps: number;
  bpm: number;
  phase: number; // seconds of the first beat
  beatsPerBar: number;
  sections: Section[];
  energy: number[]; // normalized 0..1
  energyHz: number;
  lines: LyricLine[];
  downbeats?: number[];
}
export type StyleSpec = string | ({ style: string } & Record<string, unknown>);
export interface LyricStyleConfig {
  default?: StyleSpec; // project default ("auto" by default)
  sections?: Record<string, StyleSpec>; // "サビ" | "chorus" | "サビ2" | exact label
  lines?: Record<string, StyleSpec>; // "12" | exact text | fragment
  params?: Record<string, Record<string, unknown>>; // per style default params
  force?: string; // one style for everything (showcase / tests)
  keywords?: Record<string, string>; // word -> effect ("" disables)
  keywordEffects?: boolean;
  size?: number; // global text size factor
  position?: "bottom" | "center" | "top";
  genre?: string; // genre recipe id (ballad / rock_edm / citypop_jazz / idol_pop / wa / hiphop) - drives auto styles, fonts, colours
  font?: string; // song-wide font (registry id, family, category or Japanese word)
  fontSections?: Record<string, string>; // "chorus" -> font
  fontLines?: Record<string, string>; // "12" | text fragment -> font
  fontKeywords?: Record<string, string>; // word -> font
  palette?: { fill?: string; stroke?: string; accent?: string };
  seed?: number; // auto-pick reroll (「別パターンで」 = seed+1)
  variety?: number; // 0 = 統一感重視 .. 1 = 変化多め (default 0.5)
  vertOk?: boolean; // false = no room for vertical text
  fitVisual?: boolean; // false = ignore picture analysis for colour
  pro?: boolean; // pro director: prefer pro_* styles, avoid cheap defaults (default true via pipeline)
  prefer?: Record<string, string[]>; // section label/type -> preferred styles (from the motion-graphics plan)
}
export interface ResolvedLine extends LyricLine {
  li: number;
  style: string;
  params: Record<string, any>;
  source: string;
  section: string;
  sectionType: SectionType;
  seed: number;
  kw: { i0: number; i1: number; effect: string; word: string }[];
  tOn: number; tOff: number; tEnd: number; exit: number; lead: number;
  hero?: boolean; // the one big move of its section
  locked?: boolean; // chosen by the user (never changed by the critic)
}
export interface Grade { name: string; filter: string; vignette: number; grain: number; tint?: string; bars?: boolean }
export interface Shot {
  id: string;
  start: number; end: number;
  src: string; // path relative to public/
  kind: "image" | "video";
  focus?: [number, number]; // 0..1 saliency centre used for smart crop
  move: string; // camera move name
  section?: string;
  clipFrom?: number; // seconds into a video source
  lyricStyle?: StyleSpec;
  prompt?: string;
  transition?: string; // transition INTO this shot
  rate?: number; // playback rate for video shots
  z0?: number; // starting zoom (match-cut chain)
  sectionType?: SectionType;
  grade?: Grade;
  face?: FaceRig; // eyes / mouth rig for native blink + mouth flap
  size?: [number, number]; // natural image size (px)
  puppet?: PuppetCfg; // resolved per-shot puppet settings
  ramp?: string; // speed ramp curve: none | in | out | punch | smooth
  vis?: import("./visual").VisFeat; // picture analysis (scripts/visfeat.py)
  role?: string; // hybrid structure shot role (lipsync / story / dance / lyric / live / flashback / cutaway / insert ...)
  textY?: number; // picture-aware lyric row for this shot
  textWhy?: string;
  locked?: boolean; // edited by the user
  muted?: boolean; // generated clip audio is never used (master song only)
  lipsync?: boolean; // placed exactly on its lip-sync/dance audio window
}
export interface FaceRig {
  eyes: [number, number, number, number][]; // x, y, rx, ry (fractions of the image)
  mouth?: [number, number, number, number] | null;
  size?: [number, number];
  skin?: string; lash?: string;
  patches?: { x: number; y: number; w: number; h: number; half: string; closed: string }[];
}
export interface PuppetCfg { blink: number; mouth: number; breath: number; hair: number; sway: number; bounce: number }
export interface VisualFx {
  bg?: "none" | "plasma" | "tunnel" | "flow" | "rings"; // generative audio-reactive background
  bgOpacity?: number; // when media exists, blend the generative layer on top (screen)
  spectrum?: "none" | "bars" | "ring" | "wave";
  audioParticles?: number; // 0..1 particles emitted by bass energy
  trails?: number; // 0..1 feedback / echo trail amount
}
export interface FinishFx { glow?: number; halation?: number; letterbox?: number; grain?: number; vignette?: number; chroma?: number; lut?: string }
export interface Layout { textY?: number; textSize?: number; plate?: boolean }
export interface RenderProps {
  [key: string]: unknown;
  preset?: string;
  width: number; height: number; fps: number;
  durationInFrames: number;
  startAt: number; // song seconds of frame 0
  audio?: string;
  lines: ResolvedLine[];
  shots: Shot[];
  beat: { bpm: number; phase: number; beatsPerBar: number };
  grade: Grade;
  shake: number; leaks: number; particles: number;
  overlayOnly: boolean;
  background?: string;
  textSize: number;
  textY: number; // 0..1 baseline row for horizontal layouts
  safeBottom?: number;
  label?: string; // showcase label
  energy?: number[]; energyHz?: number; // loudness envelope for mouth flap / reactive fallback
  visuals?: VisualFx;
  finish?: FinishFx;
  parts?: { rig: import("./rig").Rig; x?: number; h?: number; dy?: number; segments: { start: number; end: number; type: string; preset: string; energy: number }[] }; // parts animation (パーツアニメ)
  mograph?: import("./mograph").MoGraphPlan; // pro motion-graphics layer (shapes, transitions, accents, textures)
}
