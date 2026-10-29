# レシピ：アニメバトルMV（30秒・2キャラ・墨＋2色）

2人のキャラが拍ごとにぶつかり合う、アニメ戦闘MV風の作り方です。動画素材は十数本、新規生成は2本程度、イラストは9枚前後。
編集画面の「合成」だけで組めます。テンプレート: [anime_battle_mv_template.json](anime_battle_mv_template.json)（`npm run recipe:battle` で当てはめ）

## 0. 世界観と色
- 白黒の墨の世界に、**キャラAの色（例: 赤 #E0182D）** と **キャラBの色（例: 青緑 #2FF5D0）** だけを残す。
- 動画全体の設定: 色調＝「墨（白黒＋2色だけ残す）」、網点 0.1 前後、周辺の暗さ 0.3 以下（強くすると四隅が黒く抜けます）。

## 1. 基本の数字
- 1拍 = 60 ÷ BPM 秒（例 139BPM → 0.432秒、1小節 1.73秒）。カットは拍頭で切る。
- **24fps の注意**: 1拍が整数フレームになりません（139BPMで約10.4フレーム）。シーンの開始・終わりは秒（拍）で持ち、
  フレームへの丸めはパックに任せてください（シーンの最後の1コマで画が消える問題は v2.1.0 で修正済み）。インパクトは2フレーム（約0.08秒）が目安。

## 2. カット構成（30秒・サビ2回）
| 区間 | 目安 | やること（合成の型） |
|---|---|---|
| フック 0–3秒 | 1〜2拍ずつ | 白フラッシュから即激突。最強カットを最初に。タイトル叩きつけ（タイトル文字＝叩きつけ）、斜め分割＋スラッシュの入り |
| 名乗り | 2拍×2 | **フリーズ＋名前カード**（A=左・A色／B=右・B色）。最初の1拍は家紋イラスト→2拍目に本人 |
| 対面 | 3〜4拍 | 2コマ（稲妻の境目）で目と目、3コマ漫画割り（自由の枠・コマが順に出る） |
| 打ち合い | 2拍→1拍→半拍 | 全画面の斬撃（スピード線）、インパクト（白→赤ネガ）、ワイプ（小窓）で手元や目を足す |
| サビ前の溜め | 半拍連打 | 斜め分割・2コマで手＋お札のイラスト、半拍で色収差フラッシュ、「誰の〜？」で揺れ |
| サビ | 2拍ずつ | サビ頭は赤い月＋衝撃のイラスト1拍→動画。集中線、万華鏡、コマが拍ごとに増える4コマ |
| サビ2〜決着 | 2〜6拍 | 同時必殺→インパクト3連（白・赤ネガ・青緑ネガ）→一度だけ長い溜め（並び立ち） |
| ラストのロゴ | 4〜5拍 | 左右分割→中央で合体、最後の0.6秒は赤い月のイラストの前にロゴ（タイトル文字＝ロゴ） |

カット尺は「半拍〜1拍〜2拍（多数）〜4〜6拍（溜め）」でばらつかせる。サビ前で一番短く詰めて、決着で一度だけ長く溜めます。

## 3. 角度違いの動画（TOP / LOW / OTS / EYES）
同じ戦いを別の角度から撮った素材があると、分割やコマ割りが一気に「戦っている」画になります。
画像→動画の生成で、**添付は「開始フレーム（既存クリップから書き出した1枚）＋キャラAの設定画＋キャラBの設定画」の3枚**。

| 名前 | プロンプト（英語・コピペ用の骨組み） |
|---|---|
| TOP（真上） | `Top-down overhead shot of the two characters clashing, katana against a glowing barrier, sparks and ink splashes radiating outward, camera slowly rotating, monochrome ink-wash world, only <A color> and <B color> glow, consistent character designs from the reference images. Avoid: text, watermark, morphing faces, extra limbs.` |
| LOW（あおり） | `Extreme low-angle shot looking up at <character A> raising the sword against a stormy ink sky, <character B> barrier light flaring behind, slow push-in, speed lines, monochrome ink-wash world, only <A color> and <B color> glow, consistent character designs from the reference images. Avoid: ...` |
| OTS（肩越し） | `Over-the-shoulder shot from behind <character B>, the hand with glowing talismans in the foreground, <character A> charging toward the camera in the background, rack focus to the attacker, monochrome ink-wash world, ... Avoid: ...` |
| EYES（目のアップ） | `Extreme close-up of <character A>'s eyes behind the mask, glowing <A color> eyes, then a whip pan to <character B>'s eyes reflecting <B color> light, manga screentone shading, ... Avoid: ...` |

1本ずつ生成して中身を確認してから使います。ダメなら1回だけ撮り直し。

