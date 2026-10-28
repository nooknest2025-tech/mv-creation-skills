import { pythonWith, skipNote, PY_FIX } from "./_caps";
// pro motion core, motion-graphics director, combinable show modes, semi-auto mode, parts animation rig.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { EASE, accentState, beatAccents, contrastRatio, cubicBezier, flowAnchor, gridAnchor, heldScream, hierarchy, isParticle, literalColor, PALETTES, poseHold, springOver, syllables, unitStarts } from "../src/lib/pro";
import { RECIPES, comboFromText, composeCombo, directPro, estimateCuts, moodOf, proposeCombo } from "../src/lib/mograph";
import { applyInstruction } from "../src/lib/nl";
import { parsePick, semiQuestions, semiToPlan } from "../src/lib/semi";
import { autoRig, blinkAt, editRig, guessKind, layersToRig, mouthAt, rigIssues, secondary, solveRig, vowelOf, PARTS_PRESETS, partsPresetFromText } from "../src/lib/rig";
import { buildProps } from "../src/lib/pipeline";
import { ROLES } from "../src/lib/hybrids";
import { PRO_CATALOG, CATALOG } from "../src/lib/catalog";
import { TRAITS } from "../src/lib/traits";
import { STYLES } from "../src/styles/styles";
import { ASPECTS_WH, sample } from "./styles/harness";
import { charTimes } from "../src/lib/song";
import type { Section, Song } from "../src/lib/types";

function song(bpm = 120, extra: Partial<Song> = {}): Song {
  const plan: [string, Section["type"], number][] = [["INTRO", "intro", 8], ["VERSE1", "verse", 16], ["PRE1", "pre_chorus", 8], ["CHORUS1", "chorus", 16], ["BRIDGE", "bridge", 8], ["CHORUS2", "chorus", 16]];
  const sections: Section[] = []; let t = 0;
  for (const [label, type, d] of plan) { sections.push({ label, type, start: t, end: t + d }); t += d; }
  const texts = ["光の中で君を呼ぶ", "赤い夜明けを待つ", "モノクロの街で", "それでも歌う"]; const lines: Song["lines"] = []; let k = 0;
  for (const s of sections) for (let a = s.start + 0.5; a + 2.5 < s.end; a += 3) { const tx = texts[k++ % texts.length]; lines.push({ text: tx, start: a, end: a + 2.4, ...charTimes(tx, a, a + 2.4) }); }
  const energy = [...Array(t * 10)].map((_, i) => (sections.find((x) => i / 10 >= x.start && i / 10 < x.end)!.type === "chorus" ? 0.9 : 0.4));
  return { title: "pm", duration: t, fps: 30, bpm, phase: 0, beatsPerBar: 4, energy, energyHz: 10, sections, lines, ...extra };
}

