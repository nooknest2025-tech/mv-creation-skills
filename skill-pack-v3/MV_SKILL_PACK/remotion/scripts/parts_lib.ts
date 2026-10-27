// Parts animation file handling (Node): import PSD / PNG folders / single image -> rig.json + review sheet; publish for render.
import { spawnSync } from "node:child_process";
import { REMOTION_DIR, fs, path } from "./common";
import { layersToRig, rigIssues, type Rig } from "../src/lib/rig";
import type { MVConfig } from "../src/lib/config";

export function py(): string | null { for (const p of [process.env.MVPACK_PYTHON ?? "", "python3", "python", "py"].filter(Boolean)) { const r = spawnSync(p, ["--version"], { shell: process.platform === "win32" }); if (r.status === 0) return p; } return null; }
export function runPy(args: string[]): any {
  const p = py(); if (!p) throw new Error("Python が必要です（npm run doctor で確認）");
  const r = spawnSync(p, [path.join(REMOTION_DIR, "scripts", "parts.py"), ...args], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "parts.py 失敗").trim().split("\n").pop());
  return JSON.parse(r.stdout.trim().split("\n").pop() || "{}");
}
/** a folder that holds layers.json (from parts.py) -> rig.json (keeps user edits of an existing rig.json). */
export function rigFromLayersDir(dir: string, name: string, source: Rig["source"]): Rig {
  const L = JSON.parse(fs.readFileSync(path.join(dir, "layers.json"), "utf8"));
  if (!L.layers?.length) throw new Error("パーツ（レイヤー）が1つも見つかりませんでした。表示中のレイヤーがあるか確認してください");
  const rig = layersToRig(name, L.size, L.layers.map((l: any) => ({ name: l.name, src: l.file, bbox: l.bbox })));
  rig.source = source; if (L.note) rig.quality = L.note;
  const prev = path.join(dir, "rig.json");
  if (fs.existsSync(prev)) { const old: Rig = JSON.parse(fs.readFileSync(prev, "utf8")); for (const p of rig.parts) { const o = old.parts.find((x) => x.id === p.id && x.locked); if (o) Object.assign(p, { pivot: o.pivot, parent: o.parent, kind: o.kind, z: o.z, spring: o.spring, locked: true }); } }
  fs.writeFileSync(prev, JSON.stringify(rig, null, 1));
  return rig;
}
/** PNG folder (one full-canvas PNG per part, file name = part name) -> layers.json. */
export function pngFolderLayers(src: string, out: string) {
  const files = fs.readdirSync(src).filter((f) => /\.png$/i.test(f)).sort();
  if (!files.length) throw new Error(`${src} に PNG がありません`);
  fs.mkdirSync(out, { recursive: true });
  for (const f of files) if (path.resolve(src) !== path.resolve(out)) fs.copyFileSync(path.join(src, f), path.join(out, f));
  const bb = runPy(["bbox", ...files.map((f) => path.join(out, f))]);
  const first = bb[path.join(out, files[0])];
  const sizes = new Set(Object.values(bb).map((v: any) => v.size.join("x")));
  if (sizes.size > 1) throw new Error(`PNG のサイズがそろっていません（${[...sizes].join(", ")}）。全パーツを同じキャンバスサイズで書き出してください`);
  fs.writeFileSync(path.join(out, "layers.json"), JSON.stringify({ size: first.size, layers: files.map((f) => ({ name: f.replace(/\.png$/i, ""), file: f, bbox: bb[path.join(out, f)].bbox })) }, null, 1));
}
export function findRig(dir: string, inputDir: string, cfg: MVConfig): string | null {
  if (cfg.parts?.off) return null;
  if (cfg.parts?.rig) { for (const b of [dir, inputDir]) { const p = path.resolve(b, cfg.parts.rig); if (fs.existsSync(p)) return p; } return null; }
  for (const b of [path.join(dir, "parts"), path.join(inputDir, "parts")]) if (fs.existsSync(b)) for (const d of fs.readdirSync(b).sort()) { const p = path.join(b, d, "rig.json"); if (fs.existsSync(p)) return p; }
  return null;
}
/** copy rig images into public/ and rewrite srcs for the renderer. */
export function loadRigForRender(dir: string, inputDir: string, cfg: MVConfig, publicProject: string): { rig: Rig; issues: string[] } | null {
  const f = findRig(dir, inputDir, cfg); if (!f) return null;
  const rig: Rig = JSON.parse(fs.readFileSync(f, "utf8")), src = path.dirname(f), name = path.basename(src).replace(/[^\w-]/g, "_") || "rig";
  const dst = path.join(publicProject, "parts", name); fs.mkdirSync(dst, { recursive: true });
  const pub = (s: string) => { fs.copyFileSync(path.join(src, path.basename(s)), path.join(dst, path.basename(s))); return `project/parts/${name}/${path.basename(s)}`; };
  for (const p of rig.parts) { p.src = pub(p.src); if (p.states) for (const k of Object.keys(p.states)) p.states[k] = pub(p.states[k]); }
  return { rig, issues: rigIssues(rig) };
}
