// start flow v2 (npm run start / 「開始」「MV作って」): Q1 何がありますか？ → Q2 映像はどうする？ → Q3 ここから先は？
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { allowedModes, allowedPresets, checkQ1, confirmLines, detectQ1, genreOptions, hasPictures, q2Options, q2Plan, TEXT_STRUCTURES, type Material, type Q1Key, type Q2Key } from "../src/lib/startFlow";
import { semiQuestions, semiToPlan } from "../src/lib/semi";
import { VARIETY_OPTIONS } from "../src/lib/options";
import { applyInstruction } from "../src/lib/nl";
import { writeTextEditorProject } from "../scripts/mv";
import { prepareProject } from "../scripts/editor";

const R = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const M = (o: Partial<Material> = {}): Material => ({ audio: true, lyrics: true, nImages: 0, nVideos: 0, nChars: 0, ...o });
const SONG = M(), IMG = M({ nImages: 5 }), VID = M({ nImages: 2, nVideos: 3 }), CHR = M({ nChars: 1 });

describe("Q1 detection", () => {
  it("preselects from the folder", () => {
    expect(detectQ1(SONG)).toBe("song"); expect(detectQ1(IMG)).toBe("images"); expect(detectQ1(VID)).toBe("videos"); expect(detectQ1(CHR)).toBe("chars");
  });
  it("picking more than the folder has warns and falls back", () => {
    const r = checkQ1("videos", SONG); expect(r.q1).toBe("song"); expect(r.warn).toContain("input/");
    expect(checkQ1("song", IMG)).toEqual({ q1: "song" });
  });
});

describe("Q2 options per Q1 (first = recommended)", () => {
  const keys = (q1: Q1Key, m: Material) => q2Options(q1, m).map((o) => o.key);
  it("song+lyrics only -> 文字PV (0円) first, 画像を作る second", () => {
    expect(keys("song", SONG)).toEqual(["textpv", "stills"]);
    expect(q2Options("song", SONG, "約6枚")[1].label).toContain("約6枚");
  });
  it("images / videos / chars", () => {
    expect(keys("images", IMG)).toEqual(["images", "textpv", "stills"]);
    expect(keys("videos", VID)).toEqual(["videos", "images", "textpv"]);
    expect(keys("chars", CHR)).toEqual(["tachie", "textpv"]);
    expect(keys("chars", M({ nChars: 1, nImages: 1, nVideos: 1 }))).toEqual(["tachie", "videos", "images", "textpv"]);
  });
  it("every Q2 has a plan that the natural-language router understands", () => {
    for (const k of ["textpv", "images", "videos", "stills", "tachie"] as Q2Key[]) {
      const p = q2Plan(k); const cfg = applyInstruction({}, p.say.join("。")).cfg;
      if (k === "textpv") { expect(p.args).toEqual(["--text-only"]); expect(cfg.combo).toEqual(["typography", "mograph"]); }
      if (k === "tachie") expect(cfg.combo).toEqual(["tachie", "lyric_motion"]);
      if (k === "stills") expect(cfg.taste).toBe("anime");
    }
  });
});

