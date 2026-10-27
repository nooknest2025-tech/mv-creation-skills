// Mood styles (v3.1): 32 lyric styles built from the composable motion system (styles/motion.tsx).
// Each entry: catalogue text (ja), energy, mood tags, intensity 0..1 (used by fit scoring), and the motion spec.
import type { MotionSpec } from "../styles/motion";
export interface MoodStyle { short: string; ja: string; moods: string[]; intensity: number; spec: MotionSpec; defaults?: Record<string, unknown> }
export const MOOD_GROUPS: Record<string, string> = {
  ballad: "バラード・エモ", acoustic: "弾き語り・First Take", citypop: "シティポップ・ジャズ・lo-fi", wa: "和風", hiphop: "ヒップホップ・ラップ",
  idol: "アイドル・かわいい", rock: "ロック・メタル", dark: "ダーク・ボカロ", ambient: "アンビエント・チル",
};
const M = (short: string, ja: string, moods: string[], intensity: number, spec: MotionSpec): MoodStyle => ({ short, ja, moods, intensity, spec });
export const MOOD_STYLES: Record<string, MoodStyle> = {
  // ballad / emotional
  letter_glow: M("灯る手紙", "1文字ずつ柔らかく灯り、歌った所だけ温かく光る。周りに淡い光", ["ballad", "acoustic"], 0.15, { font: "serif", enter: "blur", enterDur: 0.6, ease: "soft", emph: "glow", idle: "breathe", exit: "blur", deco: ["halo"], shadow: "soft" }),
  tear_drop: M("涙のしずく", "上からそっと降りて着地し、最後はしずくのように下へ落ちて消える", ["ballad", "dark"], 0.2, { font: "serif", enter: "drop", enterDur: 0.55, ease: "soft", emph: "brighten", exit: "fall", shadow: "soft" }),
  breath_line: M("吐息", "行全体がゆっくり息をするように現れ、字間が少しずつ詰まる", ["ballad", "ambient"], 0.1, { font: "serif", unit: "line", enter: "track", enterDur: 1.1, ease: "soft", idle: "breathe", exit: "fade", track: 0.12, shadow: "soft" }),
  memory_fade: M("思い出", "下寄せの字幕位置で、ぼけた光の粒の中にふっと浮かび、ぼけて消える", ["ballad", "citypop"], 0.15, { font: "serif", layout: "low", enter: "blur", enterDur: 0.7, ease: "soft", emph: "brighten", exit: "blur", deco: ["bokeh"], shadow: "soft" }),
  // acoustic / First-Take
  first_take: M("一発撮り", "白い背景に置くような簡素な横書き。歌った所が濃くなるだけの抑えた表現", ["acoustic", "ballad"], 0.05, { font: "sans", layout: "low", unit: "char", enter: "fade", enterDur: 0.25, emph: "brighten", exit: "fade", shadow: "none", sw: 0.03 }),
  pencil_note: M("鉛筆メモ", "ノートに書いたような手書き風。下線がすっと引かれる", ["acoustic", "idol"], 0.15, { font: "round", enter: "wipe", enterDur: 0.35, emph: "lift", idle: "sway", exit: "fade", deco: ["underline"], shadow: "none" }),
  liner_notes: M("ライナーノーツ", "左寄せのタイポ。上に細い罫線とセクション名、語ごとに静かに出る", ["acoustic", "citypop"], 0.1, { font: "sans", layout: "left", unit: "word", enter: "slideL", enterDur: 0.4, ease: "expo", exit: "fade", deco: ["rule", "caption"], shadow: "soft", sw: 0.02 }),
  // city pop / jazz / lo-fi
  night_drive: M("ナイトドライブ", "語ごとに右から滑り込み、ゆっくり流れる。下線ネオン", ["citypop"], 0.35, { font: "sans", unit: "word", enter: "slideR", enterDur: 0.45, ease: "expo", emph: "accent", idle: "drift", exit: "slide", deco: ["underline"], shadow: "glow" }),
  lofi_tape: M("ローファイ", "走査線とVHSノイズの乗ったゆるい文字。ゆらゆら揺れる", ["citypop", "ambient"], 0.25, { font: "round", enter: "fade", enterDur: 0.4, idle: "sway", emph: "brighten", exit: "blur", deco: ["scanlines", "vhs"], shadow: "soft" }),
  jazz_bar: M("ジャズバー", "左寄せで字間ひろめ。枠線が伸びて語が順に灯る", ["citypop"], 0.3, { font: "serif", layout: "left", unit: "word", enter: "track", enterDur: 0.5, ease: "soft", emph: "glow", exit: "fade", deco: ["frame"], track: 0.08 }),
  retro_card: M("レトロ名刺", "カセットラベルのような色帯の上に文字が乗る。拍で軽く弾む", ["citypop", "idol"], 0.35, { font: "lyrics", enter: "squash", enterDur: 0.3, ease: "back", emph: "beat", exit: "shrink", deco: ["tape"], shadow: "none" }),
  // wa
  sumi_brush: M("墨の一筆", "筆で塗った墨の帯の上に文字がにじみ出る", ["wa"], 0.3, { font: "serif", enter: "ink", enterDur: 0.5, emph: "brighten", exit: "blur", deco: ["brush"], shadow: "none", fill: "#f4ead6" }),
  hanko_tate: M("縦書き落款", "縦書きで上からにじみ、行末に朱の落款が押される", ["wa", "ballad"], 0.25, { layout: "v", font: "serif", enter: "ink", enterDur: 0.45, emph: "accent", exit: "fade", deco: ["hanko", "rule"], shadow: "soft" }),
  kabuki_cut: M("見得", "語ごとにカッと出る大見得。止め・ためが効いた和ロック向け", ["wa", "rock"], 0.6, { font: "stamp", unit: "word", enter: "zoomIn", enterDur: 0.18, ease: "expo", emph: "beat", exit: "cut", shadow: "hard" }),
  tanzaku: M("短冊", "縦書きが風に揺れる短冊のようにそよぐ", ["wa", "ambient"], 0.2, { layout: "v", font: "serif", enter: "drop", enterDur: 0.5, ease: "soft", idle: "sway", exit: "fall", shadow: "soft" }),
  // hip-hop / rap
  punchline: M("パンチライン", "語ごとにカット割りで出る極太。フチ黒・影がっつり", ["hiphop"], 0.6, { font: "stamp", unit: "word", enter: "cut", emph: "accent", exit: "cut", shadow: "hard", sw: 0.08 }),
  flow_tick: M("フロー", "16分刻みのように1文字ずつ素早く打ち込まれ、左寄せで流れる", ["hiphop"], 0.5, { font: "stamp", layout: "left", enter: "slideL", enterDur: 0.08, ease: "expo", emph: "lift", exit: "slide", shadow: "hard" }),
  street_tag: M("ストリート", "ステッカー帯の上に斜めにバンッと貼られる", ["hiphop", "rock"], 0.55, { font: "stamp", unit: "word", enter: "skew", enterDur: 0.2, ease: "back", emph: "beat", exit: "scatter", deco: ["band"], shadow: "hard" }),
  censor_bar: M("伏せ字", "黒帯の上に文字が叩き込まれ、赤い取り消し線が走る", ["hiphop", "dark"], 0.5, { font: "sans", unit: "word", enter: "cut", emph: "accent", exit: "cut", deco: ["band", "redline"], shadow: "none" }),
  // idol / kawaii
  bubble_pop: M("ふきだし", "ふきだしがポンッと出て、中の文字が弾む", ["idol"], 0.45, { font: "round", enter: "zoomOut", enterDur: 0.3, ease: "back", emph: "lift", idle: "float", exit: "shrink", deco: ["bubble"], shadow: "none", fill: "#ff4f9a", stroke: "#ffffff" }),
  sparkle_wink: M("キラキラ", "1文字ずつ跳ねて着地、周りで星がまたたく", ["idol"], 0.45, { font: "round", enter: "drop", enterDur: 0.3, ease: "elastic", emph: "beat", idle: "float", exit: "rise", deco: ["stars"], shadow: "soft" }),
  heart_beat: M("ドキドキ", "拍で文字全体が小さく脈打ち、歌った所がピンクになる", ["idol", "ballad"], 0.35, { font: "round", enter: "zoomOut", enterDur: 0.25, ease: "back", emph: "accent", idle: "breathe", exit: "shrink", shadow: "soft" }),
  candy_squash: M("ぷにぷに", "ぺちゃんと潰れてから元に戻る柔らかい登場", ["idol"], 0.4, { font: "round", enter: "squash", enterDur: 0.35, ease: "elastic", emph: "beat", exit: "shrink", shadow: "none", sw: 0.09 }),
  // rock / metal
  power_slam: M("叩きつけ", "大きく手前から叩きつけて止まる。サビの頭に1回だけ使う大技", ["rock"], 0.85, { font: "stamp", layout: "big", unit: "word", enter: "zoomIn", enterDur: 0.14, ease: "expo", emph: "beat", idle: "jitter", exit: "cut", shadow: "hard" }),
  riff_cut: M("リフ", "横から鋭く斜めに切り込み、拍で揺れる", ["rock"], 0.7, { font: "stamp", unit: "word", enter: "skew", enterDur: 0.16, ease: "expo", emph: "beat", exit: "slide", shadow: "hard" }),
  amp_frame: M("ライブ枠", "角カッコの枠の中で文字がカットで出る。ライブ映像向け", ["rock", "hiphop"], 0.55, { font: "stamp", enter: "cut", emph: "accent", idle: "jitter", exit: "cut", deco: ["brackets"], shadow: "hard" }),
  // dark / vocaloid
  broken_signal: M("途切れる信号", "時々明滅する不安定な文字、走査線とノイズ", ["dark"], 0.5, { font: "sans", enter: "cut", emph: "accent", idle: "flicker", exit: "cut", deco: ["scanlines", "vhs"], shadow: "glow" }),
  whisper_smoke: M("囁き", "煙の中からぼんやり浮かび、煙に溶けて消える", ["dark", "ambient"], 0.2, { font: "serif", enter: "blur", enterDur: 0.8, ease: "soft", emph: "brighten", idle: "float", exit: "blur", deco: ["smoke"], shadow: "soft" }),
  vocalo_grid: M("ボカロ式", "上寄せ・字間詰めの機械的な打ち込み、テンポに合わせ1字ずつ切り替わる", ["dark", "idol"], 0.45, { font: "sans", layout: "top", enter: "flip", enterDur: 0.12, ease: "expo", emph: "accent", exit: "cut", deco: ["rule"], shadow: "none", sw: 0.06 }),
  // ambient / chill
  drift_float: M("浮遊", "ゆっくり上へ漂う文字。動きは最小限", ["ambient", "ballad"], 0.05, { font: "sans", unit: "line", enter: "fade", enterDur: 1.0, ease: "soft", idle: "float", exit: "rise", shadow: "soft", sw: 0.02 }),
  horizon: M("水平線", "細い線が伸び、その上に字間ひろめで静かに並ぶ", ["ambient", "acoustic"], 0.1, { font: "sans", unit: "line", enter: "track", enterDur: 1.2, ease: "soft", exit: "fade", deco: ["rule"], track: 0.25, shadow: "none", sw: 0.02 }),
  aurora: M("オーロラ", "光の輪の中で、歌った所がゆっくり色づく", ["ambient", "ballad"], 0.15, { font: "serif", enter: "blur", enterDur: 0.9, ease: "soft", emph: "glow", idle: "drift", exit: "blur", deco: ["halo", "bokeh"], shadow: "glow" }),
};
