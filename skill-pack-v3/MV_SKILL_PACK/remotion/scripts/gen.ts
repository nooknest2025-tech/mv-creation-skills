// npm run models                 : list ALL models in gen/models.yaml (price, limits, verified date, source)
// npm run gen -- plan [--sections chorus,intro | --shots S001,S004] [--model id] [--res 720p] [--takes 2]
//                                : Japanese generation plan with recommended model per shot + cost estimate
// npm run gen -- run --confirm 1.23 [--cap 20]  : call the API (paid!) only when the confirmed total matches the plan
// npm run gallery                : local review gallery (play / compare takes / adopt / reject / notes / regenerate)
import http from "node:http";
import YAML from "yaml";
import { PACK_DIR, PROJECTS_DIR, PUBLIC_PROJECT, REMOTION_DIR, UserError, fail, fs, log, parseArgs, path } from "./common";
import { loadConfig, readJson, saveConfig, writeJson } from "./project";
import { buildProps } from "../src/lib/pipeline";
import { PRESETS } from "../src/lib/presets";
import type { Song, Shot } from "../src/lib/types";
import { buildSpecs, reviewShotList, proseOf } from "../src/lib/shotprompt";
import { adapt, recommendModel, priceAt } from "../src/lib/videoModels";
import { selectRefs, ROLE_JA } from "../src/lib/assets";
import { estimate as estimateCost, estimateMd, confirmRun, type PlansFile } from "../src/lib/estimate";
import { planCut, needsAudio } from "../src/lib/audiocut";
import { shortShotAdvice, autoMerge, type ShortAdvice } from "../src/lib/lipsync";
import { cutAudio, validateCut, probeDur } from "./audiotrim";
import { saveLib, loadLib, planImages, addAsset, setApproval, parseAssetCmd, ORDER_JA } from "./assets_lib";

const GEN_DIR = path.join(PACK_DIR, "gen");
export const resJa = (r: string) => (r === "720p" ? "標準(720p)" : r === "1080p" ? "高画質(1080p)" : r === "480p" ? "軽量(480p)" : r);
/** user-facing model name: brand + grade (no raw ids). */
export function modelJa(id: string) {
  const s = String(id).toLowerCase(), b = /grok|xai/.test(s) ? "Grok" : /kling/.test(s) ? "Kling" : /runway|gen4/.test(s) ? "Runway" : /hailuo|minimax/.test(s) ? "Hailuo" : /luma|ray/.test(s) ? "Luma" : /wan/.test(s) ? "Wan" : /veo/.test(s) ? "Veo" : /seedance/.test(s) ? "Seedance" : /pollo/.test(s) ? "Pollo" : /gemini/.test(s) ? "Gemini" : /flux/.test(s) ? "Flux" : /manual|local/.test(s) ? "手動・ローカル" : "その他のAI";
  return `${b}${/lite|fast|turbo|mini/.test(s) ? "（軽量版）" : /pro|master|2\.0|1\.5/.test(s) ? "（上位版）" : ""}`;
}
export interface Model { id: string; provider: string; kind: string; price_per_sec: Record<string, number> | null; input_extra?: string; max_res?: string | null; max_sec?: number | null; aspects?: string[] | null; strengths?: string; verified: boolean; verified_at?: string | null; source: string; deprecated?: boolean }
export const loadPlans = (): PlansFile => YAML.parse(fs.readFileSync(path.join(GEN_DIR, "plans.yaml"), "utf8"));
export const loadModels = (): Model[] => YAML.parse(fs.readFileSync(path.join(GEN_DIR, "models.yaml"), "utf8")).models;

const MOOD: Record<string, string> = { intro: "mysterious, quiet anticipation", verse: "intimate, everyday, calm", pre_chorus: "rising tension", chorus: "explosive, euphoric, vivid", bridge: "dreamlike, reflective", outro: "afterglow, fading", other: "atmospheric" };
const MOVE_EN: Record<string, string> = { kb_in: "slow push in", kb_out: "slow pull out", drift_l: "lateral dolly left", drift_r: "lateral dolly right", push: "fast push in", face_push: "close-up push in on the face", slow_push: "very slow push in, locked tripod", zoom_punch: "punch-in zoom on the beat", whip_l: "whip pan", whip_r: "whip pan", crane_up: "crane up", shake: "handheld energetic", parallax: "parallax dolly" };

/** recommend a model per shot type (only verified, non-deprecated, priced models). */
export function recommend(shot: Shot, preset: string, models: Model[], override?: string, provider?: string): { model: Model; why: string } {
  let ok = models.filter((m) => m.verified && !m.deprecated && m.price_per_sec && m.kind === "video" && !m.id.startsWith("manual/"));
  if (provider && !override) {
    const q = provider.toLowerCase(), mine = ok.filter((m) => m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
    if (!mine.length) throw new UserError(`「${provider}」の確認済みモデルが models.yaml にありません`, "gen/models.yaml に公式の価格つきで追加するか、prompts.csv / gen_tasks.json を使って MCP やアプリで手動生成してください。");
    const p = (m: Model) => Math.max(...Object.values(m.price_per_sec!));
    const sorted = [...mine].sort((a, b) => p(a) - p(b));
    const hero = preset === "lipsync" || shot.move === "face_push" || shot.sectionType === "chorus";
    return hero ? { model: sorted[sorted.length - 1], why: `${provider}: 見せ場 → この中で上位（高単価）` } : { model: sorted[0], why: `${provider}: つなぎ → この中で最安` };
  }
  const by = (id: string) => ok.find((m) => m.id === id);
  if (override) { const m = models.find((x) => x.id === override); if (!m) throw new UserError(`モデル ${override} は models.yaml にありません`, "npm run models で一覧を確認してください。"); return { model: m, why: "指定" }; }
  if (preset === "lipsync" || shot.move === "face_push") return { model: by("grok-imagine-video-1.5") ?? ok[0], why: "口元・顔のアップ → リップシンクと参照画像に強い上位モデル" };
  if (shot.sectionType === "chorus") return { model: by("grok-imagine-video-1.5") ?? ok[0], why: "サビの見せ場 → 品質優先" };
  return { model: by("grok-imagine-video-1.5-lite") ?? ok[0], why: "つなぎ・背景カット → 最安で量を確保" };
}
export function priceOf(m: Model, res: string): number | null {
  return priceAt(m, res);
}
export function estimate(sec: number, takes: number, price: number | null) { return price === null ? null : +(Math.ceil(sec) * takes * price).toFixed(3); }

export function latestProject() {
  if (!fs.existsSync(PROJECTS_DIR)) throw new UserError("まだ曲のプロジェクトがありません", "先に npm run mv -- --stills-only を1回実行してください（曲と歌詞を読み込んでプロジェクトを作ります。動画の書き出しはしないのですぐ終わります）。");
  const name = fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "song.json"))).sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
  if (!name) throw new UserError("プロジェクトがありません", "先に npm run mv（--stills-only でもOK）を1回実行してください。");
  return path.join(PROJECTS_DIR, name);
}

