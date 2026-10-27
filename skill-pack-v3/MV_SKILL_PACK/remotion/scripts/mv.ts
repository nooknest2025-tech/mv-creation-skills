// ONE command: npm run mv [-- --song song.mp3 --lyrics lyrics.json --input ../input --preset auto --aspect 16:9 --yes]
// Detects inputs, fills gaps (analysis / Whisper / alignment / abstract visuals), shows a Japanese summary,
// renders preview stills, then the MP4 (+ Drive variant, DaVinci package, highlight) and a QA report.
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { parseLyricJson, parseLyricsFile, sectionTypeOf } from "../src/lib/song";
import { buildProps } from "../src/lib/pipeline";
import { styleSummary } from "../src/lib/resolve";
import { thumbnailTimes } from "../src/lib/cuts";
import { applyInstruction } from "../src/lib/nl";
import { ASPECTS, type Aspect, type MVConfig } from "../src/lib/config";
import { PRESETS } from "../src/lib/presets";
import type { Song } from "../src/lib/types";
import { GENRES } from "../src/lib/genres";
import { FONT_REG } from "../src/lib/fonts";
import { fetchMissing, syncRegistry } from "./fonts";
import { imageSize, INPUT_DIR, PACK_DIR, PUBLIC_PROJECT, REMOTION_DIR, UserError, analyzeAudio, autoSections, detectInput, detectScenes, durationOf, fail, focusPoint, fs, log, npx, parseArgs, path, safeName } from "./common";
import { addVersion, loadConfig, loadManifest, nextVersion, projectDir, publish, readJson, saveConfig, writeJson } from "./project";
import { driveVariant, finalMux, qaChecks, qaMarkdown, writeFcpxml, MANUAL_QA } from "./exporters";

const KIND_JA: Record<string, string> = { json: "歌詞同期JSON（そのまま使用）", srt: "SRT字幕（そのまま使用）", lrc: "LRC（そのまま使用）", vtt: "VTT字幕（そのまま使用）", ass: "ASS字幕（そのまま使用）", txt: "歌詞テキスト（音声に自動で位置合わせ）" };

function parseAss(src: string) {
  const out: string[] = [];
  let i = 1;
  const ts = (s: string) => { const [h, m, x] = s.split(":"); const sec = +h * 3600 + +m * 60 + +x; const f = (v: number) => new Date(v * 1000).toISOString().slice(11, 23).replace(".", ","); return f(sec); };
  for (const l of src.split(/\r?\n/)) { const m = l.match(/^Dialogue:\s*[^,]*,([^,]+),([^,]+),(?:[^,]*,){6}(.*)$/); if (m) out.push(`${i++}\n${ts(m[1])} --> ${ts(m[2])}\n${m[3].replace(/\{[^}]*\}/g, "").replace(/\\N/g, " ")}\n`); }
  return out.join("\n");
}

function python() { for (const p of [process.env.MVPACK_PYTHON ?? "", "python3", "python", "py"].filter(Boolean)) { const r = spawnSync(p, ["--version"], { shell: false }); if (r.status === 0) return p; } return null; }

