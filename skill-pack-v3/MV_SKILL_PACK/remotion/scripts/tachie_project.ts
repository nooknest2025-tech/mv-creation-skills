// 立ち絵モーションMV project setup: find the character material, turn it into rigs with the same code as
// `npm run parts` (import / split), and write projects/<曲>/tachie/main.tachie.json + out/editor-input.json
// so `npm run editor -- --project <曲>` opens it with every edit control (editor edits always win).
import { INPUT_DIR, UserError, fs, path } from "./common";
import { pngFolderLayers, rigFromLayersDir, runPy } from "./parts_lib";
import { TACHIE_MATERIAL_HELP } from "../src/lib/semi";
import { buildTachieStage, tachieScenes, type ShotLite } from "../src/lib/tachieMode";
import type { Mood } from "../src/lib/mograph";

export type Material =
  | { kind: "rig"; file: string; name: string }
  | { kind: "psd"; file: string; name: string }
  | { kind: "pngs"; dir: string; name: string }
  | { kind: "image"; file: string; name: string };
const nm = (s: string) => path.basename(s).replace(/\.[^.]+$/, "").replace(/[^\w\u3040-\u9fff-]/g, "_") || "chara";
const ls = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => !f.startsWith(".")).sort() : []);

/** character material in priority order: ready rigs (npm run parts) > PSD > parts PNG folder > one full-body image in input/tachie. */
export function findCharacterMaterial(inputDir = INPUT_DIR, projectDir?: string): Material[] {
  const out: Material[] = [], seen = new Set<string>();
  const add = (m: Material) => { if (!seen.has(m.name)) { seen.add(m.name); out.push(m); } };
  for (const base of [projectDir ? path.join(projectDir, "parts") : "", path.join(inputDir, "parts")].filter(Boolean))
    for (const d of ls(base)) { const f = path.join(base, d, "rig.json"); if (fs.existsSync(f)) add({ kind: "rig", file: f, name: nm(d) }); }
  for (const base of [path.join(inputDir, "parts"), path.join(inputDir, "tachie")]) {
    for (const f of ls(base)) {
      const p = path.join(base, f);
      if (/\.psd$/i.test(f)) add({ kind: "psd", file: p, name: nm(f) });
      else if (fs.statSync(p).isDirectory() && !fs.existsSync(path.join(p, "rig.json")) && ls(p).some((x) => /\.png$/i.test(x))) add({ kind: "pngs", dir: p, name: nm(f) });
      else if (base.endsWith("tachie") && /\.(png|jpe?g|webp)$/i.test(f)) add({ kind: "image", file: p, name: nm(f) });
    }
  }
  return out;
}
/** material -> rig.json (input/parts/<name>/, same place and code as npm run parts). */
export function ensureRig(m: Material, inputDir = INPUT_DIR): string {
  if (m.kind === "rig") return m.file;
  const dir = path.join(inputDir, "parts", m.name); fs.mkdirSync(dir, { recursive: true });
  try {
    if (m.kind === "psd") { runPy(["layers", m.file, "--out", dir]); rigFromLayersDir(dir, m.name, "psd"); }
    else if (m.kind === "pngs") { pngFolderLayers(m.dir, dir); rigFromLayersDir(dir, m.name, "pngs"); }
    else { runPy(["split", m.file, "--out", dir]); rigFromLayersDir(dir, m.name, "split"); }
  } catch (e: any) {
    throw new UserError(`キャラ素材「${m.name}」をパーツにできませんでした: ${e.message}`, "Python と numpy・Pillow が必要です（setup.bat / ./setup.sh か npm run doctor）。手で分けたパーツ PNG か PSD を input/parts/ に入れると確実です。");
  }
  return path.join(dir, "rig.json");
}
export interface TachieProjectIn { dir: string; inputDir?: string; mood: Mood; song: { duration: number; bpm: number; phase?: number; sections: any[] }; shots: ShotLite[]; images: string[]; videos: string[]; mediaSrc?: (src: string) => string | undefined; lyricStyles?: any[]; title: string; width?: number; height?: number; fps?: number }
/** writes tachie/main.tachie.json (+ rig copies) and out/editor-input.json; returns what was used. */
export function createTachieProject(o: TachieProjectIn) {
  const mats = findCharacterMaterial(o.inputDir ?? INPUT_DIR, o.dir);
  if (!mats.length) throw new UserError("立ち絵モーションMVのキャラ素材が見つかりません", TACHIE_MATERIAL_HELP);
  const tdir = path.join(o.dir, "tachie"); fs.mkdirSync(tdir, { recursive: true });
  const rigs = mats.slice(0, 3).map((m) => {
    const rigFile = ensureRig(m, o.inputDir ?? INPUT_DIR), src = path.dirname(rigFile), dst = path.join(tdir, `rig_${m.name}`);
    fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) if (fs.statSync(path.join(src, f)).isFile()) fs.copyFileSync(path.join(src, f), path.join(dst, f));
    return { name: m.name, dir: `rig_${m.name}` };
  });
  const stageFile = path.join(tdir, "main.tachie.json");
  // keep a hand-tuned stage: only write the default when none exists (editor patches are stored separately anyway)
  if (!fs.existsSync(stageFile)) fs.writeFileSync(stageFile, JSON.stringify(buildTachieStage(rigs, o.mood), null, 1));
  else { const st = JSON.parse(fs.readFileSync(stageFile, "utf8")); for (const c of st.chars ?? []) if (!fs.existsSync(path.join(tdir, c.rig, "rig.json"))) throw new UserError(`ステージ ${stageFile} のキャラ ${c.id} の rig（${c.rig}）が見つかりません`, "tachie/main.tachie.json を消すと、いまのキャラ素材で作り直します。"); }
  const media = [...o.images, ...o.videos], stageIndex = media.length;
  const idx = (src: string) => { const f = o.mediaSrc?.(src) ?? src; return media.findIndex((m) => m === f); };
  const scenes = tachieScenes(o.shots, idx, stageIndex, o.song.duration);
  const used = new Set(scenes.map((s) => s.asset));
  const keep = media.filter((_, i) => used.has(i));
  const manifest = {
    title: o.title, audio: undefined as any, lyrics: path.join(o.dir, "song.json"),
    images: [...keep.filter((f) => !o.videos.includes(f)), stageFile], videos: keep.filter((f) => o.videos.includes(f)),
    scenes: [] as typeof scenes, sections: o.song.sections.map((x: any) => ({ type: x.type, label: x.label, start: x.start, end: x.end })),
    ...(o.lyricStyles ? { lyricStyles: o.lyricStyles } : {}), bpm: o.song.bpm, phase: o.song.phase ?? 0, width: o.width ?? 1280, height: o.height ?? 720, fps: o.fps ?? 24,
  };
  // editor order is images then videos: put the stage right after the kept images, videos after it
  const nImg = manifest.images.length - 1, order = [...keep.filter((f) => !o.videos.includes(f)), "STAGE", ...manifest.videos];
  manifest.scenes = scenes.map((s) => ({ ...s, asset: s.asset === stageIndex ? nImg : order.indexOf(media[s.asset]) }));
  return { manifest, stageFile, rigs, materials: mats };
}
