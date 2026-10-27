// Style traits used by fit scoring: intensity 0..1, mood tags, flags (shake/glitch = never in slow ballads; hero = a "big move" to use once per section).
import { MOOD_STYLES } from "./moods";
export interface Trait { intensity: number; moods: string[]; shaky?: boolean; hero?: boolean; readable?: number /* 0..1 how legible mid-motion */; vertical?: boolean; wordUnit?: boolean }
const T = (intensity: number, moods: string, x: Partial<Trait> = {}): Trait => ({ intensity, moods: moods.split(" "), readable: 0.8, ...x });
const CORE: Record<string, Trait> = {
  simple: T(0.05, "acoustic ballad ambient citypop", { readable: 1 }),
  kinetic: T(0.8, "hiphop rock", { hero: true, wordUnit: true, readable: 0.6 }),
  reveal: T(0.12, "ballad acoustic ambient wa", { readable: 0.95 }),
  bounce: T(0.45, "idol", {}),
  karaoke: T(0.1, "idol citypop acoustic ballad", { readable: 1 }),
  outline_fill: T(0.2, "ballad citypop wa", { readable: 0.9 }),
  handwriting: T(0.2, "ballad acoustic idol", { readable: 0.85 }),
  glitch: T(0.85, "rock dark", { shaky: true, readable: 0.5 }),
  chromatic_trail: T(0.55, "rock citypop dark", { readable: 0.7 }),
  particles: T(0.4, "ballad ambient dark", { hero: true, readable: 0.6 }),
  extrude3d: T(0.5, "rock wa idol", { hero: true }),
  fly3d: T(0.7, "rock idol", { hero: true, readable: 0.6 }),
  flip3d: T(0.4, "idol citypop"),
  typewriter: T(0.15, "citypop hiphop dark acoustic", { readable: 0.95 }),
  neon: T(0.4, "citypop dark rock"),
  shatter: T(0.9, "rock", { hero: true, shaky: true, readable: 0.6 }),
  scatter: T(0.55, "idol rock", { readable: 0.6 }),
  tategaki: T(0.12, "wa ballad", { vertical: true, readable: 0.9 }),
  wave: T(0.4, "idol ambient"),
  jelly: T(0.45, "idol"),
  stamp: T(0.65, "wa hiphop rock", { hero: true, wordUnit: true }),
  mask_wipe: T(0.35, "citypop hiphop rock"),
  split_reveal: T(0.4, "citypop rock dark"),
  blur_in: T(0.12, "ballad ambient dark", { readable: 0.9 }),
  scale_pop: T(0.6, "idol rock", { hero: true }),
  circular: T(0.5, "idol ambient citypop", { readable: 0.5 }),
  ticker: T(0.4, "hiphop citypop", { readable: 0.7 }),
  collage: T(0.7, "idol hiphop", { hero: true, wordUnit: true, readable: 0.6 }),
  burst: T(0.7, "idol", { hero: true }),
  word_stack: T(0.75, "hiphop rock", { hero: true, wordUnit: true, readable: 0.7 }),
  letter_rain: T(0.5, "dark ambient", { readable: 0.6 }),
  ui_window: T(0.65, "dark idol", { hero: true }),
  sakura_fall: T(0.35, "wa ballad idol"),
  spotlight: T(0.2, "ballad acoustic dark", { readable: 0.9 }),
};
export const TRAITS: Record<string, Trait> = { ...CORE };
for (const [k, m] of Object.entries(MOOD_STYLES)) TRAITS[k] = T(m.intensity, m.moods.join(" "), {
  shaky: m.spec.idle === "jitter" || m.spec.idle === "flicker", hero: m.intensity >= 0.6 || m.spec.layout === "big",
  vertical: m.spec.layout === "v", wordUnit: m.spec.unit === "word", readable: m.spec.enter === "cut" || m.spec.enter === "fade" ? 0.95 : 0.85 });
export const trait = (s: string): Trait => TRAITS[s] ?? T(0.4, "pop");