export async function buildSong(det: ReturnType<typeof detectInput>, dir: string, o: Record<string, any>): Promise<{ song: Song; notes: string[] }> {
  const notes: string[] = [];
  const audio = det.audio!;
  const cache = path.join(dir, "song.json");
  const prev = readJson<Song | null>(cache, null);
  let song: Song;
  const dur = durationOf(audio);
  const needAnalysis = det.lyricsKind !== "json";
  let an: ReturnType<typeof analyzeAudio> | null = null;
  if (det.lyricsKind === "json") song = parseLyricJson(JSON.parse(fs.readFileSync(det.lyrics!, "utf8").replace(/^\uFEFF/, "")), path.basename(audio).replace(/\.[^.]+$/, ""));
  else if (det.lyricsKind && det.lyricsKind !== "txt") {
    let src = fs.readFileSync(det.lyrics!, "utf8");
    if (det.lyricsKind === "ass") src = parseAss(src);
    if (det.lyricsKind === "vtt") src = src.replace(/(\d\d:\d\d)\.(\d\d\d)/g, "$1,$2").replace(/^(\d\d:\d\d,\d\d\d)/gm, "00:$1");
    song = parseLyricsFile(det.lyricsKind === "lrc" ? "x.lrc" : "x.srt", src, { duration: dur });
  } else {
    const py = python();
    if (!py) throw new UserError("歌詞の自動起こしには Python が必要です", "python.org から Python 3 を入れて `pip install faster-whisper`。または歌詞ファイル（SRT/LRC/JSON）を input に入れてください。");
    const outJson = path.join(dir, "lyrics_auto.json");
    if (!fs.existsSync(outJson) || o.reanalyze) {
      log(det.lyricsKind === "txt" ? "🎤 歌詞テキストを音声に位置合わせ中（faster-whisper・無料）…" : "🎤 歌詞を自動で書き起こし中（faster-whisper・無料）…");
      const vocals = det.stems.find((s) => /vocal|ボーカル/i.test(path.basename(s)) && !/inst|off/i.test(path.basename(s)));
      const args = [path.join(REMOTION_DIR, "scripts", "transcribe.py"), audio, "--out", outJson, "--model", String(o.whisper ?? "small"), ...(det.lyricsKind === "txt" ? ["--text", det.lyrics!] : []), ...(vocals ? ["--vocals", vocals] : [])];
      const r = spawnSync(py, args, { stdio: "inherit", shell: false });
      if (r.status !== 0) throw new UserError("歌詞の自動処理に失敗しました", "pip install faster-whisper を実行してから再試行。急ぐなら歌詞なし（--no-lyrics）でも作れます。");
    } else notes.push("歌詞の自動処理結果を再利用（やり直すなら --reanalyze）");
    song = parseLyricJson(JSON.parse(fs.readFileSync(outJson, "utf8")), path.basename(audio).replace(/\.[^.]+$/, ""));
  }
  song.duration = dur || song.duration;
  if (needAnalysis || !song.energy.length) {
    an = analyzeAudio(audio);
    song.bpm = an.bpm; song.phase = an.phase; song.energy = (() => { const e = an!.energy; const s = [...e].sort((a, b) => a - b); const hi = s[Math.floor(s.length * 0.98)] || 1; return e.map((v) => Math.min(1, v / hi)); })(); song.energyHz = 20;
    if (song.sections.length <= 1) song.sections = autoSections({ ...an, energy: song.energy }).map((s) => ({ ...s, type: sectionTypeOf(s.label, s.type) }));
    notes.push(`音声解析: BPM ${an.bpm} / セクション ${song.sections.length} 個（自動）`);
  }
  // manual locks survive re-analysis (timing edits live in mv.config.json -> never overwritten here)
  if (prev && prev.title === song.title) { /* nothing to merge: edits are in config.timing */ }
  writeJson(cache, song);
  return { song, notes };
}

async function ask(q: string, def = "y") {
  if (!process.stdin.isTTY) return def;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q)).trim();
  rl.close();
  return a || def;
}

