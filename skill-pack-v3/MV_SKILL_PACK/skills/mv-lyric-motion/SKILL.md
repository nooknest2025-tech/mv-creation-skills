---
name: mv-lyric-motion
description: 歌詞の文字演出（32スタイル、自動選択、語エフェクト、行・セクション別の指定）を決めるとき。
---

# mv-lyric-motion

**モデルの目安: 標準モデル＋推論 medium**（迷ったら mv-direct で方針→ mv-run で実行）

## 提案してから設定する

新規制作では [mv-workflow](../mv-workflow/SKILL.md) の構成に合わせ、実際の歌詞から代表的な2〜3行を選ぶ。各行の意味、読みやすさ、音の強弱を根拠に、書体・色・出入り・強調語と使う区間を提案する。設定名だけで済ませず、画面見本や短い動きで見せる。ユーザーの既存指定は引き継ぎ、おまかせの場合は選定理由を示して進める。意味のある歌詞を読み切れない装飾に置き換えない。

## スタイル
`npm run styles` で 32 スタイルの一覧（日本語名つき）。`npm run showcase -- --stills` で全スタイルの静止画見本。
優先順位: 行の指定 > ショットの指定 > セクションの指定 > 既定（auto）。

## 指定の仕方
- セクション: `"サビはグリッチで"`、`"2番のAメロは手書き"`、`"最後のサビは派手に"`
- 行: `"3行目はハンコで"`、`"『好き』の行はネオン"`
- 語エフェクト: `"『キライ』は割れるように"`（crack / melt / glow / shake / sparks / heart / wave / blur / red）
- JSON: `lyrics.default`, `lyrics.sections{"chorus":"neon","verse#2":"handwriting","chorus#last":{"style":"kinetic","size":1.2}}`, `lyrics.lines{"2":"stamp"}`（JSON の行番号は0始まり＝3行目は "2"）, `lyrics.keywords{"キライ":"crack"}`

## auto のルール
セクションの種類とエネルギー順位で候補から選び、同じスタイルが続きすぎないようにする。叫び・繰り返しの強い行はアクセント（kinetic 等）。


## プロの動き（pro_* スタイル・プロ演出）
- 全自動でも既定で「プロ演出」がオン: 直線フェード・中央固定だけの字幕は使わず、`pro_*` スタイル（マスクから滑り出る・叩きつけ・横ストレッチ・線から引き出す・箱が縮んで現れる・斜めマスク・ラベル帯・バネ・短冊縦明朝・縦の柱・巨大切れ文字）を曲調とセクションで選ぶ。詳細と根拠は `docs/PRO_DIRECTION_ja.md` の「プロのモーション」。
- 動きの共通ルール（`src/lib/pro.ts`）: expo-out cubic-bezier(0.1,1,0,1)／snappy (0.1,0.9,0.2,1)／バネのオーバーシュート約1.15、ポーズtoポーズ（止まってもわずかに漂う）、音節ごと2〜3フレームずらし（文字タイミングがあれば実際の発声時刻）、要の語は大きく・助詞（はがをにのへとも）は50〜70%の明朝、3×3グリッドと対角の流れ。
- 日本語: 「サビはスマッシュで」「Aメロは短冊で」「ラベルで」「巨大な切れ文字で」「プロっぽい文字で」。従来の見た目に戻すのは「プロ演出オフ」。
- 拍のアクセント（反転フラッシュ2フレーム・拡大・回転・叫びの揺れ）は拍グリッドから付ける近似。ドラム音の検出ではないと正直に伝える。

## 書体（typography）とジャンル
- `fonts.yaml` registers 32 free fonts (OFL/Apache) in 8 categories. List them with `npm run fonts`; the image is `docs/images/font_specimen.jpg`; the guide is `docs/FONTS_ja.md`.
- Font scope, from lowest to highest priority:
  1. song `lyrics.font`
  2. genre recipe
  3. section `lyrics.fontSections`
  4. line `lyrics.fontLines`, or a `font` param in the line spec
  5. word `lyrics.fontKeywords` (per glyph)
- Japanese: 「サビは筆文字で」「丸っこい字に」「3行目は明朝で」「『キライ』は極太の字で」「書体を元に戻して」.
  - Plain style words (「手書きで」) still mean the *motion*. Font intent needs 字/文字/書体/フォント or a font name.
- Genre recipes in `src/lib/genres.ts`: ballad / rock_edm / citypop_jazz / idol_pop / wa / hiphop. Each sets the section style pools, accent style, fonts (base/chorus/accent) and palette.
  - Auto-detected when both preset and genre are auto. Override with 「ジャンルはロックで」 or 「ジャンルなし」.
- New motion: follow the `mv-style-create` skill.

## エディターでの変更が優先（共通ルール）
自動で選んだスタイル・書体・色は既定値。エディターで行ごとに変えた書体・色・大きさ・配置・角度・効果・入り方/消え方・モーション見本は必ず反映する。行番号で見た目を固定しない（`src/lib/lyricEdits.tsx`）。

## パック内での実行

このファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。
