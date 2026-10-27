// Genre recipe samples: the same stills with each genre's styles + fonts + colours (≈6 s each, labelled, concatenated).
// usage: npm run genre-demo [-- --aspect 16:9 --seconds 6 --out out/genre_samples.mp4]
import { buildProps } from "../src/lib/pipeline";
import { GENRES } from "../src/lib/genres";
import { FONT_REG } from "../src/lib/fonts";
import { charTimes } from "../src/lib/song";
import type { Song } from "../src/lib/types";
import { PACK_DIR, PUBLIC_PROJECT, REMOTION_DIR, ff, fail, focusPoint, fs, imageSize, log, npx, parseArgs, path , labelFilter, ffFilterPath } from "./common";

// original sample lyrics written for this pack
const TEXT: Record<string, [string, string, string]> = {
  ballad: ["遠い街の灯りに 君を想う", "さよならの代わりに 歌うよ", "ありがとう"],
  rock_edm: ["鳴り止まない ノイズの中で", "叫べ 夜を 壊すまで", "いくぞ"],
  citypop_jazz: ["真夜中の ハイウェイ 二人きり", "ネオンに 溶けてく 恋のリズム", "Stay"],
  idol_pop: ["きらきら 星に 願いをかけて", "大好きって 言わせてよ", "せーの！"],
  wa: ["桜 舞う 月の夜に", "紅の 花は 風に 散る", "雅"],
  hiphop: ["マイク握って 言葉を刻む 今夜も 街で 韻を踏む", "止まらない ビートに 乗せて 叫ぶ", "Yeah"],
};
const BPM: Record<string, number> = { ballad: 72, rock_edm: 150, citypop_jazz: 108, idol_pop: 140, wa: 96, hiphop: 92 };

function songFor(g: string, sec: number): Song {
  const [a, b, c] = TEXT[g], bpm = BPM[g];
  const mk = (text: string, s: number, e: number) => { const ws = text.split(" "); const tot = ws.join("").length; let acc = s;
    const words = ws.map((w) => { const d = ((e - s) * w.length) / tot; const o = { text: w, start: acc, end: acc + d }; acc += d; return o; });
    return { text, start: s, end: e, ...charTimes(text, s, e, words) }; };
  const k = sec / 6;
  return { title: g, duration: sec, fps: 30, bpm, phase: 0, beatsPerBar: 4, energy: [], energyHz: 0,
    sections: [{ label: "VERSE", type: "verse", start: 0, end: 2.5 * k }, { label: "CHORUS", type: "chorus", start: 2.5 * k, end: sec }],
    lines: [mk(a, 0.3 * k, 2.2 * k), mk(b, 2.6 * k, 4.5 * k), mk(c, 4.75 * k, 5.5 * k)] };
}

async function main() {
  const { o } = parseArgs(process.argv.slice(2));
  const sec = Number(o.seconds ?? 6), aspect = String(o.aspect ?? "16:9");
  const imgDir = path.join(PACK_DIR, "input_sample", "images"), dst = path.join(PUBLIC_PROJECT, "showcase");
  fs.mkdirSync(dst, { recursive: true });
  const imgs = fs.readdirSync(imgDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const media = imgs.map((f, i) => { const n = `img${String(i).padStart(2, "0")}${path.extname(f).toLowerCase()}`; fs.copyFileSync(path.join(imgDir, f), path.join(dst, n)); const full = path.join(imgDir, f);
    return { src: `project/showcase/${n}`, kind: "image" as const, focus: focusPoint(full), size: imageSize(full) }; });
  const tmp = path.join(REMOTION_DIR, "out", "genre_tmp"); fs.mkdirSync(tmp, { recursive: true });
  const parts: string[] = [];
  const font = path.join(REMOTION_DIR, "public", "fonts", "NotoSansJP.ttf");
  Object.keys(GENRES).forEach((g, gi) => {
    const rot = [...media.slice(gi % media.length), ...media.slice(0, gi % media.length)];
    const props = buildProps(songFor(g, sec), { genre: g, aspect } as any, rot as any);
    const pf = path.join(tmp, `${g}.json`), mp4 = path.join(tmp, `${g}.mp4`), lab = path.join(tmp, `${g}_l.mp4`);
    fs.writeFileSync(pf, JSON.stringify(props));
    const fam = (id?: string) => FONT_REG.find((f) => f.id === id)?.family ?? "-";
    const used = [...new Set(props.lines.map((L) => `${L.style}/${fam(L.params.font)}`))].join("  ");
    log(`🎬 ${GENRES[g].ja}: ${used}`);
    npx(["remotion", "render", "MV", mp4, `--props=${pf}`, "--log=error", "--concurrency=4"]);
    const label = `${GENRES[g].ja}｜${used}`.replace(/:/g, "\\:").replace(/'/g, "");
    ff(["-y", "-i", mp4, "-f", "lavfi", "-t", String(sec), "-i", "anullsrc=r=48000:cl=stereo", "-vf", labelFilter(`drawtext=fontfile=${ffFilterPath(font)}:text='${label}':x=30:y=26:fontsize=${Math.round(Math.min(props.height / 28, props.width / 48))}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=10`),
      "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "21", "-c:a", "aac", "-b:a", "128k", lab]);
    parts.push(lab);
  });
  const list = path.join(tmp, "list.txt"); fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const out = path.resolve(REMOTION_DIR, String(o.out ?? `out/genre_samples_${aspect.replace(":", "x")}.mp4`));
  ff(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  log(`✅ ${out}`);
}
main().catch(fail);
