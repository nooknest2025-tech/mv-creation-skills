---
name: mv-intake-analysis
description: 曲・歌詞・画像/動画を受け取って解析するとき（input/ の確認、BPM・セクション・エネルギー、歌詞の書き起こしや位置合わせ）。MV制作の最初の工程。
---

# mv-intake-analysis

**モデルの目安: 軽い/速いモデル＋推論 low〜medium で十分**（決まった手順をコマンドで回す工程。`codex --profile mv-run`）

## 制作全体との接続

新規MV制作では [mv-workflow](../mv-workflow/SKILL.md) を入口にする。ファイル確認・曲尺や拍の解析は演出提案の材料として先に進めてよい。自動プレビューは解析・配置の初稿であり、演出の合意や完成確認の代わりにしない。作り方が未選択なら、本番用プリセットを勝手に確定しない。

## やること
1. `input/` を見る。曲が無ければ止めて「input に mp3/wav を入れてください」と伝える。
2. `cd remotion && npm run mv -- --stills-only` を実行。最初に日本語の要約（何を使い、何を自動で補うか）が出る。
   - 歌詞JSON / SRT / LRC / VTT / ASS → そのまま使う
   - 歌詞 .txt だけ → faster-whisper で音声に位置合わせ（無料・ローカル）
   - 歌詞なし → faster-whisper で書き起こし（ボーカル無しの曲は 0 行で正常）
   - 画像/動画なし → 曲に反応する抽象映像
   - `input/stems/vocals.wav` があれば書き起こしに使う
3. 解析結果（BPM・セクション）が変なら直す: `npm run edit -- "BPMは128"`、拍がずれていたら `"拍を半拍ずらして"`。見て直すなら `npm run timing`。
4. 手で直した値は `timing.locked` に入り、再解析しても消えない。

## 注意
- faster-whisper が無いと言われたら `pip install faster-whisper`。急ぎなら歌詞なしで進めてもよい。
- 自動書き起こしは誤字が出る。歌詞テキストが提供済みか確認し、提供されていなければ有無を聞く。提供済みの歌詞を再要求しない。自動同期の後は `mv-timing-edit` で音付きの確認へ進む。

## パック内での実行

このファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。
