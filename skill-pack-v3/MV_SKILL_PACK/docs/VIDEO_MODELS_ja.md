# 動画生成モデル別ガイド（プロ仕様）

確認日: **2026-10-27**（JST）。✅=公式ドキュメントで確認 / ❔=未確認（推測で書かない）/ ⛔=提供終了。
価格・仕様は変わります。有料実行の前に、必ず出典ページを見直してください。数値は `gen/models.yaml`、参照スロットは `remotion/src/lib/videoModels.ts` の `CAPS` にあります。

## しくみ（1ショットができるまで）
1. **ショット設計**（`shotprompt.ts`）: 景別とレンズ、カメラの動き（速さと理由）、演技（口パク／ダンス）、照明（キー・リム・実光源・時間帯）、セクションごとの色（カラースクリプト）、空気感、歌詞を置く余白を決める。続けて、キャラ・衣装・場所を揃える（連続性）、開始画／終了画（マッチカット）、拍に合わせた尺、ネガティブ（顔崩れ・指・文字化け・ちらつき）を決める。
2. **ショットリスト批評**: 同じ景別や同じカメラ動作が続くと直す。各セクションに引き（状況説明）と寄り（感情）があるかを確認し、サビが一番寄っているか（盛り上がりの弧）を見る。手動ロックしたショットは直さず、提案だけ出す。
3. **モデル推薦**: 次の4点で点数をつけ、理由を日本語で出す。ショットごとに `mv.config.json` の `gen.perShot.S005: "kling-3.0"` で固定できる。
   - 口パクが必要か
   - 参照素材の枚数
   - 開始画／終了画を使うか
   - 尺が合うか、価格と予算（`gen.budgetPerShot`）

   価格が未確認のモデルは自動では選ばない。
4. **アダプタ**: 各モデルの文法に合わせて書き換える。
   - MiniMax は `[Push in]` のような角括弧のカメラ命令。
   - Runway の画像→動画は動きだけを書く。
   - Wan と Veo はネガティブを `negative_prompt` に入れる。
   - Grok と Kling と Vidu は参照を本文の `<IMAGE_0>`、`<<<image_1>>>`、`[@image1]` で指す。

   尺はモデルが対応している値に合わせる（はみ出た分は編集でトリム）。
5. **参照素材の詰め込み**: モデルのスロットに入れる。入りきらない場合の扱いは次のとおり。
   - 優先度が低いものから外す。
   - 参照スロットが無いモデルでは、参照をまとめた「合成開始画」を画像モデルで作る。
   - 終了画を使えないモデルでは、それを次のショットの開始画として使う。
6. **生成後のQA**（`npm run gen -- qa`）で次の3つを検出する。引っかかったテイクはギャラリーで「再生成」に印がつく。
   - ちらつき（明るさの点滅）
   - モーフィング（動きが小さいのに輪郭が変わる）
   - 顔のずれ（承認済みのキャラ正面と比べる。OpenCV が無い環境ではこのチェックを飛ばし、その旨を表示する）

