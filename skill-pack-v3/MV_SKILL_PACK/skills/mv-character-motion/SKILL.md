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
  - No viseme shapes (あ/い/う) and no part-rigged dance.
  - For full-body dance, suggest a video model via MCP (see [mv-video-generation](../mv-video-generation/SKILL.md)). When attaching audio, cut the exact original-song interval to the selected generation duration, verify the actual duration and upload that cut file without time-stretching. Check the resulting motion against the original interval at normal speed before adoption.

## パック内での実行

このファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。
