// Still-image generation plan for songs without input images (taste = アニメ / 実写風 / イラスト).
// Order: character sheet -> one background per section type -> one key image per scene (count driven by density).
// Pure + deterministic: no network, no paid calls. The paid route (npm run gen -- stills run) needs --confirm.
import type { Song } from "./types";

export const STILL_TASTES = ["anime", "photo", "illust"] as const;
export const needsStills = (taste: string | undefined, nImages: number) => nImages === 0 && !!taste && (STILL_TASTES as readonly string[]).includes(taste);
export const TASTE_JA: Record<string, string> = { anime: "アニメ調", photo: "実写風", illust: "イラスト調" };
const TASTE_PROMPT: Record<string, string> = { anime: "Japanese anime style key visual, clean cel shading, detailed background art", photo: "photorealistic cinematic film still, 35mm, natural light", illust: "soft painted illustration, watercolor texture, picture-book look" };
const SEC_JA: Record<string, string> = { intro: "イントロ", verse: "Aメロ", pre_chorus: "Bメロ", chorus: "サビ", bridge: "Cメロ", outro: "アウトロ", other: "間奏" };
const SEC_MOOD: Record<string, string> = { intro: "quiet, mysterious opening", verse: "everyday, intimate, calm", pre_chorus: "rising tension", chorus: "explosive, vivid, emotional peak", bridge: "dreamlike, reflective", outro: "afterglow, fading", other: "atmospheric" };
const SEC_BG: Record<string, string> = { intro: "empty city street at dawn", verse: "the singer's everyday room and neighborhood", pre_chorus: "rooftop at dusk, wind", chorus: "dramatic stage-like cityscape at night, strong backlight", bridge: "surreal dreamscape, floating light", outro: "quiet empty street after rain", other: "atmospheric abstract space" };
/** seconds per scene image by density (slow = fewer, longer images). */
export const SEC_PER_IMAGE = { slow: 12, normal: 7, fast: 4 } as const;

