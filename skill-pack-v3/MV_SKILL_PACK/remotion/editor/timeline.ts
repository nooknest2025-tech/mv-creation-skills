// Mouse timeline helpers for the editor (pure, unit-tested). All edits go to editor-state data only.
export const MIN_SCENE = 0.1, MIN_LYRIC = 0.1;
/** nearest beat (or bar with bars=true) when within `tol` seconds; else t. */
export function snapTime(t: number, bpm: number, phase = 0, tol = 0.12, bars = false): number {
  const B = (60 / (bpm || 120)) * (bars ? 4 : 1); const k = Math.round((t - phase) / B), s = phase + k * B;
  return Math.abs(s - t) <= tol ? +s.toFixed(3) : t;
}
/** move the boundary between scene i-1 and scene i (= scenes[i].start). Neighbour adjusts automatically. */
export function resizeBoundary(scenes: { start: number }[], i: number, t: number, duration: number): number {
  if (i <= 0 || i >= scenes.length) return scenes[i]?.start ?? 0;
  const lo = scenes[i - 1].start + MIN_SCENE, hi = (scenes[i + 1]?.start ?? duration) - MIN_SCENE;
  const v = +Math.max(lo, Math.min(hi, t)).toFixed(3); scenes[i].start = v; return v;
}
/** drag a lyric's start or end edge (stays inside 0..duration-1 and keeps >= MIN_LYRIC). */
export function moveLyricEdge(l: { start: number; end: number }, edge: "start" | "end", t: number, duration: number): number {
  if (edge === "start") l.start = +Math.max(0, Math.min(l.end - MIN_LYRIC, t)).toFixed(3);
  else l.end = +Math.min(duration - 1, Math.max(l.start + MIN_LYRIC, t)).toFixed(3);
  return l[edge];
}
/** drag a whole lyric block (keeps its length). */
export function moveLyric(l: { start: number; end: number }, delta: number, duration: number) {
  const len = l.end - l.start, s = Math.max(0, Math.min(duration - 1 - len, l.start + delta));
  l.start = +s.toFixed(3); l.end = +(s + len).toFixed(3);
}
/** drag a video clip body: dragging right shows earlier footage (like sliding film under a window). */
export function slideInPoint(from0: number, dragSeconds: number, rate: number, clipDur?: number): number {
  const max = clipDur && Number.isFinite(clipDur) ? Math.max(0, clipDur - 0.05) : 1e9;
  return +Math.max(0, Math.min(max, from0 - dragSeconds * (rate || 1))).toFixed(3);
}
export const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
