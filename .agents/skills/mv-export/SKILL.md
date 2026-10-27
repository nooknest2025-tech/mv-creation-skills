---
name: mv-export
description: 書き出し（YouTube/SNS 用 MP4、Drive 用 100MB 未満、縦横の複数比率、9:16 サビハイライト、DaVinci Resolve 用）をするとき。
---

# mv-export

**モデルの目安: 軽い/速いモデル＋推論 low〜medium で十分**（決まった手順をコマンドで回す工程。`codex --profile mv-run`）

## 書き出しの位置づけ

新規制作では [mv-workflow](../mv-workflow/SKILL.md) の構成・素材・リリックの合意と確認状況を引き継ぐ。書き出し自体は音付きの確認用初稿にも使える。同期や演出が未確認なら「確認用初稿」として渡す。`--yes` はCLIの確認省略であり、未回答の制作方針や費用の承認を得たことにはならない。

## Studio編集後の書き出し

Studioを併設した場合は [編集と書き出しの手順](../mv-workflow/references/review-and-studio.md) を読む。正本の現在版を描画し、正本のハッシュ/スナップショットと出力を記録する。別曲のpublic/projectや古い確認MP4を誤って出力しない。音楽の位置/音量をユーザーが編集した場合、最終muxで無条件に元曲へ置換しない。元WAVの不変と、AAC変換後の音声パケットコピーを分けて確認する。

シーン別の元曲付き確認ページ、比較・メモ、全編再生を維持する。ページの対象版、リンクとHTTP応答、動画の再生を確認する。曲専用の書き出しコマンドは、その環境に存在するか確認してから案内する。

## コマンド（remotion/）
- 通常: `npm run mv` → `<曲名>_vN_16x9.mp4`（H.264・yuv420p・faststart）＋ `_drive.mp4`（100MB 未満に自動調整）
- 複数比率: `npm run mv -- --aspects 16:9,9:16,1:1,4:5`、4K: `"4Kで"`
- サビの縦ハイライト: `npm run mv -- --highlight`
- DaVinci Resolve 21: `npm run mv -- --davinci` → 透過の歌詞レイヤー（ProRes 4444 .mov）＋ FCPXML（ファイル → 読み込み → タイムライン）
- 歌詞レイヤーだけ: `npm run overlay`

## Windows
ffmpeg が無くても Remotion 同梱の `npx remotion ffmpeg` を自動で使う（遅めなら `winget install Gyan.FFmpeg`）。

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
