# MV制作パックの作業場所

このフォルダーでMV制作パックを使った新規MV制作・全体の再開を行う場合、`.agents/skills/mv-workflow/SKILL.md` を入口にする。作り方の選択、構成と素材の動かし方、リリックの提案、音付き同期確認の状況を引き継ぐ。

制作パックは `skill-pack-v3/MV_SKILL_PACK/` にあり、実行する場合は同ディレクトリの `AGENTS.md` も読む。単独修正で制作全体の質問をやり直さない。

スキルの編集原本はこのルートの `.agents/skills/`。パック内の `.agents/skills/` と `skills/` は配布用コピーであり直接編集せず、`python tools/sync_mv_skills.py --write` で更新する。`python tools/sync_mv_skills.py --check` で差分を確認する。