describe("Q3 options only offer what Q1/Q2 allow", () => {
  it("文字PV: no picture show modes, no picture genres, text structures", () => {
    expect(allowedModes("textpv", SONG)).toEqual(["lyric_motion", "typography", "mograph"]);
    expect(allowedPresets("textpv")).toEqual(["vocaloid", "firsttake"]);
    expect(genreOptions("textpv")[0].key).toBe("auto");
    expect(TEXT_STRUCTURES[0].say).toBe("タイポグラフィ＋モーショングラフィックスで");
    expect(hasPictures("textpv")).toBe(false); expect(hasPictures("images")).toBe(true);
  });
  it("立ち絵 only when there is character material", () => {
    expect(allowedModes("images", IMG)).not.toContain("tachie");
    expect(allowedModes("images", M({ nImages: 1, nChars: 1 }))).toContain("tachie");
    expect(allowedModes("tachie", CHR)).toEqual(["tachie", "lyric_motion", "typography", "mograph"]);
  });
  it("半自動 (文字PV): show/genre/density/lyric only; Enter -> typography+mograph, no stills", () => {
    const ctx = { nImages: 0, flow: { q2: "textpv" as Q2Key, m: SONG } };
    const qs = semiQuestions(ctx);
    expect(qs.map((q) => q.id)).toEqual(["show", "genre", "density", "lyric"]);
    expect(qs[0].options.map((o) => o.key)).toEqual(["lyric_motion", "typography", "mograph", "mix"]);
    const p = semiToPlan({}, ctx);
    expect(p.combo).toEqual(["typography", "mograph"]); expect(p.say.join()).not.toContain("アニメ"); expect(p.args).toEqual([]);
    expect(semiToPlan({ genre: ["vocaloid"] }, ctx).args).toEqual(["--preset", "vocaloid"]);
  });
  it("半自動 (画像を作る): taste only anime/photo/illust, video question kept", () => {
    const qs = semiQuestions({ nImages: 0, flow: { q2: "stills", m: SONG } });
    expect(qs.find((q) => q.id === "taste")!.options.map((o) => o.key)).toEqual(["anime", "photo", "illust"]);
    expect(qs.map((q) => q.id)).toContain("video");
  });
  it("半自動 (画像だけ): no taste question, video kept; (立ち絵): parts recommended tachie", () => {
    expect(semiQuestions({ nImages: 5, flow: { q2: "images", m: IMG } }).map((q) => q.id)).toEqual(["show", "genre", "density", "video", "lyric"]);
    const t = semiQuestions({ nImages: 0, hasChar: true, flow: { q2: "tachie", m: CHR } });
    expect(t.find((q) => q.id === "parts")!.recommend).toEqual(["tachie"]);
    expect(semiToPlan({}, { nImages: 0, hasChar: true, flow: { q2: "tachie", m: CHR } }).combo[0]).toBe("tachie");
  });
  it("半自動 without the flow context (old callers) no longer defaults to picture generation", () => {
    expect(semiQuestions({ nImages: 0 })[1].recommend).toEqual(["graphic"]);
    expect(semiQuestions({}).map((q) => q.id)).toEqual(["show", "taste", "density", "video", "lyric", "parts"]);
  });
  it("こだわり variety: option 2 is 標準（おすすめ）", () => { expect(VARIETY_OPTIONS[1].label).toContain("標準"); });
  it("confirmation screen lists material, method, cost and the editor project", () => {
    const l = confirmLines(SONG, { q1: "song", q2: "textpv", q3: "auto" }, { why: "w", cost: "0円", aspect: "16:9" }).join("\n");
    for (const s of ["素材:", "映像: 文字と図形だけ", "進め方: おまかせ", "費用: 0円", "編集画面"]) expect(l).toContain(s);
  });
});

// ---- the real wizard (piped answers, dry run) for each Q1×Q2 path and each Q3 mode ----
function folder(o: { images?: number; videos?: number; chars?: boolean }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "flow-in-")), s = path.join(R, "..", "input_sample");
  for (const f of fs.readdirSync(s)) if (/\.(mp3|srt)$/.test(f)) fs.copyFileSync(path.join(s, f), path.join(d, f));
  for (let i = 0; i < (o.images ?? 0); i++) fs.writeFileSync(path.join(d, `img${i}.png`), PNG);
  for (let i = 0; i < (o.videos ?? 0); i++) fs.writeFileSync(path.join(d, `clip${i}.mp4`), Buffer.alloc(64));
  if (o.chars) { const r = path.join(d, "parts", "mychara"); fs.mkdirSync(r, { recursive: true });
    const parts = ["body", "head", "arm_l", "arm_r", "mouth"].map((k, i) => { fs.writeFileSync(path.join(r, `${k}.png`), PNG); return { id: k, src: `${k}.png`, kind: k, parent: k === "body" ? null : k === "mouth" ? "head" : "body", pivot: [0, 0], z: i }; });
    fs.writeFileSync(path.join(r, "rig.json"), JSON.stringify({ name: "mychara", size: [1, 1], parts })); }
  return d;
}
const wiz = (answers: string, inp: string) => {
  const r = spawnSync(process.execPath, [path.join(R, "node_modules", "tsx", "dist", "cli.mjs"), path.join(R, "scripts", "wizard.ts")], { cwd: R, input: answers, encoding: "utf8", env: { ...process.env, MVPACK_INPUT: inp, MVPACK_WIZARD_DRYRUN: "1" }, timeout: 120000 });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("WIZARD_ARGS ")); if (!line) throw new Error(r.stdout + r.stderr);
  return { args: JSON.parse(line.slice(12)) as string[], out: r.stdout as string };
};
const say = (a: string[]) => a[a.indexOf("--say") + 1] ?? "";
const ENTER = "\n".repeat(20);

