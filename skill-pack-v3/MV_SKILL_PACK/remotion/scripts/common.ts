// Node-side helpers: paths, ffmpeg discovery, input detection, audio analysis, friendly Japanese errors.
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const REMOTION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PACK_DIR = path.resolve(REMOTION_DIR, "..");
export const INPUT_DIR = path.join(PACK_DIR, "input");
export const PROJECTS_DIR = path.join(PACK_DIR, "projects");
export const PUBLIC_PROJECT = path.join(REMOTION_DIR, "public", "project");

export class UserError extends Error { constructor(msg: string, public fix?: string) { super(msg); } }
export function fail(e: unknown): never {
  if (e instanceof UserError) { console.error(`\n❌ ${e.message}${e.fix ? `\n💡 対処: ${e.fix}` : ""}\n`); process.exit(2); }
  console.error("\n❌ 予期しないエラーが起きました。下のメッセージをそのまま Codex に貼って「直して」と頼んでください。\n", e);
  process.exit(1);
}
export const log = (s: string) => console.log(s);

// Child Python/ffmpeg output is UTF-8 everywhere (Windows consoles default to cp932 otherwise).
process.env.PYTHONUTF8 ??= "1";
process.env.PYTHONIOENCODING ??= "utf-8";

// ---------- Windows-safe process launch ----------
// npx/npm are .cmd shims on Windows and need a shell. Node joins shell args unquoted (and warns DEP0190),
// so we build one quoted command line ourselves; paths like "C:\\Users\\a b\\MV創作" stay intact.
export const isShim = (cmd: string) => /^(npx|npm|pnpm|yarn)(\.cmd)?$/i.test(cmd);
export function winArg(a: string): string { return a === "" ? '""' : /[\s"&|<>^()%!,;=]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a; }
export function shellOpts(cmd: string, args: string[], platform = process.platform): { args: string[]; shell: boolean } {
  const shell = platform === "win32" && isShim(cmd);
  return { args: shell ? args.map(winArg) : args, shell };
}
/** spawnSync that is safe for .cmd shims on Windows (no DEP0190, quoted args). */
export function run(cmd: string, args: string[], opts: Parameters<typeof spawnSync>[2] = {}) {
  const so = shellOpts(cmd, args);
  return so.shell ? spawnSync([cmd, ...so.args].join(" "), { ...opts, shell: true }) : spawnSync(cmd, args, { ...opts, shell: false });
}

// ---------- ffmpeg: MVPACK_FFMPEG > system > pack tools/ffmpeg > Remotion's bundled binaries ----------
// The bundled build is minimal (no f32le/md5 muxers, no drawtext/select filters): callers fall back where possible.
let FF: { ff: string[]; probe: string[]; full: boolean } | null = null;
const EXE = process.platform === "win32" ? ".exe" : "";
export function bundledBinary(name: "ffmpeg" | "ffprobe"): string | null {
  const dir = path.join(REMOTION_DIR, "node_modules", "@remotion");
  try { for (const d of fs.readdirSync(dir)) if (d.startsWith("compositor-")) { const f = path.join(dir, d, name + EXE); if (fs.existsSync(f)) return f; } } catch {}
  return null;
}
export function ffmpegCmd() {
  if (FF) return FF;
  const env = process.env.MVPACK_FFMPEG;
  if (env && fs.existsSync(env)) { const pr = path.join(path.dirname(env), "ffprobe" + EXE); return (FF = { ff: [env], probe: [fs.existsSync(pr) ? pr : "ffprobe"], full: true }); }
  const sys = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  if (sys.status === 0 && sys.stdout.trim()) return (FF = { ff: ["ffmpeg"], probe: ["ffprobe"], full: true });
  const tools = path.join(PACK_DIR, "tools", "ffmpeg");
  if (fs.existsSync(tools)) for (const d of fs.readdirSync(tools)) { const f = path.join(tools, d, "bin", "ffmpeg" + EXE); if (fs.existsSync(f)) return (FF = { ff: [f], probe: [path.join(tools, d, "bin", "ffprobe" + EXE)], full: true }); }
  const bf = bundledBinary("ffmpeg"), bp = bundledBinary("ffprobe");
  if (bf && bp) return (FF = { ff: [bf], probe: [bp], full: false });
  return (FF = { ff: ["npx", "remotion", "ffmpeg"], probe: ["npx", "remotion", "ffprobe"], full: false });
}
export function ffTry(args: string[], o: { input?: Buffer; maxBuffer?: number } = {}) {
  const [cmd, ...pre] = ffmpegCmd().ff;
  return run(cmd, [...pre, "-hide_banner", "-y", ...args], { input: o.input, maxBuffer: o.maxBuffer ?? 1 << 30, cwd: REMOTION_DIR });
}
export function ff(args: string[], o: { input?: Buffer; maxBuffer?: number } = {}) {
  const r = ffTry(args, o);
  if (r.status !== 0) throw new UserError(`ffmpeg が失敗しました: ${String(r.stderr).split("\n").slice(-4).join(" ")}`, "ffmpeg が無い場合は README の「ffmpeg」節（winget install Gyan.FFmpeg か、何もしなくても Remotion 同梱版が使われます）を見てください。");
  return r;
}
export function probe(file: string): any {
  const [cmd, ...pre] = ffmpegCmd().probe;
  const r = run(cmd, [...pre, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8", cwd: REMOTION_DIR });
  if (r.status !== 0) throw new UserError(`ファイルを読めません: ${file}`, "壊れていないか、対応形式（mp3/wav/m4a/flac, mp4/mov, png/jpg/webp）か確認してください。");
  return JSON.parse(String(r.stdout));
}
export const durationOf = (f: string) => Number(probe(f).format?.duration ?? 0);
export const md5File = (f: string) => crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex");

// ---------- input detection ----------
const EXT = {
  audio: [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"], image: [".png", ".jpg", ".jpeg", ".webp"], video: [".mp4", ".mov", ".webm", ".mkv", ".m4v"],
  lyricJson: [".json"], sub: [".srt", ".lrc", ".ass", ".vtt"], text: [".txt"],
};
export interface Detected { audio?: string; stems: string[]; lyrics?: string; lyricsKind?: "json" | "srt" | "lrc" | "ass" | "vtt" | "txt"; images: string[]; videos: string[]; config?: string }
export function detectInput(dir: string): Detected {
  if (!fs.existsSync(dir)) throw new UserError(`入力フォルダが見つかりません: ${dir}`, `「${path.basename(dir)}」フォルダを作って、曲ファイル（mp3/wav）を入れてください。`);
  const all: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { if (e.name.startsWith(".")) return; const p = path.join(d, e.name); e.isDirectory() ? walk(p) : all.push(p); });
  walk(dir);
  const ext = (f: string) => path.extname(f).toLowerCase();
  const audios = all.filter((f) => EXT.audio.includes(ext(f)));
  const isStem = (f: string) => /(inst|instrumental|karaoke|off ?vocal|stem|vocal|drums|bass|伴奏|オケ)/i.test(path.basename(f));
  const main = audios.filter((f) => !isStem(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0] ?? audios[0];
  const jsons = all.filter((f) => ext(f) === ".json" && !/mv\.config|media|manifest|song\.json/i.test(path.basename(f)));
  const lyricJson = jsons.find((f) => { try { return Array.isArray(JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, "")).lyrics); } catch { return false; } });
  const sub = all.find((f) => EXT.sub.includes(ext(f)));
  const txt = all.find((f) => ext(f) === ".txt" && !/readme|メモ/i.test(path.basename(f)));
  const lyrics = lyricJson ?? sub ?? txt;
  return {
    audio: main, stems: audios.filter((f) => f !== main), lyrics,
    lyricsKind: lyrics ? (lyricJson ? "json" : (ext(lyrics).slice(1) as any)) : undefined,
    images: all.filter((f) => EXT.image.includes(ext(f))).sort(), videos: all.filter((f) => EXT.video.includes(ext(f))).sort(),
    config: all.find((f) => path.basename(f) === "mv.config.json"),
  };
}

// ---------- audio analysis (energy / BPM / sections) with ffmpeg PCM decode ----------
export function decodeMono(file: string, sr = 11025): Float32Array {
  // WAV/s16le: supported by both full and Remotion's minimal ffmpeg (which lacks the f32le muxer)
  const r = ff(["-i", file, "-vn", "-ac", "1", "-ar", String(sr), "-c:a", "pcm_s16le", "-f", "wav", "-"], { maxBuffer: 1 << 30 });
  return wavToFloat(Buffer.from(r.stdout as Buffer));
}
/** PCM s16le WAV (possibly streamed with unknown sizes) -> Float32 samples. */
export function wavToFloat(b: Buffer): Float32Array {
  let p = 12, data = -1;
  while (p + 8 <= b.length) { const id = b.toString("latin1", p, p + 4); if (id === "data") { data = p + 8; break; } p += 8 + b.readUInt32LE(p + 4); }
  if (data < 0) data = 44;
  const n = Math.floor((b.length - data) / 2), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(data + i * 2) / 32768;
  return out;
}
export function analyzeAudio(file: string) {
  const sr = 11025, x = decodeMono(file, sr), hop = Math.round(sr / 100); // 100 Hz frames
  const n = Math.floor(x.length / hop), rms = new Float32Array(n), flux = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let s = 0, hf = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) { s += x[j] * x[j]; if (j) hf += Math.abs(x[j] - x[j - 1]); }
    rms[i] = Math.sqrt(s / hop);
    const v = hf / hop;
    flux[i] = Math.max(0, v - prev); prev = v;
  }
  // onset = high-frequency flux + loudness rise (so bass-heavy kicks count too), mean-removed
  {
    let mf = 0, mr = 0; const rr = new Float32Array(n);
    const sm = new Float32Array(n); for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let j = Math.max(0, i - 4); j <= i; j++) { a += rms[j]; c++; } sm[i] = a / c; }
    for (let i = 1; i < n; i++) rr[i] = Math.max(0, sm[i] - sm[i - 1]);
    for (let i = 0; i < n; i++) { mf += flux[i]; mr += rr[i]; }
    mf = mf / n || 1; mr = mr / n || 1;
    let m = 0; for (let i = 0; i < n; i++) { flux[i] = flux[i] / mf + rr[i] / mr; m += flux[i]; }
    m /= n; for (let i = 0; i < n; i++) flux[i] = Math.max(0, flux[i] - m);
  }
  // tempo: autocorrelation of onset flux over 70..180 BPM, octave-folded toward 90..160
  const lagMin = Math.round((60 / 180) * 100), lagMax = Math.round((60 / 70) * 100);
  let best = 0, bestLag = 50;
  for (let L = lagMin; L <= lagMax; L++) { let s = 0; for (let i = L; i < n; i++) s += flux[i] * flux[i - L]; if (s > best) { best = s; bestLag = L; } }
  let bpm = 6000 / bestLag;
  // refine with parabolic peak
  bpm = Math.round(bpm * 10) / 10;
  // phase: offset maximizing onset sum on the grid
  const period = 6000 / bpm; let bestP = 0, bestS = -1;
  for (let p = 0; p < period; p += 1) { let s = 0; for (let t = p; t < n; t += period) s += flux[Math.round(t)] ?? 0; if (s > bestS) { bestS = s; bestP = p; } }
  // energy 20 Hz
  const energy: number[] = [];
  for (let i = 0; i < n; i += 5) { let s = 0; for (let j = i; j < Math.min(n, i + 5); j++) s += rms[j]; energy.push(s / 5); }
  return { bpm, phase: bestP / 100, energy, energyHz: 20, duration: x.length / sr };
}
/** novelty-based sections on 8-bar blocks: label by relative loudness (quiet=verse, loud=chorus). */
export function autoSections(an: { bpm: number; phase: number; energy: number[]; duration: number }) {
  const bar = (60 / an.bpm) * 4, block = bar * 8;
  const out: { label: string; type: string; start: number; end: number }[] = [];
  const mean = (a: number, b: number) => { const s = an.energy.slice(Math.floor(a * 20), Math.floor(b * 20)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0; };
  const all = mean(0, an.duration) || 1e-6;
  let t = 0, k = 0;
  while (t < an.duration - 1) {
    const e = Math.min(an.duration, t + block), r = mean(t, e) / all;
    const type = k === 0 && r < 0.9 ? "intro" : e >= an.duration - 0.5 && r < 0.9 ? "outro" : r > 1.12 ? "chorus" : r > 0.97 ? "pre_chorus" : "verse";
    out.push({ label: `${{ intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", outro: "アウトロ" }[type]}${k + 1}`, type, start: +t.toFixed(3), end: +e.toFixed(3) });
    t = e; k++;
  }
  // merge neighbours of same type
  return out.reduce((acc, s) => { const L = acc[acc.length - 1]; if (L && L.type === s.type) L.end = s.end; else acc.push(s); return acc; }, [] as typeof out);
}

/** edge-density centroid as a cheap saliency focus point (0..1, 0..1) for smart crop. */
export function focusPoint(file: string): [number, number] {
  try {
    // grey 64x36 raw frame (works on minimal ffmpeg too); Sobel magnitude computed here
    const r = ff(["-i", file, "-frames:v", "1", "-vf", "scale=64:36,format=gray", "-f", "image2pipe", "-c:v", "rawvideo", "-"]);
    const g = r.stdout as Buffer, at = (x: number, y: number) => g[Math.min(35, Math.max(0, y)) * 64 + Math.min(63, Math.max(0, x))] ?? 0;
    let sx = 0, sy = 0, s = 0;
    for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const v = Math.min(255, Math.hypot(gx, gy) / 4); const w = v * v; sx += w * x; sy += w * y; s += w;
    }
    if (!s) return [0.5, 0.5];
    // pull toward centre (saliency is noisy)
    return [+(0.5 + ((sx / s / 63) - 0.5) * 0.7).toFixed(3), +(0.5 + ((sy / s / 35) - 0.5) * 0.7).toFixed(3)];
  } catch { return [0.5, 0.5]; }
}

