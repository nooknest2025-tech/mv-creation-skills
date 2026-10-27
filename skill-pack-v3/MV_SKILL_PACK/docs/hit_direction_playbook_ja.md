# ヒットMVの演出プレイブック（このパックの自動演出に入っている型）

各社の公開記事から「技法」だけを抜き出して、自分の言葉でまとめたものです（文章の引用はしていません）。
右端の列が、このパックのどこで自動的に使われているかです。強さは `remotion/src/lib/presets.ts` の `recipes` と `cuts` で調整できます。

| # | 型 | 内容 | 自動演出での実装 | 参考 |
|---|---|---|---|---|
| 1 | 冒頭3秒のフック | 長いイントロやフェードで始めない。最初の一瞬に動き・焦点・文字を置き、最初の切り替えを強拍に合わせる | `recipes.coldOpen`: 1カット目は最良の画（ヒーローショット）＋強めの動き、最初のカットを拍にスナップ。プレビュー静止画に「フック」を必ず含める | [1] |
| 2 | カットは音の少し前 | 映像の切り替えを打点の1〜3フレーム前に置くと「ぴったり」に見える。全部の拍で切らず、強調所だけ密に | `timing.cutLead`（既定約0.05秒）。セクションごとのカット長（1小節〜1/4拍） | [2][3] |
| 3 | セクションでカットの長さを変える | Aメロは2〜3秒、サビは0.5〜1秒程度と、場面で緩急をつける。アップは短く、引きは長く | プリセット別の `cuts`（ダンス: サビ1拍・Aメロ2拍 など）、エネルギーが高い所は半分、静かな所は「息継ぎ」で長く（`recipes.breathing`） | [4] |
| 4 | サビ前のブレイク | サビ直前を一瞬止める/暗くして溜め、サビ頭で一気に明るく・寄る・割る | `recipes.preChorusBreak`: プレサビ最後の半拍を黒＋サビ頭に白フラッシュ/ズームパンチ | [5] |
| 5 | サビを回ごとに派手に | 1回目より2回目、最後のサビをさらに強く | `recipes.chorusEscalation`: サビの回数に応じてカットを細かく・文字を強いスタイルに。「最後のサビは派手に」でさらに強化 | [4] |
| 6 | ループする終わり方 | 最後の画を最初とつなげ、ショート動画で繰り返し見られるように | `recipes.loopEnding`: 最後のカットに最初の画を再利用。最後の1秒は文字なし | [6] |
| 7 | 一発撮りの美学（ファーストテイク風） | 白い背景・マイク1本・固定カメラ数台・横顔などの最小限の構図で、編集で盛らない | プリセット `firsttake`: 長回し・固定〜ごく遅いプッシュ・白系グレード・シンプルな字幕 | [7][8] |
| 8 | マッチカット | 形や動きが似た画同士をつないで流れを作る | `recipes.matchCut`: 同じ向きのカメラ移動が続くカットは、前のズーム量の続きから始めて動きをつなげる | — |
| 9 | サムネ候補 | 一番強い瞬間（サビ頭など）から選ぶ | `recipes.thumbnailPick`: サビ頭など3枚をプレビューで書き出し | [1] |

## 参考（2026-10-26 閲覧）
1. SunoMV ブログ「最初の 3 秒で勝負が決まる：縦型ミュージックビデオの冒頭フック」 https://suno.bi/ja/blog/first-3-seconds-hook-opening-method-vertical-mv-shorts-sunomv-2026
2. Mineral Sound「Editing Music Videos: Timing Your Cuts」 https://www.mineralsound.com/blog/timing-your-cuts
3. soundcache「How to Sync Your Cuts to the Beat」 https://soundcache.io/blog/how-to-sync-cuts-to-the-beat/
4. spumoni（note）「K-POPの制作技法 ―― 映像と音は、どう切り貼りされているか」 https://note.com/fukuy/n/n5cc525ba988f
5. 因果の交差点「サビの盛り上げはサビ前で決まる」 https://zoomyjp.com/2019/06/03/beforechorus/
6. スタールート音楽事務所「リールで音楽を伸ばす｜最初の3秒とループ設計」 https://www.starroute.jp/column/reels-ongaku-nobasu/
7. BuzzFeed Japan「一発撮りYouTubeチャンネルの裏側」 https://www.buzzfeed.com/jp/harunayamazaki/thefirsttake-1
8. 音楽ナタリー「映像で音楽を奏でる人々 第23回（THE FIRST TAKE の映像ディレクション）」 https://natalie.mu/music/column/512370

※ 「ファーストテイク風」は雰囲気の参考で、公式とは無関係です。名前やロゴを作品に使わないでください。
