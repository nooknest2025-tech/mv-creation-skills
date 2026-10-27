// npm run parts -- <コマンド>   パーツアニメ（Live2D風の切り絵アニメ）の素材を取り込む・確認する・直す
//   import <file.psd | PNGフォルダ> [--name 名前]   レイヤーを読み込み、支点・親子・前後を自動推定して rig.json を作る
//   split <画像> [--name 名前] [--no-rembg]         1枚絵を自動でパーツ分解（無料・ローカル。粗いので必ず確認）
//   check [--name 名前]                              問題点の一覧と確認用シート（支点の十字つき PNG）
//   set <名前> <パーツ.pivot=x,y | .parent=ID | .kind=head | .z=3 | .spring=0.6>   推定を手で直す（以後の再取り込みでも保持）
//   ai-prompt <画像> [--name 名前]                   画像生成AIで「パーツ分け素材」を作る場合の指示文（有料モデル・任意）
//   demo [--name demo_chara]                          オリジナルの簡易キャラ（パーツ済み）を作る
import { INPUT_DIR, fail, fs, log, parseArgs, path } from "./common";
import { pngFolderLayers, rigFromLayersDir, runPy } from "./parts_lib";
import { editRig, rigIssues, type Rig } from "../src/lib/rig";

const dirOf = (name: string) => path.join(INPUT_DIR, "parts", name);
function finish(dir: string, rig: Rig) {
  const issues = rigIssues(rig);
  log(`✅ ${rig.name}: ${rig.parts.length} パーツ → ${path.join(dir, "rig.json")}`);
  for (const p of rig.parts) log(`   ・${p.id}（${p.kind}）支点 ${p.pivot.map((v) => Math.round(v)).join(",")} 親 ${p.parent ?? "なし"}${p.states ? ` 状態: ${Object.keys(p.states).join("/")}` : ""}`);
  if (rig.quality) log(`ℹ️ ${rig.quality}`);
  issues.forEach((x) => log(`⚠️ ${x}`));
  try { const r = runPy(["sheet", path.join(dir, "rig.json"), "--out", path.join(dir, "check_sheet.png")]); log(`🖼  確認シート: ${r.out}（ピンクの十字が回転の支点。ずれていたら npm run parts -- set ${rig.name} パーツID.pivot=x,y）`); } catch (e: any) { log(`（確認シートは作れませんでした: ${e.message}）`); }
  log("▶ 次は npm run mv（input/parts/ のキャラが自動で使われます）。動きは「キャラは手を振って」「サビはノリノリで」「首をかしげて」などで指定できます。");
}
async function main() {
  const { o, rest: pos } = parseArgs(process.argv.slice(2));
  const [cmd, a1, a2] = pos ?? [];
  const name = String(o.name ?? (a1 && cmd !== "set" ? path.basename(a1).replace(/\.[^.]+$/, "") : cmd === "set" ? a1 : "demo_chara")).replace(/[^\w\u3040-\u9fff-]/g, "_");
  const dir = dirOf(name);
  switch (cmd) {
    case "import": {
      if (!a1 || !fs.existsSync(a1)) throw new Error("npm run parts -- import <file.psd | PNGフォルダ>");
      fs.mkdirSync(dir, { recursive: true });
      if (fs.statSync(a1).isDirectory()) pngFolderLayers(a1, dir); else if (/\.psd$/i.test(a1)) runPy(["layers", a1, "--out", dir]); else throw new Error("PSD か PNG フォルダを指定してください（1枚絵は split）");
      return finish(dir, rigFromLayersDir(dir, name, /\.psd$/i.test(a1) ? "psd" : "pngs"));
    }
    case "split": {
      if (!a1 || !fs.existsSync(a1)) throw new Error("npm run parts -- split <画像>");
      const r = runPy(["split", a1, "--out", dir, ...(o["no-rembg"] ? ["--no-rembg"] : [])]); log(`🔪 ${r.note}`);
      return finish(dir, rigFromLayersDir(dir, name, "split"));
    }
    case "demo": { runPy(["demo", "--out", dir]); return finish(dir, rigFromLayersDir(dir, name, "demo")); }
    case "check": { const f = path.join(dir, "rig.json"); if (!fs.existsSync(f)) throw new Error(`${f} がありません`); return finish(dir, JSON.parse(fs.readFileSync(f, "utf8"))); }
    case "set": {
      const f = path.join(dirOf(a1), "rig.json"); if (!fs.existsSync(f)) throw new Error(`${f} がありません`);
      const rig: Rig = JSON.parse(fs.readFileSync(f, "utf8")); log(`✏️ ${editRig(rig, String(a2))}`); fs.writeFileSync(f, JSON.stringify(rig, null, 1)); return finish(dirOf(a1), rig);
    }
    case "ai-prompt": {
      const txt = `【画像生成AIへの指示（パーツ分け素材）】\n添付のキャラクターと同じデザインで、以下のパーツを「同じキャンバスサイズ・同じ位置」に1枚ずつ、透過PNGで描いてください。\n隠れている部分（頭の下の首、腕の後ろの胴体、前髪の下のおでこ）も描き足してください。\nパーツ: 後ろ髪 / 体（首まで） / 左腕 / 右腕 / 頭（顔の肌のみ） / 目 / 目_閉じ / 口 / 口_a / 口_i / 口_u / 口_e / 口_o / 前髪 / アクセサリー\n※ ファイル名をパーツ名にして1つのフォルダに保存 → npm run parts -- import <フォルダ>\n注意: 生成AIは位置がずれやすく、全パーツの整合は保証されません。必ず確認シートで確認してください（有料モデルの場合は料金がかかります）。`;
      fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "ai_parts_prompt.txt"), txt); log(txt); log(`\n📝 ${path.join(dir, "ai_parts_prompt.txt")}`); return;
    }
    default: log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
}
main().catch(fail);
