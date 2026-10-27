import { CAMERA_MOVES, EFFECT_FX, STRENGTH, SYNC } from "../render/SceneFx";
import { parseRestore, restoreCut } from "./lipsync";
import { parsePlanTier } from "./estimate";
import PLANS_JSON from "./plans.gen.json";
export const planTierFromText = (t: string) => /(プラン|API|従量|クレジット)/i.test(t) ? parsePlanTier(t, PLANS_JSON as any) : null;
// Japanese natural-language instructions -> mv.config.json edits (deterministic, testable).
import type { MVConfig } from "./config";
import type { PuppetCfg, VisualFx } from "./types";
import { presetFromText, PRESETS } from "./presets";
import { CATALOG } from "./catalog";
import { fontFromText, FONT_REG } from "./fonts";
import { GENRES, genreFromText } from "./genres";
import { HYBRIDS, hybridFromText } from "./hybrids";
import { SHOW_MODES, TRANSITIONS_JA, comboFromText, composeCombo } from "./mograph";
import { PALETTES } from "./pro";
import { PARTS_PRESETS, partsPresetFromText } from "./rig";

export const JA_STYLE_WORDS: [RegExp, string][] = [
  [/スマッシュ/, "pro_smash"], [/ストレッチ|横に伸び/, "pro_stretch"], [/線から(出|引)|ライン(から|で)出/, "pro_line"], [/ボックス|箱が(縮|消)/, "pro_box"],
  [/斜めマスク|斜めに切/, "pro_diag"], [/ラベル|帯に乗/, "pro_label"], [/短冊/, "pro_tanzaku"], [/縦の柱|柱みたい/, "pro_pillar"], [/切れ文字|はみ出す(巨大)?文字/, "pro_crop"],
  [/マスク(で)?スライド|プロっぽい(文字|動き)/, "pro_slide"], [/バネ|ぽよん|色ブロック/, "pro_pop"],
  [/桜吹雪|花びら(みたい|のよう)|舞い落ち/, "sakura_fall"], [/スポットライト|照らされ|光の輪/, "spotlight"],
  [/キネティック|激しい文字|叩きつけ/, "kinetic"], [/シンプル|普通の(字幕|テロップ|文字)|従来/, "simple"], [/映画字幕|字幕風|映画風/, "simple:film"],
  [/おまかせ|お任せ|自動|オート/i, "auto"], [/タイプライター|タイピング|打ち込み/, "typewriter"], [/手書き|筆記|ペン/, "handwriting"],
  [/輪郭|アウトライン|線描|ストローク/, "outline_fill"], [/グリッチ|バグ/, "glitch"], [/ネオン/, "neon"], [/粉々|砕け散|ガラスみたいに割/, "shatter"],
  [/散らば|散って集/, "scatter"], [/縦書き|たてがき/, "tategaki"], [/押し出し|厚み|立体文字/, "extrude3d"], [/奥から|飛んでく|フライイン/, "fly3d"],
  [/フリップ|めくれ|カードみたい|くるっと/, "flip3d"], [/粒子|パーティクル/, "particles"], [/残像|トレイル|色ずれ/, "chromatic_trail"],
  [/カラオケ/, "karaoke"], [/ウェーブ|うねうね|波打つ文字/, "wave"], [/ゼリー|ぷるぷる|ぷるん/, "jelly"], [/ハンコ|はんこ|判子|スタンプ|落款/, "stamp"],
  [/ワイプ/, "mask_wipe"], [/上下に(割|分か)|割れて出/, "split_reveal"], [/ぼかし|ブラー|ピント/, "blur_in"], [/ポップ|ポンッ/, "scale_pop"],
  [/円形|円周|ぐるぐる/, "circular"], [/電光掲示|ティッカー|流れる帯/, "ticker"], [/コラージュ|切り抜き/, "collage"], [/バースト|星がはじけ/, "burst"],
  [/積み上げ|スタック/, "word_stack"], [/文字の雨|レイン/, "letter_rain"], [/ダイアログ|ウィンドウ|ポップアップ/, "ui_window"],
  [/ふわっと|フェード/, "reveal"], [/バウンス|跳ね|弾んで/, "bounce"],
];
const EFFECT_WORDS: [RegExp, string][] = [
  [/割れ|ひび|ヒビ|砕け|壊れ/, "crack"], [/溶け|とろけ|垂れ|ドロ/, "melt"], [/光|輝|キラ/, "glow"], [/震え|ガタガタ|シェイク/, "shake"],
  [/火花|パチパチ|はじけ/, "sparks"], [/ハート/, "heart"], [/ゆらゆら|揺れ/, "wave"], [/ぼや|夢み/, "blur"], [/赤く|毒々|赤に/, "red"], [/なし|無し|消して|やめ/, ""],
];
const SECTION_WORDS: [RegExp, string][] = [
  [/ラスサビ|最後のサビ/, "chorus#last"], [/サビ/, "chorus"], [/Aメロ/i, "verse"], [/Bメロ|プレサビ/i, "pre_chorus"], [/Cメロ|間奏|ブリッジ/, "bridge"],
  [/イントロ/, "intro"], [/アウトロ|エンディング|最後/, "outro"],
];
const KANSUJI: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
const num = (s: string) => (KANSUJI[s] ?? Number(s.normalize("NFKC")));

