import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import YAML from "yaml";
import { charTimes } from "../src/lib/song";
import { planStills, stillsMd, needsStills } from "../src/lib/stills";
import { semiToPlan } from "../src/lib/semi";
import { buildProps, pickPreset } from "../src/lib/pipeline";
import { applyInstruction } from "../src/lib/nl";
import { reviewShotList, buildSpecs } from "../src/lib/shotprompt";
import { videoMcps } from "../scripts/doctor_lib";
import type { Section, Song } from "../src/lib/types";

/** 「突き刺していいよ」-like: 153 BPM rock, ~3 min, Verse1/Pre/Chorus/Verse2/Chorus/Bridge/Outro. */
function rockSong(): Song {
  const plan: [string, Section["type"], number][] = [["Verse1", "verse", 30], ["Pre-Chorus", "pre_chorus", 16], ["Chorus", "chorus", 30], ["Verse2", "verse", 26], ["Chorus", "chorus", 30], ["Bridge", "bridge", 20], ["Outro", "outro", 18]];
  const sections: Section[] = []; let t = 0;
  for (const [label, type, d] of plan) { sections.push({ label, type, start: t, end: t + d }); t += d; }
  const lines: Song["lines"] = []; let k = 0;
  for (const s of sections) for (let a = s.start + 0.5; a + 2.5 < s.end; a += 3) { const tx = ["突き刺していいよ", "痛みごと抱いて", "叫ぶ夜"][k++ % 3]; lines.push({ text: tx, start: a, end: a + 2.4, ...charTimes(tx, a, a + 2.4) }); }
  const energy = [...Array(t * 10)].map((_, i) => (sections.find((x) => i / 10 >= x.start && i / 10 < x.end)!.type === "chorus" ? 0.95 : 0.6));
  return { title: "突き刺していいよ", duration: t, fps: 30, bpm: 153, phase: 0, beatsPerBar: 4, energy, energyHz: 10, sections, lines };
}
const models = YAML.parse(fs.readFileSync(path.join(__dirname, "../../gen/models.yaml"), "utf8")).models;

