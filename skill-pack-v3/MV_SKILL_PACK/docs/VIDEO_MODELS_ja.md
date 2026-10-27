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
