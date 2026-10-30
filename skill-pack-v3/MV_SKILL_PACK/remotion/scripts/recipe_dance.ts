// npm run recipe:dance -- --project <名前> [--hits hits.json] [--title "タイトル"] [--sub "サブ"] [--freeze 秒] [--template <json>]
// 「パーツアニメで踊るMV」レシピ（docs/recipes/parts_dance_mv_template.json）を、立ち絵（パーツ）プロジェクトに当てはめます。
// - カット: 曲の区間（sections）ごとに、テンプレートの [拍数, 構図] を拍に合わせて並べます（全身/上半身/顔アップ/3人並び/斜め分割）。
// - 振付: 決まったポーズへ 12fps でパッと切り替わるカクカク振付（stage.moves / routine / finale）。Hey!/Ho! は --hits（npm の heyho.py の出力）。
// - 歌詞: 1行ごとに置き場所を1回だけ決めます（その行がまたぐ全カットを見て、3人並び/分割があれば下、無ければ左右の縦書き）。
//   カットが変わっても行の位置は動きません。下に置く行がまたぐ上半身カットは、手が文字に被らないよう少し引きます。
// - 最後は freezeAt で決めポーズのまま止め、止まった後は歌詞を出しません。タイトルは最初と最後（タイプ表示なし・幅に自動で収める）。
// 元のファイルは editor-state.before-recipe.json / main.tachie.before-recipe.json に残します。歌詞の文字・タイミングはそのまま。
import fs from "node:fs"; import path from "node:path";

type Cut = [number, string, Record<string, any>];
export interface DanceTemplate { cuts: Record<string, Cut[]>; minCutSec?: number; stage: Record<string, any>; motion?: string; hits: any; title: any; lyrics: any; freeze?: { tailSec?: number } }
export interface HitIn { t: number; text?: string; kind?: "hey" | "ho" }
const secKind = (s: any) => { const k = String(s?.type ?? s?.label ?? "").toLowerCase(); return /chorus|サビ/.test(k) ? "chorus" : /pre|bメロ/.test(k) ? "pre" : /intro|イントロ/.test(k) ? "intro" : /outro|ending|アウトロ/.test(k) ? "outro" : "verse"; };

/** lay cuts along the song: per section, repeat that section kind's beat pattern. Returns scenes with scene.stage = cut patch. */
export function layCuts(data: any, tpl: DanceTemplate, asset: number) {
  const B = 60 / (data.bpm ?? 120), ph = data.phase ?? 0, dur = data.duration, out: any[] = [];
  const secs = (data.sections?.length ? data.sections : [{ type: "verse", start: 0, end: dur }]).filter((s: any) => s.start < dur);
  for (const s of secs) {
    const pat = tpl.cuts[secKind(s)] ?? tpl.cuts.verse; let t = s.start, j = 0;
    while (t < Math.min(s.end, dur) - 1e-3) { const [beats, layout, extra] = pat[j++ % pat.length]; out.push({ start: +t.toFixed(3), stage: { layout, ...extra } }); t = Math.max(t + 1e-3, ph + Math.round((t + beats * B - ph) / B) * B); }
  }
  const min = tpl.minCutSec ?? 0.45, keep = out.filter((c, i) => i === 0 || ((out[i + 1]?.start ?? dur) - c.start >= min)); // merge slivers into the previous cut
  keep[keep.length - 1].stage = { layout: "full", cutBg: "sunburst", speed: true }; // last cut: whole body for the final kime
  return keep.map((c, i) => ({ id: `S${String(i + 1).padStart(3, "0")}`, start: c.start, end: +(keep[i + 1]?.start ?? dur).toFixed(3), asset, transition: 0, label: `${c.stage.layout}`, stage: c.stage }));
}

/** one placement per lyric LINE from every cut the line spans; bust cuts inside a bottom line get pulled back. */
export function placeLines(lyrics: any[], scenes: any[], tpl: DanceTemplate) {
  const L = tpl.lyrics, hw: Record<string, any> = {}, camFix: string[] = [];
  lyrics.forEach((l, i) => {
    const hold = Math.min(l.end + 0.1, lyrics[i + 1]?.start ?? Infinity), sp = scenes.filter((s) => s.start < hold && s.end > l.start);
    const bottom = sp.some((s) => (L.bottomWhen ?? ["trio", "split"]).includes(s.stage?.layout)) || Array.from(String(l.text).replace(/（.*?）|\(.*?\)/g, "")).length > 16;
    hw[l.id] = { place: bottom ? "bottom" : "side", side: i % 2 ? "r" : "l", font: L.fonts[i % L.fonts.length], color: i % 4, deco: L.decos[i % L.decos.length] };
    if (bottom && L.bustCamInBottom) for (const s of sp) if (s.stage?.layout === "bust") { s.stage.cam = { r: 0, x: 0, ...(s.stage.cam ?? {}), ...L.bustCamInBottom }; camFix.push(s.id); }
  });
  return { hw, camFix: [...new Set(camFix)] };
}

