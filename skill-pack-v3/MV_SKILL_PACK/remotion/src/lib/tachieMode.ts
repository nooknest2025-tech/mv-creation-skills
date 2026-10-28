// 立ち絵モーションMV as a show mode: pure helpers that turn rigs (npm run parts) + the planned shots into a
// tachie stage (src/render/Tachie.tsx) and editor scenes. The stage is only the default look: every value
// (characters, guests, telops, lyric stage styles) stays editable in the shared editor, and editor patches win.
import type { Mood } from "./mograph";

export interface TachieRigRef { name: string; dir: string /* relative to the project tachie/ folder */ }
const BG: Record<Mood, "halftone" | "sunburst" | "grid"> = { rock: "sunburst", electronic: "grid", pop: "halftone", city: "grid", ballad: "halftone", wa: "halftone" };
const PAL: Record<Mood, string[]> = {
  rock: ["#ffe23d", "#ff2d55", "#111111", "#ffffff"], electronic: ["#00e5ff", "#ff4fa3", "#0d0d1a", "#ffe23d"],
  pop: ["#ffe23d", "#ff4fa3", "#1a1a1a", "#00e5ff"], city: ["#ffb3c7", "#7fd8ff", "#1b1530", "#ffe9a8"],
  ballad: ["#f6e7c8", "#e58fa5", "#2a2230", "#9fd3ff"], wa: ["#f3e5c0", "#c0392b", "#1c1c1c", "#d4a017"],
};
/** one stage with 1-3 characters side by side (more rigs -> the first three dance, others can be added in the editor). */
export function buildTachieStage(rigs: TachieRigRef[], mood: Mood, label = "立ち絵ステージ") {
  if (!rigs.length) throw new Error("rig がありません");
  const use = rigs.slice(0, 3), xs = use.length === 1 ? [0.5] : use.length === 2 ? [0.3, 0.7] : [0.19, 0.5, 0.81];
  return {
    label, bg: BG[mood] ?? "halftone", palette: PAL[mood] ?? PAL.pop, punch: mood === "rock" || mood === "electronic", bubbles: true,
    chars: use.map((r, i) => ({ id: r.name, rig: r.dir, x: xs[i], h: use.length === 1 ? 0.78 : 0.66, y: 0.99, motion: "dance" as const })),
  };
}
/** roles drawn on the 立ち絵 stage: the character itself, and the text-only screens (their look comes from the lyric styles). */
export const STAGE_ROLES = ["tachie", "typo", "mograph", "lyric"];
export interface ShotLite { id: string; start: number; end: number; src?: string; role?: string; section?: string }
/**
 * editor scenes for a 立ち絵 combo. Shots whose role is "tachie" use the stage; shots of the other picture modes
 * (物語・ライブ…) keep their image; text-only shots (typography / mograph) and shots without media use the stage,
 * where the text modes come through the planned lyric styles.
 */
export function tachieScenes(shots: ShotLite[], mediaIndex: (src: string) => number, stageIndex: number, duration: number) {
  const out: { id: string; start: number; end: number; asset: number; transition: number; label: string }[] = [];
  shots.forEach((s, i) => {
    const img = s.src && !STAGE_ROLES.includes(s.role ?? "") ? mediaIndex(s.src) : -1;
    const asset = img >= 0 ? img : stageIndex, prev = out[out.length - 1];
    if (prev && prev.asset === asset && asset === stageIndex) { prev.end = s.end; return; } // one continuous stage cut (the stage makes its own beat cuts)
    out.push({ id: s.id, start: s.start, end: s.end, asset, transition: i && asset !== prev?.asset ? Math.min(0.4, s.end - s.start) : 0, label: `${s.section ?? "シーン"}${asset === stageIndex ? "（立ち絵）" : ""}` });
  });
  if (!out.length) out.push({ id: "S001", start: 0, end: duration, asset: stageIndex, transition: 0, label: "立ち絵" });
  out[0].start = 0; out[out.length - 1].end = Math.max(out[out.length - 1].end, duration);
  return out;
}
