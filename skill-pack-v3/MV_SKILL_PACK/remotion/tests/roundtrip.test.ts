import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prepareProject, assetFor } from "../scripts/editor";
import { runEdit } from "../scripts/edit";
import { applyToEditorData, parseTarget, sceneName, helpText } from "../src/lib/editstate";
import { applyInstruction, kJa } from "../src/lib/nl";
import { DEFAULT_CONFIG } from "../src/lib/config";
import { estimateMd, shotJa } from "../src/lib/estimate";
import { demoOut, DEMO_OUT_DIR } from "../scripts/common";

const state = (rt: string) => JSON.parse(fs.readFileSync(path.join(rt, "editor-state.json"), "utf8"));
import { ffmpegMissing, skipNote, FF_FIX } from "./_caps";
const FFR = ffmpegMissing(), hasFfmpeg = !FFR; if (FFR) skipNote("動画クリップの取り込みテスト", FFR, FF_FIX);

describe("AI <-> editor round-trip (one source of truth)", () => {
  it("AI edits build on manual editor saves and show up when the editor is reopened", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-rt-"));
    fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    const r = prepareProject({ demo: true, project: dir });
    // manual edit in the editor (what /api/save writes)
    const st = state(r.runtime);
    st.data.lyrics[0].font = "noto_sans"; st.data.lyrics[0].fill = "#123456"; st.data.scenes[1].zoom = 1.4; st.revision = 2;
    fs.writeFileSync(path.join(r.runtime, "editor-state.json"), JSON.stringify(st));
    const out = runEdit(dir, "サビの歌詞をもっと派手に");
    expect(out.join("\n")).toMatch(/サビの歌詞（1行）/);
    const after = state(r.runtime);
    expect(after.revision).toBe(3);
    expect(after.lastEdit.by).toBe("ai");
    expect(after.data.lyrics[2].motion).toBe("kinetic"); // サビ = 4〜8秒
    expect(after.data.lyrics[0]).toMatchObject({ font: "noto_sans", fill: "#123456", motion: "simple" }); // manual edit kept
    expect(after.data.scenes[1].zoom).toBe(1.4);
    expect(fs.readdirSync(path.join(r.runtime, "edit-history")).length).toBe(1);
    // reopening the editor reuses the same file -> AI change is visible
    expect(prepareProject({ demo: true, project: dir }).reused).toBe(true);
    expect(state(r.runtime).data.lyrics[2].motion).toBe("kinetic");
    // a second AI edit stacks on the first
    runEdit(dir, "全体をゆっくりに");
    const s3 = state(r.runtime);
    expect(s3.revision).toBe(4); expect(s3.data.lyrics[2].motion).toBe("kinetic"); expect(s3.data.lyrics[0].motionDuration).toBeCloseTo(1.2);
    // dry run writes nothing
    runEdit(dir, "全体を赤に", { dryRun: true }); expect(state(r.runtime).revision).toBe(4);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("non-lyric instructions still go to mv.config.json, unknown ones get Japanese examples", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-rt-"));
    fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    prepareProject({ demo: true, project: dir });
    const out = runEdit(dir, "縦型で。ほにゃらら");
    expect(JSON.parse(fs.readFileSync(path.join(dir, "mv.config.json"), "utf8")).aspect).toBe("9:16");
    const q = out.find((x) => x.startsWith("？"))!;
    expect(q).toMatch(/ほにゃらら/); expect(q).toMatch(/2番の歌詞を赤に/); expect(q).toMatch(/全体をゆっくりに/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("Japanese edit instructions: colour, speed, sections", () => {
  const sections = [{ type: "verse", label: "Aメロ", start: 0, end: 10 }, { type: "chorus", label: "サビ", start: 10, end: 20 }, { type: "verse", label: "Aメロ", start: 20, end: 30 }, { type: "chorus", label: "サビ", start: 30, end: 40 }];
  const data = () => ({ sections, lyrics: [1, 12, 22, 32].map((s, i) => ({ id: `L00${i + 1}`, text: "あ", start: s, end: s + 3, motion: "simple", scale: 0.72, motionDuration: 0.8 })) });
  it("parses 1番/2番/サビ/Aメロ/最後のサビ", () => {
    expect(parseTarget("2番の歌詞を赤に")).toMatchObject({ ban: 2, all: false });
    expect(parseTarget("2番のサビ")).toMatchObject({ ban: 2, type: "chorus" });
    expect(parseTarget("Aメロ")).toMatchObject({ type: "verse" });
    expect(parseTarget("全体をゆっくりに").all).toBe(true);
    expect(kJa("chorus#2")).toBe("2番のサビ"); expect(kJa("chorus#last")).toBe("最後のサビ");
  });
  it("「2番の歌詞を赤に」 colours only 2番", () => {
    const r = applyToEditorData(data(), "2番の歌詞を赤に");
    expect(r.data.lyrics.map((l: any) => l.fill ?? null)).toEqual([null, null, "#e8413c", "#e8413c"]);
    expect(r.changes[0]).toMatch(/2番の歌詞（2行）: 色を赤に/);
  });
  it("「全体をゆっくりに」「サビを速く」「1番のAメロを青に」「最後のサビを大きく」", () => {
    expect(applyToEditorData(data(), "全体をゆっくりに").data.lyrics.every((l: any) => l.motionDuration === 1.2)).toBe(true);
    expect(applyToEditorData(data(), "サビを速く").data.lyrics.map((l: any) => l.motionDuration)).toEqual([0.8, 0.54, 0.8, 0.54]);
    expect(applyToEditorData(data(), "1番のAメロを青に").data.lyrics.map((l: any) => l.fill ?? null)).toEqual(["#4a8dff", null, null, null]);
    expect(applyToEditorData(data(), "最後のサビを大きく").data.lyrics[3].scale).toBeCloseTo(0.86);
  });
  it("unmatched instructions return to the caller and help text is Japanese with examples", () => {
    const r = applyToEditorData(data(), "よしなに");
    expect(r.unmatched).toEqual(["よしなに"]);
    expect(helpText("よしなに")).toMatch(/例|たとえば/);
    expect(applyInstruction(DEFAULT_CONFIG, "よしなに").changes[0]).toMatch(/2番の歌詞を赤に/);
  });
  it("mv.config messages use Japanese section/style names, not codes", () => {
    const c = applyInstruction(DEFAULT_CONFIG, "サビはグリッチで").changes.join();
    expect(c).toMatch(/サビ/); expect(c).not.toMatch(/chorus|glitch/);
    expect(applyInstruction(DEFAULT_CONFIG, "2番のサビを派手に").changes.join()).not.toMatch(/chorus|kinetic/);
  });
});

describe("UX wording", () => {
  it("friendly scene names hide S005", () => {
    expect(sceneName({ id: "S005", start: 42, label: "chorus" }, 4)).toBe("シーン5（サビ 0:42〜）");
    expect(sceneName({ id: "S001", start: 0, label: "S001" }, 0)).toBe("シーン1（0:00〜）");
    expect(shotJa("S005")).toBe("シーン5");
  });
  it("estimate table has no model ids or English codes", () => {
    const md = estimateMd({ lines: [{ shot: "S005", model: "kling-v2-master", provider: null, mode: "api", sec: 5, snapped: false, res: "720p", takes: 1, usd: 0.5, credits: null, verified: true }], clips: 1, seconds: 5, usdTotal: 0.5, unknown: [], credits: {}, images: [] } as any);
    expect(md).not.toMatch(/kling|S005|API従量/); expect(md).toMatch(/シーン5/);
  });
  it("scenes.ts no longer prints 見どころ", () => {
    expect(fs.readFileSync(path.join(__dirname, "../scripts/scenes.ts"), "utf8")).not.toMatch(/見どころ/);
  });
});

describe("demo outputs stay inside the pack", () => {
  it("demoOut keeps paths under remotion/out", () => {
    expect(demoOut("pro_motion_demo.mp4")).toBe(path.join(DEMO_OUT_DIR, "pro_motion_demo.mp4"));
    expect(demoOut("x.mp4", "../../../dist/pro.mp4")).toBe(path.join(DEMO_OUT_DIR, "pro.mp4"));
    expect(demoOut("x.mp4", path.join(os.tmpdir(), "a.mp4"))).toBe(path.join(DEMO_OUT_DIR, "a.mp4"));
    expect(demoOut("x.mp4", "out/sub/b.mp4")).toBe(path.join(DEMO_OUT_DIR, "sub", "b.mp4"));
    for (const f of ["pro_demo.ts", "showcase.ts", "genre_demo.ts", "presets_demo.ts"]) expect(fs.readFileSync(path.join(__dirname, "../scripts", f), "utf8")).toMatch(/demoOut\(/);
  });
});

describe("editor: video clips", () => {
  it("preview renders a <video> for video assets and an <img> for stills", async () => {
    if (!fs.existsSync(path.join(__dirname, "../editor/font-options.json"))) { const rt = fs.mkdtempSync(path.join(os.tmpdir(), "mv-b-")); await (await import("../editor/build.mjs" as any)).buildEditor(rt); }
    const { Scene } = await import("../editor/editor-scene");
    const data = { duration: 8, width: 320, height: 180, fps: 24, assets: [{ src: "assets/a.png" }, { src: "assets/v.mp4", kind: "video" }], scenes: [{ id: "S001", start: 0, asset: 0, transition: 0 }, { id: "S002", start: 4, asset: 1, transition: 0 }], lyrics: [] };
    expect(renderToStaticMarkup(React.createElement(Scene, { data, t: 5 }))).toMatch(/<video[^>]*src="assets\/v.mp4"/);
    expect(renderToStaticMarkup(React.createElement(Scene, { data, t: 1 }))).toMatch(/<img[^>]*assets\/a.png/);
    const seen: any[] = [];
    renderToStaticMarkup(React.createElement(Scene, { data, t: 5, video: (src: string, srcTime: number) => { seen.push([src, srcTime]); return null; } }));
    expect(seen[0]).toEqual(["assets/v.mp4", 1]); // 1s into the scene at normal speed = 1s into the clip
  });
  it("rejects unsupported files with a Japanese message", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-v-")); const f = path.join(dir, "a.gif"); fs.writeFileSync(f, "x");
    expect(() => assetFor(f, 0, dir)).toThrow(/この形式の素材は使えません/);
  });
  it.skipIf(!hasFfmpeg)("copies a video clip and records its length (needs ffmpeg/ffprobe; skipped otherwise)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-v-")); fs.mkdirSync(path.join(dir, "assets"));
    const f = path.join(dir, "clip.mp4");
    expect(spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=24:duration=1.5", "-pix_fmt", "yuv420p", f]).status).toBe(0);
    const a = assetFor(f, 3, dir);
    expect(a).toMatchObject({ src: "assets/video-3.mp4", kind: "video" }); expect((a as any).duration).toBeCloseTo(1.5, 1);
    expect(fs.existsSync(path.join(dir, "assets/video-3.mp4"))).toBe(true);
  });
});