## モデル一覧（要点）
| モデル | 状態 | 尺 | 解像度 | 音声 | 参照・フレーム | 価格（確認済みのみ） | 向いているショット |
|---|---|---|---|---|---|---|---|
| grok-imagine-video-1.5 | ✅ | 1–15s | 480p/720p/1080p | ネイティブ音声と口パク | 参照14枚、開始/終了、中間キー4、音声参照3 | 480p $0.08、720p $0.14、1080p $0.25 /秒 | 口パク、キャラ固定、マッチカット |
| grok-imagine-video-1.5-lite | ✅ | 1–15s | 最大1080p（720pからアップスケール） | 口パク | 開始画のみ | 480p $0.02、720p $0.03、1080p $0.14 /秒 | つなぎ、大量生成 |
| grok-imagine-video | ✅ | 1–15s | 最大720p | 生成音声 | 参照7、編集、延長 | 480p $0.05、720p $0.07 /秒 | 既存クリップの編集 |
| wan2.6-t2v / i2v | ✅ | 2–15s | 1280*720 / 1920*1080 | `audio_url` 入力（3–30s） | i2v は開始画、r2v は参照5（character1…） | 720p $0.086、1080p $0.143 /秒 | マルチショット、ネガティブ指定 |
| wan2.2-kf2v-flash | ✅ | 5s 固定 | 480/720/1080P | 無音 | 開始画と終了画の両方が必須 | 未確認 | マッチカットの補間 |
| MiniMax-Hailuo-2.3 | ✅ | 6s / 10s（1080Pは6sのみ） | 768P/1080P | なし | 開始画 | 768P 6s $0.28、10s $0.56、1080P 6s $0.49 | カメラ命令が正確 |
| MiniMax-H3 / Highspeed / Lite | 価格のみ✅ | ❔ | 2K/768P/480P | ❔ | ❔ | H3 768P $0.08、2K $0.13 /秒。Highspeed $0.06。Lite 768P $0.04、480P $0.025 | 尺が未確認なので自動では選ばない |
| seedance-2.0 | ❔ | 4–15s | 480p〜4k | ネイティブ | 参照9、開始/終了（フレームモードと参照モードは併用不可） | 未確認（トークン課金） | 参照が多いショット |
| kling-3.0 | ✅ | 3–15s | 720p/1080p/4k | ネイティブ（任意） | 画像とエレメント合計7。終了画は開始画が必須。画像3枚以上だと終了画不可 | 音声なし 720p $0.084、1080p $0.112。音声あり $0.126 / $0.168 /秒 | マルチショット、1ショット1カメラ動作 |
| veo-3.1-generate-001（Vertex） | 仕様✅、価格❔ | 4/6/8s | 最大1080p | ネイティブ | 参照3（開始画とは排他）、lastFrame | 未確認 | 開始→終了の補間 |
| runway/gen4_turbo / gen4.5 | ✅ | ❔ | ❔ | なし | 開始画（プロンプトは動きだけ） | $0.05 / $0.12 /秒 | 静止画から自然な動き |
| runway/aleph2 | ✅ | ❔ | ❔ | なし | 動画→動画の編集 | $0.28/秒（最低56クレジット） | ルック変更 |
| luma/ray-3.2 | 価格✅ | 5s / 10s | 540p〜1080p | なし | 参照は未確認 | 5秒ごと 540p $0.15、720p $0.30、1080p $1.20 | HDR |
| pixverse/v5 | ❔ | 5s / 8s | 最大1080p（1080pは5sのみ） | ❔ | ❔ | クレジット: 1080p 5s=120（ドル換算は未確認） | カメラは文章で指定 |
| vidu/q3 | 仕様✅、価格❔ | 3–16s | 540p/720p/1080p | 任意 | 参照（主体）7、1主体3枚まで、128px以上、比率1:4〜4:1 | クレジット/秒（ドル換算は未確認） | キャラ・物の固定 |
| pollo/pollo-v2 | ❔ | 1–10s | 480p/720p/1080p | 任意 | ❔ | 未確認 | Pollo の MCP 経由 |
| sora-2 | ⛔ | — | — | — | — | API は 2026-09-24 に終了 | 使わない |

## 失敗しやすい点と対策（アダプタに組み込み済み）
- **顔の崩れや別人化**: 次の3つで防ぐ。
  - キャラシート（正面・横・背面）を先に作って承認する。
  - 参照対応モデルでは毎ショットに添付する。
  - 生成後に顔の類似度をQAする。
- **指や手の崩れ、文字化け**: ネガティブ指定で防ぐ。Wan と Veo はパラメータ、ほかは本文の "Avoid:" に入れる。歌詞は動画に描かせず、このパックで後から重ねる。
- **カメラ動作の混線**: 1ショット1動作（Kling の公式ガイド）にし、批評で同じ動作の連続を直す。MiniMax は命令の角括弧で指定する。
- **尺が合わない**: 拍に合わせた長さを各モデルの対応尺に寄せ、ずれは警告して編集でトリムする。
- **Seedance と Veo の排他**: 開始画を使うなら参照は使わない。参照が2枚以上で開始画が無いときは参照モードにする。

