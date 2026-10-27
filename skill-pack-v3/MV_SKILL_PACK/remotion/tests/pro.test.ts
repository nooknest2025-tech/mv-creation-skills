// v3.1: mood styles, fit-based selection, variety/seed, picture-aware text, hybrid structures, pro critic (manual locks kept).
import { describe, expect, it } from "vitest";
import { ASPECTS_WH, sample } from "./styles/harness";
import { MOOD_STYLES } from "../src/lib/moods";
import { TRAITS } from "../src/lib/traits";
import { CATALOG } from "../src/lib/catalog";
import { resolveLines } from "../src/lib/resolve";
import { charTimes } from "../src/lib/song";
import { banReason, fitSet } from "../src/lib/direction";
import { placeText, readableFill, contrast, relLum } from "../src/lib/visual";
import { HYBRIDS, HYBRID_IDS, applyHybrid, distribute, pickHybrid } from "../src/lib/hybrids";
import { review } from "../src/lib/critic";
import { applyInstruction } from "../src/lib/nl";
import { buildProps } from "../src/lib/pipeline";
import type { Section, Shot, Song } from "../src/lib/types";

const TEXTS = ["遠い街の灯りに", "君を想う夜", "さよならの代わりに", "もう一度だけ", "光の中で", "君を呼ぶ", "届かない声", "それでも歌う"];
/** synthetic 3-minute song: intro, verse, pre, chorus x2 blocks, bridge, last chorus, outro */
function song3(bpm = 120): Song {
  const plan: [string, Section["type"], number][] = [["INTRO", "intro", 8], ["VERSE1", "verse", 24], ["PRE1", "pre_chorus", 12], ["CHORUS1", "chorus", 24], ["VERSE2", "verse", 24], ["PRE2", "pre_chorus", 12], ["CHORUS2", "chorus", 24], ["BRIDGE", "bridge", 16], ["CHORUS3", "chorus", 24], ["OUTRO", "outro", 12]];
  const sections: Section[] = []; let t = 0;
  for (const [label, type, d] of plan) { sections.push({ label, type, start: t, end: t + d }); t += d; }
  const lines: Song["lines"] = []; let k = 0;
  for (const s of sections) for (let a = s.start + 0.5; a + 2.5 < s.end; a += 3) { const tx = TEXTS[k++ % TEXTS.length]; lines.push({ text: tx, start: a, end: a + 2.4, ...charTimes(tx, a, a + 2.4) }); }
  const energy = [...Array(t * 10)].map((_, i) => { const s = sections.find((x) => i / 10 >= x.start && i / 10 < x.end)!; return s.type === "chorus" ? 0.9 : s.type === "pre_chorus" ? 0.6 : s.type === "verse" ? 0.4 : 0.2; });
  return { title: "pro", duration: t, fps: 30, bpm, phase: 0, beatsPerBar: 4, energy, energyHz: 10, sections, lines };
}
const distinct = (L: { style: string }[]) => new Set(L.map((x) => x.style)).size;

describe("mood styles (composable motion)", () => {
  it("32 new styles, each mood-tagged and in the catalogue", () => {
    expect(Object.keys(MOOD_STYLES).length).toBeGreaterThanOrEqual(30);
    for (const [k, m] of Object.entries(MOOD_STYLES)) { expect(CATALOG[k]).toBeTruthy(); expect(m.moods.length).toBeGreaterThan(0); expect(TRAITS[k]).toBeTruthy(); }
    const groups = new Set(Object.values(MOOD_STYLES).flatMap((m) => m.moods));
    for (const g of ["ballad", "acoustic", "citypop", "wa", "hiphop", "idol", "rock", "dark", "ambient"]) expect(groups.has(g)).toBe(true);
  });
  it.each(Object.keys(MOOD_STYLES))("%s renders inside every aspect without NaN", (name) => {
    for (const [W, H] of ASPECTS_WH) for (const s of sample(name, W, H)) for (const b of s.boxes) {
      expect(b.every(Number.isFinite)).toBe(true);
      expect(b[0]).toBeGreaterThan(-W * 0.05); expect(b[2]).toBeLessThan(W * 1.05); expect(b[1]).toBeGreaterThan(-H * 0.05); expect(b[3]).toBeLessThan(H * 1.05);
    }
  });
});

