// Export editable lyric groups as timestamped LRC for a separate JIZURA session.
// This is an interchange tool, not a copy of or integration with JIZURA code.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function lrcFromEditor(data) {
  if (!Array.isArray(data?.lyrics) || !data.lyrics.length) throw Error('歌詞がありません');
  const lyrics = data.lyrics.map((line, i) => {
    const start = Number(line.start), text = String(line.text ?? '').replace(/[\r\n]+/g, ' ').trim();
    if (!Number.isFinite(start) || start < 0 || !text) throw Error(`歌詞 ${i + 1} の時刻または本文が不正です`);
    return {start, text, index:i};
  }).sort((a,b) => a.start-b.start || a.index-b.index);
  const stamp = sec => {const cs=Math.round(sec*100), minutes=Math.floor(cs/6000), seconds=Math.floor(cs/100)%60, hundredths=cs%100; return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;};
  return lyrics.map(l=>`[${stamp(l.start)}]${l.text}`).join('\n')+'\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input || !output) throw Error('使い方: node editor/export-jizura.mjs <editor-state.json> <新しい出力.lrc>');
    const state=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));
    fs.writeFileSync(output,lrcFromEditor(state.data),{encoding:'utf8',flag:'wx'});
    console.log(`LRC を作成: ${path.resolve(output)}（重ねた歌詞は開始時刻順。JIZURA側で表示と同期を確認）`);
  } catch(e) { console.error(e.message); process.exitCode=1; }
}
