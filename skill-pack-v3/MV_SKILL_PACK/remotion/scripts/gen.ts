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

const GEN_DIR = path.join(PACK_DIR, "gen");
export interface Model { id: string; provider: string; kind: string; price_per_sec: Record<string, number> | null; input_extra?: string; max_res?: string | null; max_sec?: number | null; aspects?: string[] | null; strengths?: string; verified: boolean; verified_at?: string | null; source: string; deprecated?: boolean }
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
  if (!m.price_per_sec) return null;
  return m.price_per_sec[res] ?? m.price_per_sec.any ?? null;
}
export function estimate(sec: number, takes: number, price: number | null) { return price === null ? null : +(Math.ceil(sec) * takes * price).toFixed(3); }

function latestProject() {
  const name = fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "song.json"))).sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
  if (!name) throw new UserError("プロジェクトがありません", "先に npm run mv（--stills-only でもOK）を1回実行してください。");
  return path.join(PROJECTS_DIR, name);
}

export function makePlan(dir: string, o: Record<string, any>) {
  const song = readJson<Song>(path.join(dir, "song.json"), null as any), cfg = loadConfig(dir);
  const props = buildProps(song, cfg, readJson(path.join(dir, "media.json"), []) as any);
  const models = loadModels(), res = String(o.res ?? cfg.gen?.resolution ?? "720p"), takes = Number(o.takes ?? cfg.gen?.takes ?? 1);
  let shots = props.shots.filter((s) => s.src !== "" || true);
  if (o.shots) { const ids = String(o.shots).split(","); shots = shots.filter((s) => ids.includes(s.id)); }
  else {
    const secs = o.sections ? String(o.sections).split(",") : null;
    // default: one "hero" clip per section (first shot) - keeps cost small
    shots = shots.filter((s, i, a) => (i === 0 || a[i - 1].section !== s.section) && (!secs || secs.includes(s.sectionType ?? "") || secs.includes(s.section ?? "")));
  }
  const preset = PRESETS[props.preset!];
  const rows = shots.map((s) => {
    const { model, why } = recommend(s, preset.id, models, o.model ?? cfg.gen?.perShot?.[s.id] ?? cfg.gen?.model, o.provider ?? cfg.gen?.provider);
    const sec = Math.min(model.max_sec ?? 15, Math.max((model as any).min_sec ?? 1, Math.ceil(s.end - s.start)));
    const price = priceOf(model, res);
    const prompt = preset.promptTemplate.replace("{subject}", cfg.subject ?? "the singer").replace("{section}", s.sectionType ?? "").replace("{mood}", MOOD[s.sectionType ?? "other"]).replace("{move}", MOVE_EN[s.move] ?? s.move) + `, ${props.width > props.height ? "16:9" : "9:16"}`;
    const ref = s.kind === "image" && s.src ? path.join(PUBLIC_PROJECT, "..", s.src) : null;
    return { ref, aspect: props.width > props.height ? "16:9" : props.width === props.height ? "1:1" : "9:16", shot: s.id, section: s.section, start: s.start, end: s.end, sec, model: model.id, why, res, takes, price_per_sec: price, cost: estimate(sec, takes, price), prompt, verified: model.verified, source: model.source };
  });
  const total = +rows.reduce((a, r) => a + (r.cost ?? 0), 0).toFixed(3);
  const plan = { createdAt: new Date().toISOString(), project: path.basename(dir), res, takes, total, unknownCost: rows.some((r) => r.cost === null), rows };
  fs.mkdirSync(GEN_DIR, { recursive: true });
  writeJson(path.join(dir, "gen_plan.json"), plan);
  const md = [`# 生成プラン — ${plan.project}`, "", `解像度 ${res} / 1カット ${takes} テイク / **見積もり合計 $${total}**${plan.unknownCost ? "（未確認価格のモデルを含むため一部不明）" : ""}`, "",
    "| ショット | セクション | 秒 | モデル | 理由 | $/秒 | 見積もり |", "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.shot} | ${r.section} | ${r.sec} | ${r.model} | ${r.why} | ${r.price_per_sec ?? "未確認"} | ${r.cost === null ? "不明" : "$" + r.cost} |`), "",
    "## 無料の代わり", "- **静止画モード**（このまま npm run mv）: 画像だけで Ken Burns・疑似2.5D・光・粒子・拍揺れ。API 料金ゼロ。",
    "- **Grok アプリ / grok.com で手動生成**: 下の prompts.csv をコピペ → できた mp4 を `gen/takes/<ショットID>/` か `input/` に入れる → `npm run gallery` で採用。", "",
    "## プロンプト", ...rows.map((r) => `- **${r.shot}** (${r.sec}s): ${r.prompt}`), "",
    `価格の出典は gen/models.yaml の source（確認日つき）。価格は変わるので、実行前に公式ページを再確認してください。`].join("\n");
  fs.writeFileSync(path.join(dir, "gen_plan.md"), md);
  // provider-agnostic task list: any video MCP (Pollo / Grok / Runway / Kling ...) can execute it
  const tasks = { howto: "For each task call your video-generation MCP tool (text2video, or img2video when reference_image is set), wait for the result, then run: npm run gen -- import <file-or-url> --shot <shot> --from <provider>. Never exceed the user's confirmed budget.",
    tasks: rows.map((r: any) => ({ shot: r.shot, seconds: r.sec, aspect: r.aspect, resolution: res, takes, prompt: r.prompt, reference_image: r.ref && fs.existsSync(r.ref) ? path.resolve(r.ref) : null, suggested_model: r.model, mcp_model: (models.find((m) => m.id === r.model) as any)?.mcp_model ?? null, estimated_usd: r.cost, save_to: path.join(GEN_DIR, "takes", r.shot) })) };
  writeJson(path.join(dir, "gen_tasks.json"), tasks);
  fs.writeFileSync(path.join(dir, "prompts.csv"), "\uFEFFshot,section,seconds,model,prompt\n" + rows.map((r) => [r.shot, r.section, r.sec, r.model, `"${r.prompt.replace(/"/g, '""')}"`].join(",")).join("\n"));
  return { plan, md };
}

