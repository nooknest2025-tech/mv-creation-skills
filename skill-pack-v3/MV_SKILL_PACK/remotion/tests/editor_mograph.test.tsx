// 文字PV: the mograph layer (shapes / lines / particles / section transitions) in the editor preview + MP4 export,
// identical to npm run mv when unedited, and editable (whole video + per scene) with edits that always win.
import { describe, expect, it } from "vitest";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs"; import os from "os"; import path from "path"; import { spawn, spawnSync } from "child_process";
import { Scene } from "../editor/editor-scene";
import { moBg, moTop } from "../src/render/MoGraph";
import { directPro } from "../src/lib/mograph";
import { checkMoEdit, mographEditAt, mographProps } from "../src/lib/mographEdit";
import { markEdited } from "../src/lib/lyricEdits";
import { prepareProject } from "../scripts/editor";
import { writeTextEditorProject } from "../scripts/mv";
import { setMo } from "../editor/mograph-panel";

const R = path.resolve(__dirname, "..");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const W = 1280, H = 720;
const sections = [{ type: "verse", label: "Aメロ", start: 0, end: 8 }, { type: "chorus", label: "サビ", start: 8, end: 16 }] as any[];
const lines = [{ text: "まだ見ぬ朝を", start: 1, end: 4 }, { text: "光れ 今だけは", start: 9, end: 12 }];
const song: any = { title: "t", duration: 16, fps: 30, bpm: 128, phase: 0.1, beatsPerBar: 4, sections, energy: [], energyHz: 20, lines };
const plan = directPro(song, { genre: "vocaloid", combo: ["typography", "mograph"], nMedia: 0 });
const beat = { bpm: 128, phase: 0.1, beatsPerBar: 4 };
const shots = [{ role: "typo", start: 0, end: 8 }, { role: "mograph", start: 8, end: 16 }];
const P: any = { mograph: plan, shots, beat, lines, startAt: 0 };
const mk = (el: any) => renderToStaticMarkup(el ?? <i />);
const TIMES = [0.4, 3.3, 7.9, 8.05, 8.2, 11.7, 15.1];

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-ed-")), audio = path.join(R, "..", "input_sample", "sample_song.mp3");
  fs.writeFileSync(path.join(dir, "song.json"), JSON.stringify({ ...song, lines }));
  writeTextEditorProject(dir, { title: "t", audio, song, first: { genre: "vocaloid", width: W, height: H, fps: 30, beat, mograph: plan, shots, lines: lines.map(() => ({ style: "pro_slide", params: {} })) } });
  const rt = prepareProject({ project: dir }).runtime;
  return { rt, data: JSON.parse(fs.readFileSync(path.join(rt, "editor-state.json"), "utf8")).data, orig: JSON.parse(fs.readFileSync(path.join(rt, "original-source.json"), "utf8")) };
}

describe("shared mograph renderer", () => {
  it("no edit / neutral edit = byte-identical markup at every sample frame", () => {
    for (const t of TIMES) {
      const a = mk(moBg(P, t, W, H)), b = mk(moBg(P, t, W, H, { intensity: 1, speed: 1, density: 1 }));
      expect(a).toBe(b); expect(a.length).toBeGreaterThan(50);
      expect(mk(moTop(P, t, W, H, Math.round(t * 30), 30))).toBe(mk(moTop(P, t, W, H, Math.round(t * 30), 30, () => undefined)));
    }
  });
  it("each edit changes the output", () => {
    const t = 11.7, base = mk(moBg(P, t, W, H));
    for (const ed of [{ off: true }, { look: "blocks" as const }, { colors: { bg: "#123456" } }, { intensity: 0.3 }, { speed: 2 }, { density: 2 }]) expect(mk(moBg(P, t, W, H, ed))).not.toBe(base);
    const tr = plan.sections[1].start - 0.1; // inside the section transition
    const top = mk(moTop(P, tr, W, H, 0, 30));
    expect(mk(moTop(P, tr, W, H, 0, 30, () => ({ transition: "rect" })))).not.toBe(top);
    expect(mk(moTop(P, tr, W, H, 0, 30, () => ({ off: true })))).not.toBe(top);
  });
  it("scene edit wins over whole-video edit; colours merge", () => {
    const d: any = { scenes: [{ start: 0 }, { start: 8, mograph: { look: "hud", colors: { fg: "#ffffff" } } }], mographEdit: { look: "blocks", colors: { bg: "#000000" }, speed: 2 } };
    expect(mographEditAt(d, 1)).toEqual({ look: "blocks", colors: { bg: "#000000" }, speed: 2 });
    expect(mographEditAt(d, 9)).toEqual({ look: "hud", colors: { bg: "#000000", fg: "#ffffff" }, speed: 2 });
    expect(mographEditAt({ scenes: [{ start: 0 }] }, 1)).toBeUndefined();
    expect(setMo({ speed: 2 }, "speed", 1, 1)).toBeUndefined();
  });
  it("validation (front-end; server.py mirrors it)", () => {
    expect(checkMoEdit({ look: "geo", intensity: 1.5, colors: { accent: "#ff0000" } })).toBe("");
    for (const bad of [{ look: "x" }, { intensity: 9 }, { colors: { bg: "red" } }, { foo: 1 }, { off: 1 }]) expect(checkMoEdit(bad)).not.toBe("");
  });
});

