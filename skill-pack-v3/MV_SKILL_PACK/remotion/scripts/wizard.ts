// npm run start : やさしい対話ウィザード（おまかせ / 半自動 / ジャンル / こだわり）。答えると mv.config.json を作って npm run mv を実行。
import readline from "node:readline/promises";
import { INPUT_DIR, PACK_DIR, detectInput, fail, fs, log, path } from "./common";
import { PRESETS, PRESET_IDS } from "../src/lib/presets";
import { ASPECTS } from "../src/lib/config";
import { applyInstruction } from "../src/lib/nl";
import { run } from "./mv";
import { VARIETY_OPTIONS, lyricOptions, structureOptions, type Option } from "../src/lib/options";
import { MODE_IDS, SHOW_MODES, composeCombo } from "../src/lib/mograph";
import { parsePick, semiQuestions, semiToPlan, type SemiCtx } from "../src/lib/semi";
import { analyzeAudio, autoSections } from "./common";
import { estimateCutsFor, videoCostHint } from "./wizard_lib";

async function main() {
  // Piped answers (Codex / tests: printf "1\n\n" | npm run start): readline drops lines that arrive before
  // a question is asked, so read them all first and answer from the queue.
  const piped = !process.stdin.isTTY ? (await new Promise<string>((ok) => { let b = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (c) => (b += c)); process.stdin.on("end", () => ok(b)); })).split(/\r?\n/) : null;
  const rl = piped ? { question: async (s: string) => { process.stdout.write(s); const a = piped.shift() ?? ""; process.stdout.write(a + "\n"); return a; }, close: () => {} } : readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = async (s: string, def = "") => ((await rl.question(s)).trim() || def);
  log("\n🎬 MVメーカーへようこそ！ いくつか質問します（Enter だけで「おすすめ」を選べます）\n");
  let input = INPUT_DIR;
  let det = fs.existsSync(input) ? detectInput(input) : null;
  if (!det?.audio) {
    log(`📂 input フォルダに曲が見つかりません: ${input}`);
    const a = await q("  サンプル素材で試してみますか？ [Y/n] ", "y");
    if (a.toLowerCase().startsWith("n")) { log(`\n👉 ${input} に曲（mp3/wav）・歌詞（JSON/SRT/LRC/txt。なくてもOK）・画像や動画（なくてもOK）を入れて、もう一度 start.bat を実行してください。`); rl.close(); return; }
    input = path.join(PACK_DIR, "input_sample"); det = detectInput(input);
  }
  log(`\n✅ 曲: ${path.basename(det.audio!)} / 歌詞: ${det.lyrics ? path.basename(det.lyrics) : "なし（自動で書き起こし）"} / 画像 ${det.images.length} 枚 / 動画 ${det.videos.length} 本`);
  log("\nQ1. どう作りますか？\n  1) おまかせ（全部自動）\n  2) 半自動（おすすめ: 5〜6問だけ。Enter でプロのおすすめ）\n  3) ジャンルを選ぶ\n  4) こだわり（細かく指定）");
  const m0 = await q("  番号 [2]: ", "2");
  const mode = ({ "1": "1", "2": "semi", "3": "2", "4": "3" } as Record<string, string>)[m0] ?? "semi";
  const args: string[] = ["--input", input];
  // 見せ方 (multi-select, combinable) - asked in every mode; semi-auto asks it inside its own question list
  const pickModes = async (title: string): Promise<string[] | null> => {
    log(`\n${title}（複数OK: 例 3,5 = ダンス＋リリックモーション / Enter = おまかせ）`);
    MODE_IDS.forEach((id, i) => log(`  ${i + 1}) ${SHOW_MODES[id].ja} … ${SHOW_MODES[id].desc}`));
    const a = (await q("  番号 [おまかせ]: ")).normalize("NFKC");
    const ids = [...new Set(a.split(/[,+、\s]+/).map(Number).filter((n) => n >= 1 && n <= MODE_IDS.length).map((n) => MODE_IDS[n - 1]))];
    if (!ids.length) return null;
    const c = composeCombo(ids); log(`  → ${c.hybrid.ja}（セクションごとの配分）`); c.notes.forEach((n) => log(`     ${n}`));
    return ids;
  };
  const sayParts: string[] = [];
  if (mode === "1") { const m = await pickModes("Q1b. 見せ方を指定しますか？"); if (m) sayParts.push(`${m.map((x) => SHOW_MODES[x].ja).join("＋")}で`); }
  if (mode === "semi") {
    let ctx: SemiCtx = { nImages: det.images.length };
    try { const an = analyzeAudio(det.audio!); const secs = autoSections(an) as any; const song = { title: "", duration: an.duration, fps: 30, bpm: an.bpm, phase: an.phase, beatsPerBar: 4, sections: secs, energy: an.energy, energyHz: 20, lines: [] };
      ctx = { ...ctx, bpm: an.bpm, duration: an.duration, cuts: estimateCutsFor(song, det.images.length), videoCost: videoCostHint(song) }; log(`\n🎵 曲をざっと解析: BPM ${Math.round(an.bpm)}・${Math.round(an.duration)}秒（カット数・費用は目安）`); }
    catch { log("\n（曲の事前解析をスキップ。カット数・費用の目安は本番の解析後に表示します）"); }
    const ans: Record<string, string[]> = {};
    for (const qq of semiQuestions(ctx)) {
      log(`\n■ ${qq.title}`);
      qq.options.forEach((o, i) => log(`  ${i + 1}) ${o.label}${qq.recommend.includes(o.key) ? " ★おすすめ" : ""} … ${o.why}`));
      const a = await q(`  番号 [Enter=おすすめ]: `);
      if (a.trim()) ans[qq.id] = parsePick(a, qq);
    }
    const plan = semiToPlan(ans, ctx);
    log("\n📋 この内容で作ります:"); plan.plan.forEach((l) => log(`  ${l}`)); plan.warnings.forEach((w) => log(`  ⚠️ ${w}`));
    if ((await q("\n  この計画でよいですか？ [Y/n] ", "y")).toLowerCase().startsWith("n")) { log("やめました。もう一度 start で選び直せます。"); rl.close(); return; }
    sayParts.push(...plan.say);
  }
  if (mode === "2" || mode === "3") {
    log("\nQ2. ジャンルは？");
    PRESET_IDS.forEach((id, i) => log(`  ${i + 1}) ${PRESETS[id].ja} … ${PRESETS[id].desc}`));
    const g = Number(await q("  番号 [おまかせ]: ", "0"));
    if (g >= 1 && g <= PRESET_IDS.length) args.push("--preset", PRESET_IDS[g - 1]);
  }
  log("\nQ3. 画面の形は？\n  1) 横長 16:9（YouTube）  2) 縦長 9:16（ショート/TikTok/リール）  3) 正方形 1:1  4) 4:5（Instagram）  5) 全部");
  const a = await q("  番号 [1]: ", "1");
  const asp = ["16:9", "9:16", "1:1", "4:5"][Number(a) - 1];
  if (a === "5") args.push("--aspects", Object.keys(ASPECTS).join(","));
  else if (asp) args.push("--aspect", asp);
  const extra: string[] = [];
  if (mode === "3") {
    const m = await pickModes("Q3-0. 見せ方（構成の土台）"); if (m) extra.push(`${m.map((x) => SHOW_MODES[x].ja).join("＋")}で`);
    const gOf: Record<string, string> = { story: "ballad", dance: "idol_pop", live: "rock_edm", vocaloid: "dark", firsttake: "acoustic", lipsync: "idol_pop" };
    const pre = args[args.indexOf("--preset") + 1]; const genre = args.includes("--preset") ? gOf[pre] ?? null : null;
    const pickOpt = async (title: string, opts: Option[]) => {
      log(`\n${title}（プロのおすすめ順）`); opts.forEach((o, i) => log(`  ${i + 1}) ${o.label} … ${o.why}`)); log(`  ${opts.length + 1}) おまかせ`);
      const k = Number(await q("  番号 [1]: ", "1")); const o = opts[k - 1]; if (o?.say) extra.push(o.say);
    };
    if (!m) await pickOpt("Q3a. MVの構成は？", structureOptions(genre, det.images.length ? 0.5 : 0));
    await pickOpt("Q3b. 歌詞の動きの変化は？", VARIETY_OPTIONS);
    await pickOpt("Q3c. サビの文字の動きは？", lyricOptions(genre, "chorus"));
    log("\nQ4. 演出の希望を日本語でどうぞ（例: サビはグリッチで。画は0.1秒前から切り替え。キライは割れるように）");
    const say = await q("  希望 [なし]: ");
    const tier = await q("Q4b. AI動画のプランは？（例: KlingはProプラン / RunwayはAPI / Klingの残り1200クレジット）[API従量]: ");
    const all = [...extra, say, tier].filter(Boolean).join("。");
    if (all) { const r = applyInstruction({}, all); r.changes.forEach((c) => log(`   ✏️ ${c}`)); args.push("--say", all); }
    const rng = await q("Q5. 曲の一部だけ作りますか？ 例 40-60（秒）[全部]: ");
    if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(rng)) args.push("--range", rng);
    if ((await q("Q6. DaVinci 用の透過歌詞と FCPXML も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--davinci");
    if ((await q("Q7. 縦型のサビハイライト（約20秒）も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--highlight");
  }
  rl.close();
  if (sayParts.length) { const all = sayParts.join("。"); const r = applyInstruction({}, all); r.changes.forEach((c) => log(`   ✏️ ${c}`)); const i = args.indexOf("--say"); if (i >= 0) args[i + 1] = `${all}。${args[i + 1]}`; else args.push("--say", all); }
  log("\n▶ まずプレビュー静止画を作ってから、本番を書き出します。\n");
  await run(args);
}
main().catch(fail);
