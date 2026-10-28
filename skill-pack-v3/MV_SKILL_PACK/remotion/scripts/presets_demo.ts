// Presets comparison: same song section rendered with every preset, labelled, concatenated.
// usage: npm run presets-demo -- --project <曲> [--from 40 --seconds 8 --aspect 16:9 --out out/presets_compare.mp4]
import { buildProps } from "../src/lib/pipeline";
import { PRESETS } from "../src/lib/presets";
import { loadConfig, readJson } from "./project";
import { PROJECTS_DIR, REMOTION_DIR, ff, fail, fs, log, npx, parseArgs, path , labelFilter, ffFilterPath, demoOut } from "./common";

const LABEL: Record<string, string> = { story: "story｜物語・シネスコ・長回し", dance: "dance｜短いカット・粒子・パンチ", lipsync: "lipsync｜顔アップ・口パク強め", live: "live｜ライブ感・グロー・ランプ", vocaloid: "vocaloid｜中央大文字・プラズマ・リング", firsttake: "firsttake｜一発撮り・ほぼ無加工" };

async function main() {
  const { o } = parseArgs(process.argv.slice(2));
  const dir = path.join(PROJECTS_DIR, String(o.project ?? ""));
  if (!fs.existsSync(path.join(dir, "song.json"))) throw new Error("--project に npm run mv 済みの曲名を指定してください");
  const from = Number(o.from ?? 40), sec = Number(o.seconds ?? 8), aspect = String(o.aspect ?? "16:9");
  const song = readJson<any>(path.join(dir, "song.json"), null), media = readJson<any[]>(path.join(dir, "media.json"), []);
  const tmp = path.join(REMOTION_DIR, "out", "presets_tmp"); fs.mkdirSync(tmp, { recursive: true });
  const parts: string[] = [];
  for (const id of Object.keys(PRESETS).filter((k) => LABEL[k])) {
    const cfg = { ...loadConfig(dir), preset: id, aspect, range: { start: from, end: from + sec } } as any;
    const props = buildProps(song, cfg, media as any);
    const pf = path.join(tmp, `${id}.json`), mp4 = path.join(tmp, `${id}.mp4`);
    fs.writeFileSync(pf, JSON.stringify(props));
    log(`🎬 ${id}`);
    npx(["remotion", "render", "MV", mp4, `--props=${pf}`, "--log=error", "--concurrency=4"]);
    const lab = path.join(tmp, `${id}_l.mp4`);
    const font = path.join(REMOTION_DIR, "public", "fonts", "NotoSansJP.ttf");
    ff(["-y", "-i", mp4, "-vf", labelFilter(`drawtext=fontfile=${ffFilterPath(font)}:text='${LABEL[id]}':x=40:y=36:fontsize=${Math.round(Math.min(props.height / 22, props.width / 34))}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=14:enable='lt(t,${sec - 0.3})'`), "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "21", "-c:a", "aac", "-b:a", "160k", lab]);
    parts.push(lab);
  }
  const list = path.join(tmp, "list.txt"); fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const out = demoOut(`presets_compare_${aspect.replace(":", "x")}.mp4`, o.out);
  ff(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  log(`✅ ${out}`);
}
main().catch(fail);
