// Local font loading (OFL fonts in public/fonts, listed in fonts.yaml) - offline, no Google API calls.
// Base faces load once; extra registry fonts load on demand (only those a render actually uses).
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { FONT_REG } from "../lib/fonts";

const BASE = ["noto_sans", "noto_serif", "reggae", "dela", "rocknroll"];
const cache = new Map<string, Promise<void>>();
export function ensureFont(id: string): Promise<void> {
  const f = FONT_REG.find((x) => x.id === id);
  if (!f || typeof document === "undefined") return Promise.resolve();
  if (!cache.has(id)) cache.set(id, new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)})`).load().then((x) => { (document.fonts as any).add(x); }).catch((e) => console.error("フォント読み込み失敗", f.family, e)));
  return cache.get(id)!;
}
let started = false;
export function loadFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const h = delayRender("fonts", { timeoutInMilliseconds: 120000 });
  Promise.all(BASE.map(ensureFont)).then(() => continueRender(h));
}
/** block rendering until the given registry fonts are loaded. */
export function useFonts(ids: string[]) {
  const key = [...new Set(ids)].filter((i) => !BASE.includes(i)).sort().join(",");
  const [h] = useState(() => (key ? delayRender(`fonts:${key}`, { timeoutInMilliseconds: 120000 }) : null));
  useEffect(() => { if (h !== null) Promise.all(key.split(",").map(ensureFont)).then(() => continueRender(h)); }, [h, key]);
}
export { fontsOfLines } from "./fontsUsed";
