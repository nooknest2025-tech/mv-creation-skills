import type { FinishFx } from "./types";
/** letterbox bar height in px: 0..1 maps 1.85:1 .. 2.39:1 (landscape only). */
export const letterboxPx = (f: FinishFx | undefined, W: number, H: number) => {
  const lb = f?.letterbox ?? 0; if (lb <= 0 || H > W) return 0;
  const target = H - W / (lb >= 1 ? 2.39 : 1.85 + (2.39 - 1.85) * lb); // 0..1 → 1.85:1 .. 2.39:1
  return Math.max(0, target / 2);
};