describe("pro motion core", () => {
  it("expo-out does ~90% of the travel in the first 15-20%", () => { expect(EASE.expoOut(0.2)).toBeGreaterThan(0.85); expect(EASE.expoOut(1)).toBe(1); expect(EASE.expoOut(0)).toBe(0); });
  it("cubic-bezier matches the linear identity and is monotonic", () => { const lin = cubicBezier(0.25, 0.25, 0.75, 0.75); expect(lin(0.3)).toBeCloseTo(0.3, 2); let p = -1; for (let i = 0; i <= 20; i++) { const v = EASE.snappy(i / 20); expect(v).toBeGreaterThanOrEqual(p - 1e-9); p = v; } });
  it("spring overshoots to ~1.1-1.2 and settles", () => { const peak = Math.max(...[...Array(100)].map((_, i) => springOver(i / 100, 1.15))); expect(peak).toBeGreaterThan(1.1); expect(peak).toBeLessThan(1.2); expect(springOver(1)).toBe(1); });
  it("pose-to-pose: snaps then keeps drifting (never a dead freeze)", () => { expect(poseHold(0.5, 0.5)).toBeCloseTo(1, 3); expect(poseHold(2, 0.5, 0.04, 3)).toBeGreaterThan(1); expect(poseHold(2, 0.5)).toBeLessThan(poseHold(3, 0.5)); });
  it("syllables attach small kana and long vowels", () => { expect(syllables([..."きょうはー"])).toEqual([[0, 1], [2], [3, 4]]); });
  it("uses real char timing when present, else 2-3 frame stagger", () => {
    const timed = unitStarts([{ ch: "あ", t0: 1 }, { ch: "い", t0: 1.5 }, { ch: "う", t0: 2 }], 1); expect(timed).toEqual([1, 1.5, 2]);
    const flat = unitStarts([{ ch: "あ", t0: 1 }, { ch: "い", t0: 1 }, { ch: "う", t0: 1 }], 1, 30, 2.5); expect(flat[1] - flat[0]).toBeCloseTo(2.5 / 30, 5);
  });
  it("hierarchy: key word big, particles 50-70% (mincho when mixing)", () => {
    const ch = [..."君の名前を叫ぶ"], h = hierarchy(ch, { mix: true });
    expect(isParticle(ch, 1)).toBe(true); expect(h[1].scale).toBeGreaterThanOrEqual(0.5); expect(h[1].scale).toBeLessThanOrEqual(0.7); expect(h[1].mincho).toBe(true);
    expect(h[2].role).toBe("key"); expect(h[2].scale).toBeGreaterThan(1);
  });
  it("3x3 grid + diagonal flow never parks consecutive lines on the same anchor", () => { for (let s = 0; s < 20; s++) for (let i = 0; i < 6; i++) expect(flowAnchor(i, s)).not.toBe(flowAnchor(i + 1, s)); const [x, y] = gridAnchor(8); expect(x).toBeGreaterThan(0.7); expect(y).toBeGreaterThan(0.7); });
  it("strict palettes: 4 colours, readable fg on bg", () => { for (const p of Object.values(PALETTES)) expect(contrastRatio(p.fg, p.bg)).toBeGreaterThan(4.5); });
  it("lyric-literal colour", () => { expect(literalColor("赤い夜明け")?.accent).toBe("#d7192a"); expect(literalColor("モノクロの街")?.mono).toBe(true); expect(literalColor("ただの言葉")).toBeNull(); });
  it("beat accents: invert lasts exactly 2 frames on the bar", () => {
    const acc = beatAccents({ bpm: 120, phase: 0, beatsPerBar: 4 }, 0, 4, 2, ["invert", "bump"]);
    expect(acc.length).toBe(8); expect(acc[0].kind).toBe("invert");
    expect(accentState(acc, 0.01, 30).invert).toBe(true); expect(accentState(acc, 1 / 30 + 0.01, 30).invert).toBe(true); expect(accentState(acc, 2 / 30 + 0.001, 30).invert).toBe(false);
  });
  it("held scream shakes only in loud sections", () => { const c = [{ t0: 0, t1: 2 }]; expect(heldScream(c, 1, 0.9)).toBeGreaterThan(0); expect(heldScream(c, 1, 0.3)).toBe(0); });
});

describe("pro lyric styles", () => {
  it("11 pro styles registered with catalog + traits, existing ids untouched", () => {
    expect(Object.keys(PRO_CATALOG).length).toBe(11);
    for (const k of Object.keys(PRO_CATALOG)) { expect(STYLES[k], k).toBeTypeOf("function"); expect(TRAITS[k].pro).toBe(true); expect(CATALOG[k]).toBeTruthy(); }
    for (const k of ["simple", "kinetic", "reveal", "glitch", "tategaki"]) expect(STYLES[k]).toBeTypeOf("function");
  });
  it("every pro style renders at every aspect, boxes stay mostly on screen", () => {
    for (const st of Object.keys(PRO_CATALOG)) for (const [W, H] of ASPECTS_WH) {
      const r = sample(st, W, H); const mid = r[2];
      expect(mid.boxes.length, `${st} ${W}x${H}`).toBeGreaterThan(0);
      for (const b of mid.boxes) { expect(b[0]).toBeGreaterThan(-W * 0.05); expect(b[2]).toBeLessThan(W * 1.05); }
    }
  });
});

