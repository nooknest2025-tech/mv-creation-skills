import { describe, expect, it } from "vitest";
import fs from "fs"; import os from "os"; import path from "path";
import { spawn, spawnSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import { clipPlan, clipSourceTime, clipSummary } from "../src/lib/clipspeed";
import { snapTime, resizeBoundary, moveLyricEdge, moveLyric, slideInPoint } from "../editor/timeline";
import { prepareProject } from "../scripts/editor";

const R = path.join(__dirname, "..");
describe("動画クリップの速さ・伸ばす・開始位置（共通の対応表）", () => {
  it("speed presets / slider", () => {
    expect(clipPlan({ speed: 0.5 }, 4, 10)).toMatchObject({ rate: 0.5, mode: "play" });
    expect(clipSourceTime(clipPlan({ speed: 2 }, 4, 10), 1.5)).toBeCloseTo(3);
    expect(clipPlan({ speed: 9 }, 1, 100).rate).toBe(4); expect(clipPlan({ speed: 0.01 }, 1, 100).rate).toBe(0.25);
  });
  it("場面の長さに合わせる = clip/scene and ends exactly at the scene end", () => {
    const p = clipPlan({ fit: true }, 8, 2); expect(p.rate).toBeCloseTo(0.25);
    const q = clipPlan({ fit: true, clipFrom: 1 }, 2, 5); expect(q.rate).toBeCloseTo(2); expect(clipSourceTime(q, 1)).toBeCloseTo(3);
  });
  it("short clip: auto slows down, hold freezes on the last frame, loop repeats", () => {
    expect(clipPlan({}, 4, 2)).toMatchObject({ rate: 0.5, mode: "play" });
    const h = clipPlan({ tail: "hold" }, 4, 2); expect(clipSourceTime(h, 3.5)).toBeCloseTo(1.96);
    const l = clipPlan({ tail: "loop" }, 4, 2); expect(clipSourceTime(l, 2.5)).toBeCloseTo(0.5);
    expect(clipPlan({}, 100, 2)).toMatchObject({ rate: 0.25, mode: "hold" });
    expect(clipSummary(clipPlan({ speed: 1 }, 2, 10), 2)).toMatch(/1.00倍速/);
  });
  it("in-point (trim start) is clamped to the clip", () => {
    expect(clipPlan({ clipFrom: 99 }, 1, 3).inPoint).toBeCloseTo(2.95);
    expect(clipSourceTime(clipPlan({ clipFrom: 1.2 }, 2, 10), 0)).toBeCloseTo(1.2);
  });
  it("editor preview and export get the SAME clip time from the shared Scene", async () => {
    const { Scene } = await import("../editor/editor-scene");
    const data = { duration: 8, width: 320, height: 180, fps: 24, assets: [{ src: "a.png" }, { src: "v.mp4", kind: "video", duration: 2 }], scenes: [{ id: "S001", start: 0, asset: 0, transition: 0 }, { id: "S002", start: 4, asset: 1, transition: 0, speed: 2, clipFrom: 0.5, tail: "hold" }], lyrics: [] };
    const seen: number[] = []; renderToStaticMarkup(React.createElement(Scene, { data, t: 4.5, video: (_s: string, at: number) => { seen.push(at); return null; } }));
    expect(seen[0]).toBeCloseTo(1.5);
  });
});

describe("音の安全（曲は伸びない・ずれない／動画は無音）", () => {
  it("preview <video> is muted", async () => {
    const { Scene } = await import("../editor/editor-scene");
    const html = renderToStaticMarkup(React.createElement(Scene, { data: { duration: 8, width: 320, height: 180, fps: 24, assets: [{ src: "v.mp4", kind: "video" }], scenes: [{ id: "S001", start: 0, asset: 0, transition: 0, speed: 3 }], lyrics: [] }, t: 1 }));
    expect(html).toMatch(/<video[^>]*muted/);
  });
  it("export: every clip is muted, the song is muxed untouched from the original file and cut to the song length", () => {
    const entry = fs.readFileSync(path.join(R, "editor/export-entry.tsx"), "utf8");
    expect(entry.match(/<OffthreadVideo[^>]*>/g)!.every((t) => /\bmuted\b/.test(t) && /volume=\{0\}/.test(t))).toBe(true);
    expect(entry).not.toMatch(/playbackRate=|<Audio[^>]*(playbackRate|startFrom|trimBefore)/);
    const exp = fs.readFileSync(path.join(R, "editor/export.mjs"), "utf8");
    expect(exp).toMatch(/muted:true/); expect(exp).toMatch(/'-map','1:a'/); expect(exp).toMatch(/String\(qa\?Math\.min\(snapshot\.data\.duration.*:snapshot\.data\.duration\)/);
    expect(exp).not.toMatch(/atempo|asetrate|rubberband|-af/);
    const vis = fs.readFileSync(path.join(R, "src/render/Visuals.tsx"), "utf8");
    expect(vis.match(/<OffthreadVideo[^>]*>/g)!.every((t) => /\bmuted\b/.test(t))).toBe(true);
  });
  it("changing clip speed or resizing scenes never changes the song duration", () => {
    const scenes = [{ start: 0 }, { start: 4 }, { start: 6 }]; const duration = 8;
    resizeBoundary(scenes, 1, 5, duration); expect(scenes[1].start).toBe(5);
    expect(duration).toBe(8); expect(clipPlan({ speed: 4 }, 3, 1).rate).toBeLessThanOrEqual(4);
  });
});

describe("タイムラインのマウス操作（純関数）", () => {
  it("snaps to beats, Shift = free", () => { expect(snapTime(1.03, 120)).toBe(1); expect(snapTime(1.2, 120)).toBe(1.2); expect(snapTime(1.95, 120, 0, .2, true)).toBe(2); });
  it("scene edge: neighbour adjusts, never inverts", () => { const s = [{ start: 0 }, { start: 2 }, { start: 4 }]; resizeBoundary(s, 1, 9, 8); expect(s[1].start).toBeCloseTo(3.9); resizeBoundary(s, 1, -1, 8); expect(s[1].start).toBeCloseTo(0.1); });
  it("lyric edges + move stay inside the song (last second empty)", () => {
    const l = { start: 1, end: 2 }; moveLyricEdge(l, "end", 99, 8); expect(l.end).toBe(7); moveLyricEdge(l, "start", 9, 8); expect(l.start).toBeCloseTo(6.9);
    const m = { start: 1, end: 2 }; moveLyric(m, 10, 8); expect(m).toEqual({ start: 6, end: 7 });
  });
  it("dragging the clip body slides its in-point", () => { expect(slideInPoint(1, -0.5, 2, 5)).toBe(2); expect(slideInPoint(1, 3, 1, 5)).toBe(0); expect(slideInPoint(1, -9, 1, 3)).toBe(2.95); });
});

const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
describe.skipIf(!py)("server.py validate(): new clip fields", () => {
  it("accepts valid speed/fit/tail/clipFrom and rejects bad values in Japanese", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-clip-")); fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    const r = prepareProject({ demo: true, project: dir });
    const port = 5600 + Math.floor(Math.random() * 300);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", r.runtime, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const st = await (await fetch(url + "/api/state")).json();
      const save = async (patch: any) => { const d = structuredClone(st.data); Object.assign(d.scenes[1], patch); const res = await fetch(url + "/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: st.revision, data: d }) }); return [res.status, await res.json()] as const; };
      for (const bad of [{ speed: 5 }, { speed: 0.1 }, { fit: "yes" }, { tail: "bounce" }, { clipFrom: -1 }]) { const [code, body] = await save(bad); expect(code).toBe(400); expect(body.error).toMatch(/[ぁ-んァ-ン一-龥]/); }
      const [ok] = await save({ speed: 0.5, fit: true, tail: "loop", clipFrom: 0.2 }); expect(ok).toBe(200);
    } finally { srv.kill(); }
  }, 20000);
});
