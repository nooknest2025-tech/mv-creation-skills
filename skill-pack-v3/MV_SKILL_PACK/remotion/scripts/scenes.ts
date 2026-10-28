// npm run scenes -- clip.mp4 [more.mp4 ...]  → シーン分割と「動きの多さ」の目安
import { detectScenes, fail, log, parseArgs } from "./common";
const { rest, o } = parseArgs(process.argv.slice(2));
try { for (const f of rest) { const s = detectScenes(f, Number(o.threshold ?? 0.3)); log(`🎞 ${f}: ${s.length} シーン`); s.forEach((x, i) => { const n = Math.max(1, Math.min(3, Math.round(x.score * 3))); log(`  シーン${i + 1}（${x.start.toFixed(1)}〜${x.end.toFixed(1)}秒）動きの多さ ${"★".repeat(n)}${"☆".repeat(3 - n)}`); }); log("  ★が多いほど動きが大きく、サビなど盛り上がる所に向いています"); } } catch (e) { fail(e); }
