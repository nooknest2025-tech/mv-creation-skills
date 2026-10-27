// Lyric motion style catalogue (32 styles), aliases, keyword effects and auto-selection pools.
// Ported from the author's earlier Python engine (mvengine/lyricstyles.py) - same names, defaults and selection rules.
import { CUSTOM_CATALOG } from "./catalog.custom";
export type Energy = "low" | "mid" | "high";
export interface StyleInfo { ja: string; short: string; energy: Energy; defaults: Record<string, unknown> }

export const CATALOG: Record<string, StyleInfo> = {
  simple: { short: "シンプル", ja: "従来の字幕テロップ。歌った文字だけ色が変わる（film 変種=映画字幕風）", energy: "low", defaults: {} },
  kinetic: { short: "キネティック", ja: "語の塊が叩きつけられ、帯と傾きで画面を埋める激しい文字", energy: "high", defaults: {} },
  reveal: { short: "ふわっと", ja: "発声に合わせて1文字ずつふわっと浮かび上がる", energy: "low", defaults: { enter: 0.18, rise: 0.08 } },
  bounce: { short: "バウンス", ja: "小さく縮んだ文字が跳ねて着地、拍でも弾む", energy: "mid", defaults: { enter: 0.2, drop: 0.035, beat_hop: 0.06 } },
  karaoke: { short: "カラオケ", ja: "歌っている所だけ左から色が満ちるカラオケ塗り", energy: "low", defaults: { fill_color: "#ff5a8c" } },
  outline_fill: { short: "輪郭→塗り", ja: "輪郭線がなぞるように描かれ、あとから塗りが入る", energy: "low", defaults: { draw: 0.42, fill: 0.22 } },
  handwriting: { short: "手書き", ja: "ペン先が輪郭を順番に描いていく手書き風", energy: "low", defaults: { draw: 0.55 } },
  glitch: { short: "グリッチ", ja: "RGBずれ・横スライス・明滅。発声と拍の瞬間に強く崩れる", energy: "high", defaults: { amount: 1.0, beat_amount: 0.55, flicker: 0.06 } },
  chromatic_trail: { short: "残像", ja: "横から滑り込み、シアンとマゼンタの残像が尾を引く", energy: "mid", defaults: { trail: 6, dt: 0.028 } },
  particles: { short: "粒子", ja: "粒子が集まって文字になり、最後は粒子に崩れて流れる", energy: "mid", defaults: { gather: 0.5, spread: 0.32, flow_deg: -30 } },
  extrude3d: { short: "立体押し出し", ja: "厚みのある立体文字。押し出しの向きがゆっくり回る", energy: "mid", defaults: { depth: 0.16 } },
  fly3d: { short: "奥から飛来", ja: "奥から手前へ飛んできて着地、最後はカメラを追い越して消える", energy: "high", defaults: { from_z: 7.0, fly: 0.42 } },
  flip3d: { short: "フリップ", ja: "1文字ずつカードのように縦軸で回転して表を向く", energy: "mid", defaults: { flip: 0.32 } },
  typewriter: { short: "タイプ", ja: "タイプライター。1文字ずつ打たれ、カーソルが点滅", energy: "low", defaults: { caret: true } },
  neon: { short: "ネオン", ja: "ネオン管。点灯時にチカチカし、拍で光が強まる", energy: "mid", defaults: { glow: 1.0 } },
  shatter: { short: "粉砕", ja: "文字がガラスのように割れて破片が飛び散る", energy: "high", defaults: { exit: 0.6 } },
  scatter: { short: "散って集まる", ja: "画面中に散らばった文字が集まって並び、最後はまた散る", energy: "mid", defaults: { fly: 0.5 } },
  tategaki: { short: "縦書き", ja: "縦書き。上から書かれ、列がゆっくり上へ流れる", energy: "low", defaults: { flow: 0.03, x: 0.84 } },
  wave: { short: "ウェーブ", ja: "文字が波のようにうねる（拍で振れ幅が増える）", energy: "mid", defaults: { amp: 0.12 } },
  jelly: { short: "ゼリー", ja: "ゼリーのようにぷるんと潰れて伸びる（拍で弾む）", energy: "mid", defaults: { amp: 0.22 } },
  stamp: { short: "ハンコ", ja: "赤いハンコ（落款）が語ごとにドンと押される", energy: "high", defaults: { size: 0.115 } },
  mask_wipe: { short: "ワイプ", ja: "斜めのワイプで歌った所まで現れ、色帯がエッジを走る", energy: "mid", defaults: { slant: 0.35 } },
  split_reveal: { short: "上下割れ", ja: "光る線が伸び、その上下から文字が割れて出てくる", energy: "mid", defaults: { open: 0.35 } },
  blur_in: { short: "ピント", ja: "ぼやけた文字がピントが合うように現れる", energy: "low", defaults: { enter: 0.42 } },
  scale_pop: { short: "ポップ", ja: "文字がポンッと弾けるように拡大して現れ、拍で脈打つ", energy: "high", defaults: { enter: 0.36 } },
  circular: { short: "円周", ja: "円周に並んだ文字がぐるぐる回る", energy: "mid", defaults: { radius: 0.27 } },
  ticker: { short: "電光掲示板", ja: "上下の帯を電光掲示板のように歌詞が流れる", energy: "mid", defaults: { speed: 0.22 } },
  collage: { short: "コラージュ", ja: "切り抜き文字のコラージュ（色紙・書体・角度がばらばら）", energy: "high", defaults: {} },
  burst: { short: "バースト", ja: "語の頭で星・ハート・キラキラがはじける", energy: "high", defaults: { count: 14 } },
  word_stack: { short: "積み上げ", ja: "語ごとに幅をそろえて積み上げるキネティック・スタック", energy: "high", defaults: { width: 0.4 } },
  letter_rain: { short: "文字の雨", ja: "文字の雨が降り、歌詞は上から落ちてきて着地する", energy: "mid", defaults: { density: 1.0 } },
  ui_window: { short: "ダイアログ", ja: "昔のOSのダイアログが語ごとにポップアップ", energy: "high", defaults: {} },
};
// pro motion styles (src/styles/pro.tsx): masked reveals, expo-out / spring easing, hierarchy, grid layout
export const PRO_CATALOG: Record<string, StyleInfo> = {
  pro_slide: { short: "プロ・スライド", ja: "音節ごとにマスクから滑り出る。要の語は大きく、助詞は小さな明朝。グリッド配置で対角に流れる", energy: "mid", defaults: { exit: 0.28 } },
  pro_smash: { short: "プロ・スマッシュ", ja: "語が300%から一瞬で叩きつけられる（動く間だけブレ）。極太・詰め字・中抜き輪郭の影", energy: "high", defaults: { exit: 0.2 } },
  pro_stretch: { short: "プロ・ストレッチ", ja: "横に300%伸びた文字がキュッと戻る。2〜3フレームずつずらして", energy: "high", defaults: { exit: 0.22 } },
  pro_line: { short: "プロ・ライン", ja: "細い線が伸び、その裏から文字が引き出される", energy: "low", defaults: { exit: 0.35 } },
  pro_box: { short: "プロ・ボックス", ja: "ベタの箱が走り、縮んで消えると文字が現れる", energy: "mid", defaults: { exit: 0.25 } },
  pro_diag: { short: "プロ・斜めマスク", ja: "斜めのマスクが走って文字を切り出す。少し傾けて疾走感", energy: "mid", defaults: { exit: 0.25 } },
  pro_label: { short: "プロ・ラベル", ja: "差し色の帯が先に伸び、文字が帯に乗って滑り込む。小さな等幅の英数字つき", energy: "mid", defaults: { exit: 0.25 } },
  pro_pop: { short: "プロ・ポップ", ja: "色ブロックに乗った文字がバネのように弾む（オーバーシュート約1.15）", energy: "mid", defaults: { exit: 0.25 } },
  pro_tanzaku: { short: "短冊・縦明朝", ja: "短冊の枠に縦書き明朝。上から直線的にゆっくり現れ、長く留まる", energy: "low", defaults: { exit: 0.5, hold: 0.8 } },
  pro_pillar: { short: "縦の柱", ja: "要の語を極太の縦の柱として画面端に、全文は小さく横に", energy: "mid", defaults: { exit: 0.3 } },
  pro_crop: { short: "巨大切れ文字", ja: "要の語を画面からはみ出す巨大な輪郭文字（形として）にし、手前に読める行を叩きつける", energy: "high", defaults: { exit: 0.22 } },
};
Object.assign(CATALOG, PRO_CATALOG);
Object.assign(CATALOG, CUSTOM_CATALOG);
export const STYLE_NAMES = Object.keys(CATALOG);

