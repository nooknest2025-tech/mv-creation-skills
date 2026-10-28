---
name: mv-video-generation
description: 有料の動画生成 API（xAI Grok Imagine など）や MCP でショット動画を作るとき、料金を見積もるとき、テイクを比較・採用するとき。
---

# mv-video-generation

**モデルの目安: 標準モデル＋推論 medium**（迷ったら mv-direct で方針→ mv-run で実行）

## 絶対ルール
- 既定は「自分で作る → 入れる」（無料）。シーンごとのプロンプトと添付（役割: キャラ参照／スタイル参照／背景参照／開始画（first frame）／終了画、ファイルの場所）を `video_todo.md`・`prompts.csv` と画面で渡し、できた動画は `input/made/` → `npm run made`（「作ったの入れた」）で取り込む。
- MCP・生成APIを呼ぶ前は**毎回**、シーンごとのプロンプトと添付（書き換え・スキップ可。`prompts.csv` の use 列＝スキップ、prompt 列＝書き換え）と見積もりを見せて確認を取る（`npm run gen -- run` も同じ表示をしてから確認）。ウィザードの選択肢には金額を出さない。
- 既定は無料。**有料生成は日本語で見積もりを見せ、ユーザーが金額に OK と言ってから**。
- 価格は `gen/models.yaml` の確認済みの値だけ使う（`verified: false` は「未確認」と言う。推測しない）。古ければ公式ページを再確認して日付を更新。

## 音声を添付する生成では、生成秒数と添付音声の秒数を一致させる

リップシンク・ダンス・演奏など、実曲に合わせる生成で音声を添付する場合に適用する。MCP、API、ブラウザでの手動添付のどれでも同じ。元の音源は保持し、添付用の区間音声を別ファイルとして作る。

1. ツール仕様から、音声入力と音声に同期した生成への対応、選べる生成秒数、音声形式・サンプルレート・長さの制約、自動的な尺変更の有無を確認する。音声を受け取れるだけで同期生成が保証されるとは判断しない。
2. **先に生成秒数Dと実曲内の開始位置Sを決め、元曲の[S, S+D)だけを切り出す。生成設定のDと、実際に添付する音声ファイルの実測尺を一致させてから送信する。** 例：5秒生成で曲の12.3秒から使うなら、12.3〜17.3秒の5秒音声を添付する。全曲や長い区間を添付してツール側の自動調整に任せない。
3. 音声の速度・テンポ・ピッチを変えない。タイムストレッチ、早送り・スロー、ループ、フェード、無断の無音追加で尺を合わせない。サンプルレート変換が必要なら実時間を維持する。区間の開始・終了はサンプル単位で扱い、丸めによる誤差も記録する。
4. 生成が5秒単位などの制約なら、その秒数分の実曲区間を確保して切り出し、編集で必要な範囲だけ使う。開始位置・生成区間・編集で使う範囲の対応を記録する。曲末などで必要な長さの音声が取れなければ、開始位置を調整するか、別の対応秒数・ツールを選ぶ。勝手に水増しや伸縮をしない。
5. 送信前に切り出したファイルを測定する。可能ならPCM WAVを使い、サンプル数÷サンプルレートで尺を検証する。許容誤差はPCMで1サンプル以内を目安とし、コーデックのパディングやコンテナ表示で差がある場合は復号後の有効音声尺を確認する。差を解決できなければ添付・生成せず、形式やツールを変更する。例示したWAVが全ツールで使えるとは仮定しない。
6. **検証した区間音声そのものをアップロードし、そのアップロード結果を生成ジョブの音声入力に指定する。** 切り出したのに元の全曲を添付する取り違えを防ぐため、ショットID、S、D、ファイルパス、ハッシュ、実測尺、アップロード先の参照ID、生成設定を記録して照合する。認証情報や署名付き一時URLは保存しない。
7. 生成後も動画の実測尺をDと照合し、元の実曲を同じSから速度1倍で合わせ、冒頭・中盤・末尾の口や拍のずれを音付きで確認する。同じ尺でも内部の動きが伸縮されることはあるので、尺一致だけで同期済みとしない。大きな同期不良を無断の速度変更で隠さず、別テイク・別設定・別ツールを検討する。一方、ユーザーが生成後の映像の速度調整を求めた場合は、元曲を変えず [mv-timing-edit](../mv-timing-edit/SKILL.md) の局所編集として記録・確認する。生成前の添付音声の尺合わせとは別の工程。再生成は承認済み予算に従う。

元曲を使ったMVの最終音声は元曲を基準にし、生成ツールの再生成音声へ置き換えない。音声非対応のツールに、プロンプトだけで正確なリップシンクや実曲同期ダンスができると説明しない。

## 一貫性・演技と再生成