/** scene detection + motion score per scene for video clips. */
export function detectScenes(file: string, thr = 0.3): { start: number; end: number; score: number }[] {
  const dur = durationOf(file);
  const r = ffTry(["-i", file, "-vf", `scale=160:-2,select='gt(scene,0)',metadata=print:file=-`, "-an", "-f", "null", "-"]);
  if (r.status !== 0) { // minimal ffmpeg has no select/metadata filters: even ~3s segments instead
    const n = Math.max(1, Math.round(dur / 3)); return Array.from({ length: n }, (_, i) => ({ start: (i * dur) / n, end: ((i + 1) * dur) / n, score: 0.5 }));
  }
  const txt = String(r.stdout) + String(r.stderr);
  const pts: { t: number; s: number }[] = [];
  let cur = -1;
  for (const line of txt.split("\n")) {
    const m = line.match(/pts_time:([\d.]+)/); if (m) cur = +m[1];
    const s = line.match(/lavfi\.scene_score=([\d.]+)/); if (s && cur >= 0) pts.push({ t: cur, s: +s[1] });
  }
  const cuts = [0, ...pts.filter((p) => p.s > thr).map((p) => p.t), dur].filter((v, i, a) => i === 0 || v - a[i - 1] > 0.4);
  const scenes: { start: number; end: number; score: number }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const inside = pts.filter((p) => p.t > a && p.t < b && p.s <= thr);
    const motion = inside.length ? inside.reduce((x, p) => x + p.s, 0) / inside.length : 0;
    scenes.push({ start: +a.toFixed(3), end: +b.toFixed(3), score: +Math.min(1, motion * 8 + Math.min(1, (b - a) / 6) * 0.3).toFixed(3) });
  }
  return scenes.length ? scenes : [{ start: 0, end: dur, score: 0.5 }];
}

export function parseArgs(argv: string[]) {
  const o: Record<string, string | boolean> = {}; const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); if (v !== undefined) o[k] = v; else if (argv[i + 1] && !argv[i + 1].startsWith("--")) o[k] = argv[++i]; else o[k] = true; }
    else rest.push(a);
  }
  return { o, rest };
}
export function npx(args: string[], opts: { quiet?: boolean } = {}) {
  const r = run("npx", args, { cwd: REMOTION_DIR, stdio: opts.quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0) throw new UserError(`レンダリングに失敗しました（npx ${args.slice(0, 3).join(" ")} …）。${opts.quiet ? String(r.stderr).slice(-600) : ""}`, "npm run setup で環境チェック → それでもダメならエラー全文を Codex に貼ってください。");
  return r;
}
export function safeName(s: string) { return s.replace(/[\\/:*?"<>|]/g, "_").trim() || "song"; }
export { fs, path, execFileSync };

/** natural pixel size of an image (ffprobe). */
export function imageSize(file: string): [number, number] | undefined {
  try { const st = probe(file).streams?.find((x: any) => x.width); return st ? [st.width, st.height] : undefined; } catch { return undefined; }
}
