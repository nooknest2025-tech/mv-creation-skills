---
name: mv-character-motion
description: Use when the user wants still characters to feel alive - blinking, lip flap synced to the vocal/lyrics, breathing, hair sway, bobbing to the beat - per song, per section or per shot (目パチ・口パク・呼吸・髪揺れ・ノリ).
---
# キャラを動かす（目パチ・口パク・呼吸・髪揺れ・拍ノリ）

All in Remotion (`src/lib/puppet.ts`, `src/render/Puppet.tsx`). No paid tools.

## Flow
1. `npm run mv` runs `scripts/faces.py` (OpenCV 4.x anime-face cascade). It writes `public/project/faces/faces.json` plus blink patches, and logs `🙂 目パチ・口パク: 顔あり n/N`.
2. If faces are missed or misplaced (tilted or small faces), have the user run `npm run faces`.
   - It opens a browser page: click 左目 → 右目 → 口, or 顔なし.
   - The result is saved to `projects/<曲>/faces_manual.json` and takes priority on the next run.
3. Change settings in Japanese with `npm run edit`:
   - 「目パチして」「口パク強め」「髪揺れなし」「拍でノって」
   - 「サビは口パク強め」「S012は口パクなし」「キャラを動かさない」
4. Check with `npm run preview`, then look at a frame mid-lyric (mouth open) and the eyes (a blink lasts about 0.14s every 2–4.5s).

## Rules
- Mouth flaps once per mora from the lyric char timings, scaled by loudness. Small kana and ー do not flap. Without lyric timing there is no flap.
- Images without a face only get breathing and sway, never fake eyes.
- Order of priority: preset < config < section < shot.
- Limits to tell the user honestly:
  - Whole-image puppet (this section) has no viseme shapes (あ/い/う) and no limb motion. For those, use parts animation below (needs parts: PSD / PNG layers / rough auto split).
  - For full-body dance, suggest a video model via MCP (see [mv-video-generation](../mv-video-generation/SKILL.md)). When attaching audio, cut the exact original-song interval to the selected generation duration, verify the actual duration and upload that cut file without time-stretching. Check the resulting motion against the original interval at normal speed before adoption.

## パーツアニメ（Live2D風の切り絵。`src/lib/rig.ts`, `src/render/Rig.tsx`）
上の目パチ・口パクは「1枚絵の一部を動かす」方式。パーツ（頭・体・腕・髪・目・口…）に分かれた素材があれば、パーツごとに支点で回転・移動する本当のパーツアニメができる。
1. 取り込み（どれか）:
   - PSD: `npm run parts -- import キャラ.psd`（psd-tools・無料/MIT。レイヤー名から種類を推定: 頭・体・左腕・右腕・前髪・後ろ髪・目・口・リボン…）
   - PNG フォルダ（全パーツ同じキャンバスサイズ、ファイル名=パーツ名）: `npm run parts -- import フォルダ`
   - 1枚絵の自動分解（無料・ローカル）: `npm run parts -- split 画像.png`。rembg（任意）で切り抜き→頭/体/左右の腕に粗く分割→隠れた所は OpenCV で塗り足し。**粗い**ので必ず確認・修正。髪・目・口は分かれない。
   - 画像生成AIでパーツ素材を作る（任意・有料モデル）: `npm run parts -- ai-prompt 画像.png` で指示文を作り、出来た PNG を import。位置ずれが起きやすいと伝える。
   - 目と口の差分は「目_閉じ」「口_a」「口_i」…の名前で状態として登録される。
2. 確認: 取り込み時に `check_sheet.png`（ピンクの十字＝回転の支点）を必ずユーザーに見せる。直すときは `npm run parts -- set <名前> 頭.pivot=400,480`（`.parent=` `.kind=` `.z=` `.spring=` も可。手直しは再取り込みでも保持）。
3. 動き（プリセット）: 待機 idle／うなずき nod／歌う sing（歌詞の音節で口の形 a/i/u/e/o）／ノリ groove（拍で体が弾み腕が振れる）／手を振る wave／首をかしげる tilt。おまかせ = イントロ待機・Aメロ歌う・サビはノリ。髪・服・アクセは親の動きにバネで遅れてついてくる。
   - 日本語: 「キャラは手を振って」「首をかしげて」「サビはキャラがノリノリで」「キャラはうなずいて」。半自動メニューでも選べる。
4. 限界（正直に）: 2D の切り絵なので、顔の向きを変える（振り向く）・腕の前後の重なりの入れ替え・髪の物理演算・体の変形（メッシュ変形）は不可。Live2D Cubism/Spine の書き出しデータは読み込めない。

## パック内での実行

このファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。
