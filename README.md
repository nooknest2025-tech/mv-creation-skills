# MV制作スキル

このGitリポジトリではMV制作スキルの手順と配布用コピーを管理する。

- `.agents/skills/`：編集原本。
- `skill-pack-v3/MV_SKILL_PACK/.agents/skills/`：制作パックへ組み込む配布用コピー。
- `skill-pack-v3/MV_SKILL_PACK/skills/`：同内容の配布用コピー。
- `tools/sync_mv_skills.py`：補足資料を含む同期・リンク・差分の検査。

この更新はスキル配布用。Remotion/FFmpegの実行環境そのもの、曲専用の編集プロジェクト、音源・画像・生成動画は同梱しない。スキルを入れただけでStudio編集機能が自動導入されるものではない。制作パックの実行環境と併用し、必要ならスキルの手順で編集構成を追加する。

制作の入口は `mv-workflow`。シーン別確認ページを残しながら、希望者向けにRemotion Studioを併設する。元動画の保持、映像の尺/速度調整、元音源の保護、手動編集の永続化と実機検証を扱う。

```text
python tools/sync_mv_skills.py --write
python tools/sync_mv_skills.py --check
python -m unittest discover -s tools -p test_sync_mv_skills.py
```

原本のみを編集し、配布用コピーを直接変更しない。詳しい更新・検証範囲は `tools/MV_SKILL_REVIEW.md` を参照。

## 共通編集UI（制作パック同梱）

`skill-pack-v3/MV_SKILL_PACK/remotion/editor/` に、どのプロジェクトでも使えるブラウザ編集UIを同梱した（歌詞の結合・分割・秒数、シーン、全モーション・書体・色、保存、保存値での MP4 書き出し）。

```text
cd skill-pack-v3/MV_SKILL_PACK/remotion
npm install
npm run editor -- --demo --project editor-demo
```

使い方・必要なもの・確認済み範囲は `skill-pack-v3/MV_SKILL_PACK/docs/EDITOR_ja.md`。Windows/macOS での動作は未確認。
