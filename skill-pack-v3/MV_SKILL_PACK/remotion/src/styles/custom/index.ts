// Registry of styles made with `npm run style:new`.
import type { StyleFn } from "../prims";
import { sakuraFall } from "./sakura_fall";
import { spotlight } from "./spotlight";
// @style:new import (do not remove this line)
export const CUSTOM_STYLES: Record<string, StyleFn> = {
  sakura_fall: sakuraFall,
  spotlight: spotlight,
  // @style:new entry (do not remove this line)
};
import { MOOD_STYLES } from "../../lib/moods";
import { motionStyle } from "../motion";
for (const [k, m] of Object.entries(MOOD_STYLES)) CUSTOM_STYLES[k] = motionStyle(m.spec);
