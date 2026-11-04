import { describe, expect, it } from "vitest";
import { prepareTrim, trimBoundary, deleteScene, insertAssetAt, pasteSceneAt, bakeClip } from "../editor/timeline";
import { clipPlan, clipSourceTime } from "../src/lib/clipspeed";
const D = 12, L = 30;
const info = (s: any) => ({ video: s.asset === 0, clipDur: s.asset === 0 ? L : undefined });
const scenes = () => [{ id: "a", start: 0, asset: 0, speed: 1 }, { id: "b", start: 4, asset: 0, speed: 1, clipFrom: 10 }, { id: "c", start: 8, asset: 1 }];
const srcAt = (sc: any[], i: number, t: number) => { const e = sc[i + 1]?.start ?? D; return clipSourceTime(clipPlan(sc[i], e - sc[i].start, L), t - sc[i].start); };

describe("editor timeline: one-step trim / delete / add / paste", () => {
  it("trimming a boundary keeps the next clip's footage in place (IN moves with the cut)", () => {
    const sc = scenes(), before = srcAt(sc, 1, 6);
    prepareTrim(sc, 1, D, info);
    expect(trimBoundary(sc, 1, 5, D, info)).toBeCloseTo(5);
    expect(sc[1].start).toBeCloseTo(5);
    expect(sc[1].clipFrom).toBeCloseTo(11);
    expect(srcAt(sc, 1, 6)).toBeCloseTo(before, 3);
  });
  it("trimming past a speed change keeps the footage in place too", () => {
    const sc: any[] = scenes(); sc[1].segments = [{ at: 0, speed: 1 }, { at: 1, speed: 0.5 }]; sc[1].speed = 1;
    prepareTrim(sc, 1, D, info); const before = srcAt(sc, 1, 7);
    expect(trimBoundary(sc, 1, 6, D, info)).toBeCloseTo(6);
    expect(sc[1].clipFrom).toBeCloseTo(11.5); // 1 s at 1x + 1 s at 0.5x
    expect(srcAt(sc, 1, 7)).toBeCloseTo(before, 3);
  });
  it("trim is clamped to the source (cannot pull IN before 0)", () => {
    const sc = scenes(); sc[1].clipFrom = 2; prepareTrim(sc, 1, D, info);
    expect(trimBoundary(sc, 1, 0.5, D, info)).toBeCloseTo(2); // only 2 s of footage before IN
    expect(sc[1].clipFrom).toBeCloseTo(0);
  });
  it("delete: previous scene fills the gap, first scene hands start 0 to the next, last one is kept", () => {
    const sc = scenes();
    expect(deleteScene(sc, 1)).toBeNull(); expect(sc.map((s) => s.id)).toEqual(["a", "c"]);
    expect(deleteScene(sc, 0)).toBeNull(); expect(sc[0]).toMatchObject({ id: "c", start: 0 });
    expect(typeof deleteScene(sc, 0)).toBe("string"); expect(sc.length).toBe(1);
  });
  it("add an image scene inside another: 4 s, no gaps, unique id", () => {
    const sc = scenes(), r = insertAssetAt(sc, 1, 1, D, info, { video: false });
    expect(typeof r).toBe("object");
    const k = (r as any).index; expect(sc[k]).toMatchObject({ asset: 1, start: 1 }); expect(sc[k + 1].start).toBeCloseTo(4);
    expect(new Set(sc.map((s) => s.id)).size).toBe(sc.length);
    for (let i = 1; i < sc.length; i++) expect(sc[i].start).toBeGreaterThan(sc[i - 1].start);
  });
  it("too close to the scene end gives a Japanese message instead of a broken timeline", () => {
    const sc = scenes(); expect(insertAssetAt(sc, 7.9, 1, D, info, { video: false })).toMatch(/近すぎます/);
  });
  it("copy (baked) + paste keeps the copied length where there is room", () => {
    const sc = scenes(), tmp = structuredClone(sc); bakeClip(tmp, 0, D, info);
    const r = pasteSceneAt(sc, 8.5, { scene: tmp[0], len: 2 }, D, info) as any;
    expect(sc[r.index].start).toBeCloseTo(8.5); expect((sc[r.index + 1]?.start ?? D) - sc[r.index].start).toBeCloseTo(2);
  });
});