describe("show modes (multi-select, combinable)", () => {
  it("natural Japanese combos", () => {
    expect(comboFromText("ダンス＋リリックモーションで")).toEqual(["dance", "lyric_motion"]);
    expect(comboFromText("物語＋タイポグラフィで")).toEqual(["story", "typography"]);
    expect(comboFromText("リップシンク＋モーショングラフィックスで")).toEqual(["lipsync", "mograph"]);
    expect(comboFromText("モーショングラフィックスで")).toEqual(["mograph"]);
    expect(comboFromText("ストーリー＋リップシンクで")).toBeNull(); // existing named template keeps priority
    expect(comboFromText("サビは速く")).toBeNull();
  });
  it("applyInstruction sets combo + structure and explains the section mix", () => {
    const r = applyInstruction({}, "ダンス＋リリックモーションで");
    expect(r.cfg.combo).toEqual(["dance", "lyric_motion"]); expect(r.changes[0]).toMatch(/ダンス＋リリックモーション/); expect(r.changes[0]).toMatch(/サビ/);
  });
  it("picture + typography: chorus becomes full-screen typography", () => {
    const c = composeCombo(["dance", "typography"]);
    expect(c.textMode.chorus).toBe("typo"); expect(c.hybrid.sections.chorus!.typo).toBeGreaterThan(c.hybrid.sections.chorus!.dance!); expect(c.hybrid.sections.verse!.dance).toBeGreaterThan(0.5);
    for (const sec of Object.values(c.hybrid.sections)) for (const role of Object.keys(sec!)) expect(ROLES[role], role).toBeTruthy();
  });
  it("buildProps with a combo assigns typo / mograph roles and section palettes", () => {
    const media = [...Array(8)].map((_, i) => ({ src: `m${i}.jpg`, kind: "image" as const }));
    const p: any = buildProps(song(), { combo: ["story", "typography"] } as any, media);
    expect(p.structure).toBe("combo_story_typography");
    expect(p.shots.some((s: any) => s.role === "typo" && s.sectionType === "chorus")).toBe(true);
    expect(p.mograph.sections.length).toBe(6);
    const typoLine = p.lines.find((L: any) => p.shots.find((s: any) => L.start >= s.start && L.start < s.end)?.role === "typo");
    if (typoLine) expect(typoLine.params.palette.fill).toBeTruthy();
  });
});

describe("pro auto director", () => {
  it("maps moods", () => { expect(moodOf("rock_edm", 150)).toBe("rock"); expect(moodOf("ballad", 70)).toBe("ballad"); expect(moodOf(null, 128)).toBe("electronic"); expect(moodOf(null, 110)).toBe("pop"); });
  it("rock chorus: 8th-note cuts (when enough media), smash/crop type, white-black-red, accents", () => {
    const p = directPro(song(150), { genre: "rock_edm", nMedia: 20 }); const ch = p.sections.find((s) => s.type === "chorus")!;
    expect(ch.cutBeats).toBe(0.5); expect(ch.lyricPrefer[0]).toBe("pro_smash"); expect(ch.palette.id).toBe("mono_red"); expect(ch.accentDensity).toBe(3);
    expect(p.accents.some((a) => a.kind === "invert")).toBe(true);
  });
  it("ballad: tanzaku / long holds / slow transitions / no accents in verses", () => {
    const p = directPro(song(70), { genre: "ballad" }); const v = p.sections.find((s) => s.type === "verse")!;
    expect(v.look).toBe("tanzaku"); expect(v.cutBeats).toBeGreaterThanOrEqual(8); expect(v.accentDensity).toBe(0); expect(RECIPES.ballad.tr).toContain("slow_wipe");
  });
  it("full auto avoids cheap defaults: pro styles dominate, no simple/karaoke", () => {
    const p: any = buildProps(song(128), {} as any, [...Array(10)].map((_, i) => ({ src: `m${i}.jpg`, kind: "image" as const })));
    const pro = p.lines.filter((L: any) => TRAITS[L.style]?.pro).length; expect(pro / p.lines.length).toBeGreaterThan(0.6);
    expect(p.lines.some((L: any) => L.style === "simple" || L.style === "karaoke")).toBe(false);
    expect(p.mograph).toBeTruthy(); expect(p.structureWhy).toMatch(/自動提案/);
  });
  it("pro can be switched off (classic look, existing behaviour)", () => { const p: any = buildProps(song(), { pro: false } as any, []); expect(p.mograph).toBeUndefined(); });
  it("lyric colour words recolour the accent", () => { const p = directPro(song(), {}); expect(p.sections.some((s) => s.palette.accent === "#d7192a")).toBe(true); });
  it("density changes the cut count", () => { const s = song(); expect(estimateCuts(s, null, "fast")).toBeGreaterThan(estimateCuts(s, null, "normal")); expect(estimateCuts(s, null, "slow")).toBeLessThan(estimateCuts(s, null, "normal")); });
  it("auto proposal uses faces / media", () => { expect(proposeCombo("rock", 0.5, 10)).toContain("lipsync"); expect(proposeCombo("pop", 0, 0)).not.toContain("story"); });
});

