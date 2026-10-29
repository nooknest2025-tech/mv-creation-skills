/** Stable tabs even when auxiliary servers are intentionally not running. */
export const TOOL_TABS = ['timing', 'faces'] as const;
export function toolUnavailable(key: string, reason?: string) {
  const label = key === 'timing' ? 'タイミング' : '顔の位置';
  return `${label}の補助画面は起動していません。${reason ?? '通常の起動では npm run editor -- --project <名前> で補助画面も起動します。'} 歌詞の秒数やシーンは「歌詞」「シーン」タブでも調整できます。`;
}
