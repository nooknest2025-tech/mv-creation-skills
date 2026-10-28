import { describe, it, expect } from "vitest";
import { moveAt, snap, solveChar, MOVES, ROUTINES, ANIM_FPS, type TachieChar } from "../src/lib/tachie";
const beat = { bpm: 139, phase: 0, beatsPerBar: 4 };
const rig: any = { name: "t", size: [640, 640], parts: [{ id: "body", src: "b", kind: "body", pivot: [320, 600], z: 1 }, { id: "arm_r", src: "a", kind: "arm_r", parent: "body", pivot: [400, 350], z: 2 }, { id: "mouth", src: "m", kind: "mouth", parent: "body", pivot: [0, 0], z: 3, states: { a: "a", i: "i" } }] };
const c: TachieChar = { id: "black", rig, base: "", x: 0.3, h: 0.7, motion: "guitar" };
const ctx = (t: number, section = "verse") => ({ t, beat, chorus: section === "chorus", singing: false, mora: [], seed: 1, section });
describe("tachie dance moves", () => {
  it("every routine move exists", () => { for (const r of Object.values(ROUTINES)) for (const ph of Object.values(r)) for (const [m] of ph) expect(MOVES[m]).toBeDefined(); });
  it("verse is half-time: pose held for 2 beats", () => { const B = 60 / 139; expect(moveAt("guitar", ctx(0), 0.1).cur).toBe(moveAt("guitar", ctx(0), 1.9).cur); expect(moveAt("guitar", ctx(0), 2.1).cur).not.toBe(moveAt("guitar", ctx(0), 0.1).cur); expect(B).toBeGreaterThan(0); });
  it("snap overshoots once then holds", () => { expect(snap(0)).toBeLessThan(1); expect(snap(1 / ANIM_FPS + 0.001)).toBeGreaterThan(1); expect(snap(0.5)).toBe(1); });
  it("body is stepped (limited animation) and held mid-beat", () => { const a = solveChar(c, ctx(1.0)).body, b = solveChar(c, ctx(1.0 + 0.3 / ANIM_FPS)).body; expect(a).toEqual(b); const h1 = solveChar(c, ctx(0.5)).body, h2 = solveChar(c, ctx(0.7)).body; expect(h1.rot).toBeCloseTo(h2.rot, 6); });
  it("mouth uses half-open frame for small openings", () => { const p = solveChar(c, { ...ctx(0.1), singing: true, mora: [{ ch: "あ", t0: 0, t1: 0.4 }] }); expect(["a", "i", undefined]).toContain(p.mouth.state); });
});
import { lipAt, freezeT, lastBeatOf, moraOf, stopTimeOf } from "../src/lib/tachie";
describe("tachie v3", () => {
  it("mouth closed with no lyric, opens on a loud sung mora, shut in breath gaps", () => {
    const vocal = { fps: 24, v: Array(100).fill(1) }, mora = moraOf({ id: "x", text: "あ　あ", start: 0, end: 1 });
    expect(lipAt({ ...ctx(0.1), singing: false, vocal } as any)).toBe("closed");
    expect(lipAt({ ...ctx(mora[0].t0 + 0.05), singing: true, mora, vocal } as any)).not.toBe("closed");
    expect(lipAt({ ...ctx((mora[0].t1 + mora[1].t0) / 2), singing: true, mora, vocal } as any)).toBe("closed");
    expect(lipAt({ ...ctx(mora[0].t0 + 0.05), singing: true, mora, vocal: { fps: 24, v: Array(100).fill(0) } } as any)).not.toBe("a");
  });
  it("final kime on the last beat, frozen afterwards", () => {
    const end = 30.76, lb = lastBeatOf(beat, end); expect(lb).toBeLessThanOrEqual(end); expect(end - lb).toBeLessThan(60 / 139 + 1e-6);
    expect(freezeT(end + 5, beat, end)).toBe(freezeT(end, beat, end));
    const a = solveChar(c, { ...ctx(end), end }), b = solveChar(c, { ...ctx(end + 3), end }); expect(a).toEqual(b);
  });
});
describe("tachie v4 arms", () => {
  it("chorus arms swing wide (>=40deg) and stay stepped", () => {
    let mx = 0; for (let t = 16; t < 20; t += 1 / 24) { const p = solveChar(c, { ...ctx(t, "chorus") }); mx = Math.max(mx, Math.abs(p.arm_r.rot)); }
    expect(mx).toBeGreaterThanOrEqual(40);
    const a = solveChar(c, ctx(16.0, "chorus")).arm_r, b = solveChar(c, ctx(16.0 + 0.3 / 12, "chorus")).arm_r; expect(a).toEqual(b);
  });
});
import { layoutAt, lyricModeOf, keywordOf } from "../src/render/Tachie";
describe("tachie v5 direction", () => {
  it("chorus layout changes every 1-2 beats, verse holds longer", () => {
    let ch = 0, prev = ""; for (let b = 0; b < 32; b++) { const l = layoutAt(b, true, false); if (l !== prev) ch++; prev = l; } expect(ch).toBeGreaterThanOrEqual(14);
    let v = 0; prev = ""; for (let b = 0; b < 32; b++) { const l = layoutAt(b, false, false); if (l !== prev) v++; prev = l; } expect(v).toBeLessThan(ch);
  });
  it("keyword + modes", () => { expect(keywordOf("白い仮面に　赤いまなざし")).toBe("仮面"); expect(lyricModeOf(0, "letterbox")).toBe(lyricModeOf(0, "duo")); });
  it("stops at the end of the last lyric: dances until then, kime snaps there, still afterwards", () => {
    const end = stopTimeOf([{ end: 10 }, { end: 29.952 }], 30.76)!; expect(end).toBeCloseTo(29.952);
    const seen = new Set<string>(); for (let t = end - 2; t < end - 0.05; t += 1 / 30) seen.add(JSON.stringify(solveChar(c, { ...ctx(t, "chorus"), end }).arm_r)); expect(seen.size).toBeGreaterThanOrEqual(3);
    const a = solveChar(c, { ...ctx(end, "chorus"), end }); expect(solveChar(c, { ...ctx(end + 0.05, "chorus"), end })).toEqual(a); expect(solveChar(c, { ...ctx(30.76, "chorus"), end })).toEqual(a);
  });
});
describe("tachie v5.2 stop time", () => {
  it("vocal end wins when earlier and is floored to a frame", () => {
    expect(stopTimeOf([{ end: 29.76 }], 30.76, 29.458, 30)).toBeCloseTo(Math.floor(29.458 * 30) / 30, 6);
    expect(stopTimeOf([{ end: 29.76 }], 30.76, undefined, 30)!).toBeLessThanOrEqual(29.76);
  });
});
import { visibleLines } from "../src/render/Tachie";
import fsx from "fs";
describe("tachie v5.3 lyrics", () => {
  it("each line has one style regardless of cut, and lines never overlap", () => {
    const L = JSON.parse(fsx.readFileSync("../projects/パーツアニメ試作/lyrics.json", "utf8")).lyrics.map((l: any, i: number) => ({ id: "L" + i, ...l }));
    const modes = new Map<string, Set<string>>();
    for (let t = 0; t < 31; t += 1 / 30) { const v = visibleLines(L, t); expect(v.length).toBeLessThanOrEqual(1);
      for (const l of v) for (let b = 0; b < 16; b++) { const s = modes.get(l.id) ?? new Set<string>(); s.add(lyricModeOf(L.indexOf(l), layoutAt(b, true, false))); modes.set(l.id, s); } }
    for (const s of modes.values()) expect(s.size).toBe(1);
  });
});
import { tateBox } from "../src/render/Tachie";
import { singersOf } from "../src/lib/tachie";
describe("tachie v5.6 tate balloon", () => {
  it("content fits the inner safe box and the balloon stays on screen-size", () => {
    const L = JSON.parse(fsx.readFileSync("../projects/パーツアニメ試作/lyrics.json", "utf8")).lyrics;
    for (const l of L) { const cols = l.text.replace(/（.*?）|\(.*?\)/g, "").split(/[　\s、]/).filter(Boolean); const b = tateBox(cols.length, Math.max(...cols.map((c: string) => Array.from(c).length)), 64.8, 1920, 1080);
      expect(b.contentW).toBeLessThanOrEqual(b.w * 0.61); expect(b.contentH).toBeLessThanOrEqual(b.h * 0.61); expect(b.w).toBeLessThanOrEqual(1920 * 0.34 + 1); expect(b.h).toBeLessThanOrEqual(1080 * 0.86 + 1); }
  });
});
describe("tachie v5.7 third dancer", () => {
  it("cafe rig is complete, dances choppy, sings its own lines and every chorus call", () => {
    const st = JSON.parse(fsx.readFileSync("../projects/パーツアニメ試作/tachie/chorus.tachie.json", "utf8"));
    const rig = JSON.parse(fsx.readFileSync("../projects/パーツアニメ試作/tachie/rig_cafe/rig.json", "utf8"));
    expect(st.chars.map((c: any) => c.id)).toEqual(["black", "gothic", "cafe"]);
    for (const p of rig.parts) { expect(fsx.existsSync("../projects/パーツアニメ試作/tachie/rig_cafe/" + p.src)).toBe(true); for (const s of Object.values(p.states ?? {})) expect(fsx.existsSync("../projects/パーツアニメ試作/tachie/rig_cafe/" + s)).toBe(true); }
    expect(rig.parts.filter((p: any) => /ear|hair_back/.test(p.id))).toEqual([]); // cap + ears live only in the head part
    const L = JSON.parse(fsx.readFileSync("../projects/パーツアニメ試作/lyrics.json", "utf8")).lyrics.map((l: any, i: number) => ({ ...l, id: "L" + i }));
    expect(singersOf(st, L, L[2])).toEqual(["cafe"]); expect(singersOf(st, L, L[0])).toEqual(["black"]); expect(singersOf(st, L, L[6]).length).toBe(3);
    expect(ROUTINES.dance.chorus.every(([m]) => m in MOVES)).toBe(true);
  });
});

