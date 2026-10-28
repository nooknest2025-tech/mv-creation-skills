// npm run start : やさしい対話ウィザード（start flow v2）。
//   Q1 何がありますか？（input フォルダから自動で選択済み）→ Q2 映像はどうする？（Q1 に合う選択肢だけ）
//   → Q3 ここから先は？（おまかせ / 半自動 / こだわり）→ 画面の形 → 確認画面 → Enter で開始。
// 1画面1問・Enter = おすすめ。答えから --say（自然文）と CLI フラグを作って npm run mv と同じ run() を呼ぶ。有料APIは呼ばない。
import readline from "node:readline/promises";
import YAML from "yaml";
import { INPUT_DIR, PACK_DIR, analyzeAudio, autoSections, detectInput, fail, fs, log, path } from "./common";
import { PRESETS } from "../src/lib/presets";
import { ASPECTS } from "../src/lib/config";
import { applyInstruction } from "../src/lib/nl";
import { run } from "./mv";
import { TACHIE_OPTION, VARIETY_OPTIONS, lyricOptions, structureOptions, type Option } from "../src/lib/options";
import { findCharacterMaterial } from "./tachie_project";
import { TACHIE_MATERIAL_HELP, parsePick, semiQuestions, semiToPlan, type SemiCtx } from "../src/lib/semi";
import { SHOW_MODES, composeCombo } from "../src/lib/mograph";
import { planStills } from "../src/lib/stills";
import { estimateCutsFor, videoCostHint } from "./wizard_lib";
import { Q1_OPTS, Q3_DEFAULT, Q3_OPTS, TEXT_STRUCTURES, allowedModes, allowedPresets, checkQ1, confirmLines, detectQ1, hasPictures, materialLine, q2Options, q2Plan, type Material, type Q1Key, type Q2Key, type Q3Key } from "../src/lib/startFlow";

const ASPECT_OPTS = [["16:9", "横長 16:9（YouTube）"], ["9:16", "縦長 9:16（ショート/TikTok/リール）"], ["1:1", "正方形 1:1"], ["4:5", "4:5（Instagram）"], ["all", "全部"]] as const;