describe("1. still-image generation plan (no input images)", () => {
  it("needs stills only for picture tastes without images", () => {
    expect(needsStills("anime", 0)).toBe(true); expect(needsStills("photo", 0)).toBe(true); expect(needsStills("illust", 0)).toBe(true);
    expect(needsStills("graphic", 0)).toBe(false); expect(needsStills("anime", 3)).toBe(false); expect(needsStills(undefined, 0)).toBe(false);
  });
  it("character sheet -> backgrounds -> scenes, count driven by density, costs per image model", () => {
    const S = rockSong(), slow = planStills(S, { taste: "anime", density: "slow", models }), fast = planStills(S, { taste: "anime", density: "fast", models });
    expect(slow.tasks[0].kind).toBe("character");
    expect(slow.tasks.slice(1, 1 + slow.counts.background).every((t) => t.kind === "background")).toBe(true);
    expect(slow.counts.background).toBe(5); // verse, pre, chorus, bridge, outro
    expect(slow.counts.scene).toBeGreaterThanOrEqual(7); expect(slow.counts.scene).toBeLessThan(fast.counts.scene);
    expect(slow.counts.total).toBe(1 + 5 + slow.counts.scene);
    const sc = slow.tasks.filter((t) => t.kind === "scene");
    expect(sc[0].prompt).toMatch(/anime/); expect(sc[0].prompt).toMatch(/突き刺していいよ/); expect(sc[0].refs).toEqual(["character_sheet.png", "bg_verse.png"]);
    const grok = slow.costs.find((c) => c.id === "grok-imagine-image")!;
    expect(grok.usd).toBeCloseTo(0.02 * slow.counts.total, 5);
    expect(slow.costs[0]).toMatchObject({ id: "manual", usd: 0, free: true });
    expect(slow.costs.find((c) => c.id === "gemini-image")!.usd).toBeNull();
    expect(planStills(S, { taste: "photo", models }).tasks[1].prompt).toMatch(/photorealistic/);
  });
  it("plan text says how many images, which route and the total in Japanese", () => {
    const p = planStills(rockSong(), { taste: "anime", density: "slow", models }), md = stillsMd(p, "突き刺していいよ");
    expect(md).toMatch(new RegExp(`合計 ${p.counts.total} 枚`)); expect(md).toMatch(/おすすめの方法: 無料/); expect(md).toMatch(/0円/);
    expect(md).toMatch(/直前に見積もり/); expect(md).toMatch(/input\/made/); expect(md).toMatch(/npm run made/); expect(md).not.toMatch(/有料API:/);
  });
  it("import puts scene images where npm run mv finds them, refs into project assets; paid run needs --confirm", async () => {
    const S = await import("../scripts/stills");
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), "st-")), inbox = fs.mkdtempSync(path.join(os.tmpdir(), "in-"));
    fs.writeFileSync(path.join(proj, "song.json"), JSON.stringify(rockSong())); fs.writeFileSync(path.join(proj, "mv.config.json"), JSON.stringify({ taste: "anime", density: "slow" }));
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    for (const f of ["character_sheet.png", "bg_verse.png", "scene_002.png", "scene_001.png"]) fs.writeFileSync(path.join(inbox, f), png);
    const before = fs.existsSync(S.AI_IMAGES_DIR) ? fs.readdirSync(S.AI_IMAGES_DIR) : null;
    try {
      const r = S.importStills(proj, inbox);
      expect(r).toMatchObject({ character: 1, background: 1, scene: 2 });
      expect(fs.existsSync(path.join(S.AI_IMAGES_DIR, "scene_001.png"))).toBe(true);
      const { detectInput, INPUT_DIR } = await import("../scripts/common");
      expect(detectInput(INPUT_DIR).images.some((f) => f.endsWith(path.join("AI生成画像", "scene_001.png")))).toBe(true);
      const lib = JSON.parse(fs.readFileSync(path.join(proj, "assets", "assets.json"), "utf8"));
      expect(lib.assets.map((a: any) => a.role).sort()).toEqual(["character_front", "location"]);
      await expect(S.runStills(proj, {})).rejects.toThrow(/金額の確認が必要/);
      await expect(S.runStills(proj, { confirm: 0.01 })).rejects.toThrow(/金額の確認が必要/);
      const { md } = S.writeStillsPlan(proj); expect(md).toMatch(/キャラクターシート/); expect(fs.existsSync(path.join(proj, "stills_prompts.csv"))).toBe(true);
    } finally { if (before === null) fs.rmSync(S.AI_IMAGES_DIR, { recursive: true, force: true }); else for (const f of ["scene_001.png", "scene_002.png"]) if (!before.includes(f)) fs.rmSync(path.join(S.AI_IMAGES_DIR, f), { force: true }); fs.rmSync(path.join(S.stillsInbox(proj)), { recursive: true, force: true }); }
  });
});

describe("2. semi-auto: taste-aware mix", () => {
  const ctx = { nImages: 0, bpm: 153, duration: 170 };
  it("mix + anime with no images -> 物語＋リリックモーション with generated images", () => {
    const p = semiToPlan({ show: ["mix"], taste: ["anime"], density: ["slow"], video: ["none"], lyric: ["auto"] }, ctx);
    expect(p.combo).toContain("story"); expect(p.combo).toContain("lyric_motion");
    expect(p.plan.join("\n")).toMatch(/アニメ調の静止画/); expect(p.warnings).toEqual([]);
  });
  it("conflicting answers are warned in Japanese with a fix", () => {
    const p = semiToPlan({ show: ["typography"], taste: ["anime"] }, ctx);
    expect(p.warnings[0]).toMatch(/画像が使われません/); expect(p.warnings[0]).toMatch(/物語/);
    expect(semiToPlan({ show: ["mix"], taste: ["own"] }, ctx).warnings[0]).toMatch(/input/);
    expect(semiToPlan({ show: ["mix"], taste: ["graphic"] }, ctx).combo).not.toContain("story");
  });
});

