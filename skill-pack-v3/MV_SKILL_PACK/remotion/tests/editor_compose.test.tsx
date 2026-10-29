// Editor compositing (scene.comp / data.comp): geometry, backward compatibility, validation (TS + server.py), grade LUT, no-wrap lyrics.
import { describe, expect, it } from "vitest";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs"; import os from "os"; import path from "path"; import { spawn, spawnSync } from "child_process";
import { Scene } from "../editor/editor-scene";
import { prepareProject } from "../scripts/editor";
import { markEdited } from "../src/lib/lyricEdits";
import { checkComp, checkGlobalComp, cutPolys, layoutSlots, panelSourceTime, resolvePanels } from "../src/lib/compose";
import { layoutH, layoutV } from "../src/styles/layout";
import { mergeSceneSlivers } from "../src/lib/sceneSlivers";
// @ts-ignore plain ESM helper used by export.mjs
import { inkCube } from "../editor/lut.mjs";
const R = path.resolve(__dirname, "..");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const mk = (data: any, t: number) => renderToStaticMarkup(<Scene data={data} t={t} />);
const demo = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "mv-comp-")); fs.writeFileSync(path.join(d, "mv.config.json"), "{}"); const rt = prepareProject({ demo: true, project: d }).runtime; return { rt, data: JSON.parse(fs.readFileSync(path.join(rt, "editor-state.json"), "utf8")).data, orig: JSON.parse(fs.readFileSync(path.join(rt, "original-source.json"), "utf8")) }; };
const W = 1920, H = 1080;

describe("compositing geometry", () => {
  it("split: ratio + angle give the v8 diagonal (62% top / 38% bottom)", () => {
    const ang = (Math.atan((0.12 * W) / (H / 2)) * 180) / Math.PI;
    const [a, b] = cutPolys("v", 0.5, ang, W, H);
    expect(a[1][0]).toBeCloseTo(62, 6); expect(a[2][0]).toBeCloseTo(38, 6); expect(b[0][0]).toBeCloseTo(62, 6);
    const [h] = cutPolys("h", 0.4, 0, W, H); expect(h[2]).toEqual([100, 40]);
  });
  it("manga panels grow on the beat; pip / kaleido slots", () => {
    const g = layoutSlots({ type: "panels", count: 4, grow: true, step: 1 }, W, H, 0.5);
    expect(g.map((s) => s.appear ?? 0)).toEqual([0, 0.5, 1, 1.5]);
    expect(layoutSlots({ type: "panels", count: 3, ratio: 0.6 }, W, H, 0.5).map((s) => s.box)).toEqual([[0, 0, 60, 100], [60, 0, 40, 50], [60, 50, 40, 50]]);
    expect(layoutSlots({ type: "pip" }, W, H, 0.5)).toHaveLength(3);
    const k = resolvePanels({ layout: { type: "kaleido" }, panels: [{ asset: 0, rot: 0, rot1: 20 }] }, W, H, 0.5);
    expect(k.map((p) => [p.flipX, p.flipY, p.rot1])).toEqual([[false, false, 20], [true, false, -20], [false, true, -20], [true, true, 20]]);
    const m = resolvePanels({ layout: { type: "mirror", dir: "h" }, panels: [{ asset: 1 }] }, W, H, 0.5);
    expect(m).toHaveLength(2); expect(m[1].flipY).toBe(true); expect(m[1].asset).toBe(1);
  });
  it("composited cuts are kept even when only a few frames long (other slivers still merge)", () => {
    const sc = [{ start: 0 }, { start: 1, comp: { panels: [{ asset: 0 }] } }, { start: 1.07, comp: { panels: [{ asset: 0 }] } }, { start: 1.14 }, { start: 1.2 }, { start: 3 }];
    expect(mergeSceneSlivers(sc as any, 4).map((s: any) => s.start)).toEqual([0, 1, 1.07, 1.2, 3]);
  });
  it("per-panel clip segment never loops (holds the last frame), freeze holds the in-point", () => {
    expect(panelSourceTime({ from: 1, rate: 2 }, 0.5)).toBe(2);
    expect(panelSourceTime({ from: 3, rate: 1 }, 5, 4, 30)).toBeCloseTo(4 - 1 / 30, 6);
    expect(panelSourceTime({ from: 1.5, freeze: true }, 3)).toBe(1.5);
  });
});

describe("validation (server.py mirrors it)", () => {
  const ok = { layout: { type: "split", dir: "v", ratio: 0.5, angle: 20 }, panels: [{ asset: 0, from: 0.5, z: 1.2, z1: 1.4, flipX: true, slide: "left" }, { asset: 0 }], fx: [{ t: 0, d: 0.05, type: "redneg" }], shake: 10, punch: 0.07, tilt: 4, enter: "slash", border: "focus", card: { name: "名前", sub: "SUB", color: "#E0182D", side: "right" }, title: { text: "T", at: 0.2, style: "logo" } };
  it("accepts a full scene comp and rejects bad values", () => {
    expect(() => checkComp(ok, 1, 2)).not.toThrow();
    for (const bad of [{ ...ok, panels: [] }, { ...ok, foo: 1 }, { ...ok, layout: { type: "x" } }, { ...ok, layout: { type: "split", ratio: 0.95 } }, { ...ok, panels: [{ asset: 3 }] }, { ...ok, panels: [{ asset: 0, rate: 9 }] }, { ...ok, fx: [{ t: 0, d: 0.05, type: "boom" }] }, { ...ok, card: { name: "" } }, { ...ok, panels: [{ asset: 0, appear: 5 }] }])
      expect(() => checkComp(bad, 1, 2)).toThrow();
    expect(() => checkGlobalComp({ colors: { red: "#ff0000" }, halftone: 0.12, vignette: 0.55, grade: { look: "ink", base: 0.1 } })).not.toThrow();
    for (const bad of [{ grade: { look: "cube" } }, { grade: { look: "cube", lut: "../x.cube" } }, { colors: { red: "red" } }, { halftone: 2 }, { what: 1 }]) expect(() => checkGlobalComp(bad)).toThrow();
  });
});

