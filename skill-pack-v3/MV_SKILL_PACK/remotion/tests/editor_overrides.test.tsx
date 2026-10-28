/**
 * Pack-wide rule (v6.5): every renderer/stage = built-in default look + the editor's per-line / per-scene edits always applied.
 * Any new custom stage must pass the "honors editor overrides" check below (add its fixture to FIXTURES).
 */
import { describe, expect, it } from "vitest";
import React from "react"; import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs"; import os from "os"; import path from "path"; import { spawn, spawnSync } from "child_process";
import { Scene } from "../editor/editor-scene";
import { markEdited, wantsEditorMotion } from "../src/lib/lyricEdits";
import { prepareProject } from "../scripts/editor";
import { mergePatch, stageFor, setPatch } from "../src/lib/stagePatch";
const R = path.resolve(__dirname, "..");
const TACHIE = path.join(R, "../projects/パーツアニメ試作/out/editor");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const load = (dir: string) => ({ data: JSON.parse(fs.readFileSync(path.join(dir, "editor-state.json"), "utf8")).data, orig: JSON.parse(fs.readFileSync(path.join(dir, "original-source.json"), "utf8")) });
const html = (data: any, t: number) => renderToStaticMarkup(<Scene data={data} t={t} />);
const mid = (l: any) => (l.start + l.end) / 2;
const demoDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "mv-ov-")); fs.writeFileSync(path.join(d, "mv.config.json"), "{}"); return prepareProject({ demo: true, project: d }).runtime; };
const FIXTURES: [string, () => string][] = [["立ち絵ステージ (パーツアニメ試作)", () => TACHIE], ["画像MV (demo)", demoDir]];

describe("editor edits always win over built-in looks", () => {
  it("markEdited: editor defaults / untouched lines are not edits; real changes are", () => {
    const { data, orig } = load(TACHIE); markEdited(data, orig);
    expect(data.lyrics.filter((l: any) => l.edited)).toEqual([]);
    const l = data.lyrics[4]; l.fill = orig.lyrics[4].fill; l.font = l.font === "mochiy" ? "rocknroll" : "mochiy"; l.stageStyle = "auto"; markEdited(data, orig);
    expect(l.edited).toEqual(["font"]);
    l.motion = "typewriter"; markEdited(data, orig); expect(wantsEditorMotion(l)).toBe(true);
    data.scenes[1].zoom = 1.4; markEdited(data, orig); expect(data.scenes[1].edited).toEqual(["zoom"]);
  });
  for (const [name, dir] of FIXTURES) it(`honors editor overrides: ${name}`, () => {
    const { data, orig } = load(dir()); markEdited(data, orig);
    const l = data.lyrics[Math.min(4, data.lyrics.length - 1)], t = mid(l), before = html(data, t);
    expect(html(structuredClone(data), t)).toBe(before); // untouched -> identical
    for (const edit of [{ fill: "#00e0ff" }, { angle: -12 }, { position: "tc" }, { font: l.font === "mochiy" ? "rocknroll" : "mochiy" }, { effect: "glow" }, { motion: "typewriter" }]) {
      const d = structuredClone(data); Object.assign(d.lyrics[data.lyrics.indexOf(l)], edit); markEdited(d, orig);
      expect(html(d, t), JSON.stringify(edit)).not.toBe(before);
    }
  });
  it("立ち絵: untouched lines stay pixel-identical when another line is edited (both loops)", () => {
    const { data, orig } = load(TACHIE); markEdited(data, orig);
    const d = structuredClone(data); Object.assign(d.lyrics[4], { fill: "#00e0ff", angle: -8 }); d.lyrics[8].stageStyle = "band"; markEdited(d, orig);
    data.lyrics.forEach((l: any, i: number) => { if (i !== 4 && i !== 8) expect(html(d, mid(l)), l.id).toBe(html(data, mid(l))); });
    expect(html(d, mid(d.lyrics[8]))).toContain("solid"); // band style chosen in the editor
  });
});