describe("3. gen plan without projects", () => {
  it("friendly Japanese message instead of ENOENT", async () => {
    const C = await import("../scripts/common"), real = C.PROJECTS_DIR;
    const { latestProject } = await import("../scripts/gen");
    if (!fs.existsSync(real)) expect(() => latestProject()).toThrow(/npm run mv -- --stills-only/);
    else expect(fs.readFileSync(path.join(__dirname, "../scripts/gen.ts"), "utf8")).toMatch(/!fs\.existsSync\(PROJECTS_DIR\)\) throw new UserError\("まだ曲のプロジェクトがありません", "先に npm run mv -- --stills-only/);
  });
});

describe("4. chosen show mode wins over the BPM guess", () => {
  it("「物語＋リリックモーションで」 -> 物語 preset, wording matches", () => {
    const cfg = applyInstruction({} as any, "物語＋リリックモーションで").cfg;
    const r = pickPreset(rockSong(), cfg, false);
    expect(r.preset.id).toBe("story"); expect(r.why).toMatch(/物語＋リリックモーション/); expect(r.why).not.toMatch(/ダンス|BPM/);
    expect(buildProps(rockSong(), cfg, []).presetWhy).toMatch(/物語/);
  });
});

describe("5. slow density really reduces cuts", () => {
  it("rock song: ゆったり ≈ well under half of normal and far below 114", () => {
    const S = rockSong();
    const slow = buildProps(S, applyInstruction({} as any, "シーンはゆったり").cfg, []).shots.length;
    const normal = buildProps(S, {} as any, []).shots.length;
    expect(slow).toBeLessThan(60); expect(slow).toBeLessThan(normal * 0.6);
    const sl = buildProps(S, applyInstruction({} as any, "シーンはゆったり").cfg, []).shots;
    const chorus = sl.filter((s) => s.sectionType === "chorus"), verse = sl.filter((s) => s.sectionType === "verse");
    expect(chorus.length / 60).toBeGreaterThanOrEqual(verse.length / 56); // chorus still a little faster
  });
});

describe("6. friendly shot critique", () => {
  it("uses シーン名 and Japanese camera terms", () => {
    const sp = buildSpecs(buildProps(rockSong(), {} as any, []).shots, {});
    for (let i = 1; i < sp.length; i++) { sp[i].size = sp[0].size; sp[i].section = sp[0].section; sp[i].move = { ...sp[0].move, mm: "truck" }; }
    const r = reviewShotList(sp.slice(0, 4), new Set(), { [sp[1].shot]: "シーン2（Aメロ 0:12〜）" });
    const txt = r.issues.map((i) => i.msg).join("\n");
    expect(txt).toMatch(/シーン2（Aメロ 0:12〜）/); expect(txt).toMatch(/横移動/);
    expect(txt).not.toMatch(/\bS\d{3}\b|truck|push|wide shot|medium shot/);
  });
  it("gen plan labels: 標準(720p), no raw model ids in the table", async () => {
    const { resJa, modelJa } = await import("../scripts/gen");
    expect(resJa("720p")).toBe("標準(720p)"); expect(modelJa("grok-imagine-video-1.5-lite")).toBe("Grok（軽量版）"); expect(modelJa("grok-imagine-video-1.5")).toBe("Grok（上位版）");
  });
});

describe("7. doctor counts only video-generation MCPs", () => {
  it("ace-studio is not a video MCP", () => {
    expect(videoMcps(["ace-studio", "filesystem", "github"])).toEqual([]);
    expect(videoMcps(["pollo-ai", "grok-imagine", "runway", "kling", "luma"])).toHaveLength(5);
    expect(videoMcps(["default-tools"])).toEqual([]);
  });
});

describe("extra fixes found in the PC test", () => {
  it("lyric JSON top-level bpm is used; 「シーンは標準」 resets density; style summary is Japanese", async () => {
    const { parseLyricJson } = await import("../src/lib/song");
    expect(parseLyricJson({ bpm: 153, lyrics: [{ text: "あ", start: 1, end: 2 }] }).bpm).toBe(153);
    expect(applyInstruction({ density: "slow" } as any, "シーンは標準").cfg.density).toBeUndefined();
    const { styleSummary } = await import("../src/lib/resolve");
    expect(styleSummary([{ style: "pro_box" }, { style: "pro_box" }] as any)).toBe("プロ・ボックス×2");
  });
});
