// 立ち絵モーションMV as a selectable show mode: wizard choices, natural-language routing, combos, project creation.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { MODE_IDS, SHOW_MODES, comboFromText, composeCombo, proposeCombo } from "../src/lib/mograph";
import { applyInstruction } from "../src/lib/nl";
import { parsePick, semiQuestions, semiToPlan, TACHIE_MATERIAL_HELP } from "../src/lib/semi";
import { TACHIE_OPTION, structureOptions } from "../src/lib/options";
import { ROLES } from "../src/lib/hybrids";
import { buildTachieStage, tachieScenes } from "../src/lib/tachieMode";
import { createTachieProject, findCharacterMaterial } from "../scripts/tachie_project";
import { prepareProject } from "../scripts/editor";

const R = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
function fakeInput(withRig = true) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tachie-in-"));
  if (withRig) {
    const r = path.join(d, "parts", "mychara"); fs.mkdirSync(r, { recursive: true });
    const parts = ["body", "head", "arm_l", "arm_r", "mouth"].map((k, i) => { fs.writeFileSync(path.join(r, `${k}.png`), PNG); return { id: k, src: `${k}.png`, kind: k, parent: k === "body" ? null : k === "mouth" ? "head" : "body", pivot: [0, 0], z: i }; });
    fs.writeFileSync(path.join(r, "rig.json"), JSON.stringify({ name: "mychara", size: [1, 1], parts }));
  }
  return d;
}

describe("立ち絵 show mode", () => {
  it("is a picture show mode with its own role, listed last so existing numbers stay", () => {
    expect(SHOW_MODES.tachie.kind).toBe("picture");
    expect(MODE_IDS.at(-1)).toBe("tachie");
    expect(MODE_IDS.slice(0, 7)).toEqual(["story", "lipsync", "dance", "live", "lyric_motion", "typography", "mograph"]);
    expect(ROLES.tachie).toBeTruthy();
  });
  it("natural language routes to it (alone and combined with every other mode)", () => {
    expect(comboFromText("立ち絵で")).toEqual(["tachie"]);
    expect(comboFromText("パーツアニメで")).toEqual(["tachie"]);
    expect(comboFromText("キャラを踊らせて")).toEqual(["tachie"]);
    expect(comboFromText("立ち絵＋リリックモーションで")).toEqual(["tachie", "lyric_motion"]);
    expect(comboFromText("立ち絵＋タイポグラフィで")).toEqual(["tachie", "typography"]);
    expect(comboFromText("立ち絵＋モーショングラフィックスで")).toEqual(["tachie", "mograph"]);
    expect(comboFromText("立ち絵＋物語で")).toEqual(["tachie", "story"]);
    expect(comboFromText("ライブ＋立ち絵で")).toEqual(["live", "tachie"]);
    expect(comboFromText("立ち絵＋ダンス＋タイポグラフィで")).toEqual(["tachie", "dance", "typography"]);
    expect(comboFromText("パーツアニメ＋リップシンク＋モーショングラフィックスで")).toEqual(["tachie", "lipsync", "mograph"]);
    // existing behaviour unchanged
    expect(comboFromText("ダンス＋リリックモーションで")).toEqual(["dance", "lyric_motion"]);
    expect(comboFromText("ストーリー＋リップシンクで")).toBeNull();
    for (const s of ["立ち絵で", "キャラを踊らせて", "立ち絵＋タイポグラフィ＋物語で"]) expect(applyInstruction({}, s).cfg.combo).toContain("tachie");
  });
  it("every combo with another mode composes a section mix that includes the stage", () => {
    for (const m of MODE_IDS.filter((x) => x !== "tachie")) {
      const c = composeCombo(["tachie", m]);
      const roles = new Set(Object.values(c.hybrid.sections).flatMap((x) => Object.keys(x ?? {})));
      expect(roles.has("tachie"), m).toBe(true);
    }
    const c3 = composeCombo(["tachie", "story", "typography"]);
    expect(Object.keys(c3.hybrid.sections.verse!)).toContain("tachie");
    expect(Object.keys(c3.hybrid.sections.pre_chorus!)).toContain("story");
  });
  it("半自動: offered in 見せ方 and キャラの動き, recommended when character material exists", () => {
    const qs = semiQuestions({ hasChar: true });
    expect(qs[0].options.map((o) => o.key)).toContain("tachie");
    expect(qs[5].options.map((o) => o.key)).toContain("tachie");
    expect(qs[5].recommend).toEqual(["tachie"]);
    expect(semiQuestions({})[5].recommend).toEqual(["auto"]);
    expect(semiToPlan({}, { hasChar: true }).combo).toContain("tachie"); // mix -> 立ち絵 when material is there
    expect(semiToPlan({ parts: ["tachie"] }, { hasChar: true }).combo[0]).toBe("tachie");
    const pick = parsePick(`${MODE_IDS.indexOf("tachie") + 1},${MODE_IDS.indexOf("typography") + 1}`, qs[0]);
    expect(semiToPlan({ show: pick }, { hasChar: true }).combo).toEqual(["tachie", "typography"]);
    expect(semiToPlan({ show: ["tachie"] }, { hasChar: false }).warnings.join()).toContain("input/parts");
    expect(semiToPlan({ show: ["tachie"], taste: ["graphic"] }, { hasChar: true }).combo).toEqual(["tachie", "mograph"]);
    expect(semiToPlan({}, {}).combo).not.toContain("tachie"); // no material: old default
  });
  it("おまかせ proposes it only with character material; こだわり offers it as a comparison", () => {
    expect(proposeCombo("pop", 0, 3, true)[0]).toBe("tachie");
    expect(proposeCombo("pop", 0, 3)).not.toContain("tachie");
    expect(TACHIE_OPTION.say).toBe("立ち絵で");
    expect(structureOptions(null, 0).some((o) => o.say === "立ち絵で")).toBe(false); // the planner's ranking is unchanged
  });
  it("stage + scenes: 立ち絵 / text-only shots on the stage, story shots keep their image", () => {
    const st = buildTachieStage([{ name: "a", dir: "rig_a" }, { name: "b", dir: "rig_b" }], "rock");
    expect(st.chars.map((c) => c.x)).toEqual([0.3, 0.7]); expect(st.bubbles).toBe(true);
    const sc = tachieScenes([{ id: "S1", start: 0, end: 2, src: "img0", role: "tachie" }, { id: "S2", start: 2, end: 4, src: "img0", role: "typo" }, { id: "S3", start: 4, end: 6, src: "img1", role: "story" }], (s) => (s === "img1" ? 1 : 0), 2, 6);
    expect(sc.map((s) => s.asset)).toEqual([2, 1]); expect(sc[0].end).toBe(4); expect(sc[1].end).toBe(6);
  });
});