describe("stage elements (characters / guests / telops) are editable too", () => {
  it("mergePatch / setPatch: id-keyed arrays, defaults pruned, no patch = same object", () => {
    const st = { chars: [{ id: "a", x: 0.2 }, { id: "b", x: 0.8 }], guests: { peeks: [{ id: "s", t: 1 }] } };
    expect(stageFor({ scenes: [{}] }, 0, st)).toBe(st);
    expect(mergePatch(st, { chars: { b: { dx: 0.1 } } }).chars[1]).toEqual({ id: "b", x: 0.8, dx: 0.1 });
    expect(setPatch({}, st, ["chars", "a", "dx"], 0, 0)).toEqual({});
    expect(setPatch({}, st, ["chars", "a", "dx"], 0.1, 0)).toEqual({ chars: { a: { dx: 0.1 } } });
    expect(stageFor({ stage: { pause: { telop: "x" } }, scenes: [{}] }, 0, st)).not.toHaveProperty("pause"); // project-wide keys never add elements to other cuts
  });
  const at = (data: any, i: number) => (data.scenes[i].start + (data.scenes[i + 1]?.start ?? data.duration)) / 2;
  for (const [what, patch, scene, t] of [
    ["character offset / size / hide (per cut)", null, { chars: { black: { dx: 0.1, k: 1.2 }, cafe: { hide: true } } }, (d: any) => at(d, 4)],
    ["interlude telop text / position / colour", { pause: { telop: "ゲスト登場！", telopY: 0.5, telopColor: "#ffee00" } }, null, () => 32.0],
    ["guest size / name / tag", { guests: { items: { seal: { scale: 1.4, name: "x" } }, tag: "ゲスト" } }, null, () => 32.0],
    ["guests off", { guests: { off: true } }, null, () => 32.0],
    ["final group shot", { guests: { group: [{ id: "puppy", x: 0.5, h: 0.4 }] } }, null, (d: any) => d.duration - 1],
  ] as [string, any, any, (d: any) => number][]) it(`立ち絵: ${what}`, () => {
    const { data, orig } = load(TACHIE); markEdited(data, orig); const tt = t(data), before = html(data, tt);
    const d = structuredClone(data); if (patch) d.stage = patch; if (scene) d.scenes[4].stage = scene; markEdited(d, orig);
    expect(html(d, tt)).not.toBe(before);
    if (scene) expect(d.scenes[4].edited).toContain("stage");
    for (const l of data.lyrics.filter((l: any) => l.start < 30)) expect(html(d, mid(l)), "loop 1 untouched").toBe(html(data, mid(l)));
  });
});

describe.skipIf(!py)("edits flow through editor save and the MP4 export endpoint", () => {
  it("save marks edited lines; render snapshot carries them; bad stageStyle rejected", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-ovs-"));
    for (const f of ["editor-state.json", "original-source.json"]) fs.copyFileSync(path.join(TACHIE, f), path.join(dir, f));
    const port = 6700 + Math.floor(Math.random() * 200);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", dir, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MV_NO_PICKER: "1" } });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const st = async () => (await fetch(url + "/api/state")).json();
      const post = async (p: string, b: any) => { const s = await st(); const r = await fetch(url + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: s.revision, ...b }) }); return [r.status, await r.json()] as const; };
      const s0 = await st(), d = structuredClone(s0.data); Object.assign(d.lyrics[4], { fill: "#00e0ff", stageStyle: "band" });
      const [c1] = await post("/api/save", { data: d }); expect(c1).toBe(200);
      const saved = (await st()).data; expect(saved.lyrics[4].edited).toEqual(expect.arrayContaining(["fill", "stageStyle"])); expect(saved.lyrics[3].edited).toBeUndefined();
      const bad = structuredClone(saved); bad.lyrics[4].stageStyle = "nope"; const [c2] = await post("/api/save", { data: bad }); expect(c2).toBe(400);
      const d2 = structuredClone((await st()).data); d2.stage = { guests: { tag: "ゲスト" } }; d2.scenes[4].stage = { chars: { black: { dx: 0.1 } } };
      const [c4] = await post("/api/save", { data: d2 }); expect(c4).toBe(200); const sv2 = (await st()).data; expect(sv2.editedStage).toBe(true); expect(sv2.scenes[4].edited).toContain("stage");
      const bad2 = structuredClone(sv2); bad2.stage = [1]; expect((await post("/api/save", { data: bad2 }))[0]).toBe(400);
      const [c3, job] = await post("/api/render", { folder: dir }); expect(c3).toBe(200);
      const snap = JSON.parse(fs.readFileSync(path.join(dir, job.snapshot), "utf8")).data; expect(snap.lyrics[4].edited).toEqual(expect.arrayContaining(["fill", "stageStyle"])); expect(snap.stage.guests.tag).toBe("ゲスト"); expect(snap.scenes[4].stage.chars.black.dx).toBe(0.1);
      expect(html(snap, mid(snap.lyrics[4]))).not.toBe(html(load(TACHIE).data, mid(snap.lyrics[4])));
    } finally { srv.kill(); }
  }, 30000);
});