export async function run(argv: string[]) {
  try { syncRegistry(); } catch { /* fonts.yaml missing: keep bundled list */ }
  const { o } = parseArgs(argv);
  let inputDir = path.resolve(String(o.input ?? INPUT_DIR));
  if (o.sample) inputDir = path.join(PACK_DIR, "input_sample");
  const det = detectInput(inputDir);
  if (o.song) det.audio = path.resolve(String(o.song));
  if (o.lyrics) { det.lyrics = path.resolve(String(o.lyrics)); const e = path.extname(det.lyrics).slice(1).toLowerCase(); det.lyricsKind = (e === "json" ? "json" : e) as any; }
  if (o["no-lyrics"]) { det.lyrics = undefined; det.lyricsKind = undefined; }
  if (!det.audio) throw new UserError(`曲ファイルが見つかりません（${inputDir}）`, "input フォルダに mp3 / wav / m4a を1つ入れてください。試すだけなら `npm run mv -- --sample`。");
  const title = String(o.title ?? path.basename(det.audio).replace(/\.[^.]+$/, ""));
  const dir = projectDir(title);
  let cfg: MVConfig = loadConfig(dir, det.config);
  for (const k of ["preset", "aspect"] as const) if (o[k]) (cfg as any)[k] = o[k];
  if (o.range) { const [a, b] = String(o.range).split("-").map(Number); cfg.range = { start: a, end: b }; }
  if (o.say) { const r = applyInstruction(cfg, String(o.say)); cfg = r.cfg; r.changes.forEach((c) => log(`  ✏️ ${c}`)); saveConfig(dir, cfg); }

  // ---- summary of what was detected / what will be generated ----
  log(`\n📂 入力: ${inputDir}`);
  log(`  🎵 曲: ${path.basename(det.audio)}${det.stems.length ? `（ほかに ${det.stems.length} 個の音源: ${det.stems.map((s) => path.basename(s)).join(", ")} → ボーカル音源は歌詞合わせに使用）` : ""}`);
  log(`  📝 歌詞: ${det.lyrics ? `${path.basename(det.lyrics)} … ${KIND_JA[det.lyricsKind!]}` : o["no-lyrics"] ? "なし（歌詞なしで作成）" : "なし → 🤖 音声から自動で書き起こします（faster-whisper・無料）"}`);
  log(`  🖼  画像: ${det.images.length} 枚　🎞  動画: ${det.videos.length} 本${!det.images.length && !det.videos.length ? " → 🤖 素材なし: 曲に反応する抽象映像を自動生成します" : ""}`);
  if (det.lyricsKind !== "json") log("  📈 BPM・セクション・音の強さ: 🤖 自動解析します");

  const { song, notes } = await buildSong(det, dir, o);
  if (o["no-lyrics"]) song.lines = [];
  notes.forEach((n) => log(`  ℹ️ ${n}`));

  // ---- media (copied into public/project, scenes + focus cached) ----
  const mediaCache = readJson<Record<string, any>>(path.join(dir, "media_cache.json"), {});
  const media = [] as any[];
  const pub: { from: string; name: string }[] = [{ from: det.audio, name: `audio${path.extname(det.audio).toLowerCase()}` }];
  [...det.images, ...det.videos].forEach((f, i) => {
    const kind = det.videos.includes(f) ? "video" : "image";
    const name = `media/${String(i).padStart(3, "0")}${path.extname(f).toLowerCase()}`;
    pub.push({ from: f, name });
    const key = `${f}:${fs.statSync(f).size}`;
    if (!mediaCache[key] || (kind === "image" && !mediaCache[key].size)) mediaCache[key] = kind === "video" ? { scenes: detectScenes(f), duration: durationOf(f) } : { focus: focusPoint(f), size: imageSize(f) };
    media.push({ src: `project/${name}`, kind, orig: path.basename(f), ...mediaCache[key] });
  });
  writeJson(path.join(dir, "media_cache.json"), mediaCache);
  // face rig for native 目パチ / 口パク (auto detect + manual picks from npm run faces)
  if (det.images.length && !o["no-faces"]) {
    const py = python(), fdir = path.join(PUBLIC_PROJECT, "faces");
    fs.rmSync(fdir, { recursive: true, force: true });
    const r = py ? spawnSync(py, [path.join(REMOTION_DIR, "scripts", "faces.py"), "--out", fdir, "--manual", path.join(dir, "faces_manual.json"), ...det.images], { encoding: "utf8", shell: false }) : null;
    const fj = path.join(fdir, "faces.json");
    if (r && r.status === 0 && fs.existsSync(fj)) {
      const faces = readJson<Record<string, any>>(fj, {});
      let n = 0;
      for (const m of media) { const fc = faces[m.orig]; if (fc?.eyes?.length) { m.face = fc; n++; } }
      log(`  🙂 目パチ・口パク: 顔あり ${n}/${det.images.length} 枚（直すなら npm run faces）`);
    } else log(`  ℹ️ 顔検出なし（${py ? (r?.stderr || "").split("\n").filter(Boolean).pop() ?? "" : "Python なし"}）→ 呼吸・髪揺れ・ノリだけ有効。目と口の位置は npm run faces で手動指定できます`);
  }
  // picture analysis for fit (text placement / colour contrast / art style / clip motion)
  { const py = python(), files = [...det.images, ...(det.videos ?? [])];
    if (py && files.length) {
      const vf = path.join(dir, "visfeat.json");
      const r = spawnSync(py, [path.join(REMOTION_DIR, "scripts", "visfeat.py"), "--out", vf, ...files], { encoding: "utf8", shell: false });
      if (r.status === 0 && fs.existsSync(vf)) { const V = readJson<Record<string, any>>(vf, {}); const byName = Object.fromEntries(Object.entries(V).map(([k, v]) => [path.basename(k), v]));
        let n = 0; for (const m of media) { const v = byName[m.orig]; if (v) { (m as any).vis = v; n++; } }
        const arts = [...new Set(Object.values(V).map((v: any) => v.art))];
        log(`  🔎 画像解析: ${n} 素材（画風: ${arts.join("/")}）→ 文字の位置と色を画に合わせます`); }
      else log(`  ℹ️ 画像解析をスキップ（${(r.stderr || "").split("\n").filter(Boolean).pop() ?? "Pillow/numpy が必要: pip install pillow numpy"}）→ 文字は既定の位置・色。npm run doctor で確認できます`);
    } }
  publish(pub);
  { // parts animation rig (npm run parts で作成): projects/<曲>/parts/<名前>/rig.json or input/parts/<名前>/rig.json
    const { loadRigForRender } = await import("./parts_lib");
    const rr = loadRigForRender(dir, inputDir, cfg, PUBLIC_PROJECT);
    if (rr) { cfg = { ...cfg, parts: { ...(cfg.parts ?? {}), rigData: rr.rig } }; log(`  🧩 パーツアニメ: ${rr.rig.name}（${rr.rig.parts.length} パーツ${rr.issues.length ? `・要確認 ${rr.issues.length} 件` : ""}）`); rr.issues.forEach((x) => log(`     ⚠️ ${x}`)); }
  }
  writeJson(path.join(PUBLIC_PROJECT, "song.json"), song);
  writeJson(path.join(PUBLIC_PROJECT, "mv.config.json"), { ...cfg, audioFile: `project/${pub[0].name}` });
  writeJson(path.join(PUBLIC_PROJECT, "media.json"), media);
  writeJson(path.join(dir, "media.json"), media);

  if (cfg.range?.start !== undefined && cfg.range.start >= song.duration - 0.5) throw new UserError(`範囲の開始 ${cfg.range.start}秒 が曲の長さ（${song.duration.toFixed(1)}秒）を超えています`, `--range 0-${Math.floor(song.duration)} のように曲の中に収まる範囲を指定してください`);
  const aspects: Aspect[] = (o.aspects ? String(o.aspects).split(",") : cfg.aspects ?? [cfg.aspect ?? "16:9"]) as Aspect[];
  const first = buildProps(song, cfg, media, { audio: `project/${pub[0].name}`, aspect: aspects[0] });
  { const { fontsOfLines } = await import("../src/render/fontsUsed"); await fetchMissing({ ids: fontsOfLines(first.lines) }); }
  // A per-project manifest lets the shared editor (npm run editor -- --project <name>) reopen the exact source files.
  if (det.images.length && !(det.videos ?? []).length) writeJson(path.join(dir, "out", "editor-input.json"), {
    title, audio: det.audio, lyrics: path.join(dir, "song.json"), images: det.images,
    scenes: first.shots.map((s, i) => ({ id: s.id, start: s.start, end: s.end,
      asset: Math.max(0, media.findIndex((m) => m.src === s.src)), transition: i ? Math.min(0.7, s.end - s.start) : 0,
      label: s.section ?? `シーン ${i + 1}` })),
    lyricStyles: first.lines.map((l) => ({ motion: l.style, params: l.params })),
    width: first.width, height: first.height, fps: first.fps,
  });
  if (first.genre) { const g = GENRES[first.genre]; log(`🎼 ジャンル: ${g.ja}（${first.genreWhy}）→ 書体 ${[g.fonts.base, g.fonts.chorus].map((i) => FONT_REG.find((f) => f.id === i)?.family ?? i).join(" / ")}　違えば「ジャンルはロックで」など`); }
  log(`\n🎬 演出: ${PRESETS[first.preset!].ja}（${first.presetWhy}）　画面: ${aspects.map((a) => ASPECTS[a]?.ja ?? a).join(" / ")}`);
  log(`🎞  構成: ${first.structureWhy}　変えるなら「ストーリー＋リップシンクで」「サビだけ歌うシーン」など`);
  for (const n of first.sectionNotes ?? []) log(`   ・${n}`);
  if ((first as any).mographNotes?.length) { log("🎨 プロ演出（図形・色・転換・拍アクセント）: 消すなら「モーショングラフィックスなし」、昔の見た目は「プロ演出オフ」"); for (const n of (first as any).mographNotes) log(`   ・${n}`); }
  if (first.review) { log(`\n${first.review.note}\n  （プロチェック ${first.review.score}/100）`); fs.writeFileSync(path.join(dir, "director_note.md"), `${first.review.note}\n\n## セクションごとの選択理由\n${(first.sectionNotes ?? []).map((n) => `- ${n}`).join("\n")}\n\n## 構成\n- ${first.structureWhy}\n`); }
  log(`  カット ${first.shots.length} 個 / 歌詞 ${first.lines.length} 行 / 文字スタイル: ${styleSummary(first.lines) || "（歌詞なし）"}`);
  const m = loadManifest(dir, title);
  const v = nextVersion(m);
  const base = `${safeName(title)}_v${v}`;
  const outDir = path.join(dir, "out");

  // ---- preview stills (hook / first chorus / verse / ending + thumbnails) ----
  const propsFile = (asp: string, extra: Record<string, unknown> = {}) => {
    const p = { ...buildProps(song, cfg, media, { audio: `project/${pub[0].name}`, aspect: asp }), ...extra };
    const f = path.join(dir, `props_${asp.replace(":", "x")}${extra.overlayOnly ? "_overlay" : ""}.json`);
    writeJson(f, p);
    return { f, p };
  };
  const { f: pf0, p: p0 } = propsFile(aspects[0]);
  if (!o["no-preview"]) {
    const ch = song.sections.find((s) => s.type === "chorus");
    const picks: [string, number][] = [["01_冒頭フック", 1.2], ["02_最初のサビ", (ch?.start ?? song.duration * 0.3) + 1], ["03_中盤", song.duration * 0.55], ["04_エンディング", Math.max(0, (cfg.range?.end ?? song.duration) - 1.5)]];
    thumbnailTimes(song, 3).forEach((t, i) => picks.push([`thumb_${i + 1}`, t]));
    log(`\n🖼  プレビュー静止画を作成中…`);
    for (const [name, t] of picks) {
      const fr = Math.max(0, Math.min(p0.durationInFrames - 1, Math.round((t - p0.startAt) * p0.fps)));
      npx(["remotion", "still", "MV", path.join(outDir, `preview_${name}.jpg`), `--props=${pf0}`, `--frame=${fr}`, "--log=error"], { quiet: true });
    }
    log(`  ✅ ${outDir}${path.sep}preview_*.jpg を確認してください`);
  }
  if (o["stills-only"]) return;
  if (!o.yes && (await ask("\n▶ この内容で本番の動画を書き出しますか？ [Y/n] ")).toLowerCase().startsWith("n")) { log("中止しました。mv.config.json を直すか、Codex に指示してからもう一度どうぞ。"); return; }

  const outputs: Record<string, string> = {};
  const qaAll: string[] = [];
  const startAt = cfg.range?.start ?? 0, endAt = Math.min(song.duration, cfg.range?.end ?? song.duration);
  for (const asp of aspects) {
    const tag = asp.replace(":", "x");
    const { f: pf, p } = propsFile(asp);
    if (!o["overlay-only"]) {
      const silent = path.join(outDir, `.${base}_${tag}_video.mp4`);
      log(`\n🎞  レンダリング中（${asp}, ${(p.durationInFrames / p.fps).toFixed(1)}秒）…`);
      npx(["remotion", "render", "MV", silent, `--props=${pf}`, "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--muted", "--log=error", ...(o.concurrency ? [`--concurrency=${o.concurrency}`] : [])]);
      const out = path.join(outDir, `${base}_${tag}.mp4`);
      const mux = finalMux(silent, det.audio, out, startAt || endAt < song.duration ? { start: startAt, dur: endAt - startAt } : {});
      fs.rmSync(silent, { force: true });
      outputs[`mp4_${tag}`] = path.relative(dir, out);
      let drive: string | undefined;
      if (!o["no-drive"]) { drive = path.join(outDir, `${base}_${tag}_drive.mp4`); const mb = driveVariant(out, drive, Number(o["drive-mb"] ?? 95)); outputs[`drive_${tag}`] = path.relative(dir, drive); log(`  ☁️ Drive用 ${mb.toFixed(1)}MB`); }
      const items = qaChecks({ out, audio: det.audio, expectDur: endAt - startAt, audioCopied: mux.audioCopied, partial: startAt > 0 || endAt < song.duration - 0.05, lines: p.lines, startAt, endAt, drive });
      qaAll.push(`### ${asp}\n` + items.map((i) => `- ${i.ok ? "✅" : "⚠️"} ${i.item} — ${i.detail}`).join("\n"));
      items.forEach((i) => log(`  ${i.ok ? "✅" : "⚠️"} ${i.item}`));
    }
    if (o["overlay-only"] || o.davinci) {
      const { f: pfo, p: po } = propsFile(asp, { overlayOnly: true });
      const ov = path.join(outDir, `${base}_${tag}_lyrics_overlay.mov`);
      log(`  🔤 透過歌詞オーバーレイ（ProRes 4444）を書き出し中…`);
      npx(["remotion", "render", "LyricOverlay", ov, `--props=${pfo}`, "--codec=prores", "--prores-profile=4444", "--pixel-format=yuva444p10le", "--image-format=png", "--muted", "--log=error"]);
      outputs[`overlay_${tag}`] = path.relative(dir, ov);
      if (o.davinci && outputs[`mp4_${tag}`]) {
        const x = path.join(outDir, `${base}_${tag}_davinci.fcpxml`);
        writeFcpxml(x, { title: `${title} v${v}`, fps: po.fps, width: po.width, height: po.height, duration: po.durationInFrames / po.fps, video: path.join(dir, outputs[`mp4_${tag}`]), overlay: ov, audio: det.audio });
        outputs[`fcpxml_${tag}`] = path.relative(dir, x);
        log(`  🎛  DaVinci: ${path.basename(x)}（ファイル > 読み込み > タイムライン で開く）`);
      }
    }
  }
  // highlight: first chorus, 9:16, ~20 s
  if ((o.highlight || cfg.highlight) && !o["overlay-only"]) {
    const ch = song.sections.find((s) => s.type === "chorus") ?? song.sections[0];
    const hcfg: MVConfig = { ...cfg, aspect: "9:16", range: { start: Math.max(0, ch.start - 0.5), end: Math.min(song.duration, ch.start + 19.5) } };
    const hp = buildProps(song, hcfg, media, { audio: `project/${pub[0].name}`, aspect: "9:16" });
    const hf = path.join(dir, "props_highlight.json"); writeJson(hf, hp);
    const silent = path.join(outDir, `.${base}_hl.mp4`), out = path.join(outDir, `${base}_9x16_highlight.mp4`);
    log("\n📱 9:16 サビハイライトを書き出し中…");
    npx(["remotion", "render", "MV", silent, `--props=${hf}`, "--codec=h264", "--crf=19", "--pixel-format=yuv420p", "--muted", "--log=error"]);
    finalMux(silent, det.audio, out, { start: hcfg.range!.start, dur: hcfg.range!.end! - hcfg.range!.start! });
    fs.rmSync(silent, { force: true });
    outputs.highlight = path.relative(dir, out);
  }
  const qa = qaMarkdown(`${title} v${v}`, [], MANUAL_QA).replace("## 自動チェック\n", `## 自動チェック\n${qaAll.join("\n\n")}\n`);
  fs.writeFileSync(path.join(outDir, `${base}_QA.md`), qa);
  outputs.qa = path.relative(dir, path.join(outDir, `${base}_QA.md`));
  addVersion(dir, m, { v, createdAt: new Date().toISOString(), note: String(o.note ?? o.say ?? ""), preset: first.preset!, aspect: aspects.join(","), outputs, configSnapshot: cfg });
  log(`\n🎉 完成！ v${v}\n${Object.values(outputs).map((x) => `  ・${path.join(dir, x)}`).join("\n")}\n`);
  log("次の一手: 気になる所を日本語で Codex に伝える（例「サビはグリッチで」）→ もう一度 npm run mv。良ければ npm run approve -- " + v);
  await offerEditor(dir, o);
}