const TASTE_EN: Record<string, string> = { anime: "Japanese anime style, clean cel shading", photo: "photorealistic cinematic film still", illust: "soft painted illustration, watercolor texture", graphic: "flat vector graphic shapes, minimal", own: "" };
export const withTaste = (subject: string | undefined, taste?: string) => [subject, taste ? TASTE_EN[taste] : ""].filter(Boolean).join(", ") || undefined;
export function makePlan(dir: string, o: Record<string, any>) {
  const song = readJson<Song>(path.join(dir, "song.json"), null as any), cfg = loadConfig(dir);
  const props = buildProps(song, cfg, readJson(path.join(dir, "media.json"), []) as any);
  const models = loadModels(), res = String(o.res ?? cfg.gen?.resolution ?? "720p"), takes = Number(o.takes ?? cfg.gen?.takes ?? 1);
  let shots = props.shots.filter((s) => s.src !== "" || true);
  if (o.shots) { const ids = String(o.shots).split(","); shots = shots.filter((s) => ids.includes(s.id)); }
  else {
    const scope = cfg.gen?.scope;
    if (scope === "none" && !o.sections) log("ℹ️ 動画化は「静止画のみ」の設定です（mv.config.json gen.scope）。一部だけ試すなら --sections chorus を付けてください");
    const secs = o.sections ? String(o.sections).split(",") : scope === "chorus" ? ["chorus"] : scope === "none" ? ["__none__"] : null;
    if (scope === "all" && !o.sections) { /* every shot */ shots = shots.filter(() => true); }
    // default: one "hero" clip per section (first shot) - keeps cost small
    if (scope !== "all" || o.sections) shots = shots.filter((s, i, a) => (i === 0 || a[i - 1].section !== s.section) && (!secs || secs.includes(s.sectionType ?? "") || secs.includes(s.section ?? "")));
  }
  const preset = PRESETS[props.preset!];
  const aspect = props.width > props.height ? "16:9" : props.width === props.height ? "1:1" : "9:16";
  const lib = loadLib(dir), locked = new Set<string>(props.shots.filter((s) => s.locked).map((s) => s.id));
  const allSpecs = buildSpecs(props.shots, { subject: withTaste(cfg.subject, cfg.taste), continuity: cfg.continuity, bpm: song.bpm, textY: (props as any).textY });
  const SEC_JA: Record<string, string> = { intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", bridge: "Cメロ", outro: "アウトロ" };
  const names: Record<string, string> = Object.fromEntries(props.shots.map((s, i) => [s.id, `シーン${i + 1}（${SEC_JA[s.sectionType ?? ""] ?? s.section ?? ""} ${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")}〜）`]));
  const shotReview = reviewShotList(allSpecs, locked, names);
  const specOf = (id: string) => allSpecs.find((x) => x.shot === id)!;
  const legacy = !!(o.provider ?? cfg.gen?.provider);
  // short lip-sync/dance shots: warn when a model would stretch them by >1s; auto (unlocked) shots are merged with a same-singer neighbour
  const pickFor = (id: string) => { const sp = specOf(id); if (!sp) return null; const ov = o.model ?? cfg.gen?.perShot?.[id] ?? cfg.gen?.model; if (legacy) return recommend(props.shots.find((x) => x.id === id)!, preset.id, models, ov, o.provider ?? cfg.gen?.provider).model; return recommendModel(sp, models, { res, refs: selectRefs(lib, { shot: id, role: sp.role, size: sp.size, performance: sp.performance }), override: ov, verifiedOnly: true, budgetPerShot: cfg.gen?.budgetPerShot }).model; };
  const shortIn = props.shots.map((s) => ({ id: s.id, start: s.start, end: s.end, performance: specOf(s.id)?.performance, singer: specOf(s.id)?.continuity?.character ?? cfg.subject ?? "", locked: s.locked }));
  const shortAdv: ShortAdvice[] = shortShotAdvice(shortIn, pickFor, models).filter((a) => shots.some((s) => s.id === a.shot));
  let merged: string[] = [];
  if (cfg.gen?.autoMerge !== false && !o.noMerge) {
    const am = autoMerge(shortIn, shortAdv, cfg.gen?.keepCut ?? []);
    merged = am.merged;
    shots = shots.map((s) => { const m = am.shots.find((x) => x.id === s.id); return m ? { ...s, start: m.start, end: m.end } : s; });
    const gone = new Set(shortIn.map((x) => x.id).filter((id) => !am.shots.some((x) => x.id === id)));
    shots = shots.filter((s) => !gone.has(s.id));
  }
  const rows = shots.map((s) => {
    const sp = specOf(s.id);
    const refs = selectRefs(lib, { shot: s.id, role: sp.role, size: sp.size, performance: sp.performance });
    const ov = o.model ?? cfg.gen?.perShot?.[s.id] ?? cfg.gen?.model;
    let model: Model, why: string;
    if (legacy) ({ model, why } = recommend(s, preset.id, models, ov, o.provider ?? cfg.gen?.provider));
    else { const pk = recommendModel(sp, models, { res, refs, override: ov, verifiedOnly: true, budgetPerShot: cfg.gen?.budgetPerShot }); model = pk.model; why = pk.why.slice(0, 3).join("・"); }
    const req = adapt(sp, model, refs, { res, aspect });
    let audioCut: any = null;
    if (needsAudio(sp.performance)) {
      const c = planCut(s, model, song.duration, props.fps), songF = findSong(dir, o, cfg);
      audioCut = { ...c, file: null as string | null, error: null as string | null };
      if (!songF) audioCut.error = "元の曲ファイルが見つかりません（--song で指定）";
      else if (!o.dryAudio) { try { const f = cutAudio(songF, c, path.join(dir, "assets", "audio")); audioCut.file = path.relative(dir, f); upsertAudioAsset(dir, s.id, audioCut.file); } catch (e: any) { audioCut.error = e.message; } }
      req.seconds = c.dur; req.params.duration = c.dur;
      if (c.attach && audioCut.file) { req.params.audio_file = path.join(dir, audioCut.file); req.refs.audio = { id: `lipsync_audio_${s.id}`, role: "lipsync_audio", file: audioCut.file, shot: s.id }; }
    }
    const sec = req.seconds, price = priceOf(model, res);
    const ref = s.kind === "image" && s.src ? path.join(PUBLIC_PROJECT, "..", s.src) : null;
    return { audioCut, ref, aspect, shot: s.id, section: s.section, start: s.start, end: s.end, sec, model: model.id, why, res, takes, price_per_sec: price, cost: estimate(sec, takes, price), prompt: req.prompt, negative_prompt: req.negative_prompt, params: req.params, refs: { first: req.refs.first?.file, last: req.refs.last?.file, keyframes: req.refs.keyframes.map((a) => a.file), refs: req.refs.refs.map((a) => ({ file: a.file, role: a.role })), audio: req.refs.audio?.file, composite: req.refs.composite?.map((a) => a.file) }, dropped: req.refs.dropped.map((d) => `${ROLE_JA[d.a.role]}: ${d.why}`), warnings: [...req.warnings, ...req.refs.notes], spec: sp, verified: model.verified, source: model.source };
  });
  const imgT = readJson<any>(path.join(dir, "image_tasks.json"), null);
  const imageUSD = imgT?.total_usd ?? 0;
  const total = +(rows.reduce((a, r) => a + (r.cost ?? 0), 0) + (imageUSD ?? 0)).toFixed(3);
  const plan = { shortShots: shortAdv, merged, shotReview, createdAt: new Date().toISOString(), project: path.basename(dir), res, takes, total, unknownCost: rows.some((r) => r.cost === null) || !!(imgT && imgT.total_usd == null), imageUSD, imageTasks: imgT?.tasks?.length ?? 0, rows };
  const est = estimateFor(dir, rows, models);
  (est as any).shortShots = shortAdv; (est as any).merged = merged;
  (plan as any).estimate = est; plan.total = est.usdTotal; (plan as any).unknownCost = !est.complete;
  fs.mkdirSync(GEN_DIR, { recursive: true });
  writeJson(path.join(dir, "gen_plan.json"), plan);
  fs.writeFileSync(path.join(dir, "gen_estimate.md"), estimateMd(est));
  const md = [`# 生成プラン — ${plan.project}`, "", `画質 ${resJa(res)} / 1シーン ${takes} 回生成 / **動画の見積もり合計（確認済み）$${plan.total}**（うち参照画像 ${plan.imageTasks}枚 $${imageUSD ?? "未確認"}）${plan.unknownCost ? "（料金が未確認のAIを含むため一部不明）" : ""}`, "",
    ...(rows.length ? ["| シーン | 秒 | 動画AI | 理由 | 1秒あたり | 見積もり |", "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${names[r.shot] ?? r.shot} | ${r.sec} | ${modelJa(r.model)} | ${r.why} | ${r.price_per_sec == null ? "未確認" : "$" + r.price_per_sec} | ${r.cost === null ? "不明" : "$" + r.cost} |`)] : ["動画にするシーンはありません（静止画のみの設定）。静止画をAIで作る計画は stills_plan.md（npm run gen -- stills）を見てください。"]), "",
    `## 画づくりのチェック（スコア ${shotReview.score}）`, ...(shotReview.issues.length ? shotReview.issues.map((i) => `- ${i.fixed ? "🔧" : "💡"} ${i.msg}`) : ["- 問題なし"]), "",
    ...(shortAdv.length ? ["## ⚠ 短い口パク/ダンスショット（対応尺に1秒以上伸びる）", ...shortAdv.flatMap((a) => [`- ${a.msg}`, ...a.options.map((x) => `  - 案: ${x}`)]), ...(merged.length ? [`- 🔧 自動モードで結合: ${merged.join("、")}（あなたが指定したカットは変えていません）`] : []), ""] : []),
    "## 口パク・ダンスの音声（元の曲から切り出し）", ...(rows.filter((r: any) => r.audioCut).map((r: any) => `- **${names[r.shot] ?? r.shot}**: ${r.audioCut.start.toFixed(3)}s から ${r.audioCut.dur}s（${r.audioCut.adjustJa}）→ ${r.audioCut.file ?? "未作成: " + r.audioCut.error} / ${r.audioCut.note}`)), "",
    "## 参照素材の割り当て", ...rows.map((r: any) => `- **${names[r.shot] ?? r.shot}**: ${[r.refs.first && "開始画", r.refs.last && "終了画", r.refs.refs.length && `参照${r.refs.refs.length}枚`, r.refs.composite && "合成開始画（要作成）", r.refs.audio && "音声"].filter(Boolean).join(" / ") || "なし"}${r.dropped.length ? `（使えない素材: ${r.dropped.join("、")}）` : ""}${r.warnings.length ? ` ⚠ ${r.warnings.join("、")}` : ""}`), "",
    "## 無料の代わり", "- **静止画モード**（このまま npm run mv）: 画像だけで Ken Burns・疑似2.5D・光・粒子・拍揺れ。API 料金ゼロ。",
    "- **Grok アプリ / grok.com で手動生成**: 下の prompts.csv をコピペ → できた mp4 を `gen/takes/<シーン番号 例 S002>/` か `input/` に入れる → `npm run gallery` で採用。", "",
    "## プロンプト", ...rows.map((r) => `- **${names[r.shot] ?? r.shot}**（${r.sec}秒）: ${r.prompt}`), "",
    estimateMd(est), "",
    `価格の出典は gen/models.yaml の source（確認日つき）。価格は変わるので、実行前に公式ページを再確認してください。`].join("\n");
  fs.writeFileSync(path.join(dir, "gen_plan.md"), md);
  // provider-agnostic task list: any video MCP (Pollo / Grok / Runway / Kling ...) can execute it
  const tasks = { howto: "For each task call your video-generation MCP tool (text2video, or img2video when reference_image is set), wait for the result, then run: npm run gen -- import <file-or-url> --shot <shot> --from <provider>. Never exceed the user's confirmed budget.",
    tasks: rows.map((r: any) => ({ audio_file: r.audioCut?.attach && r.audioCut.file ? path.join(dir, r.audioCut.file) : null, post_sync_audio: r.audioCut?.file ? path.join(dir, r.audioCut.file) : null, negative_prompt: r.negative_prompt ?? null, params: r.params, refs: r.refs, shot: r.shot, seconds: r.sec, aspect: r.aspect, resolution: res, takes, prompt: r.prompt, reference_image: r.ref && fs.existsSync(r.ref) ? path.resolve(r.ref) : null, suggested_model: r.model, mcp_model: (models.find((m) => m.id === r.model) as any)?.mcp_model ?? null, estimated_usd: r.cost, save_to: path.join(GEN_DIR, "takes", r.shot) })) };
  writeJson(path.join(dir, "gen_tasks.json"), tasks);
  fs.writeFileSync(path.join(dir, "prompts.csv"), "\uFEFFshot,section,seconds,model,prompt\n" + rows.map((r) => [r.shot, r.section, r.sec, r.model, `"${r.prompt.replace(/"/g, '""')}"`].join(",")).join("\n"));
  return { plan, md };
}

// ---- reference assets: npm run gen -- assets [list|add <file> --role R [--shot S005]|approve <id>|plan|"キャラシート作って"] ----
export function assetsCmd(dir: string, args: string[], o: Record<string, any>) {
  const lib = loadLib(dir), sub = args[0] ?? "list";
  const jp = parseAssetCmd(args.join(" "));
  if (sub === "add" || jp?.kind === "replace") {
    const file = sub === "add" ? args[1] : String(o.file ?? "");
    if (!file || !fs.existsSync(file)) throw new UserError("画像ファイルを指定してください", jp?.kind === "replace" ? `例: npm run gen -- assets "${jp.shot}の開始画を差し替え" --file 新しい画像.png` : "例: npm run gen -- assets add face.png --role character_front");
    const a = addAsset(dir, file, (jp?.kind === "replace" ? jp.role : o.role) as any, { shot: jp?.kind === "replace" ? jp.shot : o.shot, note: o.note });
    log(`✅ ${ROLE_JA[a.role]}${a.shot ? "（" + a.shot + "）" : ""} を登録: ${a.file}`); return a;
  }
  if (sub === "approve" || jp?.kind === "approve") { const ids = jp?.kind === "approve" && jp.all ? lib.assets.filter((a) => a.approved === false).map((a) => a.id) : [args[1]]; ids.forEach((id) => setApproval(dir, id, true)); log(`✅ 承認: ${ids.join(", ")}`); return ids; }
  if (sub === "plan" || jp && ["make_sheet", "make_bg", "make_frames"].includes(jp.kind)) {
    const models = loadModels(), im = models.find((m: any) => m.id === (o.image ?? loadConfig(dir).gen?.imageModel ?? "grok-imagine-image"))!;
    const song = readJson<Song>(path.join(dir, "song.json"), null as any), cfg = loadConfig(dir);
    const props = buildProps(song, cfg, readJson(path.join(dir, "media.json"), []) as any);
    const specs = buildSpecs(props.shots, { subject: cfg.subject, continuity: cfg.continuity, bpm: song.bpm });
    const want = jp?.kind === "make_frames" && jp.shots ? jp.shots : null;
    const need = specs.filter((s) => (!want || want.includes(s.shot)) && (jp?.kind === "make_frames" || sub === "plan")).map((s) => ({ shot: s.shot, needsStart: true, needsEnd: !!s.matchCutTo }));
    let { tasks, total } = planImages(dir, lib, need, { model: im, character: cfg.continuity?.character ?? cfg.subject, wardrobe: cfg.continuity?.wardrobe, palette: "", specs: Object.fromEntries(specs.map((s) => [s.shot, proseOf(s)])), locations: cfg.continuity?.locations, props: cfg.continuity?.props });
    if (jp?.kind === "make_sheet") tasks = tasks.filter((t) => /character/.test(t.role));
    if (jp?.kind === "make_bg") tasks = tasks.filter((t) => /location|prop/.test(t.role));
    total = tasks.some((t) => t.usd == null) ? null : +tasks.reduce((a, t) => a + (t.usd ?? 0), 0).toFixed(3);
    writeJson(path.join(dir, "image_tasks.json"), { howto: "Generate each image with your image tool (Grok Imagine / Gemini / Flux / local SD / MCP), in order. Save into save_to, then: npm run gen -- assets add <file> --role <role> [--shot <shot>]. New images start unapproved: review in npm run gallery.", order: ORDER_JA, total_usd: total, tasks });
    log(`🖼 画像タスク ${tasks.length} 件（順番: ${ORDER_JA}）/ ${im.id} 見積もり ${total == null ? "価格未確認" : "$" + total}\n💾 ${path.join(dir, "image_tasks.json")}`); return { tasks, total };
  }
  for (const a of lib.assets) log(`${a.approved === false ? "⏳" : "✅"} ${a.id.padEnd(26)} ${ROLE_JA[a.role]}${a.shot ? " " + a.shot : ""}  ${a.file}`);
  if (!lib.assets.length) log("素材はまだありません。「キャラシート作って」→ npm run gen -- assets キャラシート作って");
  return lib;
}

export function findSong(dir: string, o: Record<string, any>, cfg: any): string | null {
  for (const c of [o.song, cfg.song, cfg.audio]) if (c && fs.existsSync(String(c))) return path.resolve(String(c));
  const pub = fs.existsSync(PUBLIC_PROJECT) ? fs.readdirSync(PUBLIC_PROJECT).find((f) => /\.(wav|mp3|m4a|flac|aac)$/i.test(f)) : null;
  return pub ? path.join(PUBLIC_PROJECT, pub) : null;
}
function upsertAudioAsset(dir: string, shot: string, file: string) {
  const lib = loadLib(dir); lib.assets = lib.assets.filter((a) => !(a.role === "lipsync_audio" && a.shot === shot));
  lib.assets.push({ id: `lipsync_audio_${shot}`, role: "lipsync_audio", file, shot, approved: true, generatedBy: "audiotrim", note: "元の曲から自動切り出し" });
  saveLib(dir, lib);
}
/** pre-generation: every cut audio must match its video length within 1 frame. */
export function validateAudio(dir: string, rows: any[], fps = 30): string[] {
  const errs: string[] = [];
  for (const r of rows) { const a = r.audioCut; if (!a) continue;
    if (!a.file) { errs.push(`${r.shot}: 音声がありません（${a.error ?? "未作成"}）`); continue; }
    const v = validateCut(path.join(dir, a.file), r.sec, fps); if (!v.ok) errs.push(`${r.shot}: ${v.msg}`); }
  return errs;
}

// ---- cost estimate (API + subscription credits + images) ----
export function estimateFor(dir: string, rows: any[], models = loadModels()) {
  const cfg = loadConfig(dir), imgT = readJson<any>(path.join(dir, "image_tasks.json"), null);
  const byModel: Record<string, number> = {}; for (const t of imgT?.tasks ?? []) byModel[t.model] = (byModel[t.model] ?? 0) + 1;
  const images = Object.entries(byModel).map(([id, n]) => ({ count: n, model: id, usd_each: (models.find((m: any) => m.id === id) as any)?.price_per_image ?? null }));
  return estimateCost(rows.map((r) => ({ shot: r.shot, model: r.model, seconds: r.sec, res: r.res, takes: r.takes, audio: !!cfg.gen?.audio, adjustJa: r.audioCut && r.audioCut.adjust !== "none" ? r.audioCut.adjustJa : undefined })), models, loadPlans(), cfg.gen?.plans ?? {}, images);
}

// ---- generated-clip QA (flicker / morph / face drift) -> marks takes "regen" in the gallery ----
export function clipQA(dir: string, o: Record<string, any>) {
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  const py = process.env.MVPACK_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
  const takes = path.join(GEN_DIR, "takes"); if (!fs.existsSync(takes)) { log("テイクがありません"); return []; }
  const face = loadLib(dir).assets.find((a) => a.role === "character_front" && a.approved !== false);
  const out: any[] = [];
  for (const s of fs.readdirSync(takes)) for (const f of fs.readdirSync(path.join(takes, s)).filter((x) => /\.(mp4|mov|webm)$/i.test(x))) {
    let r: any;
    try { r = JSON.parse(execFileSync(py, [path.join(REMOTION_DIR, "scripts", "clipqa.py"), path.join(takes, s, f), ...(face ? ["--ref", path.join(dir, face.file)] : []), "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))[0]; }
    catch (e: any) { if (e.stdout) r = JSON.parse(e.stdout)[0]; else { log(`⚠️ QA 実行失敗 ${s}/${f}: ${String(e.message).split("\n")[0]}（ffmpeg / numpy / pillow が必要）`); continue; } }
    out.push({ shot: s, file: f, ...r });
    log(`${r.regenerate ? "🔁" : "✅"} ${s}/${f} ${r.flags.map((x: any) => x.ja).join("・")}${r.notes.length ? "（" + r.notes.join("、") + "）" : ""}`);
    if (r.regenerate && !o.dry) reviewAction(dir, { shot: s, file: f, action: "regen" }), reviewAction(dir, { shot: s, file: f, action: "note", note: "自動QA: " + r.flags.map((x: any) => x.ja + " " + x.at_sec.join(",") + "秒").join(" / ") });
  }
  writeJson(path.join(dir, "clip_qa.json"), out); return out;
}

// ---- provider adapters (provider-agnostic; add more by implementing generate()) ----
export interface Adapter { id: RegExp; envKey: string; buildRequest(r: any, imageUrl?: string): { url: string; body: any }; }
export const ADAPTERS: Adapter[] = [{
  id: /^grok-imagine-video/, envKey: "XAI_API_KEY",
  buildRequest: (r, imageUrl) => ({ url: "https://api.x.ai/v1/videos/generations", body: { model: r.model, prompt: r.prompt, duration: r.sec, resolution: r.res, ...(imageUrl ? { image_url: imageUrl } : {}) } }),
}];

export async function runPlan(dir: string, o: Record<string, any>) {
  const plan = readJson<any>(path.join(dir, "gen_plan.json"), null);
  if (!plan) throw new UserError("生成プランがありません", "先に npm run gen -- plan を実行して、内容と金額を確認してください。");
  const cap = Number(o.cap ?? loadConfig(dir).gen?.capUSD ?? 20);
  const est = estimateFor(dir, plan.rows);
  log(estimateMd(est));
  const aerr = validateAudio(dir, plan.rows, readJson<any>(path.join(dir, "song.json"), {}).fps ?? 30);
  if (aerr.length) throw new UserError("口パク/ダンス用の音声と動画の長さが合いません", aerr.join("\n"));
  const interactive = !!process.stdin.isTTY && o.confirm == null && !o.yes;
  const ask = async (q: string) => { const rl = (await import("node:readline/promises")).default.createInterface({ input: process.stdin, output: process.stdout }); const a = await rl.question(q); rl.close(); return a; };
  const d = await confirmRun(est, { confirm: o.confirm, interactive, ask, cap });
  if (!d.go) { log("🛑 " + d.reason); return { ran: false, reason: d.reason }; }
  const pending = loadLib(dir).assets.filter((a) => a.approved === false);
  if (pending.length) throw new UserError(`未承認の参照素材が ${pending.length} 件あります`, "npm run gallery で確認して承認（または却下）してから動画を生成してください。");
  for (const r of plan.rows) {
    if (est.lines.find((l) => l.shot === r.shot)?.mode === "plan") { log(`📱 ${r.shot}: サブスクのクレジットで公式アプリ/Webから生成 → npm run gen -- import で取り込み`); continue; }
    const ad = ADAPTERS.find((a) => a.id.test(r.model));
    if (!ad) { log(`⏭ ${r.shot}: ${r.model} は自動実行に未対応 → prompts.csv で手動生成してください`); continue; }
    const key = process.env[ad.envKey];
    if (!key) throw new UserError(`${ad.envKey} が設定されていません`, `環境変数 ${ad.envKey} に API キーを設定（キーはファイルに書かない）。`);
    const { url, body } = ad.buildRequest(r);
    for (let k = 0; k < r.takes; k++) {
      log(`🎥 ${r.shot} take${k + 1}: ${r.model} ${r.sec}s …`);
      const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
      const id = res.request_id ?? res.id;
      let videoUrl: string | undefined;
      for (let i = 0; i < 120 && !videoUrl; i++) { await new Promise((z) => setTimeout(z, 5000)); const st = await fetch(`https://api.x.ai/v1/videos/${id}`, { headers: { authorization: `Bearer ${key}` } }).then((x) => x.json()); videoUrl = st.video?.url ?? st.url; if (st.status === "failed") break; }
      if (!videoUrl) { log(`  ⚠️ 失敗/タイムアウト（request ${id}）`); continue; }
      const out = path.join(GEN_DIR, "takes", r.shot, `take${Date.now()}.mp4`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(await (await fetch(videoUrl)).arrayBuffer()));
      log(`  ✅ ${out}`);
    }
  }
  log("👀 npm run gallery で確認・採用してください");
}

// ---- import clips made by ANY tool (MCP, web app, phone) into gen/takes/<shot>/ ----
export async function importTake(src: string, shot: string | undefined, from = "manual", note?: string): Promise<string[]> {
  const isUrl = /^https?:\/\//.test(src);
  const files = isUrl ? [src] : fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f)).map((f) => path.join(src, f)) : [src];
  const out: string[] = [];
  for (const f of files) {
    const id = shot ?? path.basename(f).match(/S\d{3}/i)?.[0]?.toUpperCase();
    if (!id) { log(`⏭ ${path.basename(f)}: ショットIDが分かりません（--shot S012 を付けるか、ファイル名に S012 を入れてください）`); continue; }
    const ext = (path.extname(isUrl ? new URL(f).pathname : f) || ".mp4").toLowerCase();
    const dst = path.join(GEN_DIR, "takes", id, `${from.replace(/[^\w-]/g, "_")}_${Date.now()}${ext}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (isUrl) { const r = await fetch(f); if (!r.ok) throw new UserError(`ダウンロード失敗 (${r.status})`, "URLの期限切れなら、MCPでもう一度結果を取得してください。"); fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer())); }
    else fs.copyFileSync(f, dst);
    const metaF = path.join(path.dirname(dst), "takes.json"), meta = readJson<Record<string, any>>(metaF, {});
    meta[path.basename(dst)] = { from, source: isUrl ? f : path.resolve(f), importedAt: new Date().toISOString(), note };
    writeJson(metaF, meta);
    log(`📥 ${id} ← ${path.basename(f)}（${from}）`); out.push(dst);
  }
  return out;
}

// ---- review gallery ----
export function galleryState(dir: string) {
  const takesDir = path.join(GEN_DIR, "takes"), review = readJson<Record<string, any>>(path.join(dir, "gen_review.json"), {});
  const shots = fs.existsSync(takesDir) ? fs.readdirSync(takesDir).filter((d) => fs.statSync(path.join(takesDir, d)).isDirectory()) : [];
  return { shots: shots.sort().map((s) => ({ shot: s, takes: fs.readdirSync(path.join(takesDir, s)).filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f)).map((f) => ({ file: f, from: readJson<any>(path.join(takesDir, s, "takes.json"), {})[f]?.from, ...(review[`${s}/${f}`] ?? {}) })) })), plan: readJson(path.join(dir, "gen_plan.json"), null) };
}
export function reviewAction(dir: string, a: { shot: string; file: string; action: "adopt" | "reject" | "regen" | "note"; note?: string }) {
  const f = path.join(dir, "gen_review.json"), review = readJson<Record<string, any>>(f, {});
  const k = `${a.shot}/${a.file}`;
  review[k] = { ...(review[k] ?? {}), ...(a.action === "note" ? { note: a.note } : { status: a.action }) };
  if (a.action === "adopt") {
    for (const kk of Object.keys(review)) if (kk.startsWith(a.shot + "/") && kk !== k && review[kk].status === "adopt") review[kk].status = "kept";
    // wire into the timeline: copy to public/project/gen and set timing.perShot[shot].src
    const dst = path.join(PUBLIC_PROJECT, "gen", a.shot, a.file);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(GEN_DIR, "takes", a.shot, a.file), dst);
    const cfg = loadConfig(dir); cfg.timing ??= {}; cfg.timing.perShot ??= {};
    const prev = { ...(cfg.timing.perShot[a.shot] ?? {}) }; delete prev.lipsync;
    cfg.timing.perShot[a.shot] = { ...prev, src: `project/gen/${a.shot}/${a.file}`, kind: "video", clipFrom: 0 };
    // lip-sync/dance: record the audio window + measured lengths so the render places the clip exactly and checks it (<=1 frame)
    const row = readJson<any>(path.join(dir, "gen_plan.json"), null)?.rows?.find((r: any) => r.shot === a.shot);
    if (row?.audioCut) { const ac = row.audioCut, wav = ac.file ? path.join(dir, ac.file) : null;
      const sec = (f: string | null) => { try { return f && fs.existsSync(f) ? probeDur(f) : null; } catch { return null; } };
      cfg.timing.perShot[a.shot].lipsync = { start: ac.start, dur: ac.dur, origStart: ac.origStart, origEnd: ac.origEnd, adjust: ac.adjust, at: new Date().toISOString(), wav: ac.file ?? null, wavSec: sec(wav), clipSec: sec(dst), attach: !!ac.attach }; }
    saveConfig(dir, cfg);
  }
  writeJson(f, review);
  return review[k];
}
const GALLERY_HTML = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>生成レビュー</title><style>body{background:#15131a;color:#eee;font-family:sans-serif;margin:16px}.shot{margin:18px 0;padding:12px;background:#221e2a;border-radius:10px}.takes{display:flex;gap:12px;flex-wrap:wrap}.take{background:#2c2735;padding:8px;border-radius:8px;width:340px}video{width:100%;border-radius:6px}button{margin:3px;border:0;border-radius:5px;padding:5px 9px;cursor:pointer}.adopt{background:#2a9d5a;color:#fff}.reject{background:#7a2a3a;color:#fff}.regen{background:#555;color:#fff}.st{font-weight:700}textarea{width:100%;background:#111;color:#fff}</style>
<h2>🎞 生成レビュー（ショットごと）</h2><p>採用 = タイムラインに自動で入ります（mv.config.json → timing.perShot）。新しいテイクは gen/takes/&lt;ショットID&gt;/ に置くと自動で表示（MCP・手動どちらでもOK）。</p><h2>💰 見積もり</h2><pre id=est style="white-space:pre-wrap;background:#111;padding:8px"></pre><button class=adopt id=go>この金額で生成する</button> <button class=reject id=cancel>キャンセル</button> <span id=gost></span><h2>🖼 参照素材（動画生成の前に承認）</h2><div id=assets></div><div id="list"></div>
<script>let EST=null;fetch('/estimate').then(r=>r.json()).then(e=>{EST=e;document.getElementById('est').textContent=e.md});document.getElementById('cancel').onclick=()=>{document.getElementById('gost').textContent='キャンセルしました（何もしていません）'};document.getElementById('go').onclick=()=>{if(!EST)return;if(!confirm('合計 $'+EST.usdTotal+' で生成します。よろしいですか？')){document.getElementById('gost').textContent='キャンセルしました';return}fetch('/run',{method:'POST',body:JSON.stringify({confirm:EST.usdTotal})}).then(r=>r.json()).then(r=>document.getElementById('gost').textContent=r.ran===false?'🛑 '+r.reason:'▶ 生成を開始しました')};async function la(){const d=await fetch('/assets').then(r=>r.json());const A=document.getElementById('assets');A.innerHTML=(d.assets||[]).map(a=>'<div class=take style="display:inline-block;width:220px"><img style="width:100%" src="/afile/'+a.id+'"><div>'+a.id+' '+(a.approved===false?'⏳未承認':'✅')+'</div><button class=adopt onclick="aact(\\''+a.id+'\\',1)">承認</button><button class=reject onclick="aact(\\''+a.id+'\\',0)">却下</button></div>').join('')||'<p>素材なし</p>'}function aact(id,ok){fetch('/aact',{method:'POST',body:JSON.stringify({id,ok})}).then(la)}la();async function load(){const d=await fetch('/state').then(r=>r.json());const L=document.getElementById('list');L.innerHTML='';
const plan={};(d.plan?.rows||[]).forEach(r=>plan[r.shot]=r);
if(!d.shots.length)L.innerHTML='<p>まだテイクがありません。</p>';
d.shots.forEach(s=>{const el=document.createElement('div');el.className='shot';const p=plan[s.shot];el.innerHTML='<h3>'+s.shot+(p?' — '+p.section+' / '+p.sec+'秒 / '+p.model:'')+'</h3>'+(p?'<small>'+p.prompt+'</small>':'')+'<div class=takes></div>';
s.takes.forEach(t=>{const c=document.createElement('div');c.className='take';c.innerHTML='<video controls loop muted src="/take/'+s.shot+'/'+t.file+'"></video><div>'+t.file+' <span class=st>'+({adopt:'✅採用',reject:'❌却下',regen:'🔁再生成希望',kept:'保留'}[t.status]||'')+'</span></div><button class=adopt>採用</button><button class=reject>却下</button><button class=regen>再生成</button><textarea placeholder="メモ">'+(t.note||'')+'</textarea>';
const act=(a,note)=>fetch('/act',{method:'POST',body:JSON.stringify({shot:s.shot,file:t.file,action:a,note})}).then(load);
c.querySelector('.adopt').onclick=()=>act('adopt');c.querySelector('.reject').onclick=()=>act('reject');c.querySelector('.regen').onclick=()=>act('regen');c.querySelector('textarea').onchange=e=>act('note',e.target.value);el.querySelector('.takes').appendChild(c)});L.appendChild(el)})}
load();setInterval(()=>{if(!document.querySelector('video:not([paused])'))load()},15000)</script></html>`;

async function main() {
  const { o, rest } = parseArgs(process.argv.slice(2));
  const cmd = rest[0] ?? (process.argv[1]?.includes("models") ? "models" : "plan");
  if (cmd === "models") {
    for (const m of loadModels()) log(`${m.deprecated ? "⛔" : m.verified ? "✅" : "❔"} ${m.id.padEnd(30)} ${m.provider.padEnd(22)} ${m.price_per_sec ? Object.entries(m.price_per_sec).map(([k, v]) => `${k}:$${v}/s`).join(" ") : "価格未確認"}  最大 ${m.max_res ?? "?"} ${m.max_sec ?? "?"}s  確認日 ${m.verified_at ?? "-"}\n    ${m.strengths ?? ""}  ${m.input_extra ?? ""}\n    出典: ${m.source}`);
    log("\n✅=公式で確認済み ❔=未確認（価格は推測しません） ⛔=提供終了。更新は gen/models.yaml を編集。");
    return;
  }
  const dir = o.project ? path.join(PROJECTS_DIR, String(o.project)) : latestProject();
  if (!fs.existsSync(path.join(dir, "song.json"))) throw new UserError(`プロジェクト「${path.basename(dir)}」がまだありません`, "先に npm run mv -- --stills-only を1回実行してください。");
  if (cmd === "stills") {
    const S = await import("./stills"), sub = rest[1] ?? "plan";
    if (sub === "import") { const r = S.importStills(dir, rest[2] ?? (o.from ? String(o.from) : undefined)); log(`✅ 取り込みました: シーン画像 ${r.scene} 枚（→ ${r.to}）／キャラクターシート ${r.character} 枚・背景 ${r.background} 枚（参照素材）\n▶ 次: npm run mv で画像を使ったMVを作ります`); return; }
    if (sub === "run") { const r = await S.runStills(dir, o); log(`✅ 生成して取り込みました: シーン画像 ${r.scene} 枚 → npm run mv`); return; }
    const { plan, md } = S.writeStillsPlan(dir, o); log(md); log(`\n${S.stillsSummary(plan)}\n💾 ${path.join(dir, "stills_plan.md")} / stills_prompts.csv\n📥 画像の置き場所: ${S.stillsInbox(dir)}`); return;
  }
  if (cmd === "plan") {
    const S = await import("./stills"), cfg0: any = loadConfig(dir), nImg = (readJson<any[]>(path.join(dir, "media.json"), []) ?? []).filter((m: any) => m.kind === "image").length;
    if (S.needsStills(cfg0.taste, nImg)) { const { plan } = S.writeStillsPlan(dir, o); log(`\n⚠️ 画像がまだありません（テイスト: ${({ anime: "アニメ", photo: "実写風", illust: "イラスト" } as any)[cfg0.taste]}）。先に静止画を作ります:\n${S.stillsSummary(plan)}\n   詳しい手順と画像リスト: ${path.join(dir, "stills_plan.md")}（npm run gen -- stills でも表示）\n`); }
    const { md } = makePlan(dir, o); log(md); log(`\n💾 ${path.join(dir, "gen_plan.md")} / prompts.csv\n▶ 実行するなら（有料）: npm run gen -- run --confirm <合計金額>`); return; }
  if (cmd === "run") return runPlan(dir, o);
  if (cmd === "assets") return assetsCmd(dir, rest.slice(1), o);
  if (cmd === "qa") return clipQA(dir, o);
  if (cmd === "estimate") { const p = readJson<any>(path.join(dir, "gen_plan.json"), null) ?? makePlan(dir, o).plan; const e = estimateFor(dir, p.rows); Object.assign(e, { shortShots: p.shortShots ?? [], merged: p.merged ?? [] }); log(estimateMd(e)); log(`\n▶ 実行: npm run gen -- run （確認あり）/ 非対話: --confirm ${e.usdTotal}`); return e; }
  if (cmd === "plan-tier") { const { applyInstruction } = await import("../src/lib/nl"); const r = applyInstruction(loadConfig(dir), rest.slice(1).join(" ")); saveConfig(dir, r.cfg); r.changes.forEach((c) => log("✏️ " + c)); if (!r.changes.length) log("プランを読み取れませんでした。例: KlingはProプラン / RunwayはAPI / Klingの残り1200クレジット"); return r; }
  if (cmd === "import") {
    if (!rest[1]) throw new UserError("取り込むファイル・フォルダ・URLを指定してください", "例: npm run gen -- import ~/Downloads/clip.mp4 --shot S012 --from pollo");
    const got = await importTake(rest[1], o.shot ? String(o.shot).toUpperCase() : undefined, String(o.from ?? "manual"), o.note ? String(o.note) : undefined);
    log(got.length ? `✅ ${got.length} 本取り込みました → npm run gallery で採用` : "取り込めたファイルはありません"); return;
  }
  if (cmd === "gallery") {
    const port = Number(o.port ?? 5180);
    http.createServer((req, res) => {
      try {
        if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(GALLERY_HTML); return; }
        if (req.url === "/state") { const b = JSON.stringify(galleryState(dir)); res.writeHead(200, { "content-type": "application/json" }); res.end(b); return; }
        if (req.url === "/estimate") { const p = readJson<any>(path.join(dir, "gen_plan.json"), null); const e = p ? estimateFor(dir, p.rows) : null; res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(e ? { ...e, md: estimateMd(e) } : { md: "生成プランがありません（npm run gen -- plan）" })); return; }
        if (req.url === "/run" && req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => { try { const r = await runPlan(dir, { confirm: JSON.parse(b).confirm, yes: true }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(r ?? { ran: true })); } catch (e: any) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ran: false, reason: e.message })); } }); return; }
        if (req.url === "/assets") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(loadLib(dir))); return; }
        if (req.url?.startsWith("/afile/")) { const a = loadLib(dir).assets.find((x) => x.id === decodeURIComponent(req.url!.slice(7))); if (!a) { res.writeHead(404); res.end(); return; } res.writeHead(200); fs.createReadStream(path.join(dir, a.file)).pipe(res); return; }
        if (req.url === "/aact" && req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const { id, ok } = JSON.parse(b); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(setApproval(dir, id, !!ok))); }); return; }
        if (req.url?.startsWith("/take/")) { const f = path.join(GEN_DIR, "takes", ...decodeURIComponent(req.url.slice(6)).split("/")); res.writeHead(200, { "content-type": "video/mp4" }); fs.createReadStream(f).pipe(res); return; }
        if (req.url === "/act" && req.method === "POST") { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { const r = reviewAction(dir, JSON.parse(b)); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(r)); }); return; }
        res.writeHead(404); res.end();
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    }).listen(port, "127.0.0.1", () => log(`🎞 レビューギャラリー: http://127.0.0.1:${port}/ （Ctrl+C で終了）`));
    return;
  }
  throw new UserError(`不明なコマンド: ${cmd}`, "plan / run / import / gallery / models のどれかです。");
}
if (process.argv[1]?.match(/gen\.ts$/)) main().catch(fail);