async function main() {
  // Piped answers (Codex / tests: printf "\n\n\n" | npm run start): readline drops lines that arrive before
  // a question is asked, so read them all first and answer from the queue.
  const piped = !process.stdin.isTTY ? (await new Promise<string>((ok) => { let b = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (c) => (b += c)); process.stdin.on("end", () => ok(b)); })).split(/\r?\n/) : null;
  const rl = piped ? { question: async (s: string) => { process.stdout.write(s); const a = piped.shift() ?? ""; process.stdout.write(a + "\n"); return a; }, close: () => {} } : readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = async (s: string, def = "") => ((await rl.question(s)).trim().normalize("NFKC") || def);
  /** one numbered choice; Enter = the recommended (first unless rec given). */
  const choose = async <K extends string>(title: string, opts: { key: K; label: string; why: string }[], rec: K = opts[0].key, note?: string): Promise<K> => {
    log(`\n${title}`); if (note) log(`  ${note}`);
    opts.forEach((o, i) => log(`  ${i + 1}) ${o.label}${o.key === rec ? " ★おすすめ" : ""} … ${o.why}`));
    const ri = opts.findIndex((o) => o.key === rec) + 1;
    const n = Number(await q(`  番号 [Enter=${ri}]: `, String(ri)));
    return opts[n - 1]?.key ?? rec;
  };

  log("\n🎬 MVメーカーへようこそ！ 1問ずつ聞きます（Enter だけで「おすすめ」を選べます）");
  let input = process.env.MVPACK_INPUT ? path.resolve(process.env.MVPACK_INPUT) : INPUT_DIR;
  let det = fs.existsSync(input) ? detectInput(input) : null;
  if (!det?.audio) {
    log(`\n📂 input フォルダに曲が見つかりません: ${input}`);
    const a = await q("  サンプル素材で試してみますか？ [Y/n] ", "y");
    if (a.toLowerCase().startsWith("n")) { log(`\n👉 ${input} に曲（mp3/wav）・歌詞（JSON/SRT/LRC/txt。なくてもOK）・画像や動画（なくてもOK）を入れて、もう一度 start.bat を実行してください。`); rl.close(); return; }
    input = path.join(PACK_DIR, "input_sample"); det = detectInput(input);
  }
  const chars = findCharacterMaterial(input);
  const m: Material = { audio: !!det.audio, lyrics: !!det.lyrics, nImages: det.images.length, nVideos: det.videos.length, nChars: chars.length };
  log(`\n🔎 見つかった素材: ${materialLine(m)}`);
  log(`   曲: ${path.basename(det.audio!)}${det.lyrics ? ` / 歌詞: ${path.basename(det.lyrics)}` : ""}${chars.length ? ` / キャラ: ${chars.map((c) => c.name).join("・")}` : ""}`);

  // ---- Q1 ----
  const detected = detectQ1(m);
  const q1pick = await choose<Q1Key>("Q1. 何がありますか？（見つかった素材から選んであります）", Q1_OPTS, detected);
  const c1 = checkQ1(q1pick, m); if (c1.warn) log(`  ⚠️ ${c1.warn}`);
  const q1 = c1.q1;

  // song analysis (free, local) for cost / cut estimates
  let song: any = null;
  try { const an = analyzeAudio(det.audio!); song = { title: "", duration: an.duration, fps: 30, bpm: an.bpm, phase: an.phase, beatsPerBar: 4, sections: autoSections(an) as any, energy: an.energy, energyHz: 20, lines: [] }; } catch { /* estimates shown after the real analysis */ }
  let stillsCost = "", stillsCount = 0;
  if (song && (q1 === "song" || q1 === "images")) {
    try {
      const models = YAML.parse(fs.readFileSync(path.join(PACK_DIR, "gen", "models.yaml"), "utf8")).models;
      const p = planStills(song, { taste: "anime", models }); stillsCount = p.counts.total;
      const paid = p.costs.filter((c) => !c.free && c.usd != null).sort((a, b) => a.usd! - b.usd!)[0];
      stillsCost = `約${p.counts.total}枚。手作業なら0円${paid ? `／有料なら約$${paid.usd}` : ""}`;
    } catch { /* models.yaml missing: no estimate */ }
  }

  // ---- Q2 ----
  const q2opts = q2Options(q1, m, stillsCost);
  const q2: Q2Key = await choose("Q2. 映像はどうする？", q2opts, q2opts[0].key, q1 === "song" ? "画像がないので、まずは文字と図形で作る「文字PV」がおすすめです（0円）" : undefined);

  // ---- Q3 ----
  const q3: Q3Key = await choose("Q3. ここから先は？", Q3_OPTS, Q3_DEFAULT);

  const args: string[] = ["--input", input];
  const base = q2Plan(q2);
  // the visual choice narrows what the folder offers: text PV ignores pictures, 画像だけ ignores videos
  if (q2 === "textpv" || (q2 === "stills" && m.nImages)) args.push("--text-only");
  if (q2 === "images" && m.nVideos) args.push("--images-only");
  let say: string[] = [...base.say], why = base.why;
  const extra: string[] = [];
  const flowCtx = { q2, m };

  if (q3 === "semi") {
    let ctx: SemiCtx = { nImages: hasPictures(q2) ? m.nImages + m.nVideos : 0, hasChar: chars.length > 0, flow: flowCtx };
    if (song) { ctx = { ...ctx, bpm: song.bpm, duration: song.duration, cuts: estimateCutsFor(song, ctx.nImages ?? 0), videoCost: videoCostHint(song) }; log(`\n🎵 曲をざっと解析: BPM ${Math.round(song.bpm)}・${Math.round(song.duration)}秒（カット数・費用は目安）`); }
    const ans: Record<string, string[]> = {};
    for (const qq of semiQuestions(ctx)) {
      log(`\n■ ${qq.title}`);
      qq.options.forEach((o, i) => log(`  ${i + 1}) ${o.label}${qq.recommend.includes(o.key) ? " ★おすすめ" : ""} … ${o.why}`));
      const a = await q(`  番号 [Enter=おすすめ]: `);
      if (a.trim()) ans[qq.id] = parsePick(a, qq);
    }
    const plan = semiToPlan(ans, ctx);
    say = q2 === "stills" ? [...plan.say.filter((s) => !/^画像は/.test(s)), q2Plan(q2, (ans.taste ?? ["anime"])[0]).say[0]] : plan.say;
    if (!say.some((s) => /で$/.test(s) && /[＋]|モーション|タイポ|物語|立ち絵/.test(s)) && plan.combo.length) say.unshift(`${plan.combo.map((x) => SHOW_MODES[x].ja).join("＋")}で`);
    args.push(...plan.args);
    extra.push(...plan.plan); plan.warnings.forEach((w) => extra.push(`⚠️ ${w}`));
  }

  if (q3 === "kodawari") {
    const modes = allowedModes(q2, m);
    log(`\nK1. 見せ方（構成の土台。複数OK: 例 1,3 / Enter = おまかせ）`);
    modes.forEach((id, i) => log(`  ${i + 1}) ${SHOW_MODES[id].ja} … ${SHOW_MODES[id].desc}`));
    const a = await q("  番号 [おまかせ]: ");
    const ids = [...new Set(a.split(/[,+、\s]+/).map(Number).filter((n) => n >= 1 && n <= modes.length).map((n) => modes[n - 1]))];
    if (ids.length) { const c = composeCombo(ids); log(`  → ${c.hybrid.ja}（セクションごとの配分）`); c.notes.forEach((n) => log(`     ${n}`)); say = [...say.filter((s) => /^画像は/.test(s)), `${ids.map((x) => SHOW_MODES[x].ja).join("＋")}で`]; extra.push(`見せ方: ${ids.map((x) => SHOW_MODES[x].ja).join("＋")}`); }
    const genres = [{ key: "auto", label: "おまかせ（曲から自動）", why: "BPM・音の強さ・歌詞の密度から選ぶ" }, ...allowedPresets(q2).map((id) => ({ key: id, label: PRESETS[id].ja, why: PRESETS[id].desc }))];
    const g = await choose("K2. ジャンル（演出の型）は？", genres, "auto");
    if (g !== "auto") { args.push("--preset", g); extra.push(`ジャンル: ${PRESETS[g].ja}`); }
    const gOf: Record<string, string> = { story: "ballad", dance: "idol_pop", live: "rock_edm", vocaloid: "dark", firsttake: "acoustic", lipsync: "idol_pop" };
    const genre = g !== "auto" ? gOf[g] ?? null : null;
    const pickOpt = async (title: string, opts: { label: string; say?: string; why: string }[], def = 1) => {
      log(`\n${title}（プロのおすすめ順）`); opts.forEach((o, i) => log(`  ${i + 1}) ${o.label}${i + 1 === def ? " ★おすすめ" : ""} … ${o.why}`)); log(`  ${opts.length + 1}) おまかせ`);
      const k = Number(await q(`  番号 [Enter=${def}]: `, String(def))); const o = opts[k - 1]; if (o?.say) { say.push(o.say); extra.push(`${title.replace(/^K\d+\. /, "").replace(/（.*$/, "").replace(/は？$/, "")}: ${o.label}`); } return o;
    };
    if (!ids.length) {
      if (hasPictures(q2)) {
        const st = structureOptions(genre, 0.5) as Option[];
        const o = await pickOpt("K3. MVの構成は？", q2 === "tachie" ? [TACHIE_OPTION, ...st] : m.nChars ? [...st, TACHIE_OPTION] : st);
        if (o) say = say.filter((s) => s === o.say || !/(モーション|タイポ|物語|立ち絵).*で$/.test(s));
      } else {
        const o = await pickOpt("K3. MVの構成は？（画像なしで成立するものだけ）", TEXT_STRUCTURES);
        if (o) say = say.filter((s) => s === o.say || !/(モーション|タイポ|物語|立ち絵).*で$/.test(s));
      }
    }
    await pickOpt("K4. 歌詞の動きの変化は？", VARIETY_OPTIONS, 2);
    await pickOpt("K5. サビの文字の動きは？", lyricOptions(genre, "chorus"));
    log("\nK6. 演出の希望を日本語でどうぞ（例: サビはグリッチで。キライは割れるように）");
    const free = await q("  希望 [なし]: "); if (free) { say.push(free); extra.push(`希望: ${free}`); }
    if (q2 === "images" || q2 === "stills") { const tier = await q("K6b. AI動画のプランは？（例: KlingはProプラン / Klingの残り1200クレジット）[使わない・API従量]: "); if (tier) say.push(tier); }
    const rng = await q("K7. 曲の一部だけ作りますか？ 例 40-60（秒）[全部]: ");
    if (/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(rng)) { args.push("--range", rng); extra.push(`範囲: ${rng} 秒`); }
    if ((await q("K8. DaVinci 用の透過歌詞と FCPXML も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--davinci");
    if ((await q("K9. 縦型のサビハイライト（約20秒）も作りますか？ [y/N] ", "n")).toLowerCase().startsWith("y")) args.push("--highlight");
  }

  // ---- 画面の形 (all modes) ----
  log("\nQ4. 画面の形は？");
  ASPECT_OPTS.forEach(([, l], i) => log(`  ${i + 1}) ${l}${i === 0 ? " ★おすすめ" : ""}`));
  const a = Number(await q("  番号 [Enter=1]: ", "1")); const asp = ASPECT_OPTS[a - 1] ?? ASPECT_OPTS[0];
  if (asp[0] === "all") args.push("--aspects", Object.keys(ASPECTS).join(",")); else args.push("--aspect", asp[0]);

  // ---- 確認画面 ----
  const cost = q2 === "stills" ? `今回の書き出しは0円。画像は ${stillsCost || "作り方リストを見て"}（有料APIは金額を確認してからだけ。勝手には使いません）` : "0円（有料APIは使いません）";
  if (q2 === "stills" && !stillsCount) why += "（画像の枚数は書き出し後の作り方リストで確認）";
  log("");
  confirmLines(m, { q1, q2, q3 }, { why, cost, aspect: asp[1], extra }).forEach((l) => log(l));
  const allSay = [...new Set(say.filter(Boolean))].join("。");
  if (allSay) { const r = applyInstruction({}, allSay); r.changes.forEach((c) => log(`   ✏️ ${c}`)); args.push("--say", allSay); }
  if ((await q("\n  開始しますか？ [Enter=開始 / n=やめる] ", "y")).toLowerCase().startsWith("n")) { log("やめました。もう一度 start で選び直せます。"); rl.close(); return; }
  rl.close();
  if (process.env.MVPACK_WIZARD_DRYRUN) { log(`WIZARD_ARGS ${JSON.stringify(args)}`); return; }
  log("\n▶ まずプレビュー静止画を作ってから、本番を書き出します。\n");
  await run(args);
}
main().catch(fail);
