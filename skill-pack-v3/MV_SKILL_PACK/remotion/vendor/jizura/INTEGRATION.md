# JIZURA engine integration

- Upstream: https://github.com/852wa/JIZURA
- Version: 0.10.1; upstream commit `fc16bfe43ea4a6c25a21f1caf04d17326de14f00`.
- Copyright (c) 2026 hakoniwa. MIT License, reproduced in `LICENSE`.
- `src/` contains the upstream engine files; `12_ui.js` is omitted. `engine.js` concatenates these files in filename order inside a browser-only guard so that the existing editor and its video render can load the same engine. Rebuild with `node vendor/jizura/build-engine.mjs` from `remotion/`.
- See `THIRD_PARTY_NOTICES.md` for upstream notices. The existing editor uses its bundled local fonts; it does not invoke JIZURA's Google Fonts loading function.

- Local modification: `08_planner.js` accepts `mvEditorLines` for literal lyric text and exact editor start/end times. The adapter renders each lyric independently to allow overlapping lines and applies the editor font and position. Upstream behavior without `mvEditorLines` is unchanged.
- Local modification: `09_render.js` accepts `offsetX`/`offsetY` so the editor can measure visible artwork with a margin, and position the sampled bounds. Defaults remain unchanged.