## 参照素材（アセット）
プロジェクトの `assets/` に保存し、`assets.json` で役割を管理します。タクさんの既存フォルダには書き込みません。
- 役割: キャラ正面、キャラ横、キャラ背面、表情、衣装、背景・場所、小道具、ルック、開始画、終了画、中間キー画、ポーズ/ダンス、口パク用の顔、口パク用の音声。
- ショットごとの自動選択: 寄りのショットには表情と顔、引きのショットには場所と全身、ダンスにはポーズ参照を付けます。開始画と終了画はそのショット専用です。未承認の素材は使いません。
- 素材が足りないとき: 画像モデルで作ります。順番はキャラシート → 背景・小道具 → 各ショットの開始画（承認済みシートを参照）で、`image_tasks.json` に書き出します。
  - 対応ツール: Grok Imagine 画像 $0.02/枚、Runway gen4_image（5クレジット）、Gemini、Flux（どちらも価格未確認）、ローカル SD（無料）、各種 MCP。
  - 画像の費用は生成プランの合計に含まれます。未承認の素材があるうちは `run` を実行できません。
- 日本語コマンド: `npm run gen -- assets キャラシート作って` / `背景を作って` / `"S05の開始画を差し替え" --file new.png` / `全部承認`。

## 出典（確認日 2026-10-27）
- xAI: https://docs.x.ai/developers/model-capabilities/video/overview 、 https://docs.x.ai/developers/model-capabilities/video/reference-to-video 、 https://docs.x.ai/developers/pricing
- Alibaba Wan: https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan2-6-i2v 、 https://www.alibabacloud.com/help/en/model-studio/legacy-wan-reference-to-video-api-reference 、 https://www.alibabacloud.com/help/en/model-studio/legacy-image-to-video-by-first-and-last-frame-api-reference
- MiniMax: https://platform.minimax.io/docs 、 https://platform.minimax.io/docs/pricing/overview
- BytePlus Seedance: https://docs.byteplus.com/en/docs/modelark/seedance-2-0-prompt-guide （仕様の一部は第三者の再掲ページで確認したため❔扱い）
- Kling: https://kling.ai/document-api/api/video/3-0-omni/image-to-video.md 、 https://kling.ai/document-api/pricing/base/video.md
- Google Veo: https://ai.google.dev/gemini-api/docs/video 、 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
- Runway: https://docs.dev.runwayml.com/guides/pricing/ 、 Gen-4 Video Prompting Guide（help.runwayml.com）、 https://github.com/runwayml/skills
- Luma: https://docs.agents.lumalabs.ai/guides/pricing/
- PixVerse: https://docs.platform.pixverse.ai/model-pricing-796039m0
- Vidu: https://platform.vidu.com/docs/api-reference/video-models/vidu-q3/reference-to-video 、 https://platform.vidu.com/docs/pricing.md
- Pollo: https://docs.pollo.ai/pollo-ai/pollo-v2
- OpenAI Sora: https://developers.openai.com/api/docs/guides/video-generation

## 生成前の見積もり（`npm run gen -- estimate`）
- ショットごとの表示：モデル、支払い方法（API の従量課金かサブスクか）、尺（モデルが対応する長さに合わせた値）、解像度、テイク数、金額またはクレジット。
- 合計に含めるもの：
  - 参照画像と開始画の費用
  - サブスクの場合は「使うクレジット / 残り → 実行後」
  - 不足する分の追加料金（単価が確認できたものだけ）
- 未確認の価格は「未確認」と表示し、合計には入れません。API の価格が未確認だと実行できません。
- 料金プランの設定：`mv.config.json` の `gen.plans.kling = "pro"` か `{ "plan": "pro", "remaining": 1200 }` で設定します。日本語でも指定できます：`npm run gen -- plan-tier "KlingはProプラン"`、`"RunwayはAPI"`、`"Klingの残り1200クレジット"`。ウィザードの Q4b でも聞きます。
- 実行前の確認：
  - `npm run gen -- run` → 見積もりを表示して `[y/N]` で確認します。Enter や N はキャンセルで、何もしません。
  - 対話できない環境では `--confirm <合計>` が見積もりと一致したときだけ実行します。
  - ギャラリーにも「この金額で生成する / キャンセル」ボタンがあります。
