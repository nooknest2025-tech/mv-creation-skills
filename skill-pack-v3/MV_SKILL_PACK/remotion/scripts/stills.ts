// npm run gen -- stills            : 静止画の生成プラン（枚数・方法・合計金額）+ stills_prompts.csv
// npm run gen -- stills import [フォルダ] : できた画像を取り込む（シーン画像 → input/AI生成画像/、キャラ・背景 → 参照素材）
// npm run gen -- stills run --image grok-imagine-image --confirm 0.62 : 有料API（金額が一致したときだけ。XAI_API_KEY が必要）
import { INPUT_DIR, PACK_DIR, UserError, fs, log, path } from "./common";
import { loadConfig, readJson, writeJson } from "./project";
import { planStills, stillsMd, stillsCsv, needsStills, type StillsPlan } from "../src/lib/stills";
import { addAsset } from "./assets_lib";
import type { Song } from "../src/lib/types";
import YAML from "yaml";

export const AI_IMAGES_DIR = path.join(INPUT_DIR, "AI生成画像");
export const stillsInbox = (dir: string) => path.join(PACK_DIR, "gen", "stills", path.basename(dir));
const IMG = /\.(png|jpe?g|webp)$/i;
const models = () => YAML.parse(fs.readFileSync(path.join(PACK_DIR, "gen", "models.yaml"), "utf8")).models;

export function stillsPlanFor(dir: string, o: Record<string, any> = {}): StillsPlan {
  const song = readJson<Song>(path.join(dir, "song.json"), null as any), cfg: any = loadConfig(dir);
  if (!song) throw new UserError("曲の情報（song.json）がありません", "先に npm run mv -- --stills-only を1回実行してください。");
  const taste = String(o.taste ?? cfg.taste ?? "anime");
  return planStills(song, { taste, density: o.density ?? cfg.density, character: cfg.continuity?.character ?? cfg.subject, models: models() });
}
/** writes stills_plan.md / stills_prompts.csv / stills_tasks.json and returns the Japanese summary. */
export function writeStillsPlan(dir: string, o: Record<string, any> = {}) {
  const p = stillsPlanFor(dir, o), md = stillsMd(p, path.basename(dir));
  fs.writeFileSync(path.join(dir, "stills_plan.md"), md);
  fs.writeFileSync(path.join(dir, "stills_prompts.csv"), stillsCsv(p));
  writeJson(path.join(dir, "stills_tasks.json"), { howto: "Generate in order (character -> backgrounds -> scenes), attach refs, save into inbox with the given file name, then: npm run gen -- stills import", inbox: stillsInbox(dir), ...p });
  fs.mkdirSync(stillsInbox(dir), { recursive: true });
  return { plan: p, md };
}
export function stillsSummary(p: StillsPlan) {
  const c = p.counts, cheapest = p.costs.filter((x) => !x.free && x.usd != null).sort((a, b) => a.usd! - b.usd!)[0];
  return `🖼 静止画: ${c.total} 枚（キャラ ${c.character}・背景 ${c.background}・シーン ${c.scene}）／おすすめ: 無料（Grok アプリ / grok.com で手動）= 0円${cheapest ? `／有料APIなら最安 $${cheapest.usd}（${cheapest.label.replace(/^有料API: /, "")}）` : ""}`;
}

/** import generated images: scene_* -> input/AI生成画像 (used by npm run mv), character/bg -> project reference assets. */
export function importStills(dir: string, from?: string) {
  const src = path.resolve(from ?? stillsInbox(dir));
  if (!fs.existsSync(src)) throw new UserError(`画像のフォルダが見つかりません: ${src}`, "作った画像をこのフォルダに入れてから、もう一度 npm run gen -- stills import を実行してください。");
  const files = fs.readdirSync(src).filter((f) => IMG.test(f)).sort();
  if (!files.length) throw new UserError("取り込める画像（png/jpg/webp）がありません", `画像を ${src} に入れてください。`);
  fs.mkdirSync(AI_IMAGES_DIR, { recursive: true });
  const out = { character: 0, background: 0, scene: 0 };
  let n = fs.readdirSync(AI_IMAGES_DIR).filter((f) => IMG.test(f)).length;
  for (const f of files) {
    const p = path.join(src, f);
    if (/^(character|chara|キャラ)/i.test(f)) { addAsset(dir, p, "character_front", { note: "キャラクターシート（AI生成）", approved: true }); out.character++; continue; }
    if (/^(bg|background|背景)/i.test(f)) { addAsset(dir, p, "location", { note: `背景（${f}）`, approved: true }); out.background++; continue; }
    const m = f.match(/scene_?(\d+)/i), num = m ? Number(m[1]) : ++n;
    fs.copyFileSync(p, path.join(AI_IMAGES_DIR, `scene_${String(num).padStart(3, "0")}${path.extname(f).toLowerCase()}`)); out.scene++;
  }
  return { ...out, to: AI_IMAGES_DIR };
}

/** paid route: only xAI image models, only with XAI_API_KEY and an exact --confirm of the plan total. */
export async function runStills(dir: string, o: Record<string, any>) {
  const p = stillsPlanFor(dir, o), id = String(o.image ?? "grok-imagine-image"), c = p.costs.find((x) => x.id === id);
  if (!c || c.free) throw new UserError(`有料APIの方法「${id}」が見つかりません`, `npm run gen -- stills で表の「方法」を確認してください（無料なら手動生成）。`);
  if (c.usd == null) throw new UserError("この方法は料金が未確認のため実行できません", "gen/models.yaml に公式の料金を確認して書いてください。");
  if (o.confirm == null || Math.abs(Number(o.confirm) - c.usd) > 1e-6) throw new UserError(`実行には金額の確認が必要です（合計 $${c.usd}・${p.counts.total} 枚）`, `内容に納得したら: npm run gen -- stills run --image ${id} --confirm ${c.usd}`);
  if (!/^grok-imagine-image/.test(id)) throw new UserError("この方法の自動実行にはまだ対応していません", "stills_prompts.csv を使って手動で生成し、npm run gen -- stills import で取り込んでください。");
  const key = process.env.XAI_API_KEY; if (!key) throw new UserError("XAI_API_KEY が設定されていません", "xAI の API キーを環境変数 XAI_API_KEY に設定してください。");
  const inbox = stillsInbox(dir); fs.mkdirSync(inbox, { recursive: true });
  for (const t of p.tasks) {
    if (fs.existsSync(path.join(inbox, t.file))) continue;
    log(`🖼 ${t.title} …`);
    const r = await fetch("https://api.x.ai/v1/images/generations", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: id, prompt: t.prompt, n: 1, response_format: "b64_json" }) });
    if (!r.ok) throw new UserError(`画像の生成に失敗しました（${r.status}）`, "時間をおいて再実行すると、できた画像の続きから作ります。");
    const j: any = await r.json(); fs.writeFileSync(path.join(inbox, t.file), Buffer.from(j.data[0].b64_json, "base64"));
  }
  return importStills(dir);
}
export { needsStills };
