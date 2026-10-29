// npm run made  （会話なら「作ったの入れた」）: 自分で作った画像・動画を取り込んで作り直す。無料の道のりの最後のひと押し。
//   1. input/made/ の画像・動画を見て（名前は自由）シーンに割り当てる
//      画像: character… → キャラ参照 / bg… → 背景参照 / それ以外 → シーン画像（scene_003 などの番号があればその番号、なければ作った順）
//      動画: 名前に S003 などのシーンIDがあればそのシーン、なければ動画のやることリスト（gen_plan.json）の順に、まだ動画のないシーンへ
//   2. 取り込んだファイルは input/made/取り込み済み/ へ移す（消さない）
//   3. npm run mv と同じ作り直し（--no-build で取り込みだけ）。混在（一部動画・残り静止画）もそのまま編集画面で直せる
// 有料APIは一切呼ばない。
import { INPUT_DIR, PROJECTS_DIR, UserError, fail, fs, log, parseArgs, path } from "./common";
import { readJson } from "./project";
import { addAsset } from "./assets_lib";

const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm|m4v)$/i;
export const madeInbox = (input = INPUT_DIR) => path.join(input, "made");

/** which scene each video goes to: explicit S### in the name wins, the rest fill the plan order (skipping scenes already taken). */
export function assignVideos(files: string[], planShots: string[], taken: string[] = []): { file: string; shot: string | null }[] {
  const used = new Set(taken), out: { file: string; shot: string | null }[] = [];
  const named = files.map((f) => ({ f, m: path.basename(f).match(/\bS(\d{2,4})\b|S(\d{2,4})(?=[_\-. ])/i) }));
  for (const { f, m } of named) if (m) { const id = `S${(m[1] ?? m[2]).padStart(3, "0")}`; used.add(id); out.push({ file: f, shot: id }); }
  const free = planShots.filter((s) => !used.has(s));
  for (const { f, m } of named) if (!m) out.push({ file: f, shot: free.shift() ?? null });
  return out;
}
/** scene number for an image: scene_007 / 007 in the name, else the next free number. */
export function assignImages(files: string[], existing: number) {
  let n = existing; const out: { file: string; kind: "character" | "background" | "scene"; to?: string }[] = [];
  for (const f of files) { const b = path.basename(f);
    if (/^(character|chara|キャラ)/i.test(b)) out.push({ file: f, kind: "character" });
    else if (/^(bg|background|背景)/i.test(b)) out.push({ file: f, kind: "background" });
    else { const m = b.match(/scene_?(\d+)/i), num = m ? Number(m[1]) : ++n; out.push({ file: f, kind: "scene", to: `scene_${String(num).padStart(3, "0")}${path.extname(b).toLowerCase()}` }); } }
  return out;
}

export async function importMade(dir: string, input = INPUT_DIR, o: { move?: boolean } = {}) {
  const inbox = madeInbox(input);
  if (!fs.existsSync(inbox)) { fs.mkdirSync(inbox, { recursive: true }); return { images: 0, videos: [] as { file: string; shot: string | null }[], inbox, empty: true }; }
  const files = fs.readdirSync(inbox).filter((f) => !f.startsWith(".") && fs.statSync(path.join(inbox, f)).isFile()).sort().map((f) => path.join(inbox, f));
  const imgs = files.filter((f) => IMG.test(f)), vids = files.filter((f) => VID.test(f));
  const scenesDir = path.join(input, "AI生成画像"); fs.mkdirSync(scenesDir, { recursive: true });
  for (const a of assignImages(imgs, fs.readdirSync(scenesDir).filter((f) => IMG.test(f)).length)) {
    if (a.kind === "character") addAsset(dir, a.file, "character_front", { note: "キャラクターシート（自分で作成）", approved: true });
    else if (a.kind === "background") addAsset(dir, a.file, "location", { note: `背景（${path.basename(a.file)}）`, approved: true });
    else fs.copyFileSync(a.file, path.join(scenesDir, a.to!));
  }
  let videos: { file: string; shot: string | null }[] = [];
  if (vids.length) {
    const gen = await import("./gen");
    let plan = readJson<any>(path.join(dir, "gen_plan.json"), null);
    if (!plan?.rows?.length) plan = (gen.makePlan(dir, { dryAudio: true }) as any).plan;
    const ed = gen.readPromptEdits(dir), cfg = readJson<any>(path.join(dir, "mv.config.json"), {});
    const taken = Object.entries<any>(cfg.timing?.perShot ?? {}).filter(([, v]) => v?.kind === "video" && v.src).map(([k]) => k);
    videos = assignVideos(vids, (plan?.rows ?? []).filter((r: any) => !ed[r.shot]?.skip).map((r: any) => r.shot), taken);
    for (const v of videos) { if (!v.shot) continue;
      const got = await gen.importTake(v.file, v.shot, "manual", "input/made から取り込み");
      if (got[0]) gen.reviewAction(dir, { shot: v.shot, file: path.basename(got[0]), action: "adopt" }); }
  }
  if (o.move !== false && files.length) { const done = path.join(inbox, "取り込み済み", new Date().toISOString().replace(/[:.]/g, "-")); fs.mkdirSync(done, { recursive: true });
    for (const f of [...imgs, ...videos.filter((v) => v.shot).map((v) => v.file)]) fs.renameSync(f, path.join(done, path.basename(f))); }
  return { images: imgs.length, videos, inbox, empty: !files.length };
}

/** rebuild args: always rebuild the project the clips were imported into (not a new project named after the song file). */
export function madeRebuildArgs(input: string, dir: string, yes: boolean) {
  const cfgTitle = readJson<any>(path.join(dir, "manifest.json"), null)?.title;
  return ["--input", input, "--title", String(cfgTitle ?? path.basename(dir)), ...(yes ? ["--yes"] : [])];
}

async function main() {
  const { o } = parseArgs(process.argv.slice(2));
  const input = path.resolve(String(o.input ?? INPUT_DIR));
  const { latestProject } = await import("./gen");
  const dir = o.project ? path.join(PROJECTS_DIR, String(o.project)) : latestProject();
  if (!dir || !fs.existsSync(dir)) throw new UserError("プロジェクトが見つかりません", "先に npm run start（または npm run mv）で一度作ってください。");
  const r = await importMade(dir, input);
  if (r.empty) { log(`📂 ${r.inbox} に、作った画像・動画を入れてから、もう一度 npm run made を実行してください（名前は自由。シーンID 例 S003 / scene_003 を名前に入れると確実）。`); return; }
  log(`✅ 取り込み: 画像 ${r.images} 枚 / 動画 ${r.videos.filter((v) => v.shot).length} 本${r.videos.length ? `（${r.videos.map((v) => `${path.basename(v.file)}→${v.shot ?? "割り当て先なし"}`).join("、")}）` : ""}`);
  const left = r.videos.filter((v) => !v.shot); if (left.length) log(`⚠️ 割り当て先のない動画は input/made/ に残しました。名前にシーンID（例 S003）を入れてもう一度どうぞ。`);
  if (o["no-build"]) return;
  log("\n▶ 作り直します（一部だけ動画・残り静止画でもOK。編集画面でそのまま直せます）\n");
  const { run } = await import("./mv");
  await run(madeRebuildArgs(input, dir, !!o.yes));
}
if (process.argv[1]?.match(/made\.ts$/)) main().catch(fail);