- サブスクのクレジットは公式アプリ/Webで使う分です。そのショットは API では実行せず、アプリで生成して `import` で取り込みます。
- プラン表は `gen/plans.yaml` にあります（出典と確認日つき）。
  - 公式で確認済み：
    - Kling：Standard 660 / Pro 3000 / Premier 8000 / Ultra 26000 クレジット。3.0 は 6〜12 クレジット/秒
    - Runway：Standard 625 / Pro・Unlimited 2250 / Max 9500。gen4.5 は 12、turbo は 5、Aleph は 28 クレジット/秒
    - Hailuo：利用規約に書かれた月額とクレジット。追加購入は $1 = 70 クレジット
    - Luma：Plus 10000。ray-3.2 は 5秒ごとのクレジット
  - 未確認：
    - Pollo の月額とクレジット
    - Luma の Pro / Ultra
    - Hailuo のモデル別クレジット消費
    - Kling と Runway の追加購入単価
    - Grok アプリの動画枠

## 口パク・ダンスの音声の自動切り出し
- 対象は口パクとダンスのショットです。動画の尺をモデルの対応尺に合わせ、元の曲をショットの開始位置からその尺ちょうどで切り出します。サンプル単位で正確に切り、フェードはかけません。
- 保存先は `assets/audio/<ショット>_lipsync.wav` で、素材の役割は「口パク用の音声」です。
- 尺が変わったときは、ショットの終わりを延ばすか詰めます。曲の終わりを超える場合は開始を前に倒します。どう変えたかはプランと見積もりに表示します。
- 音声を入れられるモデル（Wan 2.6、3〜30秒）には添付します。入れられないモデルでも音声は作り、Remotion で後から口を合わせる用に使います（プランにその旨を表示）。
- 生成の直前に ffprobe で音声と動画の長さを比べ、1フレームを超えてずれていれば止めます。元の曲ファイルは md5 で確認し、変更されていたら中止します。

## Remotion での口合わせ（音声を入れられなかったショット）
- `npm run gallery` で口パク・ダンスのテイクを採用すると、切り出し音声の開始位置と長さ、ffprobe で測ったクリップと音声の長さを `mv.config.json` の `timing.perShot.<ショット>.lipsync` に記録します。元の in/out（origStart / origEnd）も一緒に残します。
- レンダーでは、そのクリップを音声の開始位置にぴったり置きます（カットの先行や速度変化は使わず、クリップの頭から再生）。延ばしたぶんは次のショットの開始を後ろへずらし、前に倒したぶんは前のショットを詰めます。
- クリップと音声の長さが1フレームを超えてずれていたら、日本語のエラーでレンダーを止めます。
- 最終ミックスに使う音声は元の曲1本だけです。生成クリップの音声はすべてミュートし、切り出した wav はタイミングを合わせるための基準にしか使いません。
- 対象は「音声入力なし」で作ったショットです。Wan 2.6 で音声を添付したショットも同じ位置に固定します。

## 短い口パク・ダンスショットの警告
- モデルの対応尺に合わせると1秒より長く伸びるショットは、プランと見積もりに ⚠ で表示し、次の3つの案を出します。
  1. 隣の同じ歌い手のショットとつなげて1本にする
  2. 尺を1秒刻みで選べるモデルにする（例: Wan 2.6 は models.yaml では 2〜15秒。3〜30秒は音声入力の長さです）
  3. 長めに生成して、Remotion で切って使う
- あなたが指定したカットは自動では変えません。自動で作ったカットは、隣の同じ歌い手のショットとの結合を優先します（`gen.autoMerge: false` か `--noMerge` で止められます）。

## 元の長さに戻す（取り消し）
- `npm run timing -- restore S005` で1ショット、`npm run timing -- restore all` で全部を戻せます。日本語なら「S05を元の長さに戻して」「全部元の長さに戻して」です。
- 戻すと、前後のショットも元のカットに戻ります。調整の記録は `lipsyncHistory` に残り、そのショットは以後自動結合しません（`gen.keepCut`）。
- ファイルは何も消しません。元の曲は書き換えず、生成クリップも残します。切り出し音声を作り直すときは、前のものを `<ショット>_lipsync.vN.wav` として残します。
