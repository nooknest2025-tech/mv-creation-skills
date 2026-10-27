# プロの演出ルール（プランナーが実際に使う知識ベース）

このパックの自動演出は「派手さ」ではなく**曲と画に合っていること**を最優先にします。下のルールはすべてコード（`remotion/src/lib/direction.ts` / `critic.ts` / `hybrids.ts` / `visual.ts`）で実装され、テスト（`tests/pro.test.ts`）で確かめています。
参考にしたのは**技法**だけで、作品・文章・コードはコピーしていません（出典は末尾）。

## 1. 構成と物語
| ルール | 実装 |
|---|---|
| 盛り上がりの山（Aメロ < Bメロ < サビ、ラスサビが頂点） | `targetIntensity()` がセクション＋音の強さから「勢い」を計算し、文字の動きの強さをそれに合わせる。critic がサビ ≤ Aメロ、ラスサビ < 1サビ を指摘 |
| サビの前は「ため」（抑えてから解放） | Bメロの強さは中間に固定、プリセットの「サビ前1拍の黒」(preChorusBreak) |
| モチーフ／コールバック（繰り返しのサビは同じ動きで、強さだけ上げる） | 同じ種類のセクションは前回の動きを踏襲（変化多めの時だけ作り直し） |
| フック（冒頭10秒で掴む） | coldOpen（最強の画で始める）＋サビ頭の見せ場1回。critic が「サビに見せ場なし」を指摘 |
| 締め（余韻） | 最後のカットは2拍以上。critic が短すぎを指摘 |
| サビの回数分だけ盛り上げ、落ちサビで何をするか決める（加藤マニ氏） | ラスサビ判定（isLastChorus）で強さ +12% |

## 2. カメラと編集
| ルール | 実装 |
|---|---|
| 毎拍は切らない。オフビートで次のオンビートを効かせる、感情の所は「ためる」 | プリセットごとの拍単位カット＋低エネルギーで長く。critic が「同じ長さのカット10連続」を指摘 |
| 同じ動きを続けない | critic が「同じカメラの動き3連続」を自動修正（ユーザー指定のカットは提案のみ） |
| 動きには理由を（モチベーテッド・ムーブ） | 役割（ハイブリッド）ごとに動きを決める: 歌唱=顔へ寄る、ストーリー=引き・パララックス、ダンス=ホイップ・ズームパンチ、ライブ=手持ち・クレーン、回想=ゆっくり引き |
| 同じ画は2秒以上だらだら続けない（8秒で4枚くらい） | critic が「動きのない静止画4秒超」を指摘 |
| カット点は拍か歌い出しに | critic が拍・歌い出しから 0.09 秒以上ずれたカットを指摘 |
| マッチカット | matchCut レシピ（同じ寄りの連鎖） |

## 3. 構図・色
| ルール | 実装 |
|---|---|
| 歌詞は顔・視線の先・ごちゃごちゃした所を避け、余白（ネガティブスペース）へ | `scripts/visfeat.py` で上/中/下の帯のごちゃつき（エッジ密度）と顔の位置を測り、`placeText()` がコスト最小の帯へ |
| 背景に対して読める色（WCAG 4.5:1 以上） | `readableFill()` が帯の輝度とのコントラスト比を計算し、足りなければ白/黒＋反対色フチに切替（理由を記録） |
| 色の設計（セクションごと） | ジャンルの配色（本文/サビで切替）＋プリセットのグレード、回想は彩度を落とす |

## 4. 歌詞モーションの原則
| ルール | 実装 |
|---|---|
| 大技は1セクション1回（抑制） | プランナーが見せ場を1回だけ置き、critic が重複を降格 |
| 読める時間（最短 5/6 秒、日本語 7字/秒 + 0.3秒） | `minOnScreen()`。足りない行は延長、延長できなければ「行を分ける」提案 |
| 早口は語単位・読みやすい動きに | 10字/秒超の行は可読性の高い動きに差し替え |
| 強調（キーワードは太く大きく・色） | 語エフェクト（glow/red/shake…）と書体の語指定 |
| 予備動作・オーバーシュートのイージング | 合成モーション（`styles/motion.tsx`）の ease: back / elastic / expo / soft |
| 発音（モーラ）に合わせて出す | 文字ごとの発声時刻（chars[].t0）で出現・強調 |

