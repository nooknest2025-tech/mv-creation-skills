import { describe, expect, it } from "vitest";
import fs from "fs"; import os from "os"; import path from "path";
import { spawn, spawnSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import { sceneEdges, sceneBoundaryIndex, resizeBoundary, pinDefault, resetClipForAsset, ADD_ASSET_EXT, isVideoName } from "../editor/timeline";
import { clipPlan } from "../src/lib/clipspeed";
import { Scene } from "../editor/editor-scene";
import { prepareProject } from "../scripts/editor";
const R = path.resolve(__dirname, "..");

describe("ノートPC：タイムライン固定の初期値", () => {
  it("short screens default OFF, tall ON, saved choice wins", () => {
    expect(pinDefault(null, 768)).toBe(false); expect(pinDefault(null, 720)).toBe(false); expect(pinDefault(null, 1080)).toBe(true);
    expect(pinDefault("1", 720)).toBe(true); expect(pinDefault("0", 1080)).toBe(false);
  });
  it("layout CSS always pins the preview; only the timeline is optional", () => {
    const css = fs.readFileSync(path.join(R, "editor/editor-layout.css"), "utf8");
    expect(css).toMatch(/#stickyTop\{position:sticky/); expect(css).toMatch(/max-height:899px\)\{#screen\{max-width:min\(100%,calc\(38vh/);
    const js = fs.readFileSync(path.join(R, "editor/editor-entry.tsx"), "utf8"); expect(js).toContain("top.after(tl)"); expect(js).toContain("タイムラインも固定");
  });
});

describe("場面の左右どちらの端でも長さを変えられる", () => {
  it("edges: first has only right, middle both, last only left", () => {
    expect(sceneEdges(0, 3)).toEqual(["end"]); expect(sceneEdges(1, 3)).toEqual(["start", "end"]); expect(sceneEdges(2, 3)).toEqual(["start"]);
  });
  it("right edge of scene 0 lengthens scene 0 (moves boundary 1)", () => {
    const s = [{ start: 0 }, { start: 2 }, { start: 4 }]; resizeBoundary(s, sceneBoundaryIndex(0, "end"), 3, 8);
    expect(s.map((x) => x.start)).toEqual([0, 3, 4]);
  });
  it("fit clip re-fits its speed when the scene gets longer (audio untouched)", () => {
    const o = { fit: true }; expect(clipPlan(o, 2, 4).rate).toBeCloseTo(2); expect(clipPlan(o, 4, 4).rate).toBeCloseTo(1);
  });
});

describe("動画にもカメラ・エフェクトが効く", () => {
  it("video scene gets the camera transform and the effect filter", () => {
    const styles: any[] = [];
    const html = renderToStaticMarkup(React.createElement(Scene, { data: { duration: 8, width: 320, height: 180, fps: 24, assets: [{ src: "v.mp4", kind: "video", duration: 8 }],
      scenes: [{ id: "S001", start: 0, asset: 0, transition: 0, fit: true, cameraMove: "dolly_zoom", cameraStrength: "strong", effects: [{ id: "grade_warm", amount: "strong", sync: "off" }] }], lyrics: [] }, t: 4,
      video: (_s: string, _at: number, st: any) => { styles.push(st); return React.createElement("video", { style: st }); } }));
    expect(styles.length).toBeGreaterThan(0); expect(styles[0].transform).toMatch(/scale\((?!1\))/);
    expect(html).toMatch(/filter:[^;"]*sepia/);
  });
});

describe("素材の差し替え（動画も画像と同じ）", () => {
  it("swap resets trim/speed; video starts in fit mode", () => {
    expect(resetClipForAsset({ clipFrom: 1, clipTo: 2, speed: 3, segments: [], asset: 1 }, true)).toEqual({ asset: 1, fit: true });
    expect(resetClipForAsset({ fit: true, speed: 2 }, false)).toEqual({});
    expect(ADD_ASSET_EXT.test("a.MOV")).toBe(true); expect(ADD_ASSET_EXT.test("a.exe")).toBe(false); expect(isVideoName("x.webm")).toBe(true);
  });
  const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
  it.skipIf(!py)("server accepts a new video from the PC and the save check still passes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-add-")); fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    const r = prepareProject({ demo: true, project: dir }); const port = 6000 + Math.floor(Math.random() * 300);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", r.runtime, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const bad = await fetch(url + "/api/add-asset?name=x.exe", { method: "POST", body: "zz" }); expect(bad.status).toBe(400);
      const res = await fetch(url + "/api/add-asset?name=my%20clip.mov&duration=3.5", { method: "POST", body: new Uint8Array([0, 0, 0, 1]) });
      const d = await res.json(); expect(res.status).toBe(200); expect(d.asset).toMatchObject({ kind: "video", duration: 3.5 });
      expect(fs.existsSync(path.join(r.runtime, d.asset.src))).toBe(true);
      const st = await (await fetch(url + "/api/state")).json(); expect(st.data.assets.at(-1)).toEqual(d.asset);
      const data = structuredClone(st.data); data.scenes[0].asset = d.index; resetClipForAsset(data.scenes[0], true);
      const save = await fetch(url + "/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: st.revision, data }) });
      expect(save.status).toBe(200);
    } finally { srv.kill(); }
  }, 20000);
});

import { resizeSceneOnly, moveSceneOnly } from "../editor/timeline";
describe("Ctrl＋ドラッグ：そのシーンだけ", () => {
  const S = () => [{ start: 0 }, { start: 2 }, { start: 4 }, { start: 6 }];
  it("edge resize clamps the neighbour at 0.5s, never deletes it", () => {
    const s = S(); resizeSceneOnly(s, 1, "end", 9, 8); expect(s.map((x) => x.start)).toEqual([0, 2, 5.5, 6]);
    resizeSceneOnly(s, 1, "start", -3, 8); expect(s[1].start).toBe(0.5);
  });
  it("body move keeps its length; previous stretches, next is trimmed (min 0.5s)", () => {
    const s = S(); moveSceneOnly(s, 1, 2, 4, 1, 8); expect(s.map((x) => x.start)).toEqual([0, 3, 5, 6]);
    const t = S(); moveSceneOnly(t, 1, 2, 4, 9, 8); expect(t.map((x) => x.start)).toEqual([0, 3.5, 5.5, 6]);
    const u = S(); moveSceneOnly(u, 1, 2, 4, -9, 8); expect(u.map((x) => x.start)).toEqual([0, 0.5, 2.5, 6]);
  });
  it("first scene stays at 0, last scene still ends with the song", () => {
    const s = S(); moveSceneOnly(s, 0, 0, 2, 1, 8); expect(s.map((x) => x.start)).toEqual([0, 3, 4, 6]);
    const t = S(); moveSceneOnly(t, 3, 6, 8, -1, 8); expect(t.map((x) => x.start)).toEqual([0, 2, 4, 5]);
  });
});