// ---- provider adapters (provider-agnostic; add more by implementing generate()) ----
export interface Adapter { id: RegExp; envKey: string; buildRequest(r: any, imageUrl?: string): { url: string; body: any }; }
export const ADAPTERS: Adapter[] = [{
  id: /^grok-imagine-video/, envKey: "XAI_API_KEY",
  buildRequest: (r, imageUrl) => ({ url: "https://api.x.ai/v1/videos/generations", body: { model: r.model, prompt: r.prompt, duration: r.sec, resolution: r.res, ...(imageUrl ? { image_url: imageUrl } : {}) } }),
}];

async function runPlan(dir: string, o: Record<string, any>) {
  const plan = readJson<any>(path.join(dir, "gen_plan.json"), null);
  if (!plan) throw new UserError("生成プランがありません", "先に npm run gen -- plan を実行して、内容と金額を確認してください。");
  const cap = Number(o.cap ?? loadConfig(dir).gen?.capUSD ?? 20);
  if (plan.unknownCost) throw new UserError("価格が未確認のモデルが含まれるため実行できません", "models.yaml の価格を公式ページで確認して verified: true にするか、--model で確認済みモデルを指定して plan をやり直してください。");
  if (Number(o.confirm) !== plan.total) throw new UserError(`有料生成です。見積もり $${plan.total} を確認したら --confirm ${plan.total} を付けて実行してください`, "金額が違う場合は plan をやり直してください。");
  if (plan.total > cap) throw new UserError(`見積もり $${plan.total} が上限 $${cap} を超えています`, "--cap で上限を上げるか、--sections で対象を減らしてください。");
  for (const r of plan.rows) {
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
    cfg.timing.perShot[a.shot] = { ...(cfg.timing.perShot[a.shot] ?? {}), src: `project/gen/${a.shot}/${a.file}`, kind: "video", clipFrom: 0 };
    saveConfig(dir, cfg);
  }
  writeJson(f, review);
  return review[k];
}
const GALLERY_HTML = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>生成レビュー</title><style>body{background:#15131a;color:#eee;font-family:sans-serif;margin:16px}.shot{margin:18px 0;padding:12px;background:#221e2a;border-radius:10px}.takes{display:flex;gap:12px;flex-wrap:wrap}.take{background:#2c2735;padding:8px;border-radius:8px;width:340px}video{width:100%;border-radius:6px}button{margin:3px;border:0;border-radius:5px;padding:5px 9px;cursor:pointer}.adopt{background:#2a9d5a;color:#fff}.reject{background:#7a2a3a;color:#fff}.regen{background:#555;color:#fff}.st{font-weight:700}textarea{width:100%;background:#111;color:#fff}</style>
<h2>🎞 生成レビュー（ショットごと）</h2><p>採用 = タイムラインに自動で入ります（mv.config.json → timing.perShot）。新しいテイクは gen/takes/&lt;ショットID&gt;/ に置くと自動で表示（MCP・手動どちらでもOK）。</p><div id="list"></div>
<script>async function load(){const d=await fetch('/state').then(r=>r.json());const L=document.getElementById('list');L.innerHTML='';
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
  if (cmd === "plan") { const { md } = makePlan(dir, o); log(md); log(`\n💾 ${path.join(dir, "gen_plan.md")} / prompts.csv\n▶ 実行するなら（有料）: npm run gen -- run --confirm <合計金額>`); return; }
  if (cmd === "run") return runPlan(dir, o);
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
