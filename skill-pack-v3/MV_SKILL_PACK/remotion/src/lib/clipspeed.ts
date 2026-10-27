// Video clip speed / stretch / in-point — ONE pure mapping shared by the editor preview,
// the editor MP4 export and npm run mv. It only maps "time inside the scene" -> "time inside the clip".
// It never touches the song audio or the scene length (audio safety by construction).
export type ClipTail = "auto" | "hold" | "loop";
export interface ClipOpts { speed?: number; fit?: boolean; clipFrom?: number; tail?: ClipTail }
export interface ClipPlan { rate: number; inPoint: number; mode: "play" | "hold" | "loop"; span: number }
export const SPEED_MIN = 0.25, SPEED_MAX = 4;
export const SPEED_PRESETS: [string, number][] = [["スロー 0.5倍", 0.5], ["普通 1倍", 1], ["速く 2倍", 2]];
export const TAILS: Record<ClipTail, string> = { auto: "自動でゆっくりにして合わせる（おすすめ）", hold: "最後の画で止める", loop: "最初からくり返す" };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fin = (x: any, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);

/** sceneDur: seconds the scene is on screen; clipDur: clip length in seconds (unknown -> Infinity). */
export function clipPlan(o: ClipOpts, sceneDur: number, clipDur?: number): ClipPlan {
  const known = typeof clipDur === "number" && Number.isFinite(clipDur) && clipDur > 0;
  const len = known ? clipDur! : Infinity, dur = Math.max(0.01, sceneDur);
  const inPoint = clamp(fin(o.clipFrom, 0), 0, known ? Math.max(0, len - 0.05) : 1e9);
  const span = len - inPoint;
  let rate = o.fit && known ? span / dur : fin(o.speed, 1);
  rate = clamp(rate, SPEED_MIN, SPEED_MAX);
  if (!known || dur * rate <= span + 1e-6) return { rate, inPoint, mode: "play", span };
  const tail = o.tail ?? "auto";
  if (tail === "loop") return { rate, inPoint, mode: "loop", span };
  if (tail === "auto") { const r = span / dur; if (r >= SPEED_MIN) return { rate: r, inPoint, mode: "play", span }; return { rate: SPEED_MIN, inPoint, mode: "hold", span }; }
  return { rate, inPoint, mode: "hold", span };
}
/** time inside the clip (seconds) for `local` seconds after the scene starts. */
export function clipSourceTime(p: ClipPlan, local: number): number {
  let u = Math.max(0, local) * p.rate;
  if (p.mode === "loop" && Number.isFinite(p.span) && p.span > 0) u = u % p.span;
  if (Number.isFinite(p.span)) u = Math.min(u, Math.max(0, p.span - 0.04));
  return p.inPoint + u;
}
/** plain-Japanese one-liner for the UI. */
export function clipSummary(p: ClipPlan, sceneDur: number): string {
  const r = `${p.rate.toFixed(2)}倍速`;
  if (!Number.isFinite(p.span)) return `${r}（動画の長さが不明のため足りないときはくり返し）`;
  const used = Math.min(p.span, sceneDur * p.rate);
  return p.mode === "play" ? `${r}・動画の ${p.inPoint.toFixed(2)}〜${(p.inPoint + used).toFixed(2)}秒を使用` : p.mode === "loop" ? `${r}・動画が足りない分は最初からくり返し` : `${r}・動画が足りない分は最後の画で止める`;
}
