import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { normalizeLyrics, prepareProject } from "../scripts/editor";
import { CATALOG } from "../src/lib/catalog";
import { STYLES } from "../src/styles/styles";

describe("shared editor: state preparation", () => {
  it("normalizes lyric JSON shapes and clamps the last second", () => {
    const a = normalizeLyrics({ lines: [{ text: "あ", start: 0.5, end: 9.5 }] }, 10);
    expect(a[0]).toMatchObject({ id: "L001", start: 0.5, end: 9, motion: "simple", scale: 0.72, y: 0.8 });
    const b = normalizeLyrics([{ text: "い", startSeconds: 1, endSeconds: 2, motion: "pro_pop" }], 10);
    expect(b[0]).toMatchObject({ start: 1, end: 2, motion: "pro_pop" });
  });
  it("demo project writes state, source and audio hash, and reuses saved edits", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-editor-"));
    const r = prepareProject({ demo: true, project: dir });
    expect(r.reused).toBe(false);
    const st = JSON.parse(fs.readFileSync(path.join(r.runtime, "editor-state.json"), "utf8"));
    expect(st.revision).toBe(1);
    expect(st.data.lyrics.map((l: any) => l.text)).toEqual(["はじめの音を", "重ねてみよう", "ここから新しい景色へ"]);
    expect(fs.existsSync(path.join(r.runtime, st.data.audioFile))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(r.runtime, "audio-integrity.json"), "utf8")).sha256).toMatch(/^[0-9a-f]{64}$/);
    st.revision = 5; fs.writeFileSync(path.join(r.runtime, "editor-state.json"), JSON.stringify(st));
    expect(prepareProject({ demo: true, project: dir }).reused).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(r.runtime, "editor-state.json"), "utf8")).revision).toBe(5);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("file-based sample (audio + lyrics JSON + images) works without the demo generator", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mv-editor-"));
    const demo = prepareProject({ demo: true, project: path.join(tmp, "a") });
    const sample = path.join(__dirname, "..", "editor", "sample");
    const r = prepareProject({ project: path.join(tmp, "b"), audio: path.join(demo.runtime, "assets", "demo.wav"), lyrics: path.join(sample, "lyrics.json"), images: [path.join(sample, "scene1.svg"), path.join(sample, "scene2.svg")].join(",") });
    const st = JSON.parse(fs.readFileSync(path.join(r.runtime, "editor-state.json"), "utf8"));
    expect(st.data.scenes.length).toBe(2);
    expect(st.data.scenes[0].start).toBe(0);
    expect(st.data.assets.map((a: any) => a.src)).toEqual(["assets/image-0.svg", "assets/image-1.svg"]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  it("rejects missing inputs with a Japanese hint", () => {
    expect(() => prepareProject({ project: fs.mkdtempSync(path.join(os.tmpdir(), "mv-editor-")) })).toThrow(/見つかりません/);
  });
  it("every catalogued motion (incl. pro_* and custom join/leave) has a renderer the editor can call", () => {
    for (const k of ["pro_pop", "pro_slide", "join_left_right", "join_top_bottom", "leave_left_right", "leave_top_bottom"]) expect(CATALOG[k]).toBeTruthy();
    for (const k of Object.keys(CATALOG)) expect(typeof STYLES[k]).toBe("function");
  });
});
