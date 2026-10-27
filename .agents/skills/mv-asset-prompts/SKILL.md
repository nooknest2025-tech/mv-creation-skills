---
name: mv-asset-prompts
description: 画像や動画を生成AIで作るためのプロンプトを用意するとき（Grok アプリ、Gemini、どのツールでも）。無料の手動ルートが基本。
---

# mv-asset-prompts

**モデルの目安: 標準モデル＋推論 medium**（迷ったら mv-direct で方針→ mv-run で実行）

## やること（無料ルート）
1. `npm run gen -- plan` → `projects/<曲名>/gen_plan.md` と `prompts.csv` が出る（セクションの最初のショット＝見せ場だけ。`--sections chorus` や `--shots S001,S058` で絞れる）。
2. プロンプトは英語、プリセットの雰囲気・セクションのムード・カメラの動き・画面比入り。`mv.config.json` の `subject` に主役（例: "a girl with red streaked black hair, gothic outfit"）を書くと全ショットに入る。
3. ユーザーが Grok アプリ / grok.com / Gemini アプリ などで手動生成 → できた画像は `input/` に、ショット専用の動画は `gen/takes/<ショットID>/` に入れる。
4. 画像だけでも静止画モードで十分派手になる（疑似2.5D・Ken Burns・光漏れ・粒子・拍揺れ・拍トランジション・セクション別グレード）。

## 一貫性のコツ
同じ主役の説明文・同じ色の言葉・同じ画角の言葉を毎回使う。参照画像を渡せるツールなら1枚目の画像を毎回渡す。

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
