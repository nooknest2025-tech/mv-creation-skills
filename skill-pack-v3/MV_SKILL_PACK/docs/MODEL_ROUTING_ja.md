# どの工程にどの強さのモデルを使うか（Codex）

モデル名はアカウントや時期で変わるので、ここでは **「強いモデル」「標準」「軽い/速いモデル」** という段階で書きます。
実際の名前は Codex で `/model` を開いて、表示されたものから選んでください。

## 工程ごとの目安

| 工程（スキル） | 目安 | 理由 |
|---|---|---|
| 制作全体の入口・作り方の選択（mv-workflow） | 強い＋推論 high | 作り方・構成・確認状況の判断が多い |
| 方向性・絵コンテ（mv-concept-storyboard） | 強い＋推論 high | 曲の解釈・演出の組み合わせなど判断が多い |
| 生成プロンプト作成（mv-asset-prompts） | 標準＋medium | 型に沿って書くが、一貫性の判断が要る |
| 動画生成の計画・見積もり（mv-video-generation） | 標準＋medium | 計算はスクリプト。モデル選びの説明だけ判断 |
| 新しい文字の動きを作る（mv-style-create） / 立ち絵モーションMV（mv-tachie-motion） | 強い＋推論 high | 実装と見た目の確認が要る |
| キャラの動き・パーツアニメ（mv-character-motion） | 標準＋medium | 取り込みはスクリプト。支点のずれなどの判断だけ |
| 文字演出（mv-lyric-motion） / カット調整（mv-beat-edit） / 仕上げ（mv-finishing） / QA（mv-qa） | 標準＋medium | 日本語の指示 → `npm run edit` が主。迷う相談だけ強いモデルへ |
| 解析・取り込み・書き出し・タイミング・版管理（mv-intake-analysis / mv-import-clips / mv-export / mv-timing-edit / mv-shotlist-manifest） | 軽い/速い＋low〜medium | コマンドを順番に回すだけ |

コツ: **方針を決める会話は強いモデル、決まったら軽いモデルで回す**。レンダリング自体はモデルの強さと無関係（PCで動く）なので、待ち時間に強いモデルを使う必要はありません。

## Codex のプロファイルで切り替える

Codex は `codex --profile 名前` で `~/.codex/config.toml` の上に `~/.codex/名前.config.toml` を重ねて読みます（プロファイルごとに別ファイル、キーはトップレベルに書く）。
出典: Codex 公式ドキュメント「Advanced Configuration › Profiles」 https://developers.openai.com/codex/config-advanced （2026-10-26 確認）

`~/.codex/mv-direct.config.toml`（演出を決める用）
```toml
model = "<ここに /model で選べる強いモデル名>"
model_reasoning_effort = "high"
```

`~/.codex/mv-run.config.toml`（コマンドを回す用）
```toml
model = "<ここに /model で選べる軽い/速いモデル名>"
model_reasoning_effort = "low"
```

使い方:
```
codex --profile mv-direct     # 「どんなMVにする？」の相談
codex --profile mv-run        # npm run mv / edit / export を回す
```
- `model` 行を書かなければ、いつものモデルのまま推論の強さだけ変わります（いちばん安全）。
- 会話の途中なら `/model` で切り替えてもOK（Codex の仕様で選んだモデルは保存されることがあります。元に戻すのを忘れずに）。
- 古い書き方 `[profiles.名前]` は新しい Codex（0.134.0 以降）では読まれません（同じ公式ページに記載）。

## スキルの置き場所
Codex はリポジトリ内の `.agents/skills/` と、個人用の `~/.agents/skills/` を自動で読みます（`~/.codex/skills` は旧い場所で非推奨）。
出典: https://learn.chatgpt.com/docs/build-skills.md （2026-10-26 確認）
