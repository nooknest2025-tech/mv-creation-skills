// npm run check:lyrics -- --project <名前>   （または --state <editor-state.json>）
// 立ち絵（パーツ）MVの歌詞チェック。描画と同じ決まりでフレームごとに数えます。
//  1) 重複: 同じ文字が同じフレームに2つ出ていないか（舞台の歌詞・編集画面のモーション歌詞・Hey!/Ho!・掛け声の吹き出し）。舞台の歌詞は1フレーム最大1行。
//  2) 行の位置: 1行の途中（カットをまたいだ時）に置き場所が変わっていないか。0 でないと「シーンが変わったら歌詞が別の場所に出る」。
// どちらかが 0 でなければ終了コード 1。
import fs from "node:fs"; import path from "node:path";
const strip = (s: string) => s.replace(/（.*?）|\(.*?\)/g, "");
const motionEdited = (l: any) => ["motion", "params", "motionDuration"].some((k) => (l.edited ?? []).includes(k));
const holdOf = (L: any[], i: number) => Math.min(L[i].end + 0.1, L[i + 1]?.start ?? Infinity);
const stageOf = (d: any) => d.assets.find((a: any) => a?.kind === "tachie")?.stage ?? {};

export function dupCheck(d: any) {
  const a = stageOf(d), fps = d.fps ?? 24, L = d.lyrics, freeze = a.freezeAt ?? Infinity, hitTexts = (a.hits ?? []).map((h: any) => h.text).filter(Boolean);
  const bad: [number, string[]][] = []; let maxLines = 0; const frames = Math.floor(d.duration * fps);
  for (let f = 0; f < frames; f++) {
    const t = f / fps, texts: string[] = [];
    if (t < freeze || !a.hideLyricsAtStop) texts.push(...L.filter((l: any, i: number) => t >= l.start && t < holdOf(L, i) && !motionEdited(l)).sort((x: any, y: any) => y.start - x.start).slice(0, 1).map((l: any) => strip(l.text)));
    texts.push(...L.filter((l: any) => motionEdited(l) && l.start <= t && t < l.end).map((l: any) => l.text));
    texts.push(...(a.hits ?? []).filter((h: any) => h.text && h.t <= t && t < h.t + 0.7).map((h: any) => h.text));
    if (a.callBubbles !== false && a.bubbles !== false) for (const l of L) { const m = /[（(]([^）)]+)[）)]/.exec(l.text); if (m && l.start <= t && t < l.end) texts.push(m[1]); }
    const ln = texts.filter(Boolean); maxLines = Math.max(maxLines, ln.filter((x) => !hitTexts.includes(x)).length);
    if (ln.length !== new Set(ln).size) bad.push([+t.toFixed(3), ln]);
  }
  return { frames, duplicates: bad.length, first: bad.slice(0, 5), maxLyricLinesPerFrame: maxLines };
}

/** the inputs the renderer uses for a line's box: cut-merged stage hwLyrics (place/side) + the line's own editor position edits */
export function placementCheck(d: any) {
  const base = stageOf(d), fps = d.fps ?? 24, L = d.lyrics, S = d.scenes;
  const merged = (sc: any) => { const m = JSON.parse(JSON.stringify(base)); for (const [k, v] of Object.entries(sc?.stage ?? {})) m[k] = v && typeof v === "object" && !Array.isArray(v) && m[k] && typeof m[k] === "object" ? { ...m[k], ...v } : v; return m; };
  const key = (st: any, l: any, i: number) => { const c = { side: i % 2 ? "r" : "l", ...(st.hwLyrics?.[l.id] ?? {}) }, place = c.place ?? "side", ed = l.edited ?? [];
    return JSON.stringify([l.stageStyle ?? null, place, place === "side" ? c.side : null, ed.includes("x") ? l.x : null, ed.includes("y") ? l.y : null, ed.includes("position") ? l.position : null, ed.includes("scale") ? l.scale : null]); };
  const bad: { id: string; keys: string[] }[] = []; let spanning = 0;
  L.forEach((l: any, i: number) => {
    const keys = new Set<string>(), cuts: string[] = [];
    for (let f = Math.floor(l.start * fps); f < Math.floor(Math.min(holdOf(L, i), d.duration) * fps); f++) {
      const t = f / fps, sc = S.find((s: any, j: number) => s.start <= t && t < (s.end ?? S[j + 1]?.start ?? Infinity)) ?? S.at(-1);
      keys.add(key(merged(sc), l, i)); if (cuts.at(-1) !== sc?.id) cuts.push(sc?.id);
    }
    if (cuts.length > 1) spanning++; if (keys.size > 1) bad.push({ id: l.id, keys: [...keys] });
  });
  return { lines: L.length, linesSpanningCuts: spanning, positionChangesMidLine: bad.length, bad };
}

if (process.argv[1] && /lyric_checks\.ts$/.test(process.argv[1])) {
  const a = process.argv.slice(2), opt = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const file = opt("--state") ?? (opt("--project") ? path.resolve(path.dirname(process.argv[1]), "../../projects", opt("--project")!, "out/editor/editor-state.json") : "");
  if (!file || !fs.existsSync(file)) { console.error("使い方: npm run check:lyrics -- --project <名前>（または --state <editor-state.json>）"); process.exit(2); }
  const d = JSON.parse(fs.readFileSync(file, "utf8")).data, dup = dupCheck(d), pos = placementCheck(d);
  console.log(JSON.stringify({ dup, pos }, null, 1));
  console.log(dup.duplicates === 0 && dup.maxLyricLinesPerFrame <= 1 && pos.positionChangesMidLine === 0 ? "OK: 重複 0 / 1フレーム最大1行 / 行の途中で位置が変わる行 0" : "NG: 上の bad / first を確認してください");
  process.exit(dup.duplicates === 0 && pos.positionChangesMidLine === 0 ? 0 : 1);
}