describe("立ち絵 project creation (smoke)", () => {
  it("missing material -> plain explanation of what to provide", () => {
    const inp = fakeInput(false), dir = fs.mkdtempSync(path.join(os.tmpdir(), "tachie-p-"));
    expect(findCharacterMaterial(inp, dir)).toEqual([]);
    expect(() => createTachieProject({ dir, inputDir: inp, mood: "pop", song: { duration: 8, bpm: 120, sections: [] }, shots: [], images: [], videos: [], title: "t" })).toThrow(/キャラ素材/);
    expect(TACHIE_MATERIAL_HELP).toMatch(/input\/parts[\s\S]*input\/tachie[\s\S]*npm run parts -- demo/);
  });
  it("writes a stage + editor manifest that the shared editor opens with the stage as an editable asset", () => {
    const inp = fakeInput(), dir = fs.mkdtempSync(path.join(os.tmpdir(), "tachie-p-"));
    const song = { duration: 8, bpm: 120, phase: 0, sections: [{ type: "verse", label: "Aメロ", start: 0, end: 4 }, { type: "chorus", label: "サビ", start: 4, end: 8 }] };
    fs.writeFileSync(path.join(dir, "song.json"), JSON.stringify({ ...song, lines: [{ text: "はじめの音", start: 0.5, end: 3 }, { text: "サビの歌", start: 4.5, end: 7 }] }));
    const audio = path.join(inp, "a.wav"); fs.copyFileSync(path.join(R, "..", "input_sample", fs.readdirSync(path.join(R, "..", "input_sample")).find((f) => /\.(mp3|wav)$/.test(f))!), audio);
    const img = path.join(inp, "story.png"); fs.writeFileSync(img, PNG);
    const r = createTachieProject({ dir, inputDir: inp, mood: "pop", song, shots: [{ id: "S1", start: 0, end: 4, src: "m0", role: "tachie" }, { id: "S2", start: 4, end: 8, src: "m0", role: "story" }], images: [img], videos: [], mediaSrc: () => img, title: "t" });
    expect(r.rigs.map((x) => x.name)).toEqual(["mychara"]);
    expect(fs.existsSync(path.join(dir, "tachie", "rig_mychara", "rig.json"))).toBe(true);
    expect(r.manifest.images).toEqual([img, r.stageFile]);
    expect(r.manifest.scenes.map((s) => s.asset)).toEqual([1, 0]);
    fs.mkdirSync(path.join(dir, "out"), { recursive: true });
    fs.writeFileSync(path.join(dir, "out", "editor-input.json"), JSON.stringify({ ...r.manifest, audio }));
    const p = prepareProject({ project: dir });
    const st = JSON.parse(fs.readFileSync(path.join(p.runtime, "editor-state.json"), "utf8"));
    const a = st.data.assets[1];
    expect(a.kind).toBe("tachie"); expect(a.stage.chars[0].rig.parts.length).toBe(5);
    expect(fs.existsSync(path.join(p.runtime, a.stage.chars[0].base, "head.png"))).toBe(true);
    // the stage is not overwritten on a re-run (hand edits to main.tachie.json are kept)
    const f = r.stageFile, j = JSON.parse(fs.readFileSync(f, "utf8")); j.bg = "grid"; fs.writeFileSync(f, JSON.stringify(j));
    createTachieProject({ dir, inputDir: inp, mood: "rock", song, shots: [], images: [], videos: [], title: "t" });
    expect(JSON.parse(fs.readFileSync(f, "utf8")).bg).toBe("grid");
  });
});

