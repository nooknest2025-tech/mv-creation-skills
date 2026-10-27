// Project folder management: config, song analysis cache, media list, manifest with versions + approval lock.
import { DEFAULT_CONFIG, type MVConfig } from "../src/lib/config";
import { PROJECTS_DIR, PUBLIC_PROJECT, UserError, fs, path, safeName } from "./common";

export interface Version { v: number; createdAt: string; note: string; preset: string; aspect: string; outputs: Record<string, string>; configSnapshot: MVConfig; approved?: boolean }
export interface Manifest { title: string; createdAt: string; versions: Version[]; approved?: number }

export function projectDir(title: string) { const d = path.join(PROJECTS_DIR, safeName(title)); fs.mkdirSync(path.join(d, "out"), { recursive: true }); return d; }
export const readJson = <T,>(f: string, def: T): T => { try { return JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")); } catch { return def; } };
export const writeJson = (f: string, d: unknown) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2)); };

export function loadConfig(dir: string, inputCfg?: string): MVConfig {
  const f = path.join(dir, "mv.config.json");
  if (!fs.existsSync(f)) writeJson(f, inputCfg ? readJson(inputCfg, DEFAULT_CONFIG) : DEFAULT_CONFIG);
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")) }; }
  catch (e) { throw new UserError(`mv.config.json の書式が壊れています: ${(e as Error).message}`, `${f} を開いて、カンマや " の閉じ忘れを直してください（Codex に「config直して」でもOK）。`); }
}
export function saveConfig(dir: string, cfg: MVConfig) { writeJson(path.join(dir, "mv.config.json"), cfg); }

export function loadManifest(dir: string, title: string): Manifest { return readJson(path.join(dir, "manifest.json"), { title, createdAt: new Date().toISOString(), versions: [] }); }
export function nextVersion(m: Manifest) { return (m.versions.at(-1)?.v ?? 0) + 1; }
export function addVersion(dir: string, m: Manifest, v: Version) {
  // approval lock: approved versions are immutable; we only ever append
  if (m.versions.some((x) => x.v === v.v && x.approved)) throw new UserError(`v${v.v} は承認済みなので上書きできません`, "新しいバージョンとして書き出されます（npm run mv をもう一度）。");
  m.versions = m.versions.filter((x) => x.v !== v.v).concat(v);
  writeJson(path.join(dir, "manifest.json"), m);
}
export function approve(dir: string, title: string, v: number) {
  const m = loadManifest(dir, title);
  const x = m.versions.find((y) => y.v === v);
  if (!x) throw new UserError(`v${v} が見つかりません`, `あるのは ${m.versions.map((y) => "v" + y.v).join(", ") || "なし"} です。`);
  x.approved = true; m.approved = v;
  for (const f of Object.values(x.outputs)) { try { fs.chmodSync(path.join(dir, f), 0o444); } catch { /* windows: best effort */ } }
  writeJson(path.join(dir, "manifest.json"), m);
}
/** publish to Remotion public/project so Studio + renders can load files. */
export function publish(files: { from: string; name: string }[]) {
  fs.mkdirSync(PUBLIC_PROJECT, { recursive: true });
  for (const f of files) {
    const dst = path.join(PUBLIC_PROJECT, f.name);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(f.from).size) fs.copyFileSync(f.from, dst);
  }
}
