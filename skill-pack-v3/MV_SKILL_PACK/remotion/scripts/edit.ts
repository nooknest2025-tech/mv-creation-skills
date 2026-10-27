// npm run edit -- "サビの歌詞をもっと派手に" [--project 曲名] [--dry-run]
// 歌詞の色・速さ・動き・大きさは「編集画面と同じ記録」(out/editor/editor-state.json) に書き込みます。
// 手で直した内容は消えず、編集画面を開き直すと AI の変更も表示されます。
// 画面比・ジャンルなど作り直しが必要な設定は mv.config.json に書き込みます。
import { PROJECTS_DIR, UserError, fail, fs, log, parseArgs, path } from "./common";
import { applyInstruction, JA_STYLE_WORDS } from "../src/lib/nl";
import { applyToEditorData, helpText } from "../src/lib/editstate";
import { loadConfig, saveConfig } from "./project";
import { prepareProject } from "./editor";

/** core of npm run edit (exported for tests). */
export function runEdit(dir: string, text: string, opts: { dryRun?: boolean } = {}) {
  const out: string[] = [];
  const runtime = path.join(dir, "out", "editor"), stateFile = path.join(runtime, "editor-state.json");
  const canEditor = fs.existsSync(stateFile) || fs.existsSync(path.join(dir, "out", "editor-input.json"));
  let rest = text;
  if (canEditor) {
    if (!fs.existsSync(stateFile)) prepareProject({ project: dir });
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8").replace(/^\uFEFF/, ""));
    const r = applyToEditorData(state.data, text, JA_STYLE_WORDS);
    out.push(...r.changes);
    rest = r.unmatched.join("。");
    if (r.changes.length && !opts.dryRun) {
      const hist = path.join(runtime, "edit-history"); fs.mkdirSync(hist, { recursive: true });
      fs.copyFileSync(stateFile, path.join(hist, `rev-${state.revision}-${Date.now()}.json`));
      const next = { revision: state.revision + 1, data: r.data, lastEdit: { by: "ai", text, at: new Date().toISOString() } };
      fs.writeFileSync(stateFile + ".tmp", JSON.stringify(next, null, 2)); fs.renameSync(stateFile + ".tmp", stateFile);
      out.push(`💾 編集画面と同じ記録を更新しました（手で直した内容はそのまま）→ npm run editor -- --project ${path.basename(dir)} で確認・書き出し`);
    }
  }
  if (rest) {
    const r = applyInstruction(loadConfig(dir), rest);
    const ok = r.changes.filter((c) => !c.startsWith("？"));
    out.push(...ok);
    for (const c of r.changes.filter((c) => c.startsWith("？"))) out.push(`？ ${helpText(c.match(/「(.+)」（例/)?.[1] ?? rest)}`);
    if (ok.length && !opts.dryRun) { saveConfig(dir, r.cfg); out.push(`💾 作成設定 mv.config.json を更新しました → npm run preview で確認、npm run mv で作り直し`); }
  }
  return out;
}

if (process.argv[1]?.endsWith("edit.ts")) {
  const { o, rest } = parseArgs(process.argv.slice(2));
  try {
    const text = rest.join(" ");
    if (!text) throw new UserError("指示が空です", '例: npm run edit -- "サビの歌詞をもっと派手に"');
    const projects = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "mv.config.json")) || fs.existsSync(path.join(PROJECTS_DIR, d, "out", "editor", "editor-state.json"))) : [];
    const name = (o.project as string) ?? projects.sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
    if (!name) throw new UserError("プロジェクトがまだありません", "先に npm run mv を1回実行してください。");
    runEdit(path.join(PROJECTS_DIR, name), text, { dryRun: !!o["dry-run"] }).forEach((c) => log(c.startsWith("💾") || c.startsWith("？") ? c : `✏️ ${c}`));
  } catch (e) { fail(e); }
}