export function applyDance(data: any, stage0: any, tpl: DanceTemplate, o: { hits?: HitIn[]; title?: string; sub?: string; freeze?: number } = {}) {
  const asset = data.assets.findIndex((a: any) => a && typeof a === "object" && a.kind === "tachie");
  if (asset < 0) throw new Error("立ち絵（パーツ）の素材がありません。先に npm run editor -- --project <名前> で立ち絵プロジェクトを開いてください");
  const scenes = layCuts(data, tpl, asset), { hw, camFix } = placeLines(data.lyrics, scenes, tpl);
  const B = 60 / (data.bpm ?? 120), H = tpl.hits;
  const hits = (o.hits ?? []).map((h, i) => { const ho = h.kind ? h.kind === "ho" : i % 2 === 1; return { t: +h.t.toFixed(3), move: H.moves[ho ? 1 : 0], beats: H.beats, text: h.text ?? (ho ? "Ho!" : "Hey!"), x: H.x[ho ? 1 : 0], y: H.y, size: H.size, color: H.colors[ho ? 1 : 0] }; });
  const freezeAt = +(o.freeze ?? data.duration - (tpl.freeze?.tailSec ?? 0.02)).toFixed(3);
  const T = tpl.title, title = o.title ?? data.title;
  if (title && T.atStart) scenes[0].stage.title = { text: title, sub: o.sub, start: scenes[0].start, end: Math.min(T.startSec, scenes[1]?.start ?? T.startSec), y: T.y };
  const last = scenes[scenes.length - 1]; if (title && T.atEnd) last.stage.title = { text: title, sub: o.sub, start: +Math.max(last.start, freezeAt - T.endHoldSec * 0.2).toFixed(3), end: data.duration + 1, y: T.y, size: T.size };
  const stage = { ...stage0, ...tpl.stage, chars: (stage0.chars ?? []).map((c: any) => ({ ...c, motion: tpl.motion ?? c.motion })), hits, hwLyrics: hw, freezeAt, stopAt: freezeAt, bpmHint: data.bpm, beatPhase: data.phase ?? 0 };
  const lyrics = data.lyrics.map((l: any) => ({ ...l, stageStyle: tpl.lyrics.style, edited: [...new Set([...(l.edited ?? []), "stageStyle"])] }));
  const motion = (cs: any[] | undefined) => (cs ?? []).map((c: any) => ({ ...c, motion: tpl.motion ?? c.motion }));
  const assets = data.assets.map((a: any, i: number) => (i === asset ? { ...a, stage: { ...(a.stage ?? {}), ...stage, chars: motion(a.stage?.chars ?? stage0.chars) } } : a));
  return { data: { ...data, scenes, lyrics, assets }, stage, camFix };
}

if (process.argv[1] && /recipe_dance\.ts$/.test(process.argv[1])) {
  const a = process.argv.slice(2), opt = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const project = opt("--project"); if (!project) { console.error("使い方: npm run recipe:dance -- --project <名前> [--hits hits.json] [--title タイトル]"); process.exit(2); }
  const pack = path.resolve(path.dirname(path.resolve(process.argv[1])), "../.."), dir = path.join(pack, "projects", project), file = path.join(dir, "out/editor/editor-state.json");
  if (!fs.existsSync(file)) { console.error(`編集画面のデータがありません: ${file}（先に npm run editor -- --project ${project}）`); process.exit(2); }
  const tpl = JSON.parse(fs.readFileSync(opt("--template") ?? path.join(pack, "docs/recipes/parts_dance_mv_template.json"), "utf8"));
  const st = JSON.parse(fs.readFileSync(file, "utf8")), ta = st.data.assets.find((x: any) => x?.kind === "tachie");
  const tj = ta?.source && fs.existsSync(ta.source) ? ta.source : path.join(dir, "tachie/main.tachie.json"); // the editor re-imports this file on every launch
  const raw = fs.existsSync(tj) ? JSON.parse(fs.readFileSync(tj, "utf8")) : {}, stage0 = raw.stage ?? raw;
  const hits = opt("--hits") ? JSON.parse(fs.readFileSync(opt("--hits")!, "utf8")) : [];
  const { data, stage, camFix } = applyDance(st.data, stage0, tpl, { hits: Array.isArray(hits) ? hits : hits.hits, title: opt("--title"), sub: opt("--sub"), freeze: opt("--freeze") ? Number(opt("--freeze")) : undefined });
  fs.copyFileSync(file, file.replace(/\.json$/, ".before-recipe.json"));
  if (fs.existsSync(tj)) { fs.copyFileSync(tj, tj.replace(/\.json$/, ".before-recipe.json")); const rest = stage; fs.writeFileSync(tj, JSON.stringify(raw.stage ? { ...raw, stage: { ...raw.stage, ...rest } } : { ...raw, ...rest }, null, 1)); }
  fs.writeFileSync(file, JSON.stringify({ ...st, revision: (st.revision ?? 0) + 1, data }));
  const bottom = Object.values(stage.hwLyrics).filter((h: any) => h.place === "bottom").length;
  console.log(`レシピを当てはめました: ${data.scenes.length}カット / 歌詞${data.lyrics.length}行（下${bottom}・左右${data.lyrics.length - bottom}）/ Hey!Ho! ${stage.hits.length} / 止める ${stage.freezeAt}秒`);
  if (camFix.length) console.log(`  下の歌詞と重ならないよう引いた上半身カット: ${camFix.join(", ")}`);
}
