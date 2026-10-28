import { describe, expect, it } from "vitest";
import { splitSceneAt, mergeSceneWithNext, resolveClipChains, clipEndTime } from "../editor/timeline";
import { clipPlan, clipSourceTime } from "../src/lib/clipspeed";
const D = 10, L = 30;
const src = (sc: any[], t: number) => { const i = sc.findLastIndex((s) => s.start <= t), e = sc[i + 1]?.start ?? D; return clipSourceTime(clipPlan(sc[i], e - sc[i].start, L), t - sc[i].start); };
const same = (a: any[], b: any[]) => { for (let t = 0; t < D - 0.01; t += 0.1) expect(src(b, t)).toBeCloseTo(src(a, t), 2); };
const V = { video: true, clipDur: L };
const chain = (sc: any[]) => resolveClipChains(sc, D, () => true, () => L);

describe("ここで切る（シーン）", () => {
  it("image scene: two scenes, same look, too-short refused in Japanese", () => {
    const sc: any[] = [{ id: "S001", start: 0, asset: 0, cameraMove: "orbit", effects: [{ id: "blur" }], transition: 1 }];
    expect(splitSceneAt(sc, 0, 0.3, D)).toMatch(/短すぎる/); expect(splitSceneAt(sc, 0, 4, D)).toBeNull();
    expect(sc.length).toBe(2); expect(sc[1]).toMatchObject({ start: 4, asset: 0, cameraMove: "orbit", effects: [{ id: "blur" }], transition: 0 }); expect(sc[1].id).not.toBe("S001");
  });
  for (const [name, s0] of [["fit", { fit: true, clipFrom: 2, clipTo: 12 }], ["speed 1.5", { speed: 1.5, clipFrom: 1 }], ["ramp", { clipFrom: 0, segments: [{ at: 0, speed: 1 }, { at: 6, speed: 0.5 }] }]] as const) {
    it(`video (${name}): playback across the cut is seamless`, () => {
      const orig: any[] = [{ id: "S001", start: 0, asset: 0, ...s0 }]; const sc = structuredClone(orig);
      expect(splitSceneAt(sc, 0, 4, D, V)).toBeNull(); chain(sc); same(orig, sc);
      expect(sc[1].clipChain).toBe(true); expect(sc[1].clipFrom).toBeCloseTo(clipEndTime(sc[0], 4, L), 3);
    });
  }
  it("halves are independent; 2nd IN follows the 1st half's new speed live", () => {
    const sc: any[] = [{ id: "S001", start: 0, asset: 0, speed: 1 }]; splitSceneAt(sc, 0, 4, D, V);
    sc[0].speed = 0.5; sc[1].speed = 1; chain(sc); expect(sc[1].clipFrom).toBeCloseTo(2); expect(src(sc, 5)).toBeCloseTo(3);
    delete sc[1].clipChain; sc[1].clipFrom = 9; sc[0].speed = 2; chain(sc); expect(sc[1].clipFrom).toBe(9); // manual IN wins
  });
  it("「次とつなげる」: slow half + normal half -> one scene with speed segments, looks identical", () => {
    const sc: any[] = [{ id: "S001", start: 0, asset: 0, speed: 1 }, { id: "S002", start: D, asset: 1 }]; const dur = D;
    splitSceneAt(sc, 0, 4, dur, V); sc[0].speed = 0.5; chain(sc); const before = structuredClone(sc);
    expect(mergeSceneWithNext(sc, 0, dur, V)).toBeNull(); expect(sc.length).toBe(2);
    expect(sc[0].segments).toEqual([{ at: 0, speed: 0.5 }, { at: 4, speed: 1 }]); same(before, sc);
  });
  it("merge of different materials just extends the first; last scene cannot merge", () => {
    const sc: any[] = [{ id: "A", start: 0, asset: 0 }, { id: "B", start: 3, asset: 1 }];
    expect(mergeSceneWithNext(sc, 1, D)).toMatch(/最後/); mergeSceneWithNext(sc, 0, D); expect(sc).toEqual([{ id: "A", start: 0, asset: 0 }]);
  });
});

import { History, isTextField } from "../editor/history";
describe("元に戻す／やり直す（全体）", () => {
  it("each separate edit is one step; undo/redo walk them", () => {
    const h = new History(); h.reset("a"); h.record("b", 1000); h.record("c", 5000);
    expect(h.undo("c")).toBe("b"); expect(h.undo("b")).toBe("a"); expect(h.undo("a")).toBeNull();
    expect(h.redo()).toBe("b"); expect(h.redo()).toBe("c"); expect(h.redo()).toBeNull();
  });
  it("a drag / slider burst coalesces into one step; new edit clears redo", () => {
    const h = new History(); h.reset("0"); for (let k = 1; k <= 20; k++) h.record(String(k), 1000 + k * 30, true);
    expect(h.undoStack).toEqual(["0"]); expect(h.undo("20")).toBe("0"); h.record("x", 9000); expect(h.canRedo).toBe(false);
  });
  it("limit 100 steps; text fields keep native Ctrl+Z", () => {
    const h = new History(100); h.reset("s"); for (let k = 0; k < 150; k++) h.record("v" + k, k * 10000); expect(h.undoStack.length).toBe(100);
    expect(isTextField({ tagName: "INPUT", type: "number" })).toBe(true); expect(isTextField({ tagName: "INPUT", type: "range" })).toBe(false); expect(isTextField({ tagName: "BUTTON" })).toBe(false);
  });
});

it("history: cut() starts a new step even while a button is held (right-click menu)", () => {
  const h = new History(); h.reset("a"); h.record("b", 1000, true); h.cut(); h.record("c", 1010, true); expect(h.undoStack).toEqual(["a", "b"]);
});

import fs from "fs"; import os from "os"; import path from "path"; import { spawn, spawnSync } from "child_process";
import { prepareProject } from "../scripts/editor";
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
it.skipIf(!py)("server: saving after split/merge works (scene count may change), duplicate IDs refused", async () => {
  const R = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-split-")); fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
  const r = prepareProject({ demo: true, project: dir }); const port = 6800 + Math.floor(Math.random() * 300);
  const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", r.runtime, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
  try {
    const save = async (d: any) => { const st = await (await fetch(url + "/api/state")).json(); const res = await fetch(url + "/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: st.revision, data: d }) }); return [res.status, await res.json()] as const; };
    const st = await (await fetch(url + "/api/state")).json(); const d = structuredClone(st.data); const n = d.scenes.length;
    const e0 = d.scenes[1]?.start ?? d.duration; expect(splitSceneAt(d.scenes, 0, e0 / 2, d.duration)).toBeNull();
    const [ok] = await save(d); expect(ok).toBe(200); expect((await (await fetch(url + "/api/state")).json()).data.scenes.length).toBe(n + 1);
    const dup = structuredClone(d); dup.scenes[1].id = dup.scenes[0].id; const [bad, e] = await save(dup); expect(bad).toBe(400); expect(e.error).toMatch(/場面ID/);
    mergeSceneWithNext(d.scenes, 0, d.duration); const [ok2] = await save(d); expect(ok2).toBe(200);
  } finally { srv.kill(); }
}, 20000);
