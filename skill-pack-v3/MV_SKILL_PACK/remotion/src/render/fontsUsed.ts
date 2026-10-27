// font ids referenced by resolved lyric lines (line font + per-keyword fonts). Pure: usable from scripts and the renderer.
export function fontsOfLines(lines: { params: Record<string, any>; kw: { effect: string }[] }[]): string[] {
  const s = new Set<string>();
  for (const L of lines) { if (L.params.font) s.add(L.params.font); for (const k of L.kw) if (k.effect.startsWith("font:")) s.add(k.effect.slice(5)); }
  return [...s];
}