describe("fit-based variety", () => {
  it("3-minute song gets >= 5 distinct styles by default, deterministic per seed, reroll changes it", () => {
    const S = song3();
    const a = resolveLines(S, { genre: "idol_pop" }), b = resolveLines(S, { genre: "idol_pop" }), c = resolveLines(S, { genre: "idol_pop", seed: 7 });
    expect(distinct(a)).toBeGreaterThanOrEqual(5);
    expect(a.map((x) => x.style)).toEqual(b.map((x) => x.style));
    expect(c.map((x) => x.style)).not.toEqual(a.map((x) => x.style));
    for (const g of ["ballad", "rock_edm", "citypop_jazz", "wa", "hiphop", "acoustic", "dark", "ambient", null]) expect(distinct(resolveLines(S, { genre: g as any }))).toBeGreaterThanOrEqual(5);
  });
  it("variety slider: 統一感 < 変化多め", () => {
    const S = song3();
    expect(distinct(resolveLines(S, { genre: "rock_edm", variety: 0.1 }))).toBeLessThan(distinct(resolveLines(S, { genre: "rock_edm", variety: 0.95 })));
  });
  it("each genre's fit pool has 6-10 styles", () => {
    for (const g of ["ballad", "rock_edm", "citypop_jazz", "idol_pop", "wa", "hiphop", "acoustic", "dark", "ambient"]) expect(fitSet({ genre: g, secType: "verse", energy: 0.5, cps: 4, bpm: 120, text: "" }, 10).length).toBeGreaterThanOrEqual(6);
  });
  it("a slow ballad NEVER gets glitch / shaky / heavy styles, whatever the seed", () => {
    const S = song3(72);
    for (let seed = 1; seed <= 12; seed++) for (const L of resolveLines(S, { genre: "ballad", seed, variety: 0.9 })) {
      expect(TRAITS[L.style].shaky).toBeFalsy(); expect(TRAITS[L.style].intensity).toBeLessThanOrEqual(0.55); expect(L.style).not.toBe("glitch");
    }
    expect(banReason("glitch", { genre: "ballad", secType: "chorus", energy: 1, cps: 3, bpm: 70, text: "" })).toBeTruthy();
  });
  it("chorus is more intense than verse (arc) and at most one hero per section", () => {
    const L = resolveLines(song3(), { genre: "rock_edm" });
    const avg = (t: string) => { const x = L.filter((l) => l.sectionType === t); return x.reduce((a, l) => a + TRAITS[l.style].intensity, 0) / x.length; };
    expect(avg("chorus")).toBeGreaterThan(avg("verse"));
    for (const sec of new Set(L.map((l) => l.section))) expect(L.filter((l) => l.section === sec && l.hero).length).toBeLessThanOrEqual(1);
  });
  it("no identical style on consecutive lines inside a section when the section has 2+ styles", () => {
    const L = resolveLines(song3(), { genre: "idol_pop", variety: 0.9 });
    let rep = 0; for (let i = 1; i < L.length; i++) if (L[i].section === L[i - 1].section && L[i].style === L[i - 1].style) rep++;
    expect(rep / L.length).toBeLessThan(0.15);
  });
});

