// npm run qc:black -- <video.mp4> [state.json] [--max 0.08]
// Reports frames whose share of flat near-black area exceeds --max (default 8 %), skipping the intentional impact frames
// listed in the state's comp.fx. Exit code 1 when any frame fails.
import { spawn } from "node:child_process";
import fs from "node:fs";
import { blackFraction, impactWindows, isIntentional, type BlackHit } from "../src/lib/blackqc";
const args = process.argv.slice(2), mi = args.indexOf("--max"), max = mi >= 0 ? Number(args[mi + 1]) : 0.08;
const [video, stateFile] = args.filter((a, i) => !a.startsWith("--") && i !== mi + 1 || mi < 0 && !a.startsWith("--"));
if (!video) { console.error("使い方: npm run qc:black -- <動画.mp4> [state.json] [--max 0.08]"); process.exit(2); }
const st = stateFile ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null, data = st?.data ?? st;
const W = 160, H = 96, win = impactWindows(data);
const ff = spawn(process.env.MVPACK_FFMPEG ?? "ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"]);
let buf = Buffer.alloc(0), frame = 0; const fps = data?.fps ?? 30, hits: BlackHit[] = [];
ff.stdout.on("data", (d: Buffer) => { buf = Buffer.concat([buf, d]); while (buf.length >= W * H) { const f = new Uint8Array(buf.subarray(0, W * H)); buf = buf.subarray(W * H); const t = frame / fps, frac = blackFraction(f, W, H); if (frac > max && !isIntentional(t, win)) hits.push({ frame, t: +t.toFixed(3), frac: +frac.toFixed(3) }); frame++; } });
ff.on("close", () => {
  console.log(JSON.stringify({ video, frames: frame, max, failed: hits.length }));
  for (const h of hits) console.log(`frame ${h.frame}  ${h.t}s  黒い空白 ${(h.frac * 100).toFixed(1)}%`);
  process.exit(hits.length ? 1 : 0);
});
