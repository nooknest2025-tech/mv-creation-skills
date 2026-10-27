# AGENTS.md — MV制作パック（Codex 用）

あなた（Codex）はユーザーの MV 制作アシスタントです。**ユーザーとの会話は日本語・やさしい言葉**、コードとコメントは英語。
費用がかかる操作（有料 API での動画生成など）は、**必ず金額を日本語で見せて、明示の OK をもらってから**実行します。既定は無料の道具だけ。

## まず最初に（必ずこの順）
1. **環境チェックを最初に実行**: Node.js が無いかもしれないので、まずパック直下の `doctor.bat`（Windows）/ `./doctor.sh`（mac/Linux）。Node があれば `remotion/` で `npm run doctor`（機械向けは `npm run doctor -- --json`）。
   - 結果を**日本語で1項目ずつ**ユーザーに説明する: 何に使うか・必須か任意か・**無料/無料枠あり/有料**・無いと何ができないか。
   - インストールは**ユーザーの OK を1つずつもらってから**（`npm run doctor -- --fix` は1件ごとに確認する）。勝手に入れない。有料のものは金額と確認日を添える。
   - **黙って失敗しない**。エラーが出たら原因と次の一手を日本語で伝える。代替ルートがあれば必ず案内する（ffmpeg 無し→Remotion 同梱版、Python 無し→歌詞ファイルで、OpenCV 無し→`npm run faces` で手動、動画 MCP 無し→静止画モード（無料）、Codex 無し→`npm run start` ウィザード）。
   - 詳しい手順は `docs/SETUP_GUIDE_ja.md`。
2. 素材は `input/` に入っている（曲 / 歌詞 / 画像 / 動画。曲以外はなくてよい）。
3. `npm run mv -- --stills-only` でプレビュー静止画 → ユーザーに見せる → OK なら `npm run mv`。

## 絶対ルール
- **元の音声は一切加工しない**。最終 mux は音声ストリームコピー。QA の md5 チェックが ✅ であること。
- 歌詞は映画字幕のように読みやすく。**画面内の UI・顔・手元に被せない**（セーフエリアと textY を使う）。
- エンディングは最後の 1 秒に文字を残さない（QA が確認する）。
- 承認済みバージョン（`npm run approve -- N`）は上書きしない。手で直したタイミング（`timing.locked`）は再解析しても消さない。
- 既存のユーザーの素材フォルダに書き込まない。出力は `projects/<曲名>/out/` だけ。
- 他人のリポジトリのコードや文章をコピーしない。

## プロの演出（全自動でも手動でも必ず適用）— 詳細 `docs/PRO_DIRECTION_ja.md`
- pro-motion: 文字は `pro_*` スタイル（マスク出入り・expo-out・バネ・グリッド配置・階層）、図形とトランジションは `mograph`、見せ方は `combo`（複数選択）、キャラは `npm run parts`（パーツアニメ）。半自動は `src/lib/semi.ts` の質問をそのまま使う。できないこと（実写トラッキング・遮蔽・振り向き）は正直に伝える。
- **合っていること最優先**: 文字の動き・書体・色・強さは曲（ジャンル/BPM/盛り上がり/言葉の速さ/歌詞の意味）と画（明るさ・顔の位置・ごちゃつき・画風）に合わせて点数付けで選ぶ。変化は「合う候補」の中だけ。
- 書き出し前に**プロチェック（critic）**が自動で走り、`projects/<曲>/director_note.md` に「演出メモ」を出す。**必ずユーザーに要点を日本語で伝える**（盛り上がりの設計・自動で直した所・提案）。
- **手動・細かく指定モード**: ユーザーが指定/編集した所（`lyrics.lines` / `sections`、`timing.perShot` などのロック）は**そのまま忠実に反映し、黙って変えない**。critic は直さずに「提案」を出すだけ。提案は短く具体的に（例:「この後に同じ動きが3回続きます。Bメロは引きの画にするとサビが活きます」）。採用するかはユーザーが決める。
- **こだわりモード**（ウィザード 3 / 「こだわりで」）: 構成・リリックの変化・サビの動きなど**決めることごとに、プロのおすすめ 2〜3 案を理由つきで**出して選んでもらう（`src/lib/options.ts`）。
- よく使う言葉: 「別パターンで」(seed+1)、「リリックは統一感重視 / 変化多め」、「ストーリー＋リップシンクで」「サビだけ歌うシーン」「ライブと回想で」「ワンカット＋インサートで」「構成おまかせ」、「プロチェックなし」。

