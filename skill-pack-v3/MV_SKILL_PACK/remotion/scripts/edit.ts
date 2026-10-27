// npm run edit -- "サビはグリッチで。画は0.1秒前から切り替え" [--project 曲名]  → mv.config.json を更新（差分表示）
import { PROJECTS_DIR, UserError, fail, fs, log, parseArgs, path } from "./common";
import { applyInstruction } from "../src/lib/nl";
import { loadConfig, saveConfig } from "./project";
const { o, rest } = parseArgs(process.argv.slice(2));
try {
  const text = rest.join(" ");
  if (!text) throw new UserError("指示が空です", '例: npm run edit -- "サビはグリッチで"');
  const projects = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "mv.config.json"))) : [];
  const name = (o.project as string) ?? projects.sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
  if (!name) throw new UserError("プロジェクトがまだありません", "先に npm run mv を1回実行してください。");
  const dir = path.join(PROJECTS_DIR, name);
  const r = applyInstruction(loadConfig(dir), text);
  r.changes.forEach((c) => log(`✏️ ${c}`));
  if (o["dry-run"]) process.exit(0);
  saveConfig(dir, r.cfg);
  log(`💾 ${path.join(dir, "mv.config.json")} を更新しました → npm run preview で確認、npm run mv で本番`);
} catch (e) { fail(e); }
