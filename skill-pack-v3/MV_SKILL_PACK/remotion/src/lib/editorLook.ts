/** One effective appearance for controls, bulk operations and rendering. */
export function editorLook(line: any) {
  return {
    font: line.font ?? line.params?.font ?? 'noto_serif',
    fill: line.fill ?? line.params?.palette?.fill ?? '#f8f3e6',
    accent: line.accent ?? line.params?.palette?.accent ?? '#e6aa96',
    stroke: line.stroke ?? line.params?.palette?.stroke ?? '#1f271f',
  };
}
