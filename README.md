# MV制作パック（Codex など AI エージェント用・日本語）

バージョン: 2.1.0（変更点は [CHANGELOG.md](CHANGELOG.md)）

曲を入れるだけで、歌詞が動くMV（MP4）を作れる道具一式です。AI（Codex など）に日本語で話しかけて「サビはグリッチで」「縦長にして」のように直すこともできます。
既定は全部無料（PCの中で処理）。有料の生成AIは、使うときだけ金額を見せて確認してから使います。

本体は `skill-pack-v3/MV_SKILL_PACK/` にあります。全機能の説明は [skill-pack-v3/MV_SKILL_PACK/README_ja.md](skill-pack-v3/MV_SKILL_PACK/README_ja.md)、はじめての人向けは [QUICKSTART_ja.md](skill-pack-v3/MV_SKILL_PACK/QUICKSTART_ja.md) です。

## できること

- **1問ずつ・Enter でおすすめの start**（`start` で聞かれる順番。input フォルダの中身から答えを先に選んでおきます）
  1. **何がありますか？** … 曲と歌詞だけ（SRT/LRC/JSON等の歌詞データもOK）／＋画像／＋動画素材／＋キャラ素材（立ち絵・パーツ）
  2. **映像はどうする？** … 素材に合う選択肢だけ: 文字と図形だけ（文字PV）／画像だけで作る／画像を動画にする（全部 or 選んだシーンだけ）／動画も入れる／画像を作る（無料：Grokアプリ等で手作業。作った画像を動画にもできる）／立ち絵で作る。曲と歌詞だけなら **文字PV** がおすすめ。ウィザードに金額は出ません（全部無料が基本）
  - 画像・動画は自分で好きなアプリで作って `input/made/` に入れ、`npm run made`（「作ったの入れた」）で取り込み。シーンごとのプロンプトと添付画像（キャラ参照・背景参照・開始画 など、場所つき）を用意します。有料は MCP・生成APIにつなぐときだけで、直前にプロンプト・添付・見積もりを見せて毎回確認
  3. **ここから先は？** … おまかせ（追加の質問なし・おすすめ）／半自動（見せ方・ジャンル・シーンの細かさ・歌詞の雰囲気などを数問）／こだわり（決めることごとにおすすめ2〜3案を比較）。半自動・こだわりは 1・2 の答えに合う選択肢だけ出します（画像がないのに画像前提の構成は出ません）
  4. 画面の形 → **確認画面**（素材・作り方と理由・費用）→ Enter で開始。有料APIは勝手に使いません
- **編集画面（エディター）で後から全部直せる**: 歌詞の結合・分割・秒数、シーンの切替・画像位置、モーション（全カタログ）・書体・色をブラウザで直し、保存した内容で MP4 を書き出せます。どの作り方（画像MV・動画素材・文字PV（曲と歌詞だけ）・ジャンル/プリセット・立ち絵パーツアニメ）でも、編集画面用のプロジェクトが必ずでき、自動で作った見た目は「既定値」で、エディターでの変更が必ず優先されます
- **歌詞アニメーション 81種**: 基本34＋合流・分かれ4＋ムード別32（バラード・弾き語り・シティポップ/lo-fi・和風・ヒップホップ・アイドル・ロック・ダーク/ボカロ・チル）＋pro-motion 11＋語エフェクト
- **曲と画に「合う」自動演出**: ジャンル/BPM/盛り上がり/言葉の速さと画像解析（顔・ごちゃつき・明るさ）で選び、選んだ理由を日本語で表示
- **ハイブリッド構成12種**: 「ストーリー＋リップシンクで」「サビだけ歌うシーン」「ライブと回想で」など
- **パーツアニメ**: `npm run parts -- import キャラ.psd`（PNG フォルダ／1枚絵の自動分解も可）→ 支点・親子を自動推定 → 待機・うなずき・歌う・ノリ・手を振る・首かしげ
- **立ち絵モーションMV**: 全身キャラの立ち絵をパーツに分けて、拍に合わせて踊らせるMV（ボカロ・ゆっくり系のパーツアニメ）。口パク・歌詞レイアウト・ゲスト演出つき。`start` の「映像はどうする？」で「立ち絵で作る」を選ぶか（キャラ素材があると最初から選ばれています）、「立ち絵で」「立ち絵＋タイポグラフィで」と日本語でも指定でき、ほかの見せ方とも組み合わせられます。キャラ素材は `input/parts/` か `input/tachie/` に入れます。仕上げと書き出しは編集画面で（スキル `mv-tachie-motion`）
- **キャラが動く**: 目パチ・歌詞に合わせた口パク・呼吸・髪揺れ・拍でノる
- **プロのモーション・プロチェック**: 書き出し前に「同じ動きの連続・読めない文字・拍ずれ」などを点検し、自動の所は直し、ユーザー指定の所は変えずに提案だけ
- **新しい動きを AI に頼める**: 「花びらみたいに舞い落ちる字」など（スキル `mv-style-create`、`npm run style:new`）
- **書体111種**（無料・再配布OK）を曲・セクション・行・言葉ごとに指定
- 画像だけでも派手に（奥行き・光漏れ・粒子・拍に合わせた揺れ）、動画素材は良い場面を自動で探してビートで切る
- 音に反応する映像（スペクトラム・粒子・背景）、仕上げ（グレード・グロー・フィルム粒子・黒帯）も Remotion 内で
- 動画生成は どの MCP でも（Pollo・Grok・Runway…）取り込める
- 16:9（4K も可）/ 9:16 / 1:1 / 4:5、サビだけの縦ハイライト、DaVinci Resolve 用の書き出し
- 元の音声は一切いじらない（自動で md5 チェック）