describe("wizard (piped answers, dry run)", () => {
  const wiz = (answers: string, inp: string) => {
    const r = spawnSync(process.execPath, [path.join(R, "node_modules", "tsx", "dist", "cli.mjs"), path.join(R, "scripts", "wizard.ts")], { cwd: R, input: answers, encoding: "utf8", env: { ...process.env, MVPACK_INPUT: inp, MVPACK_WIZARD_DRYRUN: "1" }, timeout: 120000 });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("WIZARD_ARGS ")); if (!line) throw new Error(r.stdout + r.stderr);
    return { args: JSON.parse(line.slice(12)) as string[], out: r.stdout };
  };
  const withSong = (rig: boolean) => { const d = fakeInput(rig); const s = path.join(R, "..", "input_sample"); for (const f of fs.readdirSync(s)) if (/\.(mp3|srt)$/.test(f)) fs.copyFileSync(path.join(s, f), path.join(d, f)); return d; };
  const say = (a: string[]) => a[a.indexOf("--say") + 1] ?? "";
  it("おまかせ + character material -> 立ち絵＋リリックモーション", () => {
    const { args, out } = wiz("1\n\n\n", withSong(true));
    expect(out).toContain("キャラ素材: mychara");
    expect(applyInstruction({}, say(args)).cfg.combo).toEqual(["tachie", "lyric_motion"]);
  });
  it("おまかせ without material keeps the old flow (no --say)", () => {
    expect(wiz("1\n\n\n", withSong(false)).args).not.toContain("--say");
  });
  it("おまかせ Q1b: 立ち絵＋モーショングラフィックス＋物語 by number", () => {
    const n = (id: string) => MODE_IDS.indexOf(id) + 1;
    const { args } = wiz(`1\n${n("tachie")},${n("mograph")},${n("story")}\n\n`, withSong(true));
    expect(applyInstruction({}, say(args)).cfg.combo).toEqual(["tachie", "mograph", "story"]);
  });
  it("ジャンル: asks for 立ち絵 when material exists", () => {
    const { args } = wiz("3\n5\ny\n\n", withSong(true));
    expect(args).toContain("vocaloid"); expect(applyInstruction({}, say(args)).cfg.combo).toContain("tachie");
  });
}, 300000);