describe("Scene with compositing", () => {
  it("projects without comp fields render exactly as before; comp only changes its own scene", () => {
    const { data } = demo(); const times = [0.3, data.scenes[1].start + 0.2, data.duration - 1.5];
    const base = times.map((t) => mk(data, t));
    const d2 = structuredClone(data); d2.scenes[1].comp = { layout: { type: "split", angle: 15 }, panels: [{ asset: 0 }, { asset: data.scenes[1].asset, flipX: true }], fx: [{ t: 0, d: 0.1, type: "white" }] };
    expect(mk(d2, times[0])).toBe(base[0]);
    expect(mk(d2, times[1])).not.toBe(base[1]); expect(mk(d2, times[1])).toContain("polygon(");
    const d3 = structuredClone(d2); delete d3.scenes[1].comp; expect(times.map((t) => mk(d3, t))).toEqual(base);
  });
  it("data.comp: grade filter (preview), halftone, impacts, card and title are drawn; editor edits are marked", () => {
    const { data, orig } = demo();
    data.comp = { grade: { look: "ink" }, halftone: 0.12, vignette: 0.55 };
    data.scenes[0].comp = { layout: { type: "full" }, panels: [{ asset: 0 }], fx: [{ t: 0, d: 1, type: "tealneg" }], card: { name: "黒侍" }, title: { text: "TITLE" } };
    const h = mk(data, 0.2);
    for (const s of ["comp-grade", "黒侍", "TITLE", "mix-blend-mode:multiply", "radial-gradient(rgba(0,0,0,.9)"]) expect(h).toContain(s);
    markEdited(data, orig); expect(data.editedComp).toBe(true); expect(data.scenes[0].edited).toContain("comp");
    expect(mk({ ...data, _gradeBaked: true }, 0.2)).not.toContain('url(#comp-grade)');
  });
});

describe("grade LUT + no-wrap lyrics", () => {
  it("ink cube keeps the chosen colours and greys the rest", () => {
    const cube: string = inkCube({ keep: ["#E0182D"], base: 0.1, N: 5 });
    const rows = cube.trim().split("\n").slice(1).map((r) => r.split(" ").map(Number));
    expect(rows).toHaveLength(125);
    const at = (r: number, g: number, b: number) => rows[b * 25 + g * 5 + r];
    const red = at(4, 0, 0), green = at(0, 4, 0);
    expect(red[0] - red[1]).toBeGreaterThan(0.4); expect(Math.abs(green[0] - green[1])).toBeLessThan(0.1);
  });
  it("「改行しない」 keeps a long name on one row / one column", () => {
    const text = "ミスター・サンプルマン！ミスター・サンプルマン！";
    const L: any = { text, chars: Array.from(text).map((ch, idx) => ({ ch, idx })), params: { size: 3 } };
    expect(layoutH(L, 1280, 720).rows.length).toBeGreaterThan(1);
    const one = layoutH({ ...L, params: { size: 3, noWrap: true } }, 1280, 720);
    expect(one.rows).toHaveLength(1); expect(one.box[2] - one.box[0]).toBeLessThanOrEqual(1280 * 0.86 + 1);
    expect(layoutV({ ...L, params: { size: 3, noWrap: true } }, 1280, 720).per).toBe(Array.from(text).length);
  });
});

describe.skipIf(!py)("server.py saves and rejects comp edits", () => {
  it("save / reject / snapshot", async () => {
    const { rt } = demo();
    const port = 6800 + Math.floor(Math.random() * 90);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", rt, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MV_NO_PICKER: "1" } });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const st = async () => (await fetch(url + "/api/state")).json();
      const post = async (p: string, b: any) => { const s = await st(); const r = await fetch(url + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: s.revision, ...b }) }); return [r.status, await r.json()] as const; };
      const d = structuredClone((await st()).data);
      d.comp = { grade: { look: "ink", base: 0.1 }, colors: { red: "#E0182D", teal: "#2FF5D0" }, halftone: 0.12 };
      d.scenes[0].comp = { layout: { type: "panels", count: 4, grow: true, step: 1.25 }, panels: [{ asset: 0, from: 0.2, z: 1.2 }], fx: [{ t: 0, d: 0.05, type: "white" }], shake: 8, punch: 0.07, enter: "slash", border: "grow", card: { name: "名前" } };
      expect((await post("/api/save", { data: d }))).toEqual([200, expect.anything()]);
      const sv = (await st()).data; expect(sv.editedComp).toBe(true); expect(sv.scenes[0].edited).toContain("comp");
      for (const mut of [(x: any) => (x.scenes[0].comp.panels[0].asset = 99), (x: any) => (x.scenes[0].comp.layout.ratio = 2), (x: any) => (x.comp.grade = { look: "cube", lut: "/etc/x.cube" }), (x: any) => (x.scenes[0].comp.fx = [{ t: 0, d: 0, type: "white" }]), (x: any) => (x.scenes[0].comp.zzz = 1)]) { const b = structuredClone(sv); mut(b); expect((await post("/api/save", { data: b }))[0]).toBe(400); }
    } finally { srv.kill(); }
  }, 30000);
});
