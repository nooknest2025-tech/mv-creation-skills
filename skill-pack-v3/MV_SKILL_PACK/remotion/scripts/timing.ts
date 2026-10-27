// npm run timing [-- --project 曲名 --port 5177 --png]
// Local timing editor (waveform + beat grid + sections + lyric lines/words + cuts, playable audio, drag to adjust).
// Saves to mv.config.json -> timing (manual overrides, locked: re-analysis never overwrites them).
import http from "node:http";
import { PROJECTS_DIR, REMOTION_DIR, UserError, decodeMono, fail, fs, log, npx, parseArgs, path } from "./common";
import { loadConfig, readJson, saveConfig, writeJson } from "./project";
import { buildProps, applyTiming } from "../src/lib/pipeline";
import type { Song } from "../src/lib/types";

const { o } = parseArgs(process.argv.slice(2));
function latest() { return fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "song.json"))).sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0]; }

export function timingData(dir: string) {
  const song = readJson<Song | null>(path.join(dir, "song.json"), null);
  if (!song) throw new UserError("song.json がありません", "先に npm run mv（または npm run preview）を1回実行してください。");
  const cfg = loadConfig(dir), media = readJson(path.join(dir, "media.json"), []);
  const props = buildProps(song, cfg, media as any);
  const eff = applyTiming(song, cfg);
  const peaksFile = path.join(dir, "peaks.json");
  let peaks = readJson<number[] | null>(peaksFile, null);
  const audio = fs.readdirSync(path.join(REMOTION_DIR, "public", "project")).find((f) => f.startsWith("audio."));
  if (!peaks && audio) { const x = decodeMono(path.join(REMOTION_DIR, "public", "project", audio), 8000); peaks = []; const hop = 80; for (let i = 0; i < x.length; i += hop) { let m = 0; for (let j = i; j < Math.min(x.length, i + hop); j++) m = Math.max(m, Math.abs(x[j])); peaks.push(+m.toFixed(3)); } writeJson(peaksFile, peaks); }
  return { title: song.title, duration: song.duration, bpm: eff.bpm, phase: eff.phase, sections: eff.sections, lines: eff.lines.map((L) => ({ text: L.text, start: L.start, end: L.end, words: L.words.map((w) => ({ t: w.t, text: L.chars.slice(w.i0, w.i1).map((c) => c.ch).join("") })) })), shots: props.shots.map((s) => ({ id: s.id, start: s.start, end: s.end, section: s.section })), peaksHz: 100, peaks, timing: cfg.timing ?? {}, audio: audio ? `/audio/${audio}` : null };
}

/** merge an editor save into config.timing (and lock the edited fields). */
export function applySave(dir: string, body: any) {
  const cfg = loadConfig(dir), T = (cfg.timing ??= {});
  const locked = new Set(T.locked ?? []);
  if (body.bpm !== undefined) { T.bpm = +body.bpm; locked.add("bpm"); }
  if (body.beatShift !== undefined) { T.beatShift = +body.beatShift; locked.add("beatShift"); }
  if (body.cutLead !== undefined) T.cutLead = +body.cutLead;
  if (body.lyricIn !== undefined) T.lyricIn = +body.lyricIn;
  if (body.lyricOut !== undefined) T.lyricOut = +body.lyricOut;
  if (Array.isArray(body.sections)) { T.sections = body.sections; locked.add("sections"); }
  if (body.lines) { T.perLine = { ...(T.perLine ?? {}), ...body.lines }; locked.add("lines"); }
  T.locked = [...locked];
  saveConfig(dir, cfg);
  // Studio reads public/project/mv.config.json -> keep it in sync
  const pub = path.join(REMOTION_DIR, "public", "project", "mv.config.json");
  if (fs.existsSync(pub)) writeJson(pub, { ...readJson(pub, {}), timing: T });
  return T;
}

async function main() {
  const name = (o.project as string) ?? latest();
  if (!name) throw new UserError("プロジェクトがまだありません", "先に npm run mv を1回実行してください。");
  const dir = path.join(PROJECTS_DIR, name);
  if (o.png) {
    const d = timingData(dir);
    const pf = path.join(dir, "timeline_props.json");
    writeJson(pf, { data: { ...d, peaks: d.peaks?.filter((_, i) => i % 4 === 0), peaksHz: 25 } });
    const out = path.join(dir, "out", "timeline.png");
    npx(["remotion", "still", "Timeline", out, `--props=${pf}`, "--log=error"]);
    log(`🖼  タイムライン画像: ${out}`);
    return;
  }
  const port = Number(o.port ?? 5177);
  const html = fs.readFileSync(path.join(REMOTION_DIR, "scripts", "timing_editor.html"), "utf8");
  http.createServer((req, res) => {
    try {
      if (req.url === "/" || req.url?.startsWith("/?")) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
      if (req.url === "/data") { const body = JSON.stringify(timingData(dir)); res.writeHead(200, { "content-type": "application/json" }); res.end(body); return; }
      if (req.url?.startsWith("/audio/")) { const f = path.join(REMOTION_DIR, "public", "project", decodeURIComponent(req.url.slice(7))); res.writeHead(200, { "content-type": "audio/mpeg" }); fs.createReadStream(f).pipe(res); return; }
      if (req.url === "/save" && req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const T = applySave(dir, JSON.parse(b)); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, timing: T })); }); return; }
      res.writeHead(404); res.end();
    } catch (e) { res.writeHead(500); res.end(String((e as Error).message)); }
  }).listen(port, "127.0.0.1", () => log(`⏱  タイミングエディタ: http://127.0.0.1:${port}/ をブラウザで開いてください（${name}）。保存すると mv.config.json の timing に記録され、再解析しても消えません。Ctrl+C で終了。`));
}
import { restoreCut } from "../src/lib/lipsync";
// npm run timing -- restore S005 [S006 ...] | restore all  → 口パク/ダンスの尺調整を取り消して元のカットに戻す（ファイルは消さない）
export function restoreCmd(dir: string, args: string[]) {
  const ids = !args.length || args.includes("all") || args.includes("全部") ? "all" as const : args;
  const r = restoreCut(loadConfig(dir), ids); saveConfig(dir, r.cfg); return r.changes;
}
const argv = process.argv.slice(2);
if (process.argv[1]?.match(/timing\.ts$/)) {
  if (argv[0] === "restore") { try { const name = (o.project as string) ?? latest(); for (const c of restoreCmd(path.join(PROJECTS_DIR, name), argv.slice(1).filter((a) => !a.startsWith("--") && a !== name))) log("↩ " + c); } catch (e) { fail(e); } }
  else main().catch(fail);
}
