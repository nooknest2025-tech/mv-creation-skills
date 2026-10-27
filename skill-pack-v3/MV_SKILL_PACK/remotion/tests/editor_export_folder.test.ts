import { describe, expect, it } from "vitest";
import fs from "fs"; import os from "os"; import path from "path";
import { spawn, spawnSync } from "child_process";
import { prepareProject } from "../scripts/editor";
const R = path.resolve(__dirname, "..");
const py = ["python3", "python"].find((c) => spawnSync(c, ["--version"]).status === 0);
const runPy = (code: string) => { const r = spawnSync(py!, ["-c", `import sys,json;sys.path.insert(0,${JSON.stringify(path.join(R, "editor"))})\nfrom exportpath import *\n${code}`], { encoding: "utf8" }); if (r.status) throw Error(r.stderr); return JSON.parse(r.stdout); };

describe.skipIf(!py)("MP4の保存先：名前と場所のルール", () => {
  it("file name: default <title>_v<n>.mp4, Windows-unsafe characters removed, no folders", () => {
    const out = runPy(`print(json.dumps([safe_name('', '夏の歌', 3), safe_name('a:b*c?.MP4'), safe_name('..\\\\..\\\\evil'), safe_name('CON'), safe_name('  完成版  ')]))`);
    expect(out).toEqual(["夏の歌_v3.mp4", "a_b_c_.mp4", "evil.mp4", "_CON.mp4", "完成版.mp4"]);
  });
  it("never overwrites: a.mp4 -> a (2).mp4 -> a (3).mp4; next version counts existing", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mv-ex-")); fs.writeFileSync(path.join(d, "a.mp4"), ""); fs.writeFileSync(path.join(d, "a (2).mp4"), ""); fs.writeFileSync(path.join(d, "曲_v4.mp4"), "");
    const out = runPy(`print(json.dumps([unique_path(${JSON.stringify(d)},'a.mp4').name, unique_path(${JSON.stringify(d)},'b.mp4').name, next_version(${JSON.stringify(d)},'曲')]))`);
    expect(out).toEqual(["a (3).mp4", "b.mp4", 5]);
  });
  it("folder check: creates missing folders, rejects relative paths and files, Japanese errors", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mv-ex-")); const f = path.join(d, "file.txt"); fs.writeFileSync(f, "");
    const out = runPy(`r=[]\nfor p in [${JSON.stringify(path.join(d, "new", "deep"))}, 'relative/dir', ${JSON.stringify(f)}, '']:\n  try:r.append(['ok',str(check_folder(p))])\n  except ValueError as e:r.append(['ng',str(e)])\nprint(json.dumps(r,ensure_ascii=False))`);
    expect(out[0][0]).toBe("ok"); expect(fs.existsSync(path.join(d, "new", "deep"))).toBe(true);
    for (const k of [1, 2, 3]) { expect(out[k][0]).toBe("ng"); expect(out[k][1]).toMatch(/[ぁ-んァ-ン一-龥]/); }
  });
  it("server: settings remembered per project, picker fallback when no dialog", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-exs-")); fs.writeFileSync(path.join(dir, "mv.config.json"), "{}");
    const r = prepareProject({ demo: true, project: dir }); const port = 6400 + Math.floor(Math.random() * 300);
    const srv = spawn(py!, [path.join(R, "editor/server.py"), "--root", r.runtime, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MV_NO_PICKER: "1" } });
    const url: string = await new Promise((ok, ng) => { srv.stdout.on("data", (b) => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); setTimeout(() => ng(Error("server timeout")), 8000); });
    try {
      const post = async (p: string, b: any) => { const st = await (await fetch(url + "/api/state")).json(); const res = await fetch(url + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: st.revision, ...b }) }); return [res.status, await res.json()] as const; };
      const d0 = await (await fetch(url + "/api/export-settings")).json(); expect(d0.folder).toBe(d0.default); expect(d0.suggestedName).toMatch(/_v1\.mp4$/);
      const [, pick] = await post("/api/pick-folder", {}); expect(pick.available).toBe(false);
      const target = path.join(dir, "私の動画", "MV");
      const [ok, s] = await post("/api/export-settings", { folder: target }); expect(ok).toBe(200); expect(fs.realpathSync(s.folder)).toBe(fs.realpathSync(target));
      expect((await (await fetch(url + "/api/export-settings")).json()).folder).toBe(s.folder);
      const [bad, e] = await post("/api/export-settings", { folder: "relative" }); expect(bad).toBe(400); expect(e.error).toMatch(/フルパス/);
    } finally { srv.kill(); }
  }, 20000);
});
