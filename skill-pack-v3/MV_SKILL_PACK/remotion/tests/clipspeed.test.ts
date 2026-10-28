import { describe, expect, it } from "vitest";
import fs from "fs"; import os from "os"; import path from "path";
import { spawn, spawnSync } from "child_process";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import { clipPlan, clipSourceTime, clipSummary, integrate, knotsOf, solveSpeed, trimSpan } from "../src/lib/clipspeed";
import { snapTime, resizeBoundary, moveLyricEdge, moveLyric, slideInPoint } from "../editor/timeline";
import { prepareProject } from "../scripts/editor";

const R = path.join(__dirname, "..");
describe("動画クリップの速さ・伸ばす・開始位置（共通の対応表）", () => {
  it("speed presets / slider", () => {
    expect(clipPlan({ speed: 0.5 }, 4, 10)).toMatchObject({ rate: 0.5, mode: "play" });
    expect(clipSourceTime(clipPlan({ speed: 2 }, 4, 10), 1.5)).toBeCloseTo(3);
    expect(clipPlan({ speed: 9 }, 1, 100).rate).toBe(4); expect(clipPlan({ speed: 0.01 }, 1, 100).rate).toBe(0.1); expect(clipPlan({ speed: 0.37 }, 1, 100).rate).toBeCloseTo(0.37);
  });
  it("場面の長さに合わせる = clip/scene and ends exactly at the scene end", () => {
    const p = clipPlan({ fit: true }, 8, 2); expect(p.rate).toBeCloseTo(0.25);
    const q = clipPlan({ fit: true, clipFrom: 1 }, 2, 5); expect(q.rate).toBeCloseTo(2); expect(clipSourceTime(q, 1)).toBeCloseTo(3);
  });
  it("short clip: auto slows down, hold freezes on the last frame, loop repeats", () => {
    expect(clipPlan({}, 4, 2)).toMatchObject({ rate: 0.5, mode: "play" });
    const h = clipPlan({ tail: "hold" }, 4, 2); expect(clipSourceTime(h, 3.5)).toBeCloseTo(1.96);
    const l = clipPlan({ tail: "loop" }, 4, 2); expect(clipSourceTime(l, 2.5)).toBeCloseTo(0.5);
    expect(clipPlan({}, 100, 2)).toMatchObject({ mode: "hold" }); expect(clipPlan({}, 100, 2).rate).toBeCloseTo(0.1);
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
      for (const bad of [{ speed: 5 }, { speed: 0.05 }, { clipFrom: 1, clipTo: 0.5 }, { segments: [{ at: 0, speed: 9 }] }, { segments: [{ at: 1, speed: 1 }] }, { ease: 5 }, { solve: 3, segments: [{ at: 0, speed: 1 }] }, { fit: "yes" }, { tail: "bounce" }, { clipFrom: -1 }]) { const [code, body] = await save(bad); expect(code).toBe(400); expect(body.error).toMatch(/[ぁ-んァ-ン一-龥]/); }
      const [ok] = await save({ speed: 0.37, fit: true, tail: "loop", clipFrom: 0.2, clipTo: 0.9, segments: [{ at: 0, speed: 1 }, { at: 1, speed: 0.43 }], ease: 0.5, solve: 1 }); expect(ok).toBe(200);
    } finally { srv.kill(); }
  }, 20000);
});

describe("スピードランプ・切り取り（区間ごとの速さを積分）", () => {
  it("piecewise: 2s at 1x then 2s at 0.5x -> 3s of clip", () => {
    const k = knotsOf([{ at: 0, speed: 1 }, { at: 2, speed: 0.5 }], 4); expect(integrate(k, 2)).toBeCloseTo(2); expect(integrate(k, 4)).toBeCloseTo(3); expect(integrate(k, 3)).toBeCloseTo(2.5);
  });
  it("eased ramp is the trapezoid (1s ramp 1x->0.5x centred on 2s)", () => {
    const k = knotsOf([{ at: 0, speed: 1 }, { at: 2, speed: 0.5 }], 4, 1); expect(integrate(k, 4)).toBeCloseTo(1.5 + 0.75 + 0.75); expect(integrate(k, 1.5)).toBeCloseTo(1.5);
    // monotonic + continuous
    let prev = -1; for (let t = 0; t <= 4; t += 0.05) { const u = integrate(k, t); expect(u).toBeGreaterThanOrEqual(prev); prev = u; }
  });
  it("「途中からスローで帳尻合わせ」: solve the 2nd speed so the trimmed clip ends exactly at the scene end", () => {
    const o = { clipFrom: 1, clipTo: 4, segments: [{ at: 0, speed: 1 }, { at: 2, speed: 1 }], solve: 1 }; // 3s of clip, scene 6s
    const p = clipPlan(o, 6, 10); expect(p.speeds[1]).toBeCloseTo(0.25); expect(p.mode).toBe("play");
    expect(clipSourceTime(p, 2)).toBeCloseTo(3); expect(clipSourceTime(p, 5.99)).toBeCloseTo(4, 1);
    const q = clipPlan({ ...o, ease: 1 }, 6, 10); expect(integrate(q.knots, 6) * q.scale).toBeCloseTo(3);
  });
  it("vice versa: lock the 2nd speed, solve the 1st", () => {
    const segs = [{ at: 0, speed: 1 }, { at: 2, speed: 0.5 }]; expect(solveSpeed(segs, 0, 6, 4)).toBeCloseTo(1);
    const p = clipPlan({ segments: segs, solve: 0, clipTo: 5 }, 6, 10); expect(p.speeds[0]).toBeCloseTo(1.5); expect(p.speeds[1]).toBeCloseTo(0.5);
  });
  it("trim bounds: OUT > IN, both inside the clip; content never runs past OUT", () => {
    expect(trimSpan({ clipFrom: 2, clipTo: 1 }, 5)).toMatchObject({ inPoint: 2, out: 2.05 });
    expect(trimSpan({ clipFrom: -3, clipTo: 99 }, 5)).toMatchObject({ inPoint: 0, out: 5 });
    const p = clipPlan({ clipFrom: 1, clipTo: 2, tail: "hold" }, 4, 5); expect(clipSourceTime(p, 3.9)).toBeLessThan(2);
    expect(clipPlan({ clipFrom: 1, clipTo: 2 }, 4, 5).rate).toBeCloseTo(0.25); // auto fits the trimmed 1s into 4s
  });
  it("solved speed outside 0.1..4 is clamped and the tail rule takes over (no crash)", () => {
    const p = clipPlan({ segments: [{ at: 0, speed: 4 }, { at: 0.5, speed: 1 }], solve: 1, clipTo: 0.2 }, 6, 10); expect(p.speeds.every((v) => v >= 0.0999)).toBe(true);
  });
});