describe("picture-aware text", () => {
  const band = (lum: number, busy: number, rgb: [number, number, number]) => ({ lum, busy, rgb });
  it("moves lyrics off a face sitting low in the frame", () => {
    const vis: any = { bands: { top: band(0.2, 0.05, [40, 40, 40]), mid: band(0.3, 0.2, [80, 80, 80]), bottom: band(0.3, 0.1, [80, 80, 80]) } };
    const face: any = { eyes: [[0.45, 0.7, 0.03, 0.02], [0.55, 0.7, 0.03, 0.02]], mouth: [0.5, 0.82, 0.05, 0.02] };
    const p = placeText(vis, face, 0.84);
    expect(p.band).not.toBe("bottom");
    expect(placeText(vis, undefined, 0.84).band).toBe("bottom");
  });
  it("text colour contrasts with the background (>= 4.5:1)", () => {
    const bright = readableFill(band(0.9, 0.1, [240, 240, 235]), "#ffffff");
    expect(bright.changed).toBe(true); expect(bright.ratio).toBeGreaterThanOrEqual(4.5);
    const dark = readableFill(band(0.03, 0.1, [20, 20, 30]), "#ffffff");
    expect(dark.changed).toBe(false); expect(contrast(relLum(dark.fill), 0.03)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("hybrid structures", () => {
  it("12 templates, selectable in Japanese", () => {
    expect(HYBRID_IDS.length).toBeGreaterThanOrEqual(10);
    expect((applyInstruction({} as any, "ストーリー＋リップシンクで").cfg as any).structure).toBe("story_lipsync");
    expect((applyInstruction({} as any, "サビだけ歌うシーン").cfg as any).structure).toBe("chorus_sing");
    expect((applyInstruction({} as any, "別パターンで").cfg as any).lyrics.seed).toBe(2);
    expect((applyInstruction({} as any, "リリックは統一感重視").cfg as any).lyrics.variety).toBeLessThan(0.3);
  });
  it("ratio mix is honoured and intercut (chorus 70% lip-sync)", () => {
    const r = distribute(10, HYBRIDS.story_lipsync.sections.chorus!);
    expect(r.filter((x) => x === "lipsync").length).toBe(7);
    expect(r.slice(0, 4)).toContain("story"); // intercut, not blocked
  });
  it("lip-sync shots get images with faces, story shots stop the mouth; prompts reflect the role", () => {
    const face = { eyes: [[0.4, 0.4, 0.02, 0.01]] } as any;
    const mk = (i: number, type: any, src: string, f?: any): Shot => ({ id: `S${i}`, start: i, end: i + 1, src, kind: "image", move: "kb_in", section: type, sectionType: type, face: f, puppet: { blink: 1, mouth: 1, breath: 1, hair: 0, sway: 0, bounce: 0 } });
    const shots = [mk(0, "verse", "a.jpg"), mk(1, "verse", "b.jpg"), mk(2, "chorus", "a.jpg"), mk(3, "chorus", "b.jpg"), mk(4, "chorus", "a.jpg")];
    applyHybrid(shots, "chorus_sing", { pool: [{ src: "a.jpg", kind: "image" }, { src: "f.jpg", kind: "image", face }] });
    for (const s of shots.filter((x) => x.sectionType === "chorus")) { expect(s.role).toBe("lipsync"); expect(s.src).toBe("f.jpg"); expect(s.prompt).toMatch(/singing/); }
    for (const s of shots.filter((x) => x.sectionType === "verse")) { expect(s.role).toBe("story"); expect(s.puppet!.mouth).toBe(0); }
  });
  it("auto pick follows fit: no faces -> never a lip-sync-dependent template", () => {
    expect(HYBRIDS[pickHybrid("ballad", 0, 8).id].needsFaces).toBeFalsy();
    expect(HYBRIDS[pickHybrid("idol_pop", 0.8, 8).id].genres).toContain("idol_pop");
  });
});

describe("pro critic", () => {
  const shot = (i: number, move: string, locked = false): Shot => ({ id: `S${i}`, start: i * 2, end: i * 2 + 2, src: "a.jpg", kind: "image", move, sectionType: "verse", section: "V", locked });
  it("fixes 3x same move on auto shots", () => {
    const shots = [0, 1, 2, 3].map((i) => shot(i, "kb_in"));
    const r = review({ shots, lines: [], beat: { bpm: 120, phase: 0 }, textY: 0.84 });
    expect(r.issues.some((x) => x.rule === "same_move" && x.fixed)).toBe(true);
    expect(shots[2].move).not.toBe("kb_in");
    expect(r.note).toMatch(/演出メモ/);
  });
  it("manual mode: user-locked shots and lyric styles are kept, but suggestions are emitted", () => {
    const shots = [0, 1, 2].map((i) => shot(i, "kb_in", true));
    const r = review({ shots, lines: [], beat: { bpm: 120, phase: 0 }, textY: 0.84 });
    expect(shots.every((s) => s.move === "kb_in")).toBe(true);
    expect(r.issues.some((x) => x.rule === "same_move" && !x.fixed && /3回/.test(x.msg))).toBe(true);
    // user forces glitch on a ballad line via config -> kept, critic suggests
    const S = song3(72);
    const p = buildProps(S, { genre: "ballad", lyrics: { lines: { "0": "glitch" } } } as any, []);
    expect(p.lines.find((l) => l.li === 0)!.style).toBe("glitch");
    expect(p.review!.issues.some((x) => x.rule === "fit" && !x.fixed && x.at === "L0")).toBe(true);
    expect(p.review!.note).toMatch(/ご指定箇所は変えていません/);
  });
  it("hero restraint: two big moves in one section -> the auto one is demoted", () => {
    const S = song3();
    const p = buildProps(S, { genre: "rock_edm", lyrics: { variety: 1 } } as any, []);
    for (const sec of new Set(p.lines.map((l) => l.section))) expect(p.lines.filter((l) => l.section === sec && !l.locked && TRAITS[l.style].hero).length).toBeLessThanOrEqual(1);
  });
  it("readability: short lines are extended when there is room", () => {
    const S = song3(); S.lines[0].end = S.lines[0].start + 0.3; S.lines[0].text = "遠い街の灯りに君を想う夜"; Object.assign(S.lines[0], charTimes(S.lines[0].text, S.lines[0].start, S.lines[0].end));
    const p = buildProps(S, {} as any, []);
    const L = p.lines.find((l) => l.li === 0)!;
    expect(L.tOff - L.tOn).toBeGreaterThanOrEqual(12 / 7 + 0.3 - 0.01);
  });
});
