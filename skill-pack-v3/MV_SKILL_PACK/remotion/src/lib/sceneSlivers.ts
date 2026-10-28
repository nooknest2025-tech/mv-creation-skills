/** Merge scene cuts shorter than `min` seconds into a neighbour so the picture never flickers. */
export function mergeSceneSlivers<T extends { start: number; end?: number }>(scenes: T[], duration?: number, min = 0.5): T[] {
  const out = scenes.map((s) => ({ ...s }));
  const len = (i: number) => (out[i + 1]?.start ?? out[i].end ?? duration ?? out[i].start) - out[i].start;
  for (let i = 0; i < out.length && out.length > 1; ) {
    if (len(i) >= min) { i++; continue; }
    if (i > 0) { // absorb into the previous scene
      const prev = out[i - 1]; if (prev.end !== undefined) (prev as any).end = out[i + 1]?.start ?? out[i].end ?? prev.end;
      out.splice(i, 1);
    } else { // first scene: next one starts where this one started
      out[1] = { ...out[1], start: out[0].start, ...(i === 0 ? { transition: 0 } : {}) } as T; out.splice(0, 1);
    }
  }
  return out;
}
