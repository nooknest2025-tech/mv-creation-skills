---
name: mv-shotlist-manifest
description: ショット一覧・バージョン管理・承認ロックを扱うとき。「v2を承認」「前の版に戻して」「どのカットが何秒？」。
---

# mv-shotlist-manifest

**モデルの目安: 軽い/速いモデル＋推論 low〜medium で十分**（決まった手順をコマンドで回す工程。`codex --profile mv-run`）

## 仕組み
- `projects/<曲名>/manifest.json` に各レンダーの版（v1, v2…）、設定のスナップショット、出力ファイル、QA 結果が記録される。
- ショット（S001…）はカット計画から自動生成。`npm run timeline` で PNG の全体図、`npm run timing` でブラウザ編集。
- 承認: `npm run approve -- 2` → その版のファイルは読み取り専用になり、以後の mv 実行は新しい版番号で出力（上書きしない）。

## 採用と編集の記録

ショットIDは再生成後も維持し、テイク/確認版/採用版を別項目にする。「生成成功」「保存済み」「元曲付き確認版へ反映済み」「ユーザー採用」は異なる状態。表示中のページが古い場合は版を確かめてから修正対象を判断する。採用された例外を古い要修正ラベルのまま残さない。

生成元の相対パス・実測尺/fps・ハッシュ、採用テイク、素材側の開始/終了、30fps等のタイムラインの整数開始フレームと長さ、速度/クロップ/効果を記録する。MCP参照ID等の制作記録は配布物と分ける。

Studioの編集正本と自動処理の整合は [保存と再編集](../mv-workflow/references/review-and-studio.md) に従う。正本を丸ごと再生成して手動の位置・タイミング・キーを消さない。

## 1ショットだけ変える
`mv.config.json` の `timing.perShot.S012 = { "start": 31.2, "end": 32.0, "src": "project/media/003.jpg", "move": "push", "transition": "flash" }`
（手で直したら locked。生成AIのテイクを採用したときもここに入る）

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
