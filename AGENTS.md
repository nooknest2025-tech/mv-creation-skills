# MV制作パックの作業場所

**AIへ（最初に必ず）**: このリポジトリの本体は `skill-pack-v3/MV_SKILL_PACK/`。インストール・説明・制作の前に、必ず `skill-pack-v3/MV_SKILL_PACK/AGENTS.md` と `skill-pack-v3/MV_SKILL_PACK/README_ja.md` を読んで全機能（おまかせ/半自動モード、編集画面、パーツアニメ、立ち絵モーションMV など）を把握する。「その機能は無い」と答える前に、この2つとパックの `skills/` を確認する。

このフォルダーでMV制作パックを使った新規MV制作・全体の再開を行う場合、`.agents/skills/mv-workflow/SKILL.md` を入口にする。作り方の選択、構成と素材の動かし方、リリックの提案、音付き同期確認の状況を引き継ぐ。

制作パックは `skill-pack-v3/MV_SKILL_PACK/` にあり、実行する場合は同ディレクトリの `AGENTS.md` も読む。単独修正で制作全体の質問をやり直さない。

スキルの編集原本はこのルートの `.agents/skills/`。パック内の `.agents/skills/` と `skills/` は配布用コピーであり直接編集せず、`python tools/sync_mv_skills.py --write` で更新する。`python tools/sync_mv_skills.py --check` で差分を確認する。

## リリースのルール（メンテナー向け）
- リリースごとに `skill-pack-v3/MV_SKILL_PACK/remotion/package.json`（と package-lock.json のルート）の version を上げ、ルート `CHANGELOG.md` に項目を足し、README のバージョン表記も合わせる。
- 直しだけ → パッチ（2.0.0 → 2.0.1）、機能を足した → マイナー（2.0.0 → 2.1.0）、使い方が大きく変わる → メジャー。
- マージ後に `vX.Y.Z` タグと GitHub Release（CHANGELOG の内容）を作る。