export const ALIASES: Record<string, string> = {
  stroke: "outline_fill", spatial: "extrude3d", typing: "typewriter", vertical: "tategaki", marquee: "ticker",
  hanko: "stamp", pop: "scale_pop", rain: "letter_rain", trail: "chromatic_trail", fade: "reveal", window: "ui_window",
  stack: "word_stack", "3d": "fly3d", film: "simple", subtitle: "simple",
};

export const KEYWORD_EFFECTS: Record<string, string> = {
  crack: "ひびが入って割れる", melt: "溶けて垂れる", glow: "光る・キラッと輝く", sparks: "パチパチ火花が散る",
  shake: "ガタガタ震える", heart: "ハートが浮かぶ", wave: "ゆらゆら揺れる", blur: "夢のようにぼやける", red: "毒々しい赤に染まる",
};
export const DEFAULT_KEYWORDS: Record<string, string> = {
  キライ: "crack", 嫌い: "crack", きらい: "crack", 割れ: "crack", 壊し: "crack", 壊れ: "crack", 砕け: "crack",
  甘い: "melt", 甘く: "melt", あまい: "melt", 溶け: "melt", 溶かし: "melt", とろけ: "melt",
  光: "glow", ひかり: "glow", 輝: "glow", きらめ: "glow", キラキラ: "glow", 綺麗: "glow", キレイ: "glow", 星: "glow",
  パチパチ: "sparks", パチ: "sparks", はじけ: "sparks", 弾け: "sparks", 火花: "sparks",
  震え: "shake", 怖い: "shake", こわい: "shake", ノイズ: "shake", ガタガタ: "shake",
  好き: "heart", すき: "heart", 恋: "heart", 愛: "heart", ハート: "heart",
  ゆらゆら: "wave", 揺れ: "wave", ゆれ: "wave", 波: "wave",
  夢: "blur", ゆめ: "blur", 眠: "blur",
  毒: "red", 腐: "red", 血: "red", 赤く: "red",
};

