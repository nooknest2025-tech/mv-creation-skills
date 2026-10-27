// npm run approve -- 3 [--project 曲名]  → v3 を承認（以後上書き不可・読み取り専用）
import { PROJECTS_DIR, fail, fs, log, parseArgs, path } from "./common";
import { approve } from "./project";
const { o, rest } = parseArgs(process.argv.slice(2));
try {
  const name = (o.project as string) ?? fs.readdirSync(PROJECTS_DIR).sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
  const v = Number(String(rest[0] ?? "").replace(/^v/, ""));
  approve(path.join(PROJECTS_DIR, name), name, v);
  log(`🔒 ${name} v${v} を承認しました（以後このバージョンは上書きされません）`);
} catch (e) { fail(e); }