## 5. ハイブリッド構成（12種）
`ストーリー＋リップシンク` / `サビだけ歌うシーン` / `ストーリー＋ダンス` / `リップシンク＋リリックPV` / `ライブ＋回想` / `一発撮り＋情景カット` / `ダンス＋タイポグラフィ` / `演奏×ドラマのインターカット` / `ワンカット＋インサート` / `リリックPV＋ストーリー` / `コンセプト映像＋歌唱` / `リップシンク＋サビダンス`。
セクションごとに役割の割合（例: サビ 70% 歌唱）を持ち、交互に混ぜて配置。歌唱カットには顔のある画像、文字主役カットには顔のない画像を回し、生成プロンプトにも役割が入ります。顔のある画像が無ければ歌唱が必要な構成は自動では選びません。

## 6. 手動モードとの関係
ユーザーが指定した所はそのまま。critic は「提案」だけを出します（`director_note.md`）。

## 出典（技法の参考。2026-10-27 閲覧）
- Netflix Japanese Timed Text Style Guide（最短表示・読みの速さ）: https://partnerhelp.netflixstudios.com/hc/en-us/articles/215767517-Japanese-Timed-Text-Style-Guide
- Netflix Subtitle Timing Guidelines: https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394
- W3C WCAG 2.x コントラスト比: https://www.w3.org/TR/WCAG21/#contrast-minimum
- Ma et al., "Automated Conversion of Music Videos into Lyric Videos"（UIST'23、読みやすさと視線の一致のガイドライン）: https://arxiv.org/abs/2308.14922
- Edit Lounge "Cut To The Beat"（オフビートで切る理由）: https://editlounge.com/post-production/sound-design/cut-to-the-beat/
- LBB "Finely Sliced: Kenny Shimm"（ショットを呼吸させる）: https://lbbonline.com/news/finely-sliced-following-your-intuition-with-kenny-shimm
- ProVideo Coalition "Art of the Frame with Chancler Haynes"（フレーム内の動きで拍を打つ）: https://www.provideocoalition.com/art-of-the-frame-with-chancler-haynes-as-we-talk-music-videos-commercials-and-film/
- shots "Henry Scholfield on the moving world of music videos"（カメラを参加者に、山と谷）: https://shots.net/news/view/henry-scholfield-on-the-moving-world-of-music-videos
- Adobe Blog "Taylor Tracy Walsh"（カットの動機、マッチカット）: https://blog.adobe.com/en/publish/2020/09/08/finding-the-message-in-the-edit-with-star-editor-taylor-tracy-walsh
- StudioBinder カメラの動き / ショットサイズ / 180度ルール: https://www.studiobinder.com/blog/different-types-of-camera-movements-in-film/ ・ https://www.studiobinder.com/blog/ultimate-guide-to-camera-shots/
- VIDEO SALON 加藤マニ氏（2秒ルール、サビの回数・落ちサビ、残したいベタ＝歌唱/演奏）: https://videosalon.jp/premium/vsw282_t1/
- CINRA かとうみさと氏（楽曲を拡張する、意外性）: https://www.cinra.net/article/interview-202109-katomisato
- CINRA 内山拓也氏（最初の10秒の壁、長回しで感情移入）: https://www.cinra.net/article/interview-202004-uchiyamatakuya_yjmyk
- ALPS STUDIO note（リップシンクの強度はサビで上げる）: https://note.com/alpsstudio/n/nc2f79966bb6b
- Andy Sapp "The Process of a Lyric Video"（ウェイトで語を際立たせる）: https://andysapp.com/2014/06/01/the-process-of-a-lyric-video/