describe("文字PV editor project", () => {
  it("carries the plan; the editor Scene draws exactly the shared layer (no editor petals)", () => {
    const { data } = project();
    expect(data.mograph).toEqual(plan); expect(data.mographShots).toEqual(shots);
    const mp = mographProps(data);
    for (const t of [0.4, 7.9, 8.2]) { const h = mk(<Scene data={data} t={t} />); expect(h).toContain(mk(moBg(mp as any, t, W, H))); expect(h).not.toContain("<ellipse"); }
  });
  it("edits are detected vs original-source.json, reset clears them", () => {
    const { data, orig } = project(); markEdited(data, orig);
    expect(data.editedMograph).toBeUndefined(); expect(data.scenes.some((s: any) => s.edited)).toBe(false);
    data.mographEdit = { density: 2 }; data.scenes[1].mograph = { off: true }; markEdited(data, orig);
    expect(data.editedMograph).toBe(true); expect(data.scenes[1].edited).toEqual(["mograph"]);
    const before = mk(<Scene data={orig} t={9} />); expect(mk(<Scene data={data} t={9} />)).not.toBe(before);
    delete data.mographEdit; delete data.scenes[1].mograph; markEdited(data, orig);
    expect(data.editedMograph).toBeUndefined(); expect(mk(<Scene data={data} t={9} />)).toBe(mk(<Scene data={{ ...orig }} t={9} />));
  });
});

describe.skipIf(!py)("save + MP4 export endpoint carry mograph edits", () => {
  it("save marks, bad edits rejected, render snapshot carries edits", async () => {
    const { rt } = project();
    const port = 6900 + Math.floor(Math.random() * 90);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", rt, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MV_NO_PICKER: "1" } });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const st = async () => (await fetch(url + "/api/state")).json();
      const post = async (p: string, b: any) => { const s = await st(); const r = await fetch(url + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: s.revision, ...b }) }); return [r.status, await r.json()] as const; };
      const d = structuredClone((await st()).data); d.mographEdit = { look: "burst", colors: { accent: "#00e0ff" } }; d.scenes[0].mograph = { intensity: 0.5 };
      expect((await post("/api/save", { data: d }))[0]).toBe(200);
      const sv = (await st()).data; expect(sv.editedMograph).toBe(true); expect(sv.scenes[0].edited).toContain("mograph");
      for (const mut of [(x: any) => (x.mographEdit = { look: "nope" }), (x: any) => (x.scenes[0].mograph = { speed: 99 }), (x: any) => (x.mograph.sections[0].look = "geo")]) { const b = structuredClone(sv); mut(b); expect((await post("/api/save", { data: b }))[0]).toBe(400); }
      const [c, job] = await post("/api/render", { folder: rt }); expect(c).toBe(200);
      const snap = JSON.parse(fs.readFileSync(path.join(rt, job.snapshot), "utf8")).data;
      expect(snap.mographEdit.look).toBe("burst"); expect(snap.scenes[0].mograph.intensity).toBe(0.5); expect(snap.mograph).toEqual(plan);
    } finally { srv.kill(); }
  }, 30000);
});
