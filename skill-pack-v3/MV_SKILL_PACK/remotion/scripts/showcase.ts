// Style showcase: all 32 lyric styles, a few seconds each, over a stills-only cinematic montage.
// usage: npm run showcase [-- --seconds 2.8 --aspect 9:16 --images ../input/sample --out out/showcase.mp4 --only glitch,neon]
import { STYLE_NAMES } from "../src/lib/catalog";
import { charTimes } from "../src/lib/song";
import { resolveLines } from "../src/lib/resolve";
import { planShots } from "../src/lib/cuts";
import { PRESETS } from "../src/lib/presets";
import { ASPECTS } from "../src/lib/config";
import type { Song, SectionType } from "../src/lib/types";
import { PUBLIC_PROJECT, PACK_DIR, REMOTION_DIR, focusPoint, imageSize, fail, fs, log, npx, parseArgs, path, demoOut } from "./common";

// original sample lines (written for this pack) - include keyword-effect words (光/好き/キライ/夢/溶け)
const TEXT = ["光の中で 君を呼ぶ", "好きって 言えないまま", "キライ キライ だいキライ", "夢の続きを 見せてよ", "甘い声が 溶けていく", "揺れる 心の 音", "星を 数えて 眠る", "ノイズまみれの 世界で"];

export function showcaseSong(seconds: number, only?: string[]) {
  const styles = only?.length ? only : STYLE_NAMES;
  const bpm = 120, lines: Song["lines"] = [], sections: Song["sections"] = [];
  const types: SectionType[] = ["intro", "verse", "pre_chorus", "chorus", "bridge", "outro"];
  for (let k = 0; k < styles.length; k++) {
    const t0 = k * seconds, text = TEXT[k % TEXT.length];
    const s = t0 + 0.35, e = t0 + seconds * 0.72;
    const words = text.split(" ");
    const tot = words.join("").length;
    let acc = s;
    const ws = words.map((w) => { const d = ((e - s) * w.length) / tot; const o = { text: w, start: acc, end: acc + d }; acc += d; return o; });
    lines.push({ text, start: s, end: e, ...charTimes(text, s, e, ws) });
    sections.push({ label: `${styles[k]}`, type: types[k % types.length], start: t0, end: t0 + seconds });
  }
  const song: Song = { title: "showcase", duration: styles.length * seconds, fps: 30, bpm, phase: 0, beatsPerBar: 4, sections, energy: [], energyHz: 0, lines };
  return { song, styles };
}

async function main() {
  const { o } = parseArgs(process.argv.slice(2));
  const seconds = Number(o.seconds ?? 2.8), aspect = (o.aspect as keyof typeof ASPECTS) ?? "16:9";
  const only = typeof o.only === "string" ? o.only.split(",") : undefined;
  const { song, styles } = showcaseSong(seconds, only);
  const lines = resolveLines(song, { lines: Object.fromEntries(styles.map((s, i) => [String(i), s])) });
  // media: sample stills copied into public/project/showcase
  const imgDir = path.resolve(String(o.images ?? path.join(PACK_DIR, "input_sample", "images")));
  const dst = path.join(PUBLIC_PROJECT, "showcase");
  fs.mkdirSync(dst, { recursive: true });
  const imgs = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : [];
  const media = imgs.map((f, i) => { const n = `img${String(i).padStart(2, "0")}${path.extname(f).toLowerCase()}`; fs.copyFileSync(path.join(imgDir, f), path.join(dst, n)); const full = path.join(imgDir, f); return { src: `project/showcase/${n}`, kind: "image" as const, focus: focusPoint(full), size: imageSize(full) }; }); // smart crop
  const preset = { ...PRESETS.story, cuts: { intro: 4, verse: 2, pre_chorus: 2, chorus: 1, bridge: 4, outro: 4, other: 2 } as any, recipes: { ...PRESETS.story.recipes, preChorusBreak: false, loopEnding: false } };
  const shots = planShots(song, preset, media, {});
  const A = ASPECTS[aspect];
  const fps = 30;
  const props = { width: A.w, height: A.h, fps, durationInFrames: Math.round(song.duration * fps), startAt: 0, lines, shots, beat: { bpm: song.bpm, phase: 0, beatsPerBar: 4 },
    grade: preset.grades.verse, shake: 0.35, leaks: 0.6, particles: 0.5, finish: { vignette: 0.3, grain: 0.04, glow: 0.2 }, overlayOnly: !!o.overlay, textSize: 1, textY: A.textY, cards: styles.map((s, i) => ({ t: i * seconds, style: s })) };
  const pf = path.join(REMOTION_DIR, "out", `showcase_props_${aspect.replace(":", "x")}.json`);
  fs.mkdirSync(path.dirname(pf), { recursive: true });
  fs.writeFileSync(pf, JSON.stringify(props));
  if (o.stills) {
    for (let i = 0; i < styles.length; i++) {
      const f = Math.round((i * seconds + seconds * 0.55) * fps);
      npx(["remotion", "still", "Showcase", path.join("out", "showcase_stills", `${String(i + 1).padStart(2, "0")}_${styles[i]}_${aspect.replace(":", "x")}.jpg`), `--props=${pf}`, `--frame=${f}`, "--log=error"]);
    }
    log("✅ スチル: remotion/out/showcase_stills/");
    return;
  }
  const out = demoOut(aspect === "16:9" ? "showcase.mp4" : `showcase_${aspect.replace(":", "x")}.mp4`, o.out);
  log(`🎬 ショーケース ${styles.length}スタイル × ${seconds}秒 を書き出し中… → ${out}`);
  npx(["remotion", "render", "Showcase", out, `--props=${pf}`, "--codec=h264", "--crf=20", "--pixel-format=yuv420p", "--log=error"]);
  log(`✅ 完成: remotion/${out}`);
}
if (process.argv[1]?.includes("showcase")) main().catch(fail);