describe("semi-auto (半自動)", () => {
  it("every question has a recommended default; Enter accepts", () => { const qs = semiQuestions({ nImages: 0, bpm: 150, genre: "rock_edm" }); expect(qs.map((q) => q.id)).toEqual(["show", "taste", "density", "video", "lyric", "parts"]); for (const q of qs) { expect(q.recommend.length).toBe(1); expect(parsePick("", q)).toEqual(q.recommend); } });
  it("multi-select show modes", () => { const q = semiQuestions()[0]; expect(parsePick("3,5", q)).toEqual(["dance", "lyric_motion"]); expect(parsePick("1+6", q)).toEqual(["story", "typography"]); });
  it("answers -> instructions that applyInstruction understands", () => {
    const r = semiToPlan({ show: ["dance", "lyric_motion"], taste: ["anime"], density: ["fast"], video: ["chorus"], parts: ["wave"] });
    const a = applyInstruction({}, r.say.join("。"));
    expect(a.cfg.combo).toEqual(["dance", "lyric_motion"]); expect(a.cfg.taste).toBe("anime"); expect(a.cfg.density).toBe("fast"); expect(a.cfg.gen?.scope).toBe("chorus"); expect(a.cfg.parts?.preset).toBe("wave");
    expect(r.plan.join("\n")).toMatch(/自動で決めます/);
  });
  it("図形中心 forces motion graphics", () => { expect(semiToPlan({ taste: ["graphic"], show: ["story"] }).combo).toContain("mograph"); });
});