参照は本人/服/機材だけでなく、必要な背景と構図も含めて役割を明記する。背景が逸脱した場合、前回の入力画像と送信パラメーターを確認する。既に白背景の参照を使ったのに「次は白背景画像を付ければ解決」と説明しない。背景や機材の統一は生成結果でも確認し、参照の存在だけで成功を保証しない。

リップシンクの可否は実際のモデル/経路の音声入力仕様で確認する。音声出力ONと、入力した元曲への口同期は別機能。別モデルを指定されたら現在の正確なモデルID・参照経路・秒数・音声対応・見積もりを確認し、同じ7秒でも価格が同じと推測しない。

強い歌唱では、発音に応じた口と顎、支えた姿勢、頬/首元の自然な発声の動きと目線を具体化する。瞬きや手の動きは指示しただけで実現済みとしない。過剰なしかめ顔や同じジェスチャーの反復も確認する。

再生成より編集で直せる問題も切り分けるが、髪/ヘッドホンを欠損させる背景合成や、衣装破綻が残るクロップを完成版へ無断採用しない。費用承認の単位をショット・テイク数・上限で記録し、自動の有料リトライを増やさない。

生成ジョブを送った後はIDを保存し、ツールの自動更新/結果カードの規約に従う。再開時やユーザーの状況確認時は既存IDを読む。成功、ダウンロード、元曲との合わせ、確認ページへの反映、ユーザーの採用を分けて報告する。

## 手順
1. `npm run models` — 全モデルの価格・最大解像度・最大秒数・得意分野・確認日・出典。
2. `npm run gen -- plan [--sections chorus] [--res 720p] [--takes 2] [--model id]` — ショットごとのおすすめモデルと理由、`$/秒 × 秒 × テイク数` の見積もり、無料の代わり（静止画モード・アプリで手動）。
   - おすすめの考え方: 顔のアップ/リップシンク/サビの見せ場 → 上位モデル、つなぎ/背景 → 最安モデル。
   - 上書き: 全体 `mv.config.json` の `gen.model`、ショット別 `gen.perShot.S058 = "grok-imagine-video-1.5"`。
3. OK をもらったら `npm run gen -- run --confirm <合計金額>`（金額が一致しないと動かない。上限 `--cap`、既定 $20）。API キーは環境変数（`XAI_API_KEY`）。ファイルに書かない。
4. MCP や手動で作ったテイクも `gen/takes/<ショットID>/` に置けば同じ扱い。
5. `npm run gallery` → ブラウザでショットごとに再生・比較・採用・却下・再生成希望・メモ。**採用するとタイムラインに自動で入る**（timing.perShot.src）。→ `npm run mv`。

## 現状
xAI の自動実行アダプタはリクエストを組み立てるところまでテスト済みで、実際の API 送信は未検証。他社は prompts.csv を使った手動か、アダプタを追加（scripts/gen.ts の ADAPTERS）。

## Any video MCP (Pollo / Grok / Runway / Kling …)
- First discover the tools actually available in this session and read their current schemas. Service names in this document are examples, not proof of a connection. Check supported inputs, durations, aspect ratios, estimates, status and result retrieval without submitting a generation job.
- Follow the MCP planning and approval stages in [mv-workflow](../mv-workflow/SKILL.md). Prefer the service's current estimate for the selected model and options over a stale local price table. Report credits as credits unless a verified conversion is available; do not submit a paid job with unknown cost.
- Plan with `npm run gen -- plan [--provider pollo]`, then read `projects/<曲>/gen_tasks.json`.
  - Each task carries: shot, seconds, aspect, prompt, reference_image, suggested_model, mcp_model, estimated_usd, save_to.
- Show the total and get an explicit OK. For credit-based MCPs, use the MCP's own estimate tool (Pollo: `pollo_estimate_generation_cost`).
- Call the user's MCP:
  - img2video when reference_image is set, otherwise text2video.
  - Save the job ID and follow the current tool's completion mechanism. If its result card updates automatically and it prohibits polling, do not poll. On an explicit status request or a resumed task, retrieve the existing job as permitted. Never submit it again just to check status; keep retries within the approved scope and budget.
- Run `npm run gen -- import <file|URL|folder> --shot S012 --from pollo`, then `npm run gallery` to adopt.
- Preview the takes and check reference fidelity, unintended deformation/cropping, motion, duration and aspect ratio before adoption. Record the provider, model, job ID, approved cost/scope, local result and adopted take in the project, without API keys or signed temporary URLs.
- Full guide: `docs/VIDEO_MCP_ja.md`. Prices exist only in `gen/models.yaml`, with source and date; never guess one.

## この環境でのパックの場所

作業ディレクトリまたは上位ディレクトリから、`AGENTS.md` と `remotion/package.json` を持つ制作パックのルートを確認する。管理用ワークスペースに `skill-pack-v3/MV_SKILL_PACK/` がある場合はそこを使う。PC固有の絶対パスを前提にしない。コマンドはパック内の `remotion/` で実行する。
