// npm run pro-demo -- [--out ../../dist/pro_motion_demo.mp4] [--stills]
// Short demo of the pro motion core + motion-graphics transitions + parts animation on the bundled sample song.
// Uses projects/sample_song (run `npm run sample` once) and the original demo character (npm run parts -- demo).
import { buildProps } from "../src/lib/pipeline";
import { PALETTES } from "../src/lib/pro";
import type { Song } from "../src/lib/types";
import { readJson } from "./project";
import { INPUT_DIR, PACK_DIR, PROJECTS_DIR, PUBLIC_PROJECT, REMOTION_DIR, fail, fs, log, npx, parseArgs, path } from "./common";
import { loadRigForRender, runPy, rigFromLayersDir } from "./parts_lib";

async function main() {
  const { o } = parseArgs(process.argv.slice(2));
  const dir = path.join(PROJECTS_DIR, "sample_song");
  const song0 = readJson<Song>(path.join(dir, "song.json"), null as any), media = readJson<any[]>(path.join(dir, "media.json"), []);
  if (!song0) throw new Error("先に npm run sample を1回実行してください");
  if (!fs.existsSync(path.join(INPUT_DIR, "parts", "demo_chara", "rig.json"))) { runPy(["demo", "--out", path.join(INPUT_DIR, "parts", "demo_chara")]); rigFromLayersDir(path.join(INPUT_DIR, "parts", "demo_chara"), "demo_chara", "demo"); }
  const song: Song = { ...song0, sections: [
    { label: "Aメロ", type: "verse", start: 0, end: 5.6 }, { label: "Bメロ", type: "pre_chorus", start: 5.6, end: 9.6 },
    { label: "サビ", type: "chorus", start: 9.6, end: 13.2 }, { label: "Cメロ", type: "bridge", start: 13.2, end: song0.duration } ] };
  const rr = loadRigForRender(dir, INPUT_DIR, { parts: { rig: path.join(INPUT_DIR, "parts", "demo_chara", "rig.json") } } as any, PUBLIC_PROJECT)!;
  const cfg: any = { fps: 30, aspect: "16:9", genre: "rock_edm", combo: ["story", "typography", "mograph", "lyric_motion"], lyrics: { lines: { "0": "pro_tanzaku", "1": "pro_label", "2": "pro_smash", "3": "pro_pop" } }, parts: { rigData: rr.rig, x: 0.24, h: 0.86 } };
  const p: any = buildProps(song, cfg, media as any, { audio: "project/audio.mp3" });
  // demo choreography: one look per section so several pro looks are visible in 20 s
  const looks = [["tanzaku", "dusk", "cut"], ["hud", "neon", "glyph_zoom"], ["mono", "mono_red", "diag_sweep"], ["burst", "pop", "circle"]] as const;
  p.mograph.sections = p.mograph.sections.map((s: any, i: number) => ({ ...s, look: looks[i][0], palette: PALETTES[looks[i][1]], transition: looks[i][2], parallax: i > 0, textures: i === 2 ? ["grain", "rgb"] : i === 1 ? ["anaglyph", "halftone"] : ["grain"], accentDensity: i >= 2 ? 2 : 0 }));
  const { beatAccents } = await import("../src/lib/pro");
  p.mograph.accents = [...beatAccents(p.beat, 9.6, 13.2, 2, ["invert", "bump", "rotate"], 3), ...beatAccents(p.beat, 13.2, 20, 1, ["bump"], 4)];
  for (const B of [5.6, 9.6, 13.2]) { const i = p.shots.findIndex((s: any) => s.start < B - 1e-3 && s.end > B + 1e-3); if (i >= 0) { const a = p.shots[i]; p.shots.splice(i, 1, { ...a, end: B }, { ...a, id: `${a.id}b`, start: B, transition: "cut" }); } } // cut on the section change
  for (const s of p.shots) s.role = s.start >= 5.6 - 1e-3 ? (s.start < 9.6 ? "typo" : s.start < 13.2 ? "typo" : "mograph") : "story";
  for (const L of p.lines) { const ms = p.mograph.sections.find((s: any) => L.start >= s.start && L.start < s.end); if (ms) L.params.palette = L.start < 5.6 ? { accent: ms.palette.accent } : { fill: ms.palette.fg, stroke: ms.palette.bg, accent: ms.palette.accent }; }
  for (const L of p.lines) if (L.li === 1 || L.li === 2) { L.params.size = L.li === 2 ? 2.1 : 1.6; L.params.anchor = L.li === 2 ? 3 : 0; } // full-screen typography sections
  p.parts.segments = p.parts.segments.map((s: any) => ({ ...s, preset: s.type === "bridge" ? "groove" : "off" }));
  const out = path.resolve(String(o.out ?? path.join(PACK_DIR, "..", "..", "..", "dist", "pro_motion_demo.mp4")));
  const pf = path.join(REMOTION_DIR, "out", "pro_demo_props.json"); fs.mkdirSync(path.dirname(pf), { recursive: true }); fs.writeFileSync(pf, JSON.stringify(p));
  if (o.stills) { for (const f of String(o.stills === true ? "45,100,170,200,250,292,300,330,360,400,440,500,560" : o.stills).split(",")) npx(["remotion", "still", "MV", path.join(REMOTION_DIR, "out", "pro_demo", `f${f}.png`), `--props=${pf}`, `--frame=${f}`, "--log=error"]); log("stills → out/pro_demo/"); return; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  npx(["remotion", "render", "MV", out, `--props=${pf}`, "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--log=error", "--concurrency=4"]);
  log(`✅ ${out}`);
}
main().catch(fail);