編集画面と MP4 書き出しは Windows 11 実機で確認済み（2026-10）。まだできないこと・未確認のこと（macOS 実機など）は README_ja.md の最後に正直に書いています。

## はじめ方

### 1. 必要なもの
- **Node.js**（LTS 版・18 以上）: https://nodejs.org
- **ffmpeg**（無くても Remotion 同梱のものを自動で使います。Windows なら `winget install Gyan.FFmpeg` で速くなります）
- 足りないものは `doctor.bat`（Windows）/ `./doctor.sh`（Mac・Linux）が日本語で教えてくれます

### 2. インストール
```bash
cd skill-pack-v3/MV_SKILL_PACK/remotion
npm install
```
（Windows なら `skill-pack-v3/MV_SKILL_PACK/setup.bat` をダブルクリックでも同じことができます）

### 3. MVを作る
`skill-pack-v3/MV_SKILL_PACK/input/` に曲を入れて（歌詞・画像・動画はあれば）、
```bash
cd skill-pack-v3/MV_SKILL_PACK/remotion
npm run start
```
（Windows は `start.bat`、Mac・Linux は `./start.sh` でも可）。「何がありますか？ → 映像はどうする？ → ここから先は？（おまかせ / 半自動 / こだわり）」と1問ずつ聞かれ、Enter だけでおすすめで進みます。できたMP4は `projects/<曲名>/out/` に入ります。

### 4. 編集画面で直す
```bash
cd skill-pack-v3/MV_SKILL_PACK/remotion
npm run editor -- --demo --project editor-demo   # 見本で試す
npm run editor -- --project <曲名>               # 作ったMVを開く
```
表示された `http://127.0.0.1:5195/editor.html` をブラウザで開きます。詳しくは [docs/EDITOR_ja.md](skill-pack-v3/MV_SKILL_PACK/docs/EDITOR_ja.md)。

## AIへ

制作は `skill-pack-v3/MV_SKILL_PACK/AGENTS.md` と `skill-pack-v3/MV_SKILL_PACK/README_ja.md` を読んで全機能を把握すること。「その機能は無い」と答える前に、必ずこの2つとパックの `skills/` を確認する。

## 管理者向け（スキルの同期）

- `.agents/skills/`：編集原本。
- `skill-pack-v3/MV_SKILL_PACK/.agents/skills/`・`skill-pack-v3/MV_SKILL_PACK/skills/`：配布用コピー（直接編集しない）。
- `tools/sync_mv_skills.py`：補足資料を含む同期・リンク・差分の検査。

```text
python tools/sync_mv_skills.py --write
python tools/sync_mv_skills.py --check
python -m unittest discover -s tools -p test_sync_mv_skills.py
```

原本のみを編集し、配布用コピーを直接変更しない。詳しい更新・検証範囲は `tools/MV_SKILL_REVIEW.md` を参照。