// v5.8 floating stickers
import { floaterAt as _floaterAt } from "../src/lib/tachie";
describe("v5.8 floaters", () => {
  const it0 = { id: "seal", frames: { open: "a.webp", closed: "b.webp", mouth: "c.webp" }, h: 0.2, pattern: ["open", "mouth"], blink: "closed", ranges: [{ start: 5, end: 8, x: 0.9, y: 0.2 }] };
  const beat = { bpm: 139, phase: 0, beatsPerBar: 4 };
  it("hidden outside its ranges, shown inside", () => { expect(_floaterAt(it0, 4.9, beat)).toBeNull(); expect(_floaterAt(it0, 8.01, beat)).toBeNull(); expect(_floaterAt(it0, 6, beat)).not.toBeNull(); });
  it("stepped at 12fps (on twos) and stays inside the corner", () => { const a = _floaterAt(it0, 6.0, beat)!, b = _floaterAt(it0, 6.05, beat)!; expect(a.y).toBe(b.y); for (let t = 5; t < 8; t += 0.03) { const r = _floaterAt(it0, t, beat)!; expect(Math.abs(r.y - 0.2)).toBeLessThan(0.02); expect(Math.abs(r.x - 0.9)).toBeLessThan(0.01); } });
  it("switches frames over time", () => { const seen = new Set<string>(); for (let t = 5; t < 8; t += 1 / 12) seen.add(_floaterAt(it0, t, beat)!.frame); expect(seen.size).toBeGreaterThanOrEqual(2); });
});

