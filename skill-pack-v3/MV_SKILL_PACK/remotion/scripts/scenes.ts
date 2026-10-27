// npm run scenes -- clip.mp4 [more.mp4 ...]  → シーン分割と「見どころ」スコア
import { detectScenes, fail, log, parseArgs } from "./common";
const { rest, o } = parseArgs(process.argv.slice(2));
try { for (const f of rest) { const s = detectScenes(f, Number(o.threshold ?? 0.3)); log(`🎞 ${f}: ${s.length} シーン`); s.forEach((x, i) => log(`  ${i + 1}. ${x.start.toFixed(2)}–${x.end.toFixed(2)}s  見どころ ${x.score}`)); } } catch (e) { fail(e); }
