---
name: mv-style-create
description: Use when the user describes a NEW lyric motion in Japanese ("花びらみたいに舞って落ちる字", "スポットライトが当たる感じ") that none of the existing styles covers - author it as a real, tested, registered style. Also when they want a new typeface (書体) - see the font section.
---
# 新しい文字の動き（スタイル）を作る

Goal: a style that works the same as the built-in 32. It must be selectable by Japanese command, survive all aspect ratios, carry keyword effects, fonts and palette, be tested, and be visible in previews. Run everything in `remotion/`.

## 0. Check first (do not duplicate)
- Run `npm run styles` (list) and read `README_ja.md` 「文字の動き」.
- If an existing style plus params gets ≥80% of the description, propose that instead (e.g. 「glitch の amount を弱く」). Make a new one only if it doesn't.

## 1. Translate the description into a motion spec (write it down before coding)
- **Enter:** how a glyph appears. Tie it to the char timing `c.L.chars[i].t0` (sung moment), so it is never early.
- **Hold:** what happens while it is on screen. Use the beat via `beatPulse(c.beat, c.t)` and keep it subtle.
- **Exit:** how it leaves, from `exitP(c.L, c.t)` (0→1).
- **Unit:** per glyph (`drawH`), per word (`c.L.words`), or whole line.
- **Decor:** extra shapes (petals, light, lines). Seed them with `rng(c.L.seed, …)` so renders are deterministic.
- **Energy:** low / mid / high. **Font key:** lyrics / round / stamp / sans / serif (a user's per-line font overrides it anyway).
- **Params:** 2–5 numbers with defaults (e.g. `fall`, `drop`, `sway`). These are what the user tweaks later.

## 2. Scaffold
```
npm run style:new -- <snake_name> --short "日本語の短い名前" --ja "一文の説明" --energy mid --font serif
```
This creates:
- `src/styles/custom/<name>.tsx`: the motion (a template that already works).
- An entry in `src/lib/catalog.custom.ts`: name, description, default params.
- `tests/styles/<name>.test.ts`: registration, inside-frame check on 16:9 / 9:16 / 1:1 / 4:5, NaN check, visible while sung.
- A new row in the README style table.

## 3. Write the motion
Edit only `src/styles/custom/<name>.tsx` and the defaults in `catalog.custom.ts`.
- **Layout:** always use `layoutH(...)` (or `layoutV` for vertical). It wraps lines and respects `c.textY` and safe areas.
  - Keep `maxw` ≤ 0.86 and never place text by hand with absolute pixels.
- **Drawing:** go through `drawH(c, layout, (i, age) => state)`. It applies:
  - keyword effects (キライ=ひび, 甘い=溶ける, …) and keyword fonts,
  - the genre or config palette (CSS variables `--lyric-fill/-stroke/-accent`),
  - the exit fade.
  - If you draw glyphs yourself, call `kwMod(c, i)` and merge it, and use `Glyph` (palette-aware).
- **Return:** `{ el, boxes }`. `boxes` holds one box per glyph and is used for keyword decorations and QA.
- **Sizes:** derive from `l.px` (glyph size) or `c.W` / `c.H`, so 4K and vertical work.
- **Forbidden:** `Math.random()`, `Date.now()`, DOM measuring, network fonts, and copying code or text from other people's repos.
- **Examples:** `custom/sakura_fall.tsx` (per-glyph fall + decor + wind exit) and `custom/spotlight.tsx` (moving light + dim/lit state).

## 4. Check (all four, in order)
1. `npm run style:check -- <name>`. It runs the style's tests, writes stills for 16:9 / 9:16 / 1:1, and renders a 3-second clip (`out/style_<name>.mp4`).
2. **Look at the stills** (open the JPGs). Check that:
   - the text is readable and nothing is cut off, including in vertical,
   - キライ shows its crack effect,
   - it looks like the user's description.
3. Run `npm test` and `npm run typecheck`.
4. Run it on the user's song: `npm run edit -- "サビは<short名>で"`, then `npm run preview`.

## 5. Register for automatic use (optional)
- To have auto-select pick it, add the name to a pool in `src/lib/genres.ts` (genre recipe) or `AUTO_POOLS` in `src/lib/catalog.ts`.
- For a Japanese alias, add `[/桜吹雪|花びら/, "<name>"]` to `JA_STYLE_WORDS` in `src/lib/nl.ts`, then verify with `npm run edit -- "サビは桜吹雪で"`.

## 6. Report to the user (Japanese)
Tell them:
- the name, the Japanese command to use it, and the params they can tweak;
- the still or clip paths;
- any honest limits (e.g. "粒子は軽め。重くすると書き出しが遅くなります").

---
# 新しい書体（フォント）を足す
- **From Google Fonts:** `npm run fonts:add -- "Kiwi Maru" --category 丸ゴシック --moods soft,idol`.
  - It reads the licence from Google's METADATA, refuses non-redistributable fonts, and saves the licence text next to the font.
- **From a file:** `npm run fonts:add -- path/to/Font.ttf --category 手書き --license OFL-1.1`.
  - **Always ask the user what the licence is**, including whether it may be used in videos and redistributed. Without `--license` it is recorded as 未確認 and not bundled.
- After adding, run `npm run fonts:sheet` (specimen image), then use it: 「サビは<id>で」「『夢』は<id>で」.
- Missing fonts listed in `fonts.yaml` (bundled: false) are downloaded with `npm run fonts:fetch`.

## パック内での実行

このファイルは配布用コピー。編集原本は管理用ワークスペースの `.agents/skills/`。制作時は、この配布パックのルートにある `AGENTS.md` を読み、コマンドは `remotion/` で実行する。本文の `input/`、`projects/`、`docs/`、`gen/` はパックのルートを基準に解決する。
