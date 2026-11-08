import type {MVConfig} from './config';
import type {Song} from './types';

export type LyricEngineChoice={engine:'standard'|'jizura';why:string};
// A deterministic heuristic, not a learned judgement or an audio-listening model.
export function chooseLyricEngine(song:Pick<Song,'lines'|'duration'>,cfg:MVConfig,hasMedia:boolean):LyricEngineChoice {
 const explicit=cfg.lyricEngine;
 if(explicit==='standard')return {engine:'standard',why:'通常モーションの指定'};
 if(explicit==='jizura')return {engine:'jizura',why:'JIZURAの指定'};
 if(!song.lines.length)return {engine:'standard',why:'歌詞なし'};
 const l=cfg.lyrics;
 if(cfg.mode && cfg.mode!=='omakase' || l?.force || (l?.default && l.default!=='auto') || Object.keys(l?.lines??{}).length || Object.keys(l?.sections??{}).length || Object.keys(l?.keywords??{}).length || Object.keys(l?.params??{}).length || Object.keys(l?.fontKeywords??{}).length || l?.position!==undefined || l?.size!==undefined || l?.palette!==undefined || l?.variety!==undefined || (l as any)?.textY!==undefined || (l as any)?.textYShift!==undefined || Object.keys(cfg.sectionStyles??{}).length || cfg.combo?.includes('tachie'))
  return {engine:'standard',why:'既存のモーション指定または立ち絵を優先'};
 const dense=song.lines.filter(x=>Array.from(x.text.replace(/\s/g,'')).length/Math.max(.1,x.end-x.start)>10).length/song.lines.length;
 if(dense>.25)return {engine:'standard',why:'短時間に文字が多い行が多く可読性を優先'};
 const lyricsFirst=!hasMedia || !!cfg.combo?.some(x=>x==='lyric_motion'||x==='typography');
 if(lyricsFirst&&song.lines.length>=4)return {engine:'jizura',why:'文字中心で歌詞に字組みの変化を付けられるため'};
 return {engine:'standard',why:'映像や文字量を踏まえ通常モーションを選択'};
}
export const AUTO_JIZURA={enabled:true,style:'mono',background:'transparent',motion:.22,decor:.05,seed:20260922,fit:true} as const;