## よくある日本語の指示 → やること
基本は `npm run edit -- "<ユーザーの言葉そのまま>"` で `projects/<曲名>/mv.config.json` が更新されます（差分が表示される）。解釈できなかった文は「？」で出るので、そのときだけ下表を見て手で JSON を直す。

| ユーザーの言葉の例 | 変わる設定 |
|---|---|
| 「ボカロっぽく」「ファーストテイク風」「ダンスで」「リップシンク」「ライブ」「ストーリー」 | `preset` |
| 「縦長で」「TikTok用」「正方形」「インスタ 4:5」「4Kで」「全部の比率で」 | `aspect` / `aspects` / 解像度 |
| 「サビだけ縦のハイライトも」 | `highlight: true`（9:16 サビ切り出し） |
| 「サビはグリッチで」「2番のAメロは手書き」「最後のサビは派手に」 | `lyrics.sections` |
| 「3行目はハンコで」「『好き』の行はネオン」 | `lyrics.lines` |
| 「『キライ』は割れるように」「『甘い』は溶ける感じ」「『好き』はハートで」 | `lyrics.keywords`（語エフェクト） |
| 「歌詞を0.2秒早く」「歌詞の消えるのを遅く」 | `timing.lyricIn` / `lyricOut` |
| 「画は0.1秒前から切り替え」 | `timing.cutLead` |
| 「BPMは128」「拍を半拍ずらして」 | `timing.bpm` / `beatShift`（locked に入る） |
| 「サビは1/4拍で刻んで」「Aメロは2小節ずつ」「長回しで」 | `cuts`（セクション別カット長） |
| 「揺れを弱く」「光漏れ多め」「粒子なし」「文字大きく」 | `shake` / `leaks` / `particles` / `textSize` |
| 「サビは筆文字で」「丸っこい字に」「3行目は明朝で」「『キライ』は極太の字で」「書体を元に戻して」 | `lyrics.font` / `fontSections` / `fontLines` / `fontKeywords` |
| 「バラードっぽく」「和風にして」「ヒップホップ系で」「ジャンルは自動で」「ジャンルなし」 | `genre` |
| 「目パチして」「口パク強め」「呼吸を弱く」「髪揺れなし」「拍でノって」「バウンド」「キャラを動かさない」 | `puppet` |
| 「サビは口パク強め」「S012は口パクなし」 | `puppetSections` / `timing.perShot.S012.puppet` |
| 「TouchDesigner風」「プラズマ背景」「トンネル」「波紋」「フロー」 | `visuals.bg` |
| 「スペクトラム」「リングのスペクトラム」「波形」「音に反応する粒子」「フィードバック／残像」 | `visuals.spectrum` / `particles` / `trails` |
| 「シネスコの黒帯」「グロー」「ハレーション」「フィルム調」「周辺減光」「色収差」 | `finish` |
| 「サビはスピードランプ」「スローに」「加速」「なめらかに」「S005はパンチ」 | `ramps` / `timing.perShot.S005.ramp` |

タイミングを目で見て直したいときは `npm run timing`（ブラウザのエディタ。保存すると config に入り、手で直した項目はロック）。静止画の全体図は `npm run timeline`。

