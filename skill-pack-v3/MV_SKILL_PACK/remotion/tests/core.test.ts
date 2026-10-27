import { describe, expect, it } from "vitest";
import { parseLyricJson, parseLrc, parseSrt, sectionTypeOf, charTimes } from "../src/lib/song";
import { CATALOG, STYLE_NAMES, canonicalStyle } from "../src/lib/catalog";
import { STYLES } from "../src/styles/styles";
import { resolveLines, findKeywords, mergeKeywords, matchSection, autoPick } from "../src/lib/resolve";
import { PRESETS, presetFromText, autoPreset } from "../src/lib/presets";
import { planShots, snapToBeat, cutTimes } from "../src/lib/cuts";
import { applyInstruction } from "../src/lib/nl";
import { applyTiming, buildProps } from "../src/lib/pipeline";
import { DEFAULT_CONFIG } from "../src/lib/config";
import { recommend, priceOf, estimate, loadModels } from "../scripts/gen";

const fixture = () => parseLyricJson({
  projectName: "t", fps: 30, audio: { duration: 60 },
  analysis: { bpm: 120, energy: Array.from({ length: 1200 }, (_, i) => (i > 600 && i < 900 ? 0.9 : 0.3)), markers: [{ type: "downbeat", time: 0.5 }],
    sections: [{ label: "INTRO", start: 0, end: 10 }, { label: "VERSE", start: 10, end: 30 }, { label: "CHORUS", start: 30, end: 45 }, { label: "OUTRO", start: 45, end: 60 }] },
  lyrics: [{ text: "はじまりの朝", start: 11, end: 14 }, { text: "君が好き", start: 31, end: 33 }, { text: "さよなら", start: 46, end: 49 }],
});

describe("parsers", () => {
  it("json", () => { const s = fixture(); expect(s.bpm).toBe(120); expect(s.phase).toBe(0.5); expect(s.lines).toHaveLength(3); expect(s.sections[2].type).toBe("chorus"); expect(s.energyHz).toBe(20); });
  it("srt", () => { const l = parseSrt("1\n00:00:01,000 --> 00:00:03,500\nこんにちは\n\n2\n00:00:04,000 --> 00:00:05,000\nさようなら\n"); expect(l).toHaveLength(2); expect(l[0].start).toBe(1); expect(l[0].end).toBe(3.5); });
  it("lrc", () => { const l = parseLrc("[00:01.00]あ\n[00:03.50]い\n", 10); expect(l[0].end).toBeGreaterThan(3.3); expect(l[0].end).toBeLessThanOrEqual(3.5); });
  it("section types (typos too)", () => { expect(sectionTypeOf("CHORS")).toBe("chorus"); expect(sectionTypeOf("VERS1")).toBe("verse"); expect(sectionTypeOf("OUTLO")).toBe("outro"); expect(sectionTypeOf("PRE-CHORS")).toBe("pre_chorus"); });
  it("char times proportional", () => { const c = (charTimes("あいう", 0, 3) as any).chars; expect(c).toHaveLength(3); expect(c[2].t0).toBeCloseTo(2, 0); });
});

describe("styles", () => {
  it("32 core styles + custom, all implemented", () => { expect(STYLE_NAMES.length).toBeGreaterThanOrEqual(32); for (const n of STYLE_NAMES) expect(STYLES[n], n).toBeTypeOf("function"); });
  it("aliases + JA names", () => { expect(canonicalStyle("film")).toBe("simple"); expect(canonicalStyle(CATALOG.glitch.short)).toBe("glitch"); expect(() => canonicalStyle("nope")).toThrow(); });
  it("auto pick varies by section", () => { expect(autoPick("chorus", 0, 0, "君が好き")[0]).not.toBe(autoPick("verse", 3, 0, "はじまり")[0]); });
  it("priority line > section > default", () => {
    const s = fixture();
    const r = resolveLines(s, { default: "simple", sections: { chorus: "neon" }, lines: { 2: "stamp" } } as any);
    expect(r[0].style).toBe("simple"); expect(r[1].style).toBe("neon"); expect(r[2].style).toBe("stamp");
  });
  it("section matching #last", () => { const s = fixture(); expect(matchSection({ "outro#last": "neon" } as any, s.sections[3], 0, true)).toBe("neon"); });
  it("keyword effects", () => { const k = findKeywords("君が好きだよ", mergeKeywords({ 好き: "heart" })); expect(k.some((x) => x.effect === "heart" && x.word === "好き")).toBe(true); });
});