/** section key: "chorus" | "verse#2" (2番のAメロ) | label */
export function sectionKey(t: string): string | null {
  const ban = t.match(/([0-9０-９一二三四五]+)\s*番(目)?の?/);
  for (const [re, type] of SECTION_WORDS) if (re.test(t)) {
    if (type === "chorus#last") return type;
    return ban ? `${type}#${num(ban[1])}` : type;
  }
  return null;
}
const styleOf = (t: string) => { for (const [re, s] of JA_STYLE_WORDS) if (re.test(t)) return s; for (const n of Object.keys(CATALOG)) if (new RegExp(`\\b${n}\\b`).test(t)) return n; return null; };
const specOf = (s: string) => (s === "simple:film" ? { style: "simple", variant: "film" } : s);
const secNum = (t: string) => { const m = t.normalize("NFKC").match(/(-?\d+(?:\.\d+)?)\s*(秒|s)/); return m ? +m[1] : null; };

export function applyInstruction(cfg0: MVConfig, text: string): { cfg: MVConfig; changes: string[] } {
  const cfg: MVConfig = JSON.parse(JSON.stringify(cfg0 ?? {}));
  const changes: string[] = [];
  const parts = text.normalize("NFKC").split(/[。\n]|、(?=.*(で|に|して))/).map((s) => s?.trim()).filter(Boolean) as string[];
  for (const t of parts.length ? parts : [text]) {
    const T = (cfg.timing ??= {});
    { const r = parseRestore(t); if (r) { const x = restoreCut(cfg, r); Object.assign(cfg, x.cfg); changes.push(...x.changes); continue; } }
    { const r = camFxFromText(cfg, t); if (r) { changes.push(r); continue; } }
    // ---- plan tier: 「KlingはProプラン」「RunwayはAPI」「Klingの残り1200クレジット」 ----
    { const pt = planTierFromText(t); if (pt) { const G = (cfg.gen ??= {}); G.plans ??= {}; const cur = G.plans[pt.provider]; const prev = typeof cur === "string" ? { plan: cur } : cur ?? { plan: "api" };
      const nv = { plan: pt.plan ?? prev.plan, ...(pt.remaining != null ? { remaining: pt.remaining } : (prev as any).remaining != null ? { remaining: (prev as any).remaining } : {}) };
      G.plans[pt.provider] = nv.remaining == null ? nv.plan : nv; changes.push(`料金プラン: ${pt.provider} → ${nv.plan === "api" ? "API従量課金" : nv.plan + "プラン"}${nv.remaining != null ? `（残り ${nv.remaining} クレジット）` : ""}`); continue; } }
    // ---- pro direction: reroll / variety / hybrid structure / critic ----
    if (/別(の)?パターン|別案|やり直し.*(リリック|文字|歌詞)|リロール/.test(t)) { const L = (cfg.lyrics ??= {}); L.seed = (L.seed ?? 1) + 1; changes.push(`文字の動きを別パターンに（seed ${L.seed}。曲に合う候補の中から選び直し）`); continue; }
    if (/(リリック|歌詞|文字).*(統一感|統一|揃え)/.test(t)) { (cfg.lyrics ??= {}).variety = 0.15; changes.push("リリックは統一感重視（セクションごとに1種類・同じセクションは同じ動き）"); continue; }
    if (/(リリック|歌詞|文字).*(変化多め|変化を?多く|バラエティ|色々)/.test(t)) { (cfg.lyrics ??= {}).variety = 0.9; changes.push("リリックは変化多め（曲に合う範囲で、セクションごとに2〜3種類）"); continue; }
    if (/構成(を|は)?(自動|おまかせ)/.test(t)) { cfg.structure = "auto"; changes.push("構成 → 曲と素材に合わせて自動"); continue; }
    if (/構成(なし|を?使わない)|ハイブリッド(なし|をやめ)/.test(t)) { cfg.structure = "none"; changes.push("構成テンプレート → なし"); continue; }
    // ---- parts animation: 「腕を振って」「首をかしげて」「サビはノリノリで」 ----
    { const pp = partsPresetFromText(t); if (pp && /キャラ|腕|手|首|うなず|頷|ノリ|踊って|揺れて|歌って|待機|かしげ|傾げ/.test(t)) { const P = (cfg.parts ??= {}); const k = sectionKey(t);
      if (k) { const cur = typeof P.preset === "object" ? P.preset : P.preset ? { all: P.preset } : {}; P.preset = { ...cur, [k]: pp }; delete (P.preset as any).all; } else P.preset = pp;
      changes.push(`キャラの動き${k ? `（${k}）` : ""} → ${PARTS_PRESETS[pp].ja}（${PARTS_PRESETS[pp].why}）${P.rig || P.rigData ? "" : "　※パーツ素材が未登録です: npm run parts で取り込み"}`); continue; } }
    { const m = t.match(/画像は?(アニメ|実写|イラスト|図形|手持ち)/); if (m) { cfg.taste = ({ アニメ: "anime", 実写: "photo", イラスト: "illust", 図形: "graphic", 手持ち: "own" } as const)[m[1] as "アニメ"]; changes.push(`画像テイスト → ${m[1]}`); continue; } }
    { const m = t.match(/動画化は?(静止画のみ|しない|なし|サビ(だけ|など)?|一部|全部)/); if (m) { const G = (cfg.gen ??= {}); G.scope = /静止画|しない|なし/.test(m[1]) ? "none" : /全部/.test(m[1]) ? "all" : "chorus"; changes.push(`動画化 → ${G.scope === "none" ? "静止画のみ（0円）" : G.scope === "all" ? "全部（npm run gen -- plan で費用を確認してから）" : "サビなど一部（npm run gen -- plan で費用を確認してから）"}`); continue; } }
    // ---- show modes, combinable: 「ダンス＋リリックモーションで」「物語＋タイポグラフィ」「リップシンク＋モーショングラフィックス」 ----
    { const cm = comboFromText(t); if (cm) { cfg.combo = cm; cfg.structure = "auto"; const c = composeCombo(cm); changes.push(`見せ方 → ${cm.map((m) => SHOW_MODES[m].ja).join("＋")}（セクションごとの配分: ${c.notes.join("｜")}）`); continue; } }
    if (/(プロ演出|モーショングラフィックス|図形演出)(を)?(オフ|なし|使わない|やめ)/.test(t)) { (cfg.mograph ??= {}).off = true; changes.push("図形・トランジション演出 → オフ（文字のプロ動きは残す）"); continue; }
    if (/(従来|昔|前)の(見た目|動き)に戻|プロ(モード)?(オフ|なし)/.test(t)) { cfg.pro = false; changes.push("プロ演出 → オフ（従来の見た目）"); continue; }
    if (/シーン|カット|場面/.test(t) && /(ゆったり|少なめ|長め|ゆっくり)/.test(t)) { cfg.density = "slow"; changes.push("シーンの細かさ → ゆったり（カット長め）"); continue; }
    if (/シーン|カット|場面/.test(t) && /(テンポよく|多め|細かく|速く|刻)/.test(t)) { cfg.density = "fast"; changes.push("シーンの細かさ → テンポよく（カット短め）"); continue; }
    { const tr = (Object.entries({ circle: /円(で|の)?(トランジション|転換|ワイプ)/, ripple: /波紋/, cloud: /雲(みたい|の)?(ワイプ|トランジション)/, glyph_zoom: /文字の中に(ズーム|入)/, push_text: /巨大(な)?文字(で|が)?押/, diag_sweep: /斜め(線|の線)?(スイープ|ワイプ)/, rect: /四角(で|の)?(トランジション|ワイプ)/ }) as [string, RegExp][]).find(([, re]) => re.test(t));
      if (tr) { (cfg.mograph ??= {}).transition = tr[0] as any; changes.push(`場面転換 → ${TRANSITIONS_JA[tr[0] as keyof typeof TRANSITIONS_JA]}`); continue; } }
    { const pl = (Object.entries({ mono_red: /白黒(と|＋|\+)?赤/, neon: /ネオン(カラー|色)/, pop: /ポップ(な)?(色|カラー)/, paper_red: /紙(と|＋)?朱|和紙/, dusk: /夕暮れ(色)?/, acid: /蛍光(色|イエロー)/ }) as [string, RegExp][]).find(([, re]) => re.test(t));
      if (pl && /色|カラー|配色|パレット/.test(t)) { (cfg.mograph ??= {}).palette = pl[0]; changes.push(`配色 → ${PALETTES[pl[0]].ja}（3〜4色に絞る）`); continue; } }
    { const hid = hybridFromText(t); if (hid) { cfg.structure = hid; const h = HYBRIDS[hid]; changes.push(`構成 → ${h.ja}（${h.why}）`); continue; } }
    if (/(プロ|ディレクター)?(チェック|批評|添削)(なし|しない|オフ)/.test(t)) { cfg.critic = false; changes.push("プロチェック → オフ"); continue; }
    // ---- typeface (書体): song / section / line / keyword ----
    {
      const fid = fontFromText(t);
      const fontish = /字|文字|書体|フォント|明朝|ゴシック|筆|体で|体に/.test(t) || FONT_REG.some((f) => t.includes(f.family) || t.includes(f.id));
      const reset = /(書体|フォント)(を)?(元に|戻|リセット|なし)/.test(t);
      if ((fid && fontish) || reset) {
        const L = (cfg.lyrics ??= {});
        const kwM = t.match(/[「『](.+?)[」』](?!の行)/), lineM = t.match(/(\d+)\s*行目/), fragM = t.match(/[「『](.+?)[」』]\s*の行/), k = sectionKey(t);
        const label = fid ? `${FONT_REG.find((f) => f.id === fid)!.family}（${FONT_REG.find((f) => f.id === fid)!.category}）` : "元の書体";
        if (reset) { delete L.font; delete L.fontSections; delete L.fontLines; delete L.fontKeywords; changes.push("書体 → 元に戻す（スタイルごとの書体）"); continue; }
        if (fragM) { (L.fontLines ??= {})[fragM[1]] = fid!; changes.push(`「${fragM[1]}」の行の書体 → ${label}`); }
        else if (lineM) { (L.fontLines ??= {})[String(+lineM[1] - 1)] = fid!; changes.push(`${lineM[1]}行目の書体 → ${label}`); }
        else if (kwM && !sectionKey(kwM[1])) { (L.fontKeywords ??= {})[kwM[1]] = fid!; changes.push(`「${kwM[1]}」の書体 → ${label}`); }
        else if (k) { (L.fontSections ??= {})[k] = fid!; changes.push(`${k} の書体 → ${label}`); }
        else { L.font = fid!; changes.push(`全体の書体 → ${label}`); }
        continue;
      }
    }
    // ---- genre recipe (styles + fonts + colours) ----
    {
      const gid = genreFromText(t);
      if (/ジャンル(を|は)?(自動|おまかせ)/.test(t)) { cfg.genre = "auto"; changes.push("ジャンル → 自動判定"); continue; }
      if (/ジャンル(なし|を?使わない)/.test(t)) { cfg.genre = "none"; changes.push("ジャンル演出 → なし"); continue; }
      if (gid && /ジャンル|っぽく|風に|風で|系|らしく|にして|で作/.test(t) && !/字|文字|書体|フォント/.test(t)) { cfg.genre = gid; changes.push(`ジャンル → ${GENRES[gid].ja}（${GENRES[gid].why}）`); continue; }
    }
    // ---- puppet (目パチ / 口パク / 呼吸 / 髪揺れ / ノリ) : global, per section, per shot ----
    {
      const PUP: [RegExp, keyof PuppetCfg][] = [[/目パチ|まばたき|瞬き/, "blink"], [/口パク|口の動き|リップ(?!シンク)/, "mouth"], [/呼吸|息づかい/, "breath"], [/髪(の毛)?(が|を)?(揺|なび|ゆら)|髪揺れ/, "hair"], [/ノリ|横揺れ|体(を|が)?揺/, "sway"], [/バウンド|体(を|が)?(跳|弾)|上下に弾/, "bounce"]];
      const hits = PUP.filter(([re]) => re.test(t));
      const allOff = /(キャラ|人物|顔)(を|は)?動かさない|パペット(なし|オフ)/.test(t);
      if (hits.length || allOff) {
        const v = /なし|無し|止め|オフ|しない|消して|動かさない/.test(t) ? 0 : /弱|控えめ|少な|ちょっと|少し/.test(t) ? 0.5 : /強|多め|激し|大きく|しっかり/.test(t) ? 1.6 : 1;
        const keys: (keyof PuppetCfg)[] = allOff ? ["blink", "mouth", "breath", "hair", "sway", "bounce"] : hits.map((h) => h[1]);
        const shotM = t.match(/S\d{3}/i), k = sectionKey(t);
        const patch = Object.fromEntries(keys.map((x) => [x, v]));
        let where = "全体";
        if (shotM) { const id = shotM[0].toUpperCase(); T.perShot ??= {}; T.perShot[id] = { ...(T.perShot[id] ?? {}), puppet: { ...(T.perShot[id]?.puppet ?? {}), ...patch } }; where = id; }
        else if (k) { cfg.puppetSections ??= {}; cfg.puppetSections[k] = { ...(cfg.puppetSections[k] ?? {}), ...patch }; where = k; }
        else cfg.puppet = { ...(cfg.puppet ?? {}), ...patch };
        const JA: Record<string, string> = { blink: "目パチ", mouth: "口パク", breath: "呼吸", hair: "髪揺れ", sway: "ノリ(横揺れ)", bounce: "バウンド" };
        changes.push(`${where} の ${keys.map((x) => JA[x]).join("・")} → ${v}`);
        continue;
      }
    }
    // ---- audio-reactive visuals (TouchDesigner-style, native) ----
    if (/タッチデザイナー|touch\s*designer|td風/i.test(t)) { cfg.visuals = { ...(cfg.visuals ?? {}), bg: "flow", bgOpacity: 0.4, spectrum: "ring", audioParticles: 0.6, trails: 0.6 }; changes.push("TouchDesigner風: 音に反応する背景(flow)・円形スペクトラム・粒子・フィードバック残像"); continue; }
    {
      const bgM: [RegExp, NonNullable<VisualFx["bg"]>][] = [[/プラズマ/, "plasma"], [/トンネル/, "tunnel"], [/波紋|リング/, "rings"], [/フロー|流体|流れる背景/, "flow"]];
      const b = bgM.find(([re]) => re.test(t));
      if (b && /背景|映像|画面|ジェネ|重ね/.test(t)) { cfg.visuals = { ...(cfg.visuals ?? {}), bg: /なし|消/.test(t) ? "none" : b[1], ...(/重ね|うっすら|薄く/.test(t) ? { bgOpacity: 0.3 } : {}) }; changes.push(`音に反応する背景 → ${cfg.visuals.bg}`); continue; }
      if (/(生成|ジェネ|音に反応する)背景/.test(t) && /なし|消/.test(t)) { cfg.visuals = { ...(cfg.visuals ?? {}), bg: "none" }; changes.push("音に反応する背景 → なし"); continue; }
      if (/スペクトラム|スペアナ|イコライザ|オーディオビジュアライザ|音の(波形|バー)/.test(t)) { const sp = /なし|消/.test(t) ? "none" : /円|リング|丸/.test(t) ? "ring" : /波形|線/.test(t) ? "wave" : "bars"; cfg.visuals = { ...(cfg.visuals ?? {}), spectrum: sp as any }; changes.push(`スペクトラム → ${sp}`); continue; }
      if (/音に(反応|合わせ)/.test(t) && /粒子|パーティクル|火花/.test(t)) { cfg.visuals = { ...(cfg.visuals ?? {}), audioParticles: /なし|消/.test(t) ? 0 : /多|強/.test(t) ? 1 : 0.6 }; changes.push(`音に反応する粒子 → ${cfg.visuals.audioParticles}`); continue; }
      if (/フィードバック|残像(を|が)?(映像|画面|背景)|映像(に|の)残像|トレイル/.test(t) && !/文字|歌詞/.test(t)) { cfg.visuals = { ...(cfg.visuals ?? {}), trails: /なし|消/.test(t) ? 0 : /強|多/.test(t) ? 1 : 0.5 }; changes.push(`フィードバック残像 → ${cfg.visuals.trails}`); continue; }
    }
    // ---- finishing (inside Remotion) ----
    {
      const off = /なし|無し|消して|やめ|オフ/.test(t), lvl = off ? 0 : /弱|控えめ|少し|うっすら/.test(t) ? 0.4 : /強|多め|しっかり/.test(t) ? 1.2 : 0.8;
      if (/シネスコ|シネマスコープ|黒帯|レターボックス|映画(みたいな|っぽい)画面/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), letterbox: off ? 0 : 1 }; changes.push(`黒帯（シネスコ） → ${off ? "なし" : "2.39:1"}`); continue; }
      if (/グロー|発光|ブルーム|輝き/.test(t) && !/文字|歌詞/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), glow: lvl }; changes.push(`グロー → ${lvl}`); continue; }
      if (/ハレーション/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), halation: lvl }; changes.push(`ハレーション → ${lvl}`); continue; }
      if (/フィルム(調|っぽ|風)|粒状感|グレイン|ノイズ感/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), grain: off ? 0 : 0.1 * (lvl / 0.8), ...(off ? {} : { halation: 0.35 }) }; changes.push(`フィルム調（粒子＋ハレーション） → ${off ? "なし" : "あり"}`); continue; }
      if (/ビネット|周辺減光|周りを暗く/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), vignette: off ? 0 : lvl * 0.6 }; changes.push(`周辺減光 → ${cfg.finish.vignette}`); continue; }
      if (/色収差/.test(t)) { cfg.finish = { ...(cfg.finish ?? {}), chroma: lvl }; changes.push(`色収差 → ${lvl}`); continue; }
    }
    // ---- speed ramps ----
    if (/スピードランプ|緩急|スロー(モーション)?|加速|速度変化/.test(t) && !/歌詞|文字/.test(t)) {
      const r = /なし|無し|やめ/.test(t) ? "none" : /スロー/.test(t) && !/ランプ/.test(t) ? "out" : /加速/.test(t) ? "in" : /なめらか|滑らか|ゆるやか/.test(t) ? "smooth" : "punch";
      const shotM = t.match(/S\d{3}/i), k = sectionKey(t);
      if (shotM) { const id = shotM[0].toUpperCase(); T.perShot ??= {}; T.perShot[id] = { ...(T.perShot[id] ?? {}), ramp: r }; }
      else { cfg.ramps ??= {}; cfg.ramps[k ?? "all"] = r; }
      changes.push(`${shotM?.[0].toUpperCase() ?? k ?? "全体"} のスピードランプ → ${r}`);
      continue;
    }
    // preset / aspect / quality
    const pr = /風|プリセット|ジャンル|っぽく|スタイルで/.test(t) || /ファーストテイク|一発撮り|ボカロ|ダンスMV|ライブ風|リップシンク|ストーリー/.test(t) ? presetFromText(t) : null;
    if (pr) { cfg.preset = pr; changes.push(`プリセット → ${PRESETS[pr].ja}`); continue; }
    if (/縦型|縦長|ショート|tiktok|リール|9:16/i.test(t) && !/ハイライト/.test(t)) { cfg.aspect = "9:16"; changes.push("画面比 → 9:16（縦型）"); continue; }
    if (/正方形|1:1|スクエア/i.test(t)) { cfg.aspect = "1:1"; changes.push("画面比 → 1:1"); continue; }
    if (/4:5|インスタ/i.test(t)) { cfg.aspect = "4:5"; changes.push("画面比 → 4:5"); continue; }
    if (/横長|16:9|youtube/i.test(t)) { cfg.aspect = "16:9"; changes.push("画面比 → 16:9"); continue; }
    if (/全部の比率|全比率|全サイズ/.test(t)) { cfg.aspects = ["16:9", "9:16", "1:1", "4:5"]; changes.push("全比率を書き出し"); continue; }
    if (/ハイライト/.test(t)) { cfg.highlight = true; changes.push("9:16 サビハイライトも書き出し"); continue; }
    if (/4k/i.test(t)) { cfg.scale = 2; changes.push("解像度 → 4K"); continue; }
    // timing
    let sec = secNum(t);
    if (sec === null && /歌詞|文字|テロップ/.test(t) && /(早|遅)(く|め)/.test(t) && !/拍/.test(t)) sec = 0.2; // 「少し早く」= 0.2s
    if (/拍|ビート|グリッド/.test(t) && /ずら/.test(t) && !/\d+(\.\d+)?\s*秒/.test(t)) {
      const b = /半拍/.test(t) ? 0.5 : /1\/4|4分の1/.test(t) ? 0.25 : (t.match(/(\d+(?:\.\d+)?)\s*拍/)?.[1] ? +t.match(/(\d+(?:\.\d+)?)\s*拍/)![1] : 0.5);
      T.beatShiftBeats = /前|早|戻/.test(t) ? -b : b; T.locked = [...new Set([...(T.locked ?? []), "beatShift"])]; changes.push(`拍グリッドを ${T.beatShiftBeats}拍ずらす`); continue;
    }
    if (/bpm/i.test(t)) { const m = t.match(/(\d+(?:\.\d+)?)/); if (m) { T.bpm = +m[1]; T.locked = [...new Set([...(T.locked ?? []), "bpm"])]; changes.push(`BPM → ${T.bpm}（手動固定）`); continue; } }
    if (sec !== null && /(画|カット|切り替)/.test(t)) {
      const v = /遅|後/.test(t) && !/前/.test(t) ? -Math.abs(sec) : Math.abs(sec);
      const k = sectionKey(t);
      if (k) { (T.perSection ??= {})[k] = { ...(T.perSection[k] ?? {}), cutLead: v }; changes.push(`${k} のカットを ${v > 0 ? `${v}秒前倒し` : `${-v}秒遅らせる`}`); }
      else { T.cutLead = v; changes.push(`全カットを ${v > 0 ? `${v}秒前から切り替え` : `${-v}秒遅らせる`}`); }
      continue;
    }
    if (sec !== null && /歌詞|文字|テロップ/.test(t) && /早|前|遅|後/.test(t)) {
      const v = /早|前/.test(t) ? -Math.abs(sec) : Math.abs(sec);
      const which = /消え|退場|終わり|out/i.test(t) ? "lyricOut" : "lyricIn";
      const k = sectionKey(t);
      if (k) { (T.perSection ??= {})[k] = { ...(T.perSection[k] ?? {}), [which]: v }; } else (T as any)[which] = v;
      changes.push(`${k ?? "全体"} の歌詞${which === "lyricIn" ? "の出" : "の消え"}を ${v}秒`);
      continue;
    }
    if (sec !== null && /ビート|拍|グリッド/.test(t)) { T.beatShift = /前|早/.test(t) ? -Math.abs(sec) : Math.abs(sec); T.locked = [...new Set([...(T.locked ?? []), "beatShift"])]; changes.push(`拍グリッドを ${T.beatShift}秒ずらす`); continue; }
    // cut rhythm
    const cutM = t.match(/(1\/4|4分の1|四分の一|1\/2|半拍|2分の1|1拍|2拍|1小節|2小節)/);
    if (cutM && (/カット|切|刻|ずつ|ごと/.test(t))) {
      const beats = ({ "1/4": 0.25, "4分の1": 0.25, 四分の一: 0.25, "1/2": 0.5, 半拍: 0.5, "2分の1": 0.5, "1拍": 1, "2拍": 2, "1小節": 4, "2小節": 8 } as Record<string, number>)[cutM[1]];
      const k = sectionKey(t) ?? "all";
      if (k === "all") cfg.cutBeats = Object.fromEntries(["intro", "verse", "pre_chorus", "chorus", "bridge", "outro", "other"].map((s) => [s, beats]));
      else (cfg.cutBeats ??= {})[k] = beats;
      changes.push(`${k === "all" ? "全体" : k} のカット → ${beats}拍ごと`);
      continue;
    }
    if (/長回し|カット(を)?(なし|無し|しない)/.test(t)) { const k = sectionKey(t) ?? "all"; if (k === "all") cfg.cutBeats = Object.fromEntries(["intro", "verse", "pre_chorus", "chorus", "bridge", "outro", "other"].map((s) => [s, 0])); else (cfg.cutBeats ??= {})[k] = 0; changes.push(`${k} を長回し`); continue; }
    // look & feel
    if (/揺れ|シェイク|手ブレ/.test(t) && (/カメラ|画面|映像/.test(t) || /^(揺れ|シェイク|手ブレ)/.test(t))) { cfg.shake = /なし|無し|止め|やめ/.test(t) ? 0 : /強/.test(t) ? 0.9 : /弱|控えめ/.test(t) ? 0.2 : 0.5; changes.push(`カメラ揺れ → ${cfg.shake}`); continue; }
    if (/光漏れ|ライトリーク|フレア/.test(t)) { cfg.leaks = /なし|無し/.test(t) ? 0 : /強/.test(t) ? 1 : 0.4; changes.push(`光漏れ → ${cfg.leaks}`); continue; }
    if (/粒子|ほこり|ダスト/.test(t) && (/背景|画面|映像|漂/.test(t) || /^(粒子|ほこり|ダスト)\s*(なし|無し|多め|少なめ|強め)/.test(t))) { cfg.particles = /なし|無し/.test(t) ? 0 : /多|強/.test(t) ? 1 : 0.4; changes.push(`背景の粒子 → ${cfg.particles}`); continue; }
    if (/文字|歌詞|テロップ/.test(t) && /(上|下)(に|へ|め|寄)/.test(t) && !/行目/.test(t)) { cfg.lyrics ??= {}; const d = /上/.test(t) ? -0.06 : 0.06; (cfg.lyrics as any).textYShift = +(((cfg.lyrics as any).textYShift ?? 0) + d).toFixed(2); changes.push(`歌詞の位置を${d < 0 ? "上" : "下"}へ（${(cfg.lyrics as any).textYShift}）`); continue; }
    { const pl = t.match(/(\d+)\s*行目[^\d]*?(\d+(?:\.\d+)?)\s*秒(から|に|で)/); if (pl) { const li = String(+pl[1] - 1); (T.perLine ??= {})[li] = { ...((T.perLine as any)[li] ?? {}), start: +pl[2] }; T.locked = [...new Set([...(T.locked ?? []), "lines"])]; changes.push(`${pl[1]}行目の開始 → ${pl[2]}秒`); continue; } }
    if (/文字|歌詞/.test(t) && /大きく|小さく/.test(t)) { cfg.lyrics ??= {}; cfg.lyrics.size = +((cfg.lyrics.size ?? 1) * (/大きく/.test(t) ? 1.2 : 0.83)).toFixed(2); changes.push(`文字サイズ ×${cfg.lyrics.size}`); continue; }
    // keyword effects: 「キライ」は割れるように
    const km = t.match(/^[「『"]?(.+?)[」』"]?\s*(?:という(?:言葉|単語))?\s*(?:は|を)\s*(.+?)(?:ように|みたいに|感じ|っぽく|演出|エフェクト)/) ?? t.match(/^[「『](.+?)[」』]\s*(?:は|を)\s*(.+?)(?:で|に|して)?$/);
    if (km && !sectionKey(km[1]) && !/文字|歌詞|全体|全部|行目/.test(km[1])) {
      const eff = EFFECT_WORDS.find(([re]) => re.test(km[2]));
      if (eff) { cfg.lyrics ??= {}; (cfg.lyrics.keywords ??= {})[km[1]] = eff[1]; changes.push(`「${km[1]}」→ 語エフェクト ${eff[1] || "なし"}`); continue; }
    }
    const st = styleOf(t);
    const quiet = /静か|落ち着|控えめ|しっとり/.test(t), loud = /派手|激しく|盛り上げ/.test(t);
    const lineM = t.match(/(\d+)\s*行目/), fragM = t.match(/[「『](.+?)[」』]\s*の行/);
    const k = sectionKey(t);
    if (lineM && (st || quiet || loud)) { cfg.lyrics ??= {}; (cfg.lyrics.lines ??= {})[String(+lineM[1] - 1)] = specOf(st ?? (quiet ? "reveal" : "scale_pop")); changes.push(`${lineM[1]}行目 → ${st ?? (quiet ? "reveal" : "scale_pop")}`); continue; }
    if (fragM && (st || quiet || loud)) { cfg.lyrics ??= {}; (cfg.lyrics.lines ??= {})[fragM[1]] = specOf(st ?? (quiet ? "reveal" : "scale_pop")); changes.push(`「${fragM[1]}」を含む行 → ${st}`); continue; }
    if (k && (st || quiet || loud)) {
      cfg.lyrics ??= {}; cfg.lyrics.sections ??= {};
      if (st) { cfg.lyrics.sections[k] = specOf(st); changes.push(`${k} の歌詞 → ${st}`); }
      if (quiet) { if (!st) cfg.lyrics.sections[k] = "blur_in"; (cfg.cutBeats ??= {})[k] = 8; changes.push(`${k} を静かに（文字 blur_in・カット1小節×2）`); }
      if (loud) { if (!st) cfg.lyrics.sections[k] = "kinetic"; (cfg.cutBeats ??= {})[k] = 0.5; changes.push(`${k} を派手に（文字 kinetic・半拍カット）`); }
      continue;
    }
    if (st && /全体|全部|すべて|ぜんぶ|デフォルト/.test(t)) { cfg.lyrics ??= {}; cfg.lyrics.default = specOf(st); changes.push(`全体の歌詞 → ${st}`); continue; }
    if (st) { cfg.lyrics ??= {}; cfg.lyrics.default = specOf(st); changes.push(`全体の歌詞 → ${st}`); continue; }
    changes.push(`？ 解釈できませんでした: 「${t}」（例: 「サビはグリッチで」「画は0.1秒前から切り替え」「縦型で」）`);
  }
  return { cfg, changes };
}