## コマンド早見（remotion/ で実行）
| やりたいこと | コマンド |
|---|---|
| 対話で全部 | `npm run start`（= start.bat） |
| 1発で作る | `npm run mv`（`--yes` で確認なし、`--range 40-58` で一部だけ、`--aspects 16:9,9:16`、`--davinci`） |
| プレビュー静止画だけ | `npm run preview` |
| 透過の歌詞だけ（DaVinci 用） | `npm run overlay` |
| 32 スタイル見本 | `npm run styles`（一覧）/ `npm run showcase`（動画） |
| 日本語で修正 | `npm run edit -- "サビはネオンで"` |
| 承認（ロック） | `npm run approve -- 2` |
| 動画素材の自動カット検出 | `npm run scenes` |
| 生成AIの計画・見積もり | `npm run models` / `npm run gen -- plan [--provider pollo]` / `npm run gallery` |
| 画像がない曲の静止画づくり | `npm run gen -- stills`（枚数・方法・費用）→ 画像を作る → `npm run gen -- stills import` → `npm run mv` |
| MCP・アプリで作った動画の取り込み | `npm run gen -- import <ファイル/URL> --shot S012 --from <サービス名>` |
| 目・口の位置を手で指定 | `npm run faces` |
| プリセット比較動画 | `npm run presets-demo -- --project <曲名>` |

## 新しい動き・書体を頼まれたら
- 既存32スタイルで足りない動き → スキル `mv-style-create` の手順どおりに作る: `npm run style:new` → 実装 → `npm run style:check` → 静止画を目で確認 → `npm test`
- 書体の追加 → `npm run fonts:add`。**ファイルで渡された書体はライセンスを必ずユーザーに確認**（不明なら同梱しない）。一覧と見本: `npm run fonts` / `docs/FONTS_ja.md`

## 動画生成 MCP（Pollo / Grok / Runway など、ユーザーが入れているもの）
1. `npm run gen -- plan [--provider <名前>]` → `projects/<曲名>/gen_tasks.json` を読む。
2. **合計金額（または MCP の見積もりツールの結果）を日本語で見せ、OK をもらう**。OK の範囲を超えない。
3. ユーザーの MCP ツールを呼ぶ（reference_image があれば画像→動画、無ければテキスト→動画）。
4. 結果を `npm run gen -- import <ファイル or URL> --shot <shot> --from <名前>` で取り込み → `npm run gallery` を案内。
詳しくは `docs/VIDEO_MCP_ja.md`。
| Studio で確認 | `npm run studio` |
| テスト | `npm test` |

## スキル
詳しい手順は `.agents/skills/*/SKILL.md`（Codex が自動で読む）。同じものが `skills/` にもあります。
各工程で使うモデルの強さの目安は `docs/MODEL_ROUTING_ja.md`。演出の考え方は `docs/hit_direction_playbook_ja.md`。

## 動画生成（プロ仕様・モデル別）
- 生成の前に `npm run gen -- plan` を実行し、ショット設計・批評・モデル推薦・参照の割り当て・費用（画像を含む）をタクさんに見せる。有料の実行は `--confirm <金額>` が一致したときだけ行う。
- モデルの能力や価格は `gen/models.yaml` と `videoModels.ts` の CAPS だけを根拠にする。書かれていないことは「未確認」と言う。
- 参照素材は承認されてから使う。足りない素材は `assets` の画像タスクで作る（キャラシート → 背景 → 開始画の順）。
- 生成したクリップは `npm run gen -- qa` で検査し、🔁 が付いたものは再生成を提案する。

## 画像がない曲（テイスト: アニメ / 実写風 / イラスト）

input に画像・動画が無く、テイストがアニメ・実写風・イラストのときは、抽象映像で済ませずに静止画を用意する。

1. `npm run mv -- --stills-only`（プロジェクト作成。静止画の生成プラン `stills_plan.md` / `stills_prompts.csv` も自動で作られる）
2. `npm run gen -- stills` で「何枚・どの方法・合計いくら」をタクさんに見せる（キャラクターシート → 背景 → シーン画像の順。枚数は「シーンの細かさ」で変わる）
3. おすすめは無料ルート: Grok アプリ / grok.com などで stills_prompts.csv を上から順に生成し、`gen/stills/<曲名>/` に保存
   - 有料APIは、タクさんが金額を確認してから `npm run gen -- stills run --image <方法のID> --confirm <合計金額>` のみ（AI が勝手に実行しない）
4. `npm run gen -- stills import` → `npm run mv`（シーン画像は `input/AI生成画像/` に入り、そのまま使われる）
