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
  return { title: song.title, duration: song.duration, bpm: eff.bpm, phase: eff.phase, sections: eff.sections, lines: eff.lines.map((L) => ({ section: eff.sections.find((x) => L.start >= x.start && L.start < x.end)?.label ?? null, text: L.text, start: L.start, end: L.end, words: L.words.map((w) => ({ t: w.t, text: L.chars.slice(w.i0, w.i1).map((c) => c.ch).join("") })) })), shots: props.shots.map((s) => ({ id: s.id, start: s.start, end: s.end, section: s.section, thumb: s.src && s.kind !== "video" ? `/pub/${s.src}` : null, offset: cfg.timing?.perShot?.[s.id]?.offset ?? 0 })), lineOffsets: Object.fromEntries(Object.entries(cfg.timing?.perLine ?? {}).filter(([, v]) => v?.offset).map(([k, v]) => [k, v.offset])), perSection: cfg.timing?.perSection ?? {}, cutShift: +(DEFAULT_CUT_LEAD - (cfg.timing?.cutLead ?? DEFAULT_CUT_LEAD)).toFixed(3), peaksHz: 100, peaks, timing: cfg.timing ?? {}, audio: audio ? `/audio/${audio}` : null };
}

export const DEFAULT_CUT_LEAD = 0.05; // pipeline default: cut ~1.5 frames before the beat
const MAX_OFF = 5;
/** 保存内容のチェック（おかしな値は日本語のエラーで止める）。 */
export function validateSave(body: any) {
  if (!body || typeof body !== "object") throw new UserError("保存データが空です", "ページを再読み込みしてください。");
  const num = (v: any, what: string, lim = MAX_OFF) => { if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > lim) throw new UserError(`${what} の値がおかしいです`, `-${lim}〜+${lim} 秒の数字にしてください。`); };
  if (body.bpm !== undefined && (typeof body.bpm !== "number" || !(body.bpm >= 40 && body.bpm <= 300))) throw new UserError("BPM の値がおかしいです", "40〜300 にしてください。");
  for (const k of ["beatShift", "cutLead", "cutShift", "lyricIn", "lyricOut"]) if (body[k] !== undefined) num(body[k], k);
  for (const [k, v] of Object.entries(body.lineOffsets ?? {})) { if (!/^\d+$/.test(k)) throw new UserError("歌詞の行番号がおかしいです", k); num(v, `${+k + 1}行目のずらし`); }
  for (const [k, v] of Object.entries(body.shotOffsets ?? {})) { if (!/^[\w-]{1,40}$/.test(k)) throw new UserError("シーンIDがおかしいです", k); num(v, `${k} の切替ずらし`); }
  for (const [k, v] of Object.entries<any>(body.sectionOffsets ?? {})) { if (k.length > 60 || !v || typeof v !== "object") throw new UserError("セクション指定がおかしいです", k); for (const f of ["cut", "lyric"]) if (v[f] !== undefined) num(v[f], `${k} の${f === "cut" ? "画の切替" : "歌詞"}`); }
}

/** merge an editor save into config.timing (and lock the edited fields). */
export function applySave(dir: string, body: any) {
  validateSave(body);
  const cfg = loadConfig(dir), T = (cfg.timing ??= {});
  const locked = new Set(T.locked ?? []);
  if (body.bpm !== undefined) { T.bpm = +body.bpm; locked.add("bpm"); }
  if (body.beatShift !== undefined) { T.beatShift = +body.beatShift; locked.add("beatShift"); }
  if (body.cutLead !== undefined) T.cutLead = +body.cutLead;
  if (body.cutShift !== undefined) T.cutLead = +(DEFAULT_CUT_LEAD - body.cutShift).toFixed(3); // 画面表示はマイナス=早く
  if (body.lyricIn !== undefined) T.lyricIn = +body.lyricIn;
  const setOff = (obj: Record<string, any>, k: string, v: number) => { const cur = { ...(obj[k] ?? {}) }; if (v) cur.offset = +v.toFixed(3); else delete cur.offset; if (Object.keys(cur).length) obj[k] = cur; else delete obj[k]; };
  if (body.lineOffsets) { T.perLine ??= {}; for (const [k, v] of Object.entries<number>(body.lineOffsets)) setOff(T.perLine, k, v); }
  if (body.shotOffsets) { T.perShot ??= {}; for (const [k, v] of Object.entries<number>(body.shotOffsets)) setOff(T.perShot, k, v); }
  if (body.sectionOffsets) { T.perSection ??= {}; for (const [k, v] of Object.entries<any>(body.sectionOffsets)) { const cur = { ...(T.perSection[k] ?? {}) }; if (v.cut !== undefined) { if (v.cut) cur.cutLead = +(-v.cut).toFixed(3); else delete cur.cutLead; } if (v.lyric !== undefined) { if (v.lyric) cur.lyricIn = +v.lyric.toFixed(3); else delete cur.lyricIn; } if (Object.keys(cur).length) T.perSection[k] = cur; else delete T.perSection[k]; } }
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
      if (req.url?.startsWith("/pub/")) { const root = path.join(REMOTION_DIR, "public"); const f = path.resolve(root, decodeURIComponent(req.url.slice(5).split("?")[0])); if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } const ext = path.extname(f).toLowerCase(); res.writeHead(200, { "content-type": ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg", "cache-control": "max-age=300" }); fs.createReadStream(f).pipe(res); return; }
      if (req.url?.startsWith("/audio/")) { const f = path.join(REMOTION_DIR, "public", "project", decodeURIComponent(req.url.slice(7))); res.writeHead(200, { "content-type": "audio/mpeg" }); fs.createReadStream(f).pipe(res); return; }
      if (req.url === "/save" && req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { const T = applySave(dir, JSON.parse(b)); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, timing: T })); } catch (e) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: false, error: (e as Error).message + ((e as any).fix ? "：" + (e as any).fix : "") })); } }); return; }
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