describe("wizard paths (dry run)", () => {
  const song = folder({}), img = folder({ images: 3 }), vid = folder({ images: 1, videos: 2 }), chr = folder({ chars: true, images: 1 });
  it("曲と歌詞だけ × all Enter -> 文字PV おまかせ", () => {
    const { args, out } = wiz(ENTER, song);
    expect(out).toMatch(/1\) 曲と歌詞だけ.*★おすすめ/); expect(out).toMatch(/1\) 文字と図形だけ（文字PV・0円） ★おすすめ/);
    expect(out).toContain("費用: 0円"); expect(out).not.toContain("動画素材を含むため");
    expect(args).toContain("--text-only"); expect(args).toContain("16:9");
    expect(applyInstruction({}, say(args)).cfg.combo).toEqual(["typography", "mograph"]);
  });
  it("曲と歌詞だけ × 画像を作る -> anime stills plan, cost shown, no paid call flags", () => {
    const { args, out } = wiz("\n2\n" + ENTER, song);
    expect(out).toMatch(/2\) 画像を作る（無料の手作業 or 有料：約\d+枚。手作業なら0円/);
    const cfg = applyInstruction({}, say(args)).cfg; expect(cfg.taste).toBe("anime"); expect(args).not.toContain("--text-only");
    expect(args.join(" ")).not.toMatch(/--confirm|stills run/);
  });
  it("曲と歌詞だけ × 半自動 (all Enter) -> text only, no アニメ default", () => {
    const { args, out } = wiz("\n\n2\n" + ENTER, song);
    expect(out).not.toMatch(/■ 画像テイスト|■ 作る画像のテイスト|AI動画/);
    expect(say(args)).not.toContain("アニメ"); expect(applyInstruction({}, say(args)).cfg.combo).toEqual(["typography", "mograph"]);
  });
  it("曲と歌詞だけ × こだわり (all Enter) -> text structures only, variety Enter = 標準", () => {
    const { args, out } = wiz("\n\n3\n" + ENTER, song);
    expect(out).toContain("画像なしで成立するものだけ"); expect(out).toMatch(/2\) 標準（おすすめ） ★おすすめ/); expect(out).toContain("[Enter=2]");
    expect(out).not.toMatch(/物語|リップシンク/);
    expect(applyInstruction({}, say(args)).cfg.combo).toEqual(["typography", "mograph"]);
  });
  it("＋画像 × 画像だけ / 文字PV", () => {
    const a = wiz(ENTER, img); expect(a.out).toMatch(/2\) ＋画像 ★おすすめ/); expect(a.args).not.toContain("--text-only"); expect(say(a.args)).toContain("手持ち");
    expect(wiz("\n2\n" + ENTER, img).args).toContain("--text-only");
  });
  it("＋動画 × 動画も入れる / 画像だけ", () => {
    const a = wiz(ENTER, vid); expect(a.out).toMatch(/3\) ＋動画素材 ★おすすめ/); expect(a.args).not.toContain("--images-only");
    expect(wiz("\n2\n" + ENTER, vid).args).toContain("--images-only");
  });
  it("＋キャラ × 立ち絵 / 画像だけ (no 立ち絵 forced)", () => {
    expect(applyInstruction({}, say(wiz(ENTER, chr).args)).cfg.combo).toEqual(["tachie", "lyric_motion"]);
    const b = wiz("\n2\n2\n" + ENTER, chr); // 画像だけ → 半自動
    expect(applyInstruction({}, say(b.args)).cfg.combo ?? []).not.toContain("tachie");
  });
  it("Q1 pick beyond the folder warns and continues", () => {
    const { out, args } = wiz("4\n" + ENTER, song);
    expect(out).toContain("素材が見つかりません"); expect(args).toContain("--text-only");
  });
  it("n at the confirmation stops", () => {
    const r = spawnSync(process.execPath, [path.join(R, "node_modules", "tsx", "dist", "cli.mjs"), path.join(R, "scripts", "wizard.ts")], { cwd: R, input: "\n\n\n\nn\n", encoding: "utf8", env: { ...process.env, MVPACK_INPUT: song, MVPACK_WIZARD_DRYRUN: "1" } });
    expect(r.stdout).toContain("やめました"); expect(r.stdout).not.toContain("WIZARD_ARGS");
  });
}, 600000);

describe("文字PV always gets an editor project", () => {
  it("writes an SVG background + editor-input.json that the editor opens", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "textpv-")), audio = path.join(R, "..", "input_sample", "sample_song.mp3");
    fs.writeFileSync(path.join(dir, "song.json"), JSON.stringify({ title: "t", duration: 8, fps: 30, bpm: 120, sections: [], lines: [{ text: "あ", start: 0.5, end: 2 }] }));
    const song = { duration: 8, sections: [{ type: "verse", label: "Aメロ", start: 0, end: 4 }, { type: "chorus", label: "サビ", start: 4, end: 8 }] };
    writeTextEditorProject(dir, { title: "t", audio, song, first: { genre: "vocaloid", width: 1280, height: 720, fps: 30, lines: [{ style: "pop", params: {} }] } });
    const man = JSON.parse(fs.readFileSync(path.join(dir, "out", "editor-input.json"), "utf8"));
    expect(man.images[0]).toMatch(/textpv_bg\.svg$/); expect(man.scenes.map((s: any) => s.label)).toEqual(["Aメロ", "サビ"]); expect(man.textOnly).toBe(true);
    const p = prepareProject({ project: dir });
    expect(fs.existsSync(path.join(p.runtime, "editor-state.json"))).toBe(true);
  });
});