## 4. イラスト（静止画）9種類と置き場所
「ぼかした背景映像」の代わりと、絵の強さが足りない所の補強に使います。全部共通の頭に
`monochrome sumi-ink manga illustration, heavy brush strokes, ink splatter, paper grain, black and white only, ` を付けます。

| 役割（slot） | 中身 | 比率 | 添付 | 置き場所 |
|---|---|---|---|---|
| ill_backdrop | 廃神社など舞台の引きの背景（人物なし） | 16:9 | なし | **動画全体の背景**（空いたコマ・隙間） |
| ill_crest_a | キャラAの紋（A色の円＋武器） | 16:9 | 付けない方が安定（付けると設定画っぽくなりがち） | Aの名前カードの1拍目 |
| ill_crest_b | キャラBの紋（B色のお札の輪など） | 16:9 | Bの設定画 | Bの名前カードの最初の半分 |
| ill_slash | 斬撃の軌跡（A色の細い縁） | 16:9 | なし | 3コマ割りの下地（コマが出そろうまで） |
| ill_mask_closeup | Aの顔・仮面の超アップ | 16:9 | Aの設定画 | ワイプの途中に0.6秒差し込み |
| ill_b_hand | Bの手＋光るお札 | 9:16 | Bの設定画 | サビ前の斜め分割の片側 |
| ill_talismans | 飛び散るお札 | 1:1 | なし | サビ前の2コマの片側、1拍の全画面 |
| ill_moon_impact | 赤い月＋衝撃＋2人のシルエット | 16:9 | A・B両方 | サビ頭の1拍、ラストのロゴ背景 |
| ill_backs | 2人の背中＋霧の舞台 | 9:16 | A・B両方 | 溜めの区間の縦長コマ |

## 5. 静止画のルール（静止画だとバレないように）
- **1枚あたり画面に出すのは0.65秒まで**（1拍〜1拍半）。長い区間は「出る秒・消える秒」で区切る。
- **必ず動かす**: 拡大「始め≠終わり」か、横移動・縦移動（ティルト）・傾きのどれかを入れる。拍頭はズームパンチか揺れ。
- **動画と交互に**: 動画→絵→動画。同じ絵を続けて使わない（間に動画を挟む）。

## 6. カメラとパララックスの目安（編集画面の項目）
- 背景イラスト: 拡大 1.15→1.3、横移動 -4→4%、縦移動 2→-2%、奥行き 0.4、暗さ 0（暗い絵は「明るく」0.3〜0.4）。
- 差し込みの絵: 拡大 1.0→1.25〜1.6、傾き ±6〜10°→0、奥行き 1.4〜1.6（手前のレイヤーほど揺れ・パンチが強く効く）。
- 万華鏡は静止画でも回る: 傾き 0→20、拡大 1.4→1.7。
- 揺れ 14〜22（サビ頭・ヒット）、ズームパンチ 0.06〜0.08。カメラの揺れの速さ・パンチの長さは動画全体の「カメラ」で。

## 7. 黒い画面を出さない
- **すべてのコマに絵を入れる。** 黒・空白が許されるのはインパクト（白・ネガ）の一瞬だけ。
- 背景は「イラスト」か「ぼかした映像」にする（黒のままにしない）。斜めスラッシュの入りは前のシーンの画が下に残ります。
- 暗い素材はパネルの「明るく（lift）」で持ち上げる。周辺の暗さは0.3以下。
- 書き出したら必ず確認:
  ```
  MVPACK_SCALE=0.25 node editor/export.mjs <editor-state.json> preview.mp4   # 速い低解像度プレビュー
  npm run qc:black -- preview.mp4 <editor-state.json>
  ```
  画面全体で4%、または16マスのどれか1マスで35%を超える「平らな黒」があると失敗します（インパクトの瞬間は除外）。
  残った指摘は1コマずつ画を見て、黒い服・髪・墨の影など「絵の一部」なら良し、空のコマなら直します。

## 8. テンプレートの使い方
1. 素材（動画・イラスト・音源・歌詞）でいつもどおり編集画面を開く: `npm run editor -- --project <名前> ...`
2. 素材の名前に役割名（`top_angle`、`ill_backdrop` など）を入れておくと自動で割り当たります。番号で指定するなら `--map ill_backdrop=18,top_angle=9`。
3. `npm run recipe:battle -- --project <名前>` → 編集画面を開き直すと、全シーンの合成が入った状態から編集できます（元の状態は `editor-state.before-recipe.json`）。
4. 名前カード（キャラA/キャラB）とタイトル文字を書き換え、色（動画全体のアクセント色）を自分のキャラに合わせる。
