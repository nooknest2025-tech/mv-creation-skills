// Range playback helpers: lyric = start..end, scene = start..next scene start for the editor (pure, unit-tested).
export type Range = [number, number];
export const LYRIC_PAD = 0; // exactly the set start..end (no padding)
export function lyricRange(l: { start: number; end: number }, duration: number, pad = LYRIC_PAD): Range {
  return [Math.max(0, l.start - pad), Math.min(duration, Math.max(l.start + 0.1, l.end) + pad)];
}
export function sceneRange(scenes: { start: number }[], i: number, duration: number): Range {
  const a = scenes[i]?.start ?? 0, b = scenes[i + 1]?.start ?? duration;
  return [Math.max(0, a), Math.min(duration, Math.max(a + 0.1, b))];
}
/** what to do at playback time t: keep playing, jump back to the start (loop), or stop. */
export function loopStep(t: number, r: Range, loop: boolean): "play" | "restart" | "stop" {
  if (t < r[1] && t >= r[0] - 0.05) return "play";
  if (t < r[0] - 0.05) return "restart"; // edited so the range moved after the playhead
  return loop ? "restart" : "stop";
}