// ---- camera moves / effects / beat sync: 「サビはクラッシュズームで」「Aメロのカメラは固定」「サビに光芒」「カメラはビートに乗せない」「エフェクト強め」 ----
const CAM_WORDS: [RegExp, string][] = [[/固定|動かさない/, "none"], [/ドリーズーム|めまい/, "dolly_zoom"], [/オービット|回り込/, "orbit"], [/アーク|弧/, "arc"], [/手持ち|ハンドヘルド/, "handheld"], [/クラッシュズーム/, "crash_zoom"], [/ウィップ/, "whip_in"], [/クレーン|ジブ/, "crane_reveal"], [/顔.*(寄|プッシュ)/, "face_in"], [/2\.?5D|奥行き/, "depth_25d"], [/スピードランプ/, "speed_ramp"], [/ピント送り.*寄/, "focus_move"], [/ピント送り/, "rack_focus"], [/ロール|ダッチ|傾け/, "dutch"], [/ズーム脈動|拍でズーム/, "beat_pulse"], [/ゆっくり回転/, "slow_rotate"], [/斜め/, "diag_push"], [/ゆっくり寄|ケンバーンズ/, "kb_in"], [/引いて|引く/, "kb_out"], [/押し込/, "push"]];
const FX_WORDS: [RegExp, string][] = [[/アナモ|レンズフレア|フレア/, "anamorphic"], [/光芒|ゴッドレイ/, "god_rays"], [/ティール|オレンジ/, "teal_orange"], [/ブリーチ/, "bleach"], [/フィルム調|フィルムっぽ/, "film_look"], [/フィルムバーン/, "film_burn"], [/被写界深度|周辺ぼけ/, "dof"], [/プリズム|分光/, "prism"], [/ガラス|屈折/, "glass"], [/ボケ|ダスト/, "bokeh"], [/光のスイープ|スイープ/, "light_sweep"], [/ブルーム/, "bloom"], [/ハレーション/, "halation"], [/粒子|グレイン/, "grain"], [/ビネット|周辺減光/, "vignette"], [/レターボックス|シネマ帯/, "letterbox"], [/光漏れ|ライトリーク/, "leak"], [/VHS|走査線/, "vhs"], [/フラッシュ|ストロボ/, "flash"], [/反転/, "invert"], [/画面シェイク|画面を揺ら/, "shake"], [/RGBずれ|色ずれエフェクト/, "glitch"]];
function camFxFromText(cfg: MVConfig, t: string): string | null {
  const isCam = /カメラ/.test(t), isFx = /エフェクト/.test(t);
  const cam = CAM_WORDS.find(([re]) => re.test(t))?.[1];
  const fx = FX_WORDS.find(([re]) => re.test(t))?.[1];
  const sync = /ビートに乗せない|ビートなし|なめらか/.test(t) ? "off" : /小節ごと/.test(t) ? "bar" : /2拍ごと/.test(t) ? "beat2" : /アクセント/.test(t) ? "accent" : /ビートに乗せ|毎拍|ビートに合わせ/.test(t) ? "beat" : null;
  const amt = /弱め|控えめ|自然/.test(t) ? "weak" : /強め|強く/.test(t) ? "strong" : /普通/.test(t) ? "normal" : null;
  if (!(cam && (isCam || !fx)) && !fx && !((isCam || isFx) && (sync || amt))) return null;
  if (cam && !isCam && !/で$|に$|して|ワーク/.test(t)) return null; // avoid eating unrelated phrases
  const C: any = ((cfg as any).camfx ??= {}); C.sections ??= {};
  const k = sectionKey(t) ?? "all"; const S = (C.sections[k] ??= {}); const where = k === "all" ? "全体" : k.replace(/^chorus/, "サビ").replace(/^verse/, "Aメロ").replace(/^pre_chorus/, "Bメロ").replace(/^intro/, "イントロ").replace(/^outro/, "アウトロ").replace(/^bridge/, "間奏/Cメロ");
  const out: string[] = [];
  if (cam) { S.move = cam; out.push(`カメラ → ${CAMERA_MOVES[cam]?.label ?? cam}`); }
  if (fx) { S.fx = [...(S.fx ?? []).filter((e: any) => e.id !== fx), { id: fx, amount: amt ?? "weak", sync: sync ?? "off" }]; out.push(`エフェクト「${EFFECT_FX[fx]?.label ?? fx}」${amt ? `（${STRENGTH[amt as "weak"].label}）` : ""}`); }
  if (!fx && sync) { if (isFx && S.fx) S.fx = S.fx.map((e: any) => ({ ...e, sync })); else S.camSync = sync; out.push(`${isFx ? "エフェクト" : "カメラ"}のビート同期 → ${SYNC[sync as "off"]}`); }
  if (!fx && amt) { if (isFx && S.fx) S.fx = S.fx.map((e: any) => ({ ...e, amount: amt })); else S.camStrength = amt; out.push(`${isFx ? "エフェクト" : "カメラ"}の強さ → ${STRENGTH[amt as "weak"].label}`); }
  return `${where}: ${out.join("・")}`;
}