export const AUTO_POOLS: Record<string, string[]> = {
  intro: ["neon", "blur_in", "reveal"],
  verse: ["typewriter", "karaoke", "wave", "handwriting", "tategaki", "outline_fill"],
  pre_chorus: ["split_reveal", "mask_wipe", "fly3d", "chromatic_trail", "flip3d"],
  chorus: ["glitch", "word_stack", "scale_pop", "collage", "extrude3d"],
  bridge: ["particles", "circular", "letter_rain", "neon"],
  outro: ["particles", "blur_in", "reveal"],
  other: ["reveal", "bounce"],
};
export const AUTO_ACCENT: Record<string, string> = {
  intro: "scale_pop", verse: "bounce", pre_chorus: "stamp", chorus: "shatter", bridge: "burst", outro: "shatter", other: "scale_pop",
};

export function canonicalStyle(name: string): string {
  const k0 = String(name ?? "").normalize("NFKC").trim().toLowerCase().replace(/[- ]/g, "_");
  const k = ALIASES[k0] ?? k0;
  if (k in CATALOG || k === "auto") return k;
  // accept Japanese short names too ("グリッチ")
  const byShort = STYLE_NAMES.find((n) => CATALOG[n].short === String(name).trim());
  if (byShort) return byShort;
  throw new Error(`未知の文字スタイル「${name}」です。使える名前: ${STYLE_NAMES.join(", ")}, auto（npm run styles で一覧）`);
}
