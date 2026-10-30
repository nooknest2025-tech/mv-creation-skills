// パーツアニメで踊るMVレシピ: カットが拍に乗り、歌詞の置き場所は行ごとに1つ（カットをまたいでも動かない）、重複なし、止める秒が入る。
import { describe, expect, it } from "vitest";
import fs from "fs"; import path from "path";
import { applyDance } from "../scripts/recipe_dance";
import { dupCheck, placementCheck } from "../scripts/lyric_checks";
import { solveChar, stopTimeOf, type TachieChar } from "../src/lib/tachie";
const tpl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/recipes/parts_dance_mv_template.json"), "utf8"));
const lyrics = Array.from({ length: 10 }, (_, i) => ({ id: `L${String(i + 1).padStart(3, "0")}`, text: i % 3 ? "あいうえお　かきくけこ" : "さしすせそ（Hey!）", start: 2 + i * 2.6, end: 4.2 + i * 2.6 }));
const data = { fps: 24, bpm: 120, phase: 0, duration: 30, title: "テスト曲", lyrics, scenes: [], sections: [{ type: "intro", start: 0, end: 2 }, { type: "verse", start: 2, end: 14 }, { type: "pre", start: 14, end: 20 }, { type: "chorus", start: 20, end: 30 }],
  assets: [{ kind: "tachie", src: "assets/tachie/main.json", stage: { kind: "tachie", chars: [{ id: "a", rig: "rig_a", x: 0.5, h: 0.9 }], palette: ["#000", "#f80", "#fff", "#ff0"], bg: "halftone" } }] };
describe("parts dance recipe", () => {
  const { data: out, stage, camFix } = applyDance(JSON.parse(JSON.stringify(data)), data.assets[0].stage, tpl, { hits: [{ t: 21 }, { t: 22.5 }] });
  it("lays beat cuts with layouts, freezes at the end, hits alternate hey/ho", () => {
    expect(out.scenes.length).toBeGreaterThan(10);
    for (const s of out.scenes) { expect(Math.abs(((s.start / 0.5) % 1 + 1) % 1 - 0.5)).toBeGreaterThan(0.45 - 1e-6); expect(s.stage.layout).toBeTruthy(); }
    expect(out.scenes.at(-1).stage.layout).toBe("full");
    expect(stage.freezeAt).toBeCloseTo(29.98, 3); expect(stage.hideLyricsAtStop).toBe(true);
    expect(stage.hits.map((h: any) => h.move)).toEqual(["hit_hey", "hit_ho"]);
    expect(stage.chars[0].motion).toBe("pop_dance");
  });
  it("one placement per line: never changes mid-line, no duplicate text, ≤1 stage line per frame", () => {
    const pos = placementCheck(out); expect(pos.positionChangesMidLine).toBe(0); expect(pos.linesSpanningCuts).toBeGreaterThan(0);
    const dup = dupCheck(out); expect(dup.duplicates).toBe(0); expect(dup.maxLyricLinesPerFrame).toBeLessThanOrEqual(1);
    for (const id of camFix) expect(out.scenes.find((s: any) => s.id === id).stage.cam.s).toBeLessThan(1);
  });
  it("a dragged line keeps its x/y in every cut it spans; a per-cut hwLyrics patch is caught", () => {
    const d2 = JSON.parse(JSON.stringify(out)); Object.assign(d2.lyrics[3], { x: 0.3, y: 0.47, position: "manual", edited: ["stageStyle", "x", "y", "position"] });
    expect(placementCheck(d2).positionChangesMidLine).toBe(0);
    const l = d2.lyrics[3], sp = d2.scenes.filter((s: any) => s.start < l.end && s.end > l.start); expect(sp.length).toBeGreaterThan(1);
    sp[1].stage.hwLyrics = { [l.id]: { place: stage.hwLyrics[l.id].place === "bottom" ? "side" : "bottom" } };
    expect(placementCheck(d2).positionChangesMidLine).toBe(1);
  });
  it("freezeAt wins over the lyric end", () => { expect(stopTimeOf(lyrics, 30, undefined, 24, 29.5)).toBe(29.5); });
  it("elbows / knees / per-pose arm layers on a joint rig", () => {
    const P = (id: string, kind: string, parent: string | null, pivot: number[], z: number, extra: any = {}) => ({ id, src: id + ".png", kind, parent, pivot, z, ...extra });
    const rig: any = { name: "t", size: [800, 1280], legs: true, floorY: 1069, zArm: { bend: 45, front: { arm: 7.4, sleeve: 7.6, fore: 7.7, hand: 7.8 }, side: { arm: 5, fore: 4.9, hand: 4.95, sleeve: 7.5 } }, parts: [
      P("hips", "hips", null, [400, 690], 1), P("leg_l", "leg_l", null, [350, 695], 2.1, { foot: [350, 1069], knee: [350, 880] }), P("shin_l", "shin_l", "leg_l", [350, 880], 2), P("foot_l", "foot_l", "shin_l", [350, 1069], 3),
      P("leg_r", "leg_r", null, [450, 695], 2.1, { foot: [450, 1069], knee: [450, 880] }), P("shin_r", "shin_r", "leg_r", [450, 880], 2), P("foot_r", "foot_r", "shin_r", [450, 1069], 3),
      P("body", "body", "hips", [400, 650], 7), P("arm_l", "arm_l", "body", [292, 425], 5), P("fore_l", "fore_l", "arm_l", [281, 546], 7.2), P("hand_l", "hand_l", "fore_l", [272, 671], 7.3), P("sleeve_l", "sleeve_l", "arm_l", [292, 425], 7.5, { follow: 0 }),
      P("arm_r", "arm_r", "body", [508, 425], 5), P("fore_r", "fore_r", "arm_r", [519, 546], 7.2), P("hand_r", "hand_r", "fore_r", [527, 671], 7.3), P("head", "head", "body", [400, 392], 9)] };
    const c: TachieChar = { id: "a", rig, base: "", x: 0.5, h: 0.9, motion: "pop_dance" } as any;
    const ctx = (t: number, move: string) => ({ t, beat: { bpm: 120, phase: 0 }, chorus: true, singing: false, mora: [], seed: 1, section: "verse", hits: [{ t: 0, move, beats: 100 }], moves: tpl.stage.moves } as any);
    const fold = solveChar(c, ctx(1, "heart")) as any, side = solveChar(c, ctx(1, "stand")) as any, squat = solveChar(c, ctx(1, "claw_low")) as any;
    expect(Math.abs(fold.fore_l.rot)).toBeGreaterThan(45); expect(fold.fore_l.z).toBe(7.7); expect(fold.arm_l.z).toBe(7.4); expect(side.fore_l.z).toBe(4.9); expect(side.sleeve_l.z).toBe(7.5);
    expect(Math.abs(squat.shin_l.rot)).toBeGreaterThan(1);
  });
});
