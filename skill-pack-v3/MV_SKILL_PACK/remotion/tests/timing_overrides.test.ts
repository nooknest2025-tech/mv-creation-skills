import { describe, expect, it } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { parseLyricJson } from "../src/lib/song";
import { DEFAULT_CONFIG } from "../src/lib/config";
import { applyShotOffsets, applyTiming } from "../src/lib/pipeline";
import { applySave, validateSave, DEFAULT_CUT_LEAD } from "../scripts/timing";

const fixture = () => parseLyricJson({
  projectName: "t", fps: 30, audio: { duration: 60 },
  analysis: { bpm: 120, energy: Array.from({ length: 1200 }, () => 0.5), markers: [{ type: "downbeat", time: 0.5 }],
    sections: [{ label: "VERSE", start: 0, end: 30 }, { label: "CHORUS", start: 30, end: 60 }] },
  lyrics: [{ text: "あ", start: 11, end: 14 }, { text: "い", start: 31, end: 33 }, { text: "う", start: 40, end: 42 }],
});

describe("timing: global + individual", () => {
  it("per-line offset is added on top of global + section", () => {
    const t = applyTiming(fixture(), { ...DEFAULT_CONFIG, timing: { lyricIn: -0.2, perSection: { CHORUS: { lyricIn: 0.1 } }, perLine: { 2: { offset: -0.3 } } } } as any);
    expect(t.lines[0].start).toBeCloseTo(10.8);
    expect(t.lines[1].start).toBeCloseTo(30.9);
    expect(t.lines[2].start).toBeCloseTo(40 - 0.2 + 0.1 - 0.3);
    expect(t.lines[2].end).toBeCloseTo(42 - 0.3); // 全体lyricInは出だしだけ、個別は行ごと移動
    expect(t.lines[2].words[0].t).toBeCloseTo(t.lines[2].start, 1);
  });
  it("explicit per-line start still wins over offsets", () => {
    const t = applyTiming(fixture(), { ...DEFAULT_CONFIG, timing: { lyricIn: -0.2, perLine: { 0: { start: 12, offset: 1 } } } } as any);
    expect(t.lines[0].start).toBeCloseTo(12);
  });
  it("per-shot offset moves the cut boundary (start + previous end) with clamping", () => {
    const shots = [{ id: "A", start: 0, end: 2 }, { id: "B", start: 2, end: 4 }, { id: "C", start: 4, end: 6 }];
    const r = applyShotOffsets(shots, { perShot: { B: { offset: -0.25 }, C: { offset: 9 } } });
    expect(r[1].start).toBeCloseTo(1.75); expect(r[0].end).toBeCloseTo(1.75);
    expect(r[2].start).toBeCloseTo(5.9); expect(r[1].end).toBeCloseTo(5.9);
    expect(shots[1].start).toBe(2); // input untouched
    expect(applyShotOffsets(shots, { perShot: { A: { offset: -1 } } })[0].start).toBe(0); // first cut fixed
  });
});

describe("timing save + validation", () => {
  const mk = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "tim-")); fs.writeFileSync(path.join(d, "mv.config.json"), JSON.stringify({ timing: { perShot: { S002: { src: "x.jpg" } } } })); return d; };
  it("stores cutShift (minus=earlier) as cutLead and per-item offsets", () => {
    const d = mk();
    const T = applySave(d, { cutShift: -0.1, lyricIn: 0.2, lineOffsets: { 3: -0.15 }, shotOffsets: { S002: 0.05, S003: -0.1 }, sectionOffsets: { CHORUS: { cut: -0.05, lyric: 0.1 } } });
    expect(T.cutLead).toBeCloseTo(DEFAULT_CUT_LEAD + 0.1);
    expect(T.perLine!["3"].offset).toBeCloseTo(-0.15);
    expect(T.perShot!.S002).toEqual({ src: "x.jpg", offset: 0.05 });
    expect(T.perSection!.CHORUS).toEqual({ cutLead: 0.05, lyricIn: 0.1 });
    const T2 = applySave(d, { shotOffsets: { S002: 0, S003: 0 }, lineOffsets: { 3: 0 }, sectionOffsets: { CHORUS: { cut: 0, lyric: 0 } } });
    expect(T2.perShot!.S002).toEqual({ src: "x.jpg" }); expect(T2.perShot!.S003).toBeUndefined();
    expect(T2.perLine!["3"]).toBeUndefined(); expect(T2.perSection!.CHORUS).toBeUndefined();
  });
  it("rejects bad values", () => {
    expect(() => validateSave({ lineOffsets: { 0: 99 } })).toThrow();
    expect(() => validateSave({ shotOffsets: { "../x": 0.1 } })).toThrow();
    expect(() => validateSave({ cutShift: "a" })).toThrow();
    expect(() => validateSave({ bpm: 1000 })).toThrow();
    expect(() => validateSave({ sectionOffsets: { CHORUS: { cut: NaN } } })).toThrow();
    expect(() => validateSave({ bpm: 120, cutShift: -0.1, lineOffsets: { 0: 0.2 }, shotOffsets: { S001: -0.1 }, sectionOffsets: { VERSE: { lyric: 0.1 } } })).not.toThrow();
  });
});
