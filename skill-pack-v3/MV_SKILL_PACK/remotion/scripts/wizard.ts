// npm run start : やさしい対話ウィザード（3択モード）。答えると mv.config.json を作って npm run mv を実行。
import readline from "node:readline/promises";
import { INPUT_DIR, PACK_DIR, detectInput, fail, fs, log, path } from "./common";
import { PRESETS, PRESET_IDS } from "../src/lib/presets";
import { ASPECTS } from "../src/lib/config";
import { applyInstruction } from "../src/lib/nl";
import { run } from "./mv";
import { VARIETY_OPTIONS, lyricOptions, structureOptions, type Option } from "../src/lib/options";

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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
  log("\nQ1. どう作りますか？\n  1) おまかせ（全部自動・おすすめ）\n  2) ジャンルを選ぶ\n  3) こだわり（細かく指定）");
  const mode = await q("  番号 [1]: ", "1");
  const args: string[] = ["--input", input];
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
    const gOf: Record<string, string> = { story: "ballad", dance: "idol_pop", live: "rock_edm", vocaloid: "dark", firsttake: "acoustic", lipsync: "idol_pop" };
    const pre = args[args.indexOf("--preset") + 1]; const genre = args.includes("--preset") ? gOf[pre] ?? null : null;
    const pickOpt = async (title: string, opts: Option[]) => {
      log(`\n${title}（プロのおすすめ順）`); opts.forEach((o, i) => log(`  ${i + 1}) ${o.label} … ${o.why}`)); log(`  ${opts.length + 1}) おまかせ`);
      const k = Number(await q("  番号 [1]: ", "1")); const o = opts[k - 1]; if (o?.say) extra.push(o.say);
    };
    await pickOpt("Q3a. MVの構成は？", structureOptions(genre, det.images.length ? 0.5 : 0));
    await pickOpt("Q3b. 歌詞の動きの変化は？", VARIETY_OPTIONS);
    await pickOpt("Q3c. サビの文字の動きは？", lyricOptions(genre, "chorus"));
    log("\nQ4. 演出の希望を日本語でどうぞ（例: サビはグリッチで。画は0.1秒前から切り替え。キライは割れるように）");
    const say = await q("  希望 [なし]: ");
    const all = [...extra, say].filter(Boolean).join("。");
    if (all) { const r = applyInstruction({}, all); r.changes.forEach((c) => log(`   ✏️ ${c}`)); args.push("--say", all); }
    const rng = await q("Q5. 曲の一部だけ作りますか？ 例 40-60（秒）[全部]: ");
    if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(rng)) args.push("--range", rng);
    if ((await q("Q6. DaVinci 用の透過歌詞と FCPXML も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--davinci");
    if ((await q("Q7. 縦型のサビハイライト（約20秒）も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--highlight");
  }
  rl.close();
  log("\n▶ まずプレビュー静止画を作ってから、本番を書き出します。\n");
  await run(args);
}
main().catch(fail);
