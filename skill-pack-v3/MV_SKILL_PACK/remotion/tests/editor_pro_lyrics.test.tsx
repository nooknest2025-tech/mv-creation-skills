import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Scene, sectionFor } from "../editor/editor-scene";
import { mergeSceneSlivers } from "../src/lib/sceneSlivers";

const text = "突き刺さったヤイバ";
const chars = Array.from(text).map((ch, idx) => ({ ch, idx, t0: 0.488 + idx * 0.2, t1: 0.688 + idx * 0.2 }));
const data = (motion: string, sections?: any[]) => ({
  width: 1280, height: 720, fps: 24, bpm: 153, phase: 0, duration: 129.5, title: "rock", audioFile: "assets/original.mp3",
  assets: [{ src: "assets/image-0.jpg" }], scenes: [{ id: "S1", start: 0, end: 129.5, asset: 0 }], ...(sections ? { sections } : {}),
  lyrics: [{ text, start: 0.488, end: 2.55, chars, words: [{ i0: 0, i1: 9, t: 0.488 }], id: "L001", motion, scale: 0.72, y: 0.8, motionDuration: 0.8,
    params: { exit: 0.28, font: "zen_kaku", palette: { fill: "#ffffff", stroke: "#0a0a0a", accent: "#d7192a" } } }],
});

describe("editor preview renders stills-mode pro_* lyrics", () => {
  for (const motion of ["pro_slide", "pro_diag", "pro_box", "pro_stretch", "pro_smash"])
    for (const sections of [undefined, [{ type: "verse", label: "Aメロ", start: 0, end: 30 }]])
      test(`${motion} ${sections ? "with" : "without"} sections at 1.5s`, () => {
        const html = renderToString(<Scene data={data(motion, sections)} t={1.5} />);
        expect(html).toContain("<img");
        expect(html).toMatch(/突|&#/);
        expect(html).not.toContain("NaN");
      });
  test("pro_slide glyphs have finished entering at 1.5s (not stuck below their mask)", () => {
    const html = renderToString(<Scene data={data("pro_slide")} t={1.5} />);
    const ty = [...html.matchAll(/translate\(([-\d.]+)px, ([-\d.]+)px\) rotate\(0deg\) scale\(1, 1\)/g)].map((m) => Math.abs(+m[2]));
    expect(ty.length).toBeGreaterThan(0);
    for (const y of ty) expect(y).toBeLessThan(5);
      });
  test("sectionFor never returns undefined", () => {
    expect(sectionFor(undefined, 1)).toEqual({ section: "", sectionType: "other" });
    expect(sectionFor([{ type: "chorus", label: "サビ", start: 0, end: 9 }], 1).sectionType).toBe("chorus");
  });
});

describe("mergeSceneSlivers", () => {
  test("drops 0.2s slivers into the previous scene", () => {
    const s = [{ start: 0, end: 32.6, asset: 1 }, { start: 32.6, end: 32.8, asset: 0 }, { start: 32.8, end: 71.3, asset: 2 }, { start: 71.3, end: 71.5, asset: 0 }, { start: 71.5, end: 129.5, asset: 3 }];
    const m = mergeSceneSlivers(s, 129.5);
    expect(m.map((x) => x.asset)).toEqual([1, 2, 3]);
    expect(m[0].end).toBe(32.8);
    for (let i = 0; i < m.length; i++) expect((m[i + 1]?.start ?? 129.5) - m[i].start).toBeGreaterThanOrEqual(0.5);
  });
  test("a sliver at the start merges forward", () => {
    const m = mergeSceneSlivers([{ start: 0, end: 0.2, asset: 0 }, { start: 0.2, end: 5, asset: 1 }], 5);
    expect(m).toHaveLength(1); expect(m[0]).toMatchObject({ start: 0, asset: 1 });
  });
});
