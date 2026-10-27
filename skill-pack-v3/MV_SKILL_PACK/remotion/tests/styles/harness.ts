// Test harness for lyric styles: builds a real ResolvedLine and calls the style at several times / aspect ratios.
import { charTimes } from "../../src/lib/song";
import { resolveLines } from "../../src/lib/resolve";
import { STYLES } from "../../src/styles/styles";
import type { Ctx } from "../../src/styles/prims";
import type { Song } from "../../src/lib/types";

export const ASPECTS_WH: [number, number][] = [[1920, 1080], [1080, 1920], [1080, 1080], [1080, 1350]];
export function lineFor(style: string, text = "光の中で 君を呼ぶ キライ", start = 1, end = 3) {
  const words = text.split(" ");
  const tot = words.join("").length; let acc = start;
  const ws = words.map((w) => { const d = ((end - start) * w.length) / tot; const o = { text: w, start: acc, end: acc + d }; acc += d; return o; });
  const song: Song = { title: "t", duration: 6, fps: 30, bpm: 120, phase: 0, beatsPerBar: 4, energy: [], energyHz: 0, sections: [{ label: "CHORUS", type: "chorus", start: 0, end: 6 }],
    lines: [{ text, start, end, ...charTimes(text, start, end, ws) }] };
  return resolveLines(song, { force: style })[0];
}
/** run a style; returns boxes per sample time (throws if output is invalid). */
export function sample(style: string, W: number, H: number, times = [0.9, 1.2, 2, 2.9, 3.4]) {
  const L = lineFor(style);
  return times.map((t) => {
    const c: Ctx = { L, t, P: L.params, W, H, beat: { bpm: 120, phase: 0, beatsPerBar: 4 }, k: 1, textY: W > H ? 0.84 : 0.68 };
    const out = STYLES[style](c);
    return { t, out, boxes: out.boxes.filter(Boolean) };
  });
}
