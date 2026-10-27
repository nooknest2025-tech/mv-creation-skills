# 共通編集UI（ブラウザで歌詞・シーンを直して MP4 に書き出す）

どのプロジェクトでも使える、ブラウザの編集画面です。特定の曲や特定の PC のフォルダには依存しません。
GitHub からこのパックを入れた人なら、同じ画面を自分の曲で使えます。

## できること
- 歌詞の行の **結合**（次の行をまるごと／一部の文字だけ）と **分割**、開始・終了秒の調整
- シーンの切替秒、フェード秒、画像の位置（-100〜100）と拡大（1〜3倍）
- リリックモーションの選択（**カタログから自動で一覧化**。基本32・ムード別32・pro-motion の `pro_*`・`npm run style:new` で足した独自スタイルもすべて出ます。今回の追加: `join_left_right` 左右から合流 / `join_top_bottom` 上下から合流 / `leave_left_right` 左右へ分かれる / `leave_top_bottom` 上下へ分かれる）
- 書体（カテゴリ別。PC に実ファイルがある日本語書体だけを表示）、入り方・消え方・色・角度・配置・文字効果
- 見本を「この行／チェックした行／全行」に適用、取り消し、編集履歴
- 保存（`editor-state.json`。保存前の版は `edit-history/` に残る）と、保存した内容での MP4 書き出し

歌詞の本文は変えられません（元の歌詞の欠落・重複・並び替えはサーバー側で拒否します）。

## 必要なもの
- このパックの `setup`（`remotion/` で `npm install` 済み）
- Node.js 18 以上、Python 3.9 以上（`python3` / `python` / `py` を自動で探します。別の場所なら `MVPACK_PYTHON`）
- 書き出しに Chrome / Chromium と ffmpeg（見つからなければ Remotion 同梱のものを使います。指定は `MVPACK_BROWSER` / `MVPACK_FFMPEG`）
- 素材は **静止画（png/jpg/webp/svg）＋音源＋時刻つき歌詞 JSON**。動画素材のプロジェクトは Remotion Studio（`npm run studio`）を使ってください

## 起動（`remotion/` フォルダで）
```bash
# 1) まず見本で試す（8秒の音・画像2枚・歌詞3行を自動で作ります）
npm run editor -- --demo --project editor-demo

# 2) npm run mv（start）で作ったプロジェクトを開く（画像だけの曲なら自動で引き継ぎ用ファイルができます）
npm run editor -- --project <曲名>

# 3) ファイルを直接指定して開く
npm run editor -- --project <名前> --audio 曲.wav --lyrics 歌詞.json --images 画像1.png,画像2.png
#   見本: --lyrics editor/sample/lyrics.json --images editor/sample/scene1.svg,editor/sample/scene2.svg
```
表示された `http://127.0.0.1:5194/editor.html` をブラウザで開きます（ポート変更は `--port 5200`）。
止めるときはターミナルで Ctrl+C。もう一度同じコマンドで起動すると、**保存済みの編集から再開**します。

歌詞 JSON の形: `{"duration": 曲の秒数, "lines": [{"text": "歌詞", "start": 0.4, "end": 2.5}, ...]}`（`song.json` もそのまま使えます）。

## できるファイル（`projects/<名前>/out/editor/`）
- `editor-state.json` … 編集の正本 / `original-source.json` … 元の歌詞・素材（検証用）
- `edit-history/` … 保存ごとの前の版
- `edit-r<版>-<時刻>.mp4` … 書き出し結果（同名 `.json` はその時の設定、`.log` は書き出しログ）
- 元の音源はコピーして保持し、`audio-integrity.json` にハッシュを記録（MP4 の音声は AAC に変換）

## 書体とライセンス
- `npm install` の最後（と編集UIの起動時）に、編集UI用の **29書体** を自動で用意します。すでにあるものは飛ばします。ネットにつながらなくても install は失敗せず、手元の書体だけで使えます（あとで `npm run fonts:editor` で再試行）。
  - Google Fonts の27書体（OFL-1.1 / Apache-2.0。ライセンスを確認してから保存し、ライセンス文も保存）
  - 暗黒工房（作者: maki）の「怨霊」「吐き溜」: **作者の公式サイトから直接**ダウンロードし、ファイルは一切変更しません。リポジトリには入れていません。編集UIで選ぶと作者名と利用条件ページ（https://www.ankokukoubou.com/font/ankokuzonji.htm ）が表示されます。詳しくは `editor/FONT-LICENSES.md`
- 自動ダウンロードを止めたいとき: 環境変数 `MVPACK_SKIP_FONT_DOWNLOAD=1`、または起動時に `--no-font-download`

## 確認済み / 未確認（正直に）
- 確認済み（Linux, 2026-10-27）: 見本での起動、API での保存、不正な保存（歌詞本文の改変）の拒否、再起動後に保存内容が残ること、MP4 書き出し（1280×720 h264 + AAC、8秒）で編集（モーション `pro_pop`・文字色・シーン拡大）が映像に反映されること、ファイル指定版の準備。
- 未確認: Windows / macOS での起動と書き出し、ブラウザ画面の全操作の手動確認（今回は API とレンダリング結果で確認）、`npm run mv` → `--project <曲名>` の引き継ぎの実曲での通し確認。