describe("timing / cuts / presets", () => {
  it("snap to beat", () => { const s = fixture(); expect(snapToBeat(s, 1.26, 1)).toBeCloseTo(1.5); });
  it("cuts on beats", () => { const s = fixture(); const c = cutTimes(s, 10, 14, 2); for (const t of c) expect(((t - 0.5) / 0.5) % 1).toBeCloseTo(0); });
  it("every preset plans contiguous shots", () => {
    const s = fixture(); const media = [{ src: "a.jpg", kind: "image" as const }, { src: "b.jpg", kind: "image" as const }];
    for (const p of Object.values(PRESETS)) {
      const sh = planShots(s, p, media);
      expect(sh.length, p.id).toBeGreaterThan(p.id === "firsttake" ? 0 : 2);
      for (let i = 1; i < sh.length; i++) expect(sh[i].start).toBeCloseTo(sh[i - 1].end, 3);
      expect(sh[sh.length - 1].end).toBeCloseTo(60, 1);
    }
  });
  it("dance cuts faster than firsttake", () => { const s = fixture(), m = [{ src: "a.jpg", kind: "image" as const }]; expect(planShots(s, PRESETS.dance, m).length).toBeGreaterThan(planShots(s, PRESETS.firsttake, m).length * 3); });
  it("preset from JA text + auto", () => {
    expect(presetFromText("ファーストテイクっぽく")).toBe("firsttake"); expect(presetFromText("ボカロ風で")).toBe("vocaloid");
    expect(autoPreset({ bpm: 175, energyMean: 0.7, energyContrast: 0.3, linesPerMin: 30, hasVideo: false }).id ?? autoPreset({ bpm: 175, energyMean: 0.7, energyContrast: 0.3, linesPerMin: 30, hasVideo: false })).toBeTruthy();
  });
  it("timing offsets apply to lyrics", () => {
    const s = fixture(); const t = applyTiming(s, { ...DEFAULT_CONFIG, timing: { lyricIn: -0.2, perLine: { 1: { start: 30.5 } } } } as any);
    expect(t.lines[0].start).toBeCloseTo(10.8); expect(t.lines[1].start).toBeCloseTo(30.5);
  });
  it("buildProps 9:16 + clean ending", () => {
    const s = fixture(); const p = buildProps(s, { ...DEFAULT_CONFIG, aspect: "9:16" }, [{ src: "a.jpg", kind: "image" }]);
    expect(p.width).toBe(1080); expect(p.height).toBe(1920);
    for (const l of p.lines) expect(l.tEnd).toBeLessThanOrEqual(59.0001);
  });
});

describe("Japanese instructions", () => {
  const run = (t: string) => applyInstruction(DEFAULT_CONFIG, t).cfg as any;
  it("preset", () => expect(run("ボカロっぽくして").preset).toBe("vocaloid"));
  it("aspect", () => expect(run("縦長にして").aspect).toBe("9:16"));
  it("lyric offset", () => expect(run("歌詞を0.2秒早く").timing.lyricIn).toBeCloseTo(-0.2));
  it("section style", () => expect(JSON.stringify(run("サビはグリッチで"))).toContain("glitch"));
  it("AGENTS.md phrase table is fully understood", () => {
    for (const t of ["ボカロっぽく","ファーストテイク風","縦長で","正方形","インスタ 4:5","4Kで","全部の比率で","サビだけ縦のハイライトも","2番のAメロは手書き","最後のサビは派手に","3行目はハンコで","「好き」の行はネオン","「キライ」は割れるように","「甘い」は溶ける感じ","歌詞の消えるのを遅く","画は0.1秒前から切り替え","BPMは128","拍を半拍ずらして","サビは1/4拍で刻んで","Aメロは2小節ずつ","長回しで","揺れを弱く","光漏れ多め","粒子なし","文字大きく"])
      expect(applyInstruction(DEFAULT_CONFIG, t).changes.join(""), t).not.toContain("？");
  });
  it("half-beat shift moves the grid", () => { const c = applyInstruction(DEFAULT_CONFIG, "拍を半拍ずらして").cfg; expect(applyTiming(fixture(), c).phase).toBeCloseTo(0.5 + 0.25); });
  it("keyword effect", () => expect(JSON.stringify(run("「好き」はハートで"))).toContain("heart"));
});

describe("video generation plan", () => {
  const models = loadModels();
  it("registry: priced entries must be verified with a source", () => { for (const m of models) { expect(m.source).toBeTruthy(); if (!m.verified && !m.id.startsWith("manual/")) { expect(m.price_per_sec ?? null).toBeNull(); expect((m as any).price_per_image ?? null).toBeNull(); } } });
  it("recommend + cost", () => {
    const shot: any = { id: "S1", start: 0, end: 3, sectionType: "chorus", move: "push" };
    const r = recommend(shot, "dance", models); expect(r.model.verified).toBe(true); expect(r.model.deprecated).toBeFalsy();
    expect(estimate(3, 2, priceOf(r.model, "720p"))).toBeCloseTo(3 * 2 * priceOf(r.model, "720p")!);
    expect(estimate(3, 1, null)).toBeNull();
  });
});
