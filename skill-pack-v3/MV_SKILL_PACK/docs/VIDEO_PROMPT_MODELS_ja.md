# MV動画生成：モデル別プロンプトと検証

確認日: 2026-11-07。公式の説明を制作上の指針にまとめたもの。入力可能数、参照の記法、価格、秒数は利用サービスとモードごとに再確認する。ここにある例は設計案であり、生成テスト済みの品質保証ではない。

`npm run gen -- plan --model manual/wan-3.0` のように指定すると、対象ショットから手動生成向けの文を `prompts.csv` に作る。ほかに `manual/minimax-h3`、`manual/seedance-2.5`、`manual/kling-4.0`、`manual/grok-app` を選べる。Grok API は登録済みの `grok-imagine-video-1.5` などを指定する。手動プロファイルはAPI接続や料金確認を意味せず、添付や希望尺が使えるかは利用サービスで確認する。既に手で書き換えた `prompts.csv` の本文はモデル変更時も残る。自動生成されたままの本文は、新しいモデルに合わせて更新する。

## 最初に全モデル共通で決める

1. ショットの役割（感情・空間の提示・物語の転換・歌唱・ダンス・インサート）、尺、開始と終了の状態。
2. 人物と場所、フレームサイズ、視点、被写体の動き。カメラは別に移動方向・速度・追従対象を明記。固定ショットと移動ショットを同時に要求しない。
3. 画面の光・色・衣装・小物の連続性。前後ショットの視線、移動方向、ポーズ、動きのつながりを記録する。
4. 参照ごとに役割（人物、衣装、背景、演技、カメラ、開始画）を指定。動画の絵柄全体をコピーする指定と、カメラの動きだけ参照する指定を区別。
5. 歌唱、ダンス、歌詞、物語を自動で混ぜず、目的に合わせる。歌詞やテロップは後から編集できるレイヤーで追加する。

例：映画のような短い場面（英語は下書きであり、サービス仕様に合わせて調整）

> Medium close-up in a quiet station at dusk. The character notices an unopened letter and slowly looks toward the exit. The camera makes a slow, steady dolly push toward the character; the character stays almost still. Soft window light, muted blue and warm amber. End on the character's eyes, with the gaze directed toward frame right for the next shot.

ダンスでは全身・足元・向き・振りの開始/終了と撮影距離を明記し、必要に応じて動作参照を用いる。歌唱では実曲の該当区間を正しく対応付ける。どちらも生成後に音付きで、頭・中・終わりを確認する。音声入力の存在、生成音声への口パク、元曲への正確な同期は別の能力である。

## MiniMax H3

[MiniMax H3公式](https://www.minimax.io/news/minimax-h3-open-source) はテキスト・画像・動画・音声の文脈と音付き動画生成を説明している。Hailuo 2.3 の角括弧コマンドやAPI仕様を H3 に流用せず、利用する H3 の画面/API の資料を確認する。文章では対象の行動、カメラ、時間の順序を具体的に分ける。動き参照や実曲同期は経路単位で対応を確認する。

## Seedance 2.5

[ByteDance公式](https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5) は複数の画像・動画・音声参照、長めの物語、映像編集を説明している。人物・環境・演技の参照役割を区別し、物語なら時間区間ごとに出来事と画角を並べる。冒頭・転換・結末を一度に指示する場合も、各状態と切り替わりを具体化する。実際の接続サービスの対応数・参照方法は別途確認。

## Wan 3.0

[Alibaba公式プロンプトガイド](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-prompt-guide) の構造は、全体像、素材番号と役割、時間付きショット、必要な音、画調。画像・動画・音声は種類ごとに番号が振られる。動作だけを参照するなら、対象と役割を明示する。例：`Use Image 1 for the character; use only the camera movement of Video 1. 0–4s: ... 4–8s: ...`。実際のサービスのアップロード順・対応モードを確認する。

## Kling 4.0

[Kling公式ガイド](https://kling.ai/quickstart/kling-4-model-user-guide) は複数参照、動作参照、カメラ参照、キーフレーム、ショット指定の例を示す。画面が対応するときは `@Video 1` のように参照を指定し、人物の外見とダンス動作、あるいはカメラだけを別々に割り当てる。ショットごとに尺・被写体の動き・カメラ・次への接続を書く。API側の記法は画面と同一と仮定しない。

## Grok Imagine

[xAI公式概要](https://docs.x.ai/developers/model-capabilities/video/overview) では画像からの生成は画像を開始画とし、その後の動きを記述する。テキストからの生成では被写体・照明・カメラ・動作を明記する。[参照の仕様](https://docs.x.ai/developers/model-capabilities/video/reference-to-video) では対応モデル・参照モード・役割を確認し、対応する場合に参照番号を正しく対応させる。生成された発話のリップシンクと、ユーザーの楽曲音声を入力して同期させる機能を混同しない。

## 納品前の判定

意図した画角と移動方向、被写体の演技、カット間のつながり、顔・手・衣装・背景の破綻、冒頭/末尾の切れ、比率と秒数を確認。音付き同期が必要なら実曲と重ね、ずれ・足滑り・口の停止を確認する。問題があれば「編集で直す」「再生成」「別の手段」を分け、生成回数と費用は承認範囲内に留める。
