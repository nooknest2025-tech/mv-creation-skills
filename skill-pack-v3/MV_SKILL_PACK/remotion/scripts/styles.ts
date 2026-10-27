// npm run styles : 文字スタイル一覧（短い日本語名つき）
import { CATALOG, KEYWORD_EFFECTS } from "../src/lib/catalog";
import { PRESETS } from "../src/lib/presets";
console.log("\n🔤 文字スタイル（32種）  使い方: 「サビは glitch で」/ mv.config.json の lyrics.sections\n");
Object.entries(CATALOG).forEach(([k, v], i) => console.log(`${String(i + 1).padStart(2)}. ${k.padEnd(16)} ${v.short.padEnd(8, "　")} [${v.energy}] ${v.ja}`));
console.log("\n✨ 語エフェクト（歌詞の特定の言葉だけ）: " + Object.entries(KEYWORD_EFFECTS).map(([k, v]) => `${k}=${v}`).join(" / "));
console.log("\n🎬 ジャンル・プリセット: " + Object.values(PRESETS).map((p) => `${p.id}=${p.ja}`).join(" / "));
console.log("\n見本動画: npm run showcase（out/showcase.mp4）\n");