// v6.0 two-loop timeline
import { lyricsInWin, shiftVocal } from "../src/lib/tachie";
describe("v6.0 two loops", () => {
  const ls = [{ start: 1 }, { start: 29 }, { start: 34.5 }, { start: 62 }];
  it("each stage sees only its loop's lines", () => { expect(lyricsInWin(ls, [0, 30.76]).length).toBe(2); expect(lyricsInWin(ls, [33.67, 999]).map((l) => l.start)).toEqual([34.5, 62]); });
  it("loop 2 reads the same vocal frames", () => { const v = { fps: 24, v: [0.1, 0.5, 0.9] }, s = shiftVocal(v, 2)!; expect(s.v[48 + 1]).toBe(0.5); expect(s.v[10]).toBe(0); });
});

// v6.2 vertical lyric columns never break mid-word
import { vertCols } from "../src/render/Tachie";
describe("v6.2 vertical columns", () => {
  it("ミスター・ヘンドレ！ splits after ・", () => { expect(vertCols("ミスター・ヘンドレ！")).toEqual(["ミスター・", "ヘンドレ！"]); });
  it("spaces split, short words stay whole", () => { expect(vertCols("誰も知らない　なぜか歌える")).toEqual(["誰も知らない", "なぜか歌える"]); expect(vertCols("偽物だって？")).toEqual(["偽物だって？"]); });
});
