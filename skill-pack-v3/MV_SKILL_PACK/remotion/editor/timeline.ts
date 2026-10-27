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
/** which edges a scene block shows: left = its start (not for the first scene, which starts at 0),
 *  right = its end (not for the last scene, which always ends with the song). */
export function sceneEdges(i: number, n: number): ("start" | "end")[] {
  const e: ("start" | "end")[] = []; if (i > 0) e.push("start"); if (i < n - 1) e.push("end"); return e;
}
/** scenes are back-to-back: scene i's right edge IS the boundary in front of scene i+1. */
export const sceneBoundaryIndex = (i: number, edge: "start" | "end") => (edge === "start" ? i : i + 1);
/** pin preview+timeline? saved choice wins ("1"/"0"); otherwise only on tall screens (>= 900px). */
export const PIN_MIN_HEIGHT = 900;
export function pinDefault(saved: string | null, viewportH: number): boolean {
  return saved === "1" ? true : saved === "0" ? false : viewportH >= PIN_MIN_HEIGHT;
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

/** when a scene's material is swapped: drop the old clip trim/speed. A video starts in 「自動で合わせる」(fit) mode. */
export function resetClipForAsset(s: any, isVideo: boolean) {
  for (const k of ["clipFrom", "clipTo", "speed", "segments", "solve", "ease", "tail", "fit"]) delete s[k];
  if (isVideo) s.fit = true; return s;
}
export const ADD_ASSET_EXT = /\.(png|jpe?g|webp|gif|svg|mp4|mov|m4v|webm)$/i;
export const isVideoName = (n: string) => /\.(mp4|mov|m4v|webm)$/i.test(n);

/** Ctrl+drag (そのシーンだけ): scenes stay back-to-back, neighbours are trimmed/extended but never below `min`. */
export const MIN_SOLO = 0.5;
const endOf = (sc: { start: number }[], k: number, duration: number) => sc[k + 1]?.start ?? duration;
export function resizeSceneOnly(sc: { start: number }[], i: number, edge: "start" | "end", t: number, duration: number, min = MIN_SOLO): number {
  const b = edge === "start" ? i : i + 1; if (b <= 0 || b >= sc.length) return edge === "start" ? sc[i].start : endOf(sc, i, duration);
  const lo = sc[b - 1].start + min, hi = endOf(sc, b, duration) - min; if (lo > hi) return sc[b].start;
  return (sc[b].start = +Math.max(lo, Math.min(hi, t)).toFixed(3));
}
/** Ctrl+drag the body: the scene keeps its length and moves. The previous scene stretches/shrinks to meet it,
 *  the next one is trimmed/extended. First scene always starts at 0; last scene always ends with the song. */
export function moveSceneOnly(sc: { start: number }[], i: number, start0: number, end0: number, delta: number, duration: number, min = MIN_SOLO) {
  const n = sc.length, len = end0 - start0;
  if (i === 0 || n < 2) { if (n > 1) resizeSceneOnly(sc, 0, "end", end0 + delta, duration, min); return; }
  if (i === n - 1) { resizeSceneOnly(sc, i, "start", start0 + delta, duration, min); return; }
  const lo = sc[i - 1].start + min, hi = endOf(sc, i + 1, duration) - min - len; if (lo > hi) return;
  const s = +Math.max(lo, Math.min(hi, start0 + delta)).toFixed(3); sc[i].start = s; sc[i + 1].start = +(s + len).toFixed(3);
}
