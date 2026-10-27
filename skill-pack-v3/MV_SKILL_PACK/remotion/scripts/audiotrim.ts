// ffmpeg cut (sample-accurate, original never modified) + ffprobe validation.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { fs, path } from "./common";
import type { CutPlan } from "../src/lib/audiocut";
import { checkSync } from "../src/lib/audiocut";

export const md5 = (f: string) => crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");
export const probeDur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f], { encoding: "utf8" }).trim());

export function cutAudio(song: string, c: CutPlan, outDir: string): string {
  if (!fs.existsSync(song)) throw new Error(`元の曲が見つかりません: ${song}`);
  const before = md5(song);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${c.shot}_lipsync.${c.format}`);
  if (path.resolve(out) === path.resolve(song)) throw new Error("出力先が元の曲と同じです");
  const sr = 48000, s0 = Math.round(c.start * sr), n = Math.round(c.dur * sr);
  const af = [`aresample=${sr}`, `atrim=start_sample=${s0}:end_sample=${s0 + n}`, "asetpts=PTS-STARTPTS", ...(c.fadeMs ? [`afade=t=in:d=${c.fadeMs / 1000}`, `afade=t=out:st=${c.dur - c.fadeMs / 1000}:d=${c.fadeMs / 1000}`] : []), `apad=whole_len=${n}`].join(",");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", song, "-af", af, "-ar", String(sr), ...(c.format === "mp3" ? ["-c:a", "libmp3lame", "-b:a", "192k"] : ["-c:a", "pcm_s16le"]), out]);
  if (md5(song) !== before) throw new Error("元の曲ファイルが変更されました（中止）");
  return out;
}
export function validateCut(file: string, videoSec: number, fps = 30) { const d = probeDur(file); const r = checkSync(d, videoSec, fps); return { ...r, audioSec: d }; }
