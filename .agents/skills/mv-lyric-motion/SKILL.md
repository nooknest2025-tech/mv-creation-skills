---
name: mv-lyric-motion
description: 歌詞の文字演出（スタイル選択、語エフェクト、行・セクション別の指定）を決めるとき。
---

# mv-lyric-motion

**モデルの目安: 標準モデル＋推論 medium**（迷ったら mv-direct で方針→ mv-run で実行）

## 提案してから設定する

新規制作では [mv-workflow](../mv-workflow/SKILL.md) の構成に合わせ、実際の歌詞から代表的な2〜3行を選ぶ。各行の意味、読みやすさ、音の強弱を根拠に、書体・色・出入り・強調語と使う区間を提案する。設定名だけで済ませず、画面見本や短い動きで見せる。ユーザーの既存指定は引き継ぎ、おまかせの場合は選定理由を示して進める。意味のある歌詞を読み切れない装飾に置き換えない。

## 曲全体の文字設計

[演出の調査と判断](../mv-workflow/references/direction-research.md) を読み、歌声のフレーズ・文字量・背景と視線・前後の行のつながりを踏まえる。文字の入場、読める保持、退場と、セクション間の強弱を決める。静かな文字も有効な選択肢であり、種類数や常時変化を品質の指標にしない。画面の数枚だけで動きや音同期を判定しない。

自動プランでは、セクション平均に隠れた早口の行は行単位の文字数/秒も見て、選択候補が読みにくい特性なら他の適合候補を使う。自動候補の `readable` は手作りの目安であり、実際の可読性の測定ではない。明示指定は自動修正しない。

## スタイル
`npm run styles` で現在のスタイル一覧（日本語名つき）を確認する。`npm run showcase -- --stills` で全スタイルの静止画見本。
優先順位: 行の指定 > ショットの指定 > セクションの指定 > 既定（auto）。

## 指定の仕方
- セクション: `"サビはグリッチで"`、`"2番のAメロは手書き"`、`"最後のサビは派手に"`
- 行: `"3行目はハンコで"`、`"『好き』の行はネオン"`
- 語エフェクト: `"『キライ』は割れるように"`（crack / melt / glow / shake / sparks / heart / wave / blur / red）
- JSON: `lyrics.default`, `lyrics.sections{"chorus":"neon","verse#2":"handwriting","chorus#last":{"style":"kinetic","size":1.2}}`, `lyrics.lines{"2":"stamp"}`（JSON の行番号は0始まり＝3行目は "2"）, `lyrics.keywords{"キライ":"crack"}`

## auto のルール
セクションの種類とエネルギー順位で候補から選び、同じスタイルが続きすぎないようにする。叫び・繰り返しの強い行はアクセント（kinetic 等）。


## プロの動き（pro_* スタイル・プロ演出）
- 実装の既定は「プロ演出」がオン。曲と希望によって静かなフェード・固定配置も検討し、必要ならプロ演出を切る。既定では`pro_*` スタイル（マスクから滑り出る・叩きつけ・横ストレッチ・線から引き出す・箱が縮んで現れる・斜めマスク・ラベル帯・バネ・短冊縦明朝・縦の柱・巨大切れ文字）を曲調とセクションで選ぶ。詳細と根拠は `docs/PRO_DIRECTION_ja.md` の「プロのモーション」。
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

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
