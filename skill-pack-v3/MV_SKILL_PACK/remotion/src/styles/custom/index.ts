// Registry of styles made with `npm run style:new`.
import type { StyleFn } from "../prims";
import { sakuraFall } from "./sakura_fall";
import { spotlight } from "./spotlight";
import { joinLeftRight } from "./join_left_right";
import { joinTopBottom } from "./join_top_bottom";
import { leaveLeftRight } from "./leave_left_right";
import { leaveTopBottom } from "./leave_top_bottom";
// @style:new import (do not remove this line)
export const CUSTOM_STYLES: Record<string, StyleFn> = {
  sakura_fall: sakuraFall,
  spotlight: spotlight,
  join_left_right: joinLeftRight,
  join_top_bottom: joinTopBottom,
  leave_left_right: leaveLeftRight,
  leave_top_bottom: leaveTopBottom,
  // @style:new entry (do not remove this line)
};
import { MOOD_STYLES } from "../../lib/moods";
import { motionStyle } from "../motion";
for (const [k, m] of Object.entries(MOOD_STYLES)) CUSTOM_STYLES[k] = motionStyle(m.spec);
