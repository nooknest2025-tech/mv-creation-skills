---
name: mv-finishing
description: 仕上げ（字幕の読みやすさ、セーフエリア、色、エンディング、音声を変えない確認）をするとき。
---

# mv-finishing

**モデルの目安: 標準モデル＋推論 medium**（迷ったら mv-direct で方針→ mv-run で実行）

## チェックリスト
- 歌詞は映画字幕の読みやすさ: 1行は短く、2行まで、縁取り/影で背景に負けない。`"映画字幕風で"` → simple:film。
- 画面内の UI・顔・手元に被せない: 縦長は textY 0.68（下 20% は SNS の UI 領域）、横長は 0.84。被るなら `"文字を上に"` か `lyrics.textY`。
- 画像は構成で決めた全体表示／寄りに従う。全体表示ならcontain等で端まで収め、カメラや揺れによる切れも確認する。意図した寄りにだけスマートクロップを使い、全体表示の代わりにしない。
- セクション別グレード（色）・ビネット・グレイン。強すぎたら `"光漏れなし"` `"揺れを弱く"`。
- エンディング最後の1秒は文字なし（自動）。
- **元の音声は加工しない**: 最終 mux はストリームコピー。QA の「音声 md5 一致」を確認。部分書き出しや WAV 入力のときだけ AAC 320k（元ファイルは無変更）。

## Remotion 内の仕上げ（DaVinci 不要）
- `finish` sets glow, halation, grain, vignette, chroma, and letterbox (0..1 → 1.85–2.39:1). With a letterbox, lyrics move into the bottom bar automatically.
  - Japanese phrases: 「シネスコの黒帯」「グロー強め」「フィルム調」「周辺減光」「色収差」.
- `visuals` adds the audio-reactive layer:
  - `bg`: plasma / tunnel / rings / flow.
  - `spectrum`: bars / ring / wave.
  - `particles` (bass-driven) and `trails` (feedback).
  - Phrases: 「TouchDesigner風」「プラズマ背景」「リングのスペクトラム」「音に反応する粒子」「残像」.
- `ramps` sets speed ramps per section (`none | in | out | punch | smooth`), or per shot through `timing.perShot.S005.ramp`.
  - Video clips are time-remapped; stills ramp the camera move.
- To compare looks, run `npm run presets-demo -- --project <曲>`.

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