/** after any menu (おまかせ/半自動/ジャンル/こだわり/mv): offer the shared editor on this project. */
export async function offerEditor(dir: string, o: Record<string, any>) {
  const name = path.basename(dir), can = fs.existsSync(path.join(dir, "out", "editor-input.json")) || fs.existsSync(path.join(dir, "out", "editor", "editor-state.json"));
  if (!can) { log("ℹ️ 動画素材を含むため、画面での手直し（編集画面）は静止画の曲のみ対応です。日本語の指示（npm run edit）で直せます。"); return; }
  log(`✏️ 画面で手直しするなら: npm run editor -- --project ${name}\n   （歌詞・シーン・カメラ・エフェクト・タイミング・顔の位置を1つの画面で。保存した内容は次の AI 修正でも引き継がれます）`);
  const tty = process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;
  if (o["no-editor"] || o.editor === false || (!tty && !o.editor)) return;
  let yes = !!o.editor;
  if (!yes) { const rl = (await import("node:readline")).createInterface({ input: process.stdin, output: process.stdout });
    const a: string = await new Promise((r) => rl.question("いま編集画面を開きますか？ [Y/n] ", r)); rl.close(); yes = !/^(n|no|いいえ|いや)/i.test(a.trim()); }
  if (!yes) return;
  const { spawnSync } = await import("node:child_process");
  spawnSync(process.execPath, [path.join(REMOTION_DIR, "node_modules", "tsx", "dist", "cli.mjs"), path.join(REMOTION_DIR, "scripts", "editor.ts"), "--project", name], { stdio: "inherit", cwd: REMOTION_DIR, windowsHide: false });
}

if (process.argv[1]?.match(/mv\.ts$/)) run(process.argv.slice(2)).catch(fail);