describe("parts animation (パーツアニメ)", () => {
  const layers = [{ name: "後ろ髪", src: "hb.png", bbox: [250, 170, 550, 640] }, { name: "体", src: "b.png", bbox: [190, 470, 610, 1190] }, { name: "左腕", src: "al.png", bbox: [232, 525, 292, 840] },
    { name: "右腕", src: "ar.png", bbox: [508, 525, 568, 840] }, { name: "頭", src: "h.png", bbox: [285, 230, 515, 500] }, { name: "目", src: "e.png", bbox: [328, 335, 472, 395] }, { name: "目_閉じ", src: "ec.png", bbox: [324, 350, 476, 390] },
    { name: "口", src: "m.png", bbox: [385, 440, 415, 450] }, { name: "口_a", src: "ma.png", bbox: [382, 432, 418, 470] }, { name: "前髪", src: "hf.png", bbox: [270, 165, 530, 330] }, { name: "リボン", src: "r.png", bbox: [420, 160, 540, 240] }] as any;
  const rig = layersToRig("t", [800, 1200], layers);
  it("guesses kinds, states, parents and pivots", () => {
    expect(guessKind("左腕")).toBe("arm_l"); expect(guessKind("hair_front")).toBe("hair");
    expect(rig.parts.length).toBe(9); const eye = rig.parts.find((p) => p.kind === "eyes")!; expect(eye.states?.closed).toBe("ec.png");
    const head = rig.parts.find((p) => p.kind === "head")!; expect(head.pivot[1]).toBeGreaterThan(470); // neck
    expect(rig.parts.find((p) => p.kind === "hair")!.parent).toBe(head.id); expect(rig.parts.find((p) => p.kind === "accessory")!.parent).toBe(head.id);
    expect(rig.parts.find((p) => p.kind === "arm_l")!.pivot[1]).toBeLessThan(560); // shoulder
    expect(rigIssues(rig)).toEqual([]);
  });
  it("editRig fixes a pivot and locks it", () => { const r = JSON.parse(JSON.stringify(rig)); editRig(r, "頭.pivot=400,490"); const h = r.parts.find((p: any) => p.kind === "head"); expect(h.pivot).toEqual([400, 490]); expect(h.locked).toBe(true); expect(() => editRig(r, "bad")).toThrow(); });
  it("rigIssues reports missing head / mouth", () => { expect(rigIssues(autoRig("x", [10, 10], [{ name: "body", src: "a", bbox: [0, 0, 10, 10] }])).join()).toMatch(/頭/); });
  it("mouth opens on lyric mora with vowel shapes; closed between", () => {
    const mora = [{ t0: 1, t1: 1.3, ch: "あ" }, { t0: 1.3, t1: 1.6, ch: "い" }];
    expect(mouthAt(mora, 1.15).shape).toBe("a"); expect(mouthAt(mora, 1.45).shape).toBe("i"); expect(mouthAt(mora, 3).shape).toBe("closed"); expect(vowelOf("ょ")).toBe("o");
  });
  it("blinks are short and periodic", () => { let n = 0; for (let t = 0; t < 20; t += 1 / 30) if (blinkAt(t) > 0.5) n++; expect(n).toBeGreaterThan(5); expect(n).toBeLessThan(40); });
  it("presets drive head / arms; spring hair lags the head", () => {
    const c = { beat: { bpm: 120, phase: 0, beatsPerBar: 4 }, energy: 0.9, mora: [] };
    const w = solveRig(rig, "wave", 1.1, c), arm = rig.parts.find((p) => p.kind === "arm_r")!; expect(Math.abs(w[arm.id].rot)).toBeGreaterThan(10);
    const t = solveRig(rig, "tilt", 2, c), head = rig.parts.find((p) => p.kind === "head")!; expect(Math.abs(t[head.id].rot)).toBeGreaterThan(8);
    const g = solveRig(rig, "groove", 0.3, c), hair = rig.parts.find((p) => p.kind === "hair")!; expect(g[hair.id].rot).not.toBe(0);
    expect(secondary(() => 0, 1, 1)).toBeCloseTo(0, 9);
  });
  it("Japanese: 腕を振って / 首をかしげて / サビはノリノリで", () => {
    expect(partsPresetFromText("キャラは腕を振って")).toBe("wave"); expect(applyInstruction({}, "首をかしげて").cfg.parts?.preset).toBe("tilt");
    const r = applyInstruction({}, "サビはキャラがノリノリで"); expect((r.cfg.parts?.preset as any).chorus).toBe("groove");
    expect(Object.keys(PARTS_PRESETS)).toEqual(expect.arrayContaining(["idle", "nod", "sing", "groove", "wave", "tilt"]));
  });
  it("buildProps attaches parts segments (おまかせ: chorus = groove/sing)", () => {
    const p: any = buildProps(song(), { parts: { rigData: rig } } as any, []);
    expect(p.parts.segments.find((s: any) => s.type === "chorus").preset).toMatch(/groove|sing/); expect(p.parts.segments.find((s: any) => s.type === "intro").preset).toBe("idle");
  });
  const py = pythonWith(["PIL", "numpy"]); if (!py) skipNote("パーツ分割（parts.py）", "numpy / Pillow 入りの Python が見つかりません", PY_FIX);
  it.skipIf(!py)("parts.py: demo character -> split a flattened image into rough parts (local, free)", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "parts-")), script = path.join(__dirname, "..", "scripts", "parts.py");
    expect(spawnSync(py!, [script, "demo", "--out", path.join(d, "demo")]).status).toBe(0);
    const L = JSON.parse(fs.readFileSync(path.join(d, "demo", "layers.json"), "utf8")); expect(L.layers.length).toBeGreaterThanOrEqual(10);
    // flatten on white, then split
    const flat = path.join(d, "flat.png");
    expect(spawnSync(py!, ["-c", `from PIL import Image\nimport json,os\nd='${path.join(d, "demo")}'\nL=json.load(open(os.path.join(d,'layers.json')))\nim=Image.new('RGBA',tuple(L['size']),(255,255,255,255))\nfor l in L['layers']:\n  n=l['name']\n  if '_' in n: continue\n  im.alpha_composite(Image.open(os.path.join(d,l['file'])))\nim.convert('RGB').save('${flat}')`]).status).toBe(0);
    const r = spawnSync(py!, [script, "split", flat, "--out", path.join(d, "split"), "--no-rembg"], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    const S = JSON.parse(fs.readFileSync(path.join(d, "split", "layers.json"), "utf8"));
    expect(S.layers.map((l: any) => l.name)).toEqual(expect.arrayContaining(["体", "頭"])); expect(S.note).toMatch(/自動分解/);
    expect(fs.existsSync(path.join(d, "split", "background_plate.png"))).toBe(true);
  }, 60000);
});
