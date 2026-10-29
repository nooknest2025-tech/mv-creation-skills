// npm run recipe:battle -- --project <名前> [--map slot=素材番号,slot=素材番号] [--template <json>]
// アニメバトルMVのレシピ（docs/recipes/anime_battle_mv_template.json）を、編集画面のプロジェクトに当てはめます。
// シーンの開始は「拍」で持っているので、プロジェクトのBPMに合わせて秒に直します。素材は役割名（slot）で割り当て:
// 素材の名前（label / ファイル名）に slot 名が入っていればそれ、無ければ動画は動画、イラスト（ill_*）は画像から順番に使います。
// 元の editor-state.json は editor-state.before-recipe.json に残します。歌詞はそのまま。
import fs from "node:fs"; import path from "node:path";
import { checkComp, checkGlobalComp } from "../src/lib/compose";
export function applyRecipe(data: any, tpl: any, map: Record<string, number> = {}) {
  const beat = 60 / (data.bpm ?? tpl.sourceBpm), name = (a: any) => String(typeof a === "string" ? a : `${a?.label ?? ""} ${a?.src ?? ""}`).toLowerCase();
  const isImg = (a: any) => (typeof a === "object" && a?.kind === "image") || /\.(png|jpe?g|webp)$/i.test(typeof a === "string" ? a : a?.src ?? "");
  const vids = data.assets.map((a: any, i: number) => (isImg(a) ? -1 : i)).filter((i: number) => i >= 0), imgs = data.assets.map((a: any, i: number) => (isImg(a) ? i : -1)).filter((i: number) => i >= 0);
  let vi = 0, ii = 0; const pick: Record<string, number> = {};
  for (const s of tpl.slots as string[]) {
    if (map[s] !== undefined) { pick[s] = map[s]; continue; }
    const hit = data.assets.findIndex((a: any) => name(a).includes(s.toLowerCase()));
    if (hit >= 0) { pick[s] = hit; continue; }
    const pool = s.startsWith("ill_") && imgs.length ? imgs : vids.length ? vids : imgs;
    if (!pool.length) throw new Error("素材がありません");
    pick[s] = pool[(s.startsWith("ill_") && imgs.length ? ii++ : vi++) % pool.length];
  }
  const conv = (o: any): any => Array.isArray(o) ? o.map(conv) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => (k === "slot" ? ["asset", pick[v as string]] : [k, conv(v)]))) : o;
  const end = Math.min(data.duration, tpl.lengthBeats * beat);
  const scenes = tpl.scenes.map((s: any, i: number) => ({ id: `S${String(i + 1).padStart(3, "0")}`, start: +(s.beat * beat).toFixed(3), asset: pick[tpl.slots.find((x: string) => JSON.stringify(s.comp).includes(`"${x}"`)) ?? tpl.slots[0]], transition: 0, label: s.label, comp: conv(s.comp) })).filter((s: any) => s.start < end);
  const out = { ...data, scenes, comp: conv(tpl.comp) };
  checkGlobalComp(out.comp, out.assets.length);
  scenes.forEach((s: any, i: number) => checkComp(s.comp, out.assets.length, (scenes[i + 1]?.start ?? out.duration) - s.start));
  return { data: out, pick };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const a = process.argv.slice(2), opt = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const project = opt("--project"); if (!project) { console.error("使い方: npm run recipe:battle -- --project <名前> [--map slot=番号,...]"); process.exit(2); }
  const pack = path.resolve(__dirname, "../.."), file = path.join(pack, "projects", project, "out/editor/editor-state.json");
  if (!fs.existsSync(file)) { console.error(`編集画面のデータがありません: ${file}（先に npm run editor -- --project ${project}）`); process.exit(2); }
  const tpl = JSON.parse(fs.readFileSync(opt("--template") ?? path.join(pack, "docs/recipes/anime_battle_mv_template.json"), "utf8"));
  const map = Object.fromEntries((opt("--map") ?? "").split(",").filter(Boolean).map((kv) => { const [k, v] = kv.split("="); return [k, Number(v)]; }));
  const st = JSON.parse(fs.readFileSync(file, "utf8")); fs.copyFileSync(file, file.replace(/\.json$/, ".before-recipe.json"));
  const { data, pick } = applyRecipe(st.data, tpl, map);
  fs.writeFileSync(file, JSON.stringify({ ...st, revision: (st.revision ?? 0) + 1, data }));
  console.log(`レシピを当てはめました: ${data.scenes.length}シーン`); for (const [k, v] of Object.entries(pick)) console.log(`  ${k} → 素材${v}`);
}