export interface StillTask { id: string; kind: "character" | "background" | "scene"; file: string; title: string; prompt: string; refs: string[]; section?: string; start?: number; end?: number; lyric?: string }
export interface ImageModel { id: string; provider: string; kind: string; price_per_image: number | null; verified?: boolean; deprecated?: boolean; input_extra?: string }
export interface StillsPlan { taste: string; density: string; counts: { character: number; background: number; scene: number; total: number }; tasks: StillTask[]; costs: { id: string; label: string; usd: number | null; each: number | null; free: boolean; note: string }[]; recommended: string }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function planStills(song: Song, o: { taste: string; density?: string; character?: string; models?: ImageModel[] }): StillsPlan {
  const taste = o.taste, dens = (o.density ?? "normal") as keyof typeof SEC_PER_IMAGE, per = SEC_PER_IMAGE[dens] ?? 7;
  const secs = song.sections.length ? song.sections : [{ label: "全体", type: "other" as const, start: 0, end: song.duration }];
  const style = TASTE_PROMPT[taste] ?? TASTE_PROMPT.anime;
  const who = o.character ?? "the same young singer (consistent face, hairstyle and outfit in every image)";
  const tasks: StillTask[] = [];
  tasks.push({ id: "character", kind: "character", file: "character_sheet.png", title: "キャラクターシート（正面・横・後ろ・表情）", prompt: `${style}. character reference sheet of ${who}: full body front, side and back views plus 4 facial expressions (smile, sad, singing, determined), plain light-grey background, even lighting. no text, no watermark`, refs: [] });
  const types = [...new Set(secs.map((s) => s.type))];
  for (const t of types) tasks.push({ id: `bg_${t}`, kind: "background", file: `bg_${t}.png`, title: `背景: ${SEC_JA[t] ?? t}`, prompt: `${style}. background art, no people: ${SEC_BG[t] ?? SEC_BG.other}, mood: ${SEC_MOOD[t] ?? SEC_MOOD.other}. 16:9, no text, no watermark`, refs: [] });
  // scenes: proportional to section length, at least one per section
  const total = Math.max(secs.length, Math.min(60, Math.round(song.duration / per)));
  const alloc = secs.map((s) => Math.max(1, Math.round(((s.end - s.start) / song.duration) * total)));
  let n = 0;
  secs.forEach((s, si) => {
    const k = alloc[si], len = (s.end - s.start) / k;
    for (let j = 0; j < k; j++) {
      n++; const a = s.start + j * len, b = a + len;
      const lyric = song.lines.filter((L) => L.start < b && L.end > a).map((L) => L.text).join(" / ").slice(0, 80);
      tasks.push({ id: `scene_${String(n).padStart(3, "0")}`, kind: "scene", file: `scene_${String(n).padStart(3, "0")}.png`, title: `シーン${n}（${SEC_JA[s.type] ?? s.label} ${fmt(a)}〜）`, section: s.type, start: +a.toFixed(2), end: +b.toFixed(2), lyric,
        prompt: `${style}. ${who} in ${SEC_BG[s.type] ?? SEC_BG.other}, mood: ${SEC_MOOD[s.type] ?? SEC_MOOD.other}${lyric ? `, the scene visualizes the lyric "${lyric}"` : ""}. 16:9 cinematic composition, leave the lower third calm for lyrics. no text, no watermark`,
        refs: ["character_sheet.png", `bg_${s.type}.png`] });
    }
  });
  const counts = { character: 1, background: types.length, scene: n, total: 1 + types.length + n };
  const img = (o.models ?? []).filter((m) => m.kind === "image" && !m.deprecated && !/^local\//.test(m.id));
  const costs = [
    { id: "manual", label: "無料: Grok アプリ / grok.com などで手動生成", usd: 0, each: 0, free: true, note: "stills_prompts.csv のプロンプトを1枚ずつコピペ。無料枠の枚数・条件は各サービスで変わります（上限を超えたら翌日に続きを）" },
    { id: "local/sd", label: "無料: 自分のPCの Stable Diffusion（ComfyUI など）", usd: 0, each: 0, free: true, note: "GPU のあるPC向け。API料金ゼロ" },
    ...img.map((m) => ({ id: m.id, label: `有料API: ${m.provider}（${m.id}）`, usd: m.price_per_image == null ? null : +(m.price_per_image * counts.total).toFixed(2), each: m.price_per_image, free: false, note: m.price_per_image == null ? "料金が未確認のため合計に入れません" : `1枚 $${m.price_per_image}${m.input_extra ? "・" + m.input_extra : ""}` })),
  ];
  return { taste, density: dens, counts, tasks, costs, recommended: "manual" };
}

export function stillsMd(p: StillsPlan, song: string): string {
  const c = p.counts, paid = p.costs.filter((x) => !x.free && x.usd != null);
  return [`# 🖼 静止画の生成プラン — ${song}`, "",
    `**作る画像: 合計 ${c.total} 枚**（キャラクターシート ${c.character} 枚 → 背景 ${c.background} 枚 → シーン画像 ${c.scene} 枚）／テイスト: ${TASTE_JA[p.taste] ?? p.taste}／シーンの細かさ: ${({ slow: "ゆったり", normal: "標準", fast: "テンポよく" } as any)[p.density]}`, "",
    `**おすすめの方法: 無料（Grok アプリ / grok.com で手動生成）→ 費用 0円**`, "",
    "## 方法と費用（合計）", "| 方法 | 1枚 | 合計 | メモ |", "|---|---|---|---|",
    ...p.costs.map((x) => `| ${x.label} | ${x.each == null ? "未確認" : x.each === 0 ? "0円" : "$" + x.each} | ${x.usd == null ? "未確認" : x.usd === 0 ? "**0円**" : "**$" + x.usd + "**"} | ${x.note} |`), "",
    ...(paid.length ? [`有料APIで作る場合は、金額を確認したうえで \`npm run gen -- stills run --image <方法のID> --confirm <合計金額>\` を実行します（金額が一致しないと実行しません）。`, ""] : []),
    "## 無料で作る手順", "1. `stills_prompts.csv` を開き、上から順にプロンプトを Grok アプリ / grok.com に貼って画像を作る（キャラクターシート → 背景 → シーン）",
    "2. シーン画像を作るときは、キャラクターシートと背景の画像も一緒に添付すると、顔や服がそろいます",
    "3. できた画像を `gen/stills/<曲名>/` に、表のファイル名（例 scene_001.png）で保存（名前が違っても、作った順に並べればOK）",
    "4. `npm run gen -- stills import` で取り込み → `npm run mv` で画像を使ったMVになります", "",
    "## 画像リスト（この順で作ってください）", "| ファイル名 | 内容 | 歌詞 |", "|---|---|---|",
    ...p.tasks.map((t) => `| ${t.file} | ${t.title} | ${t.lyric ?? ""} |`), ""].join("\n");
}
export const stillsCsv = (p: StillsPlan) => "\uFEFF順番,ファイル名,内容,添付する画像,プロンプト\n" + p.tasks.map((t, i) => [i + 1, t.file, t.title, t.refs.join(" + "), `"${t.prompt.replace(/"/g, '""')}"`].join(",")).join("\n");
