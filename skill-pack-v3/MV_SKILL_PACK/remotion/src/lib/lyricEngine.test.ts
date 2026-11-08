import {describe,it,expect} from 'vitest';
import {chooseLyricEngine} from './lyricEngine';
import type {Song} from './types';
const line=(text:string,start:number,end:number)=>({text,start,end,chars:[],words:[]});
const song={duration:30,lines:[line('夜空の向こう',1,4),line('届く声は',5,7),line('笑っている',9,12),line('また明日',14,17)]} satisfies Pick<Song,'lines'|'duration'>;
describe('lyric engine selection',()=>{
 it('considers JIZURA for a lyric-led project',()=>expect(chooseLyricEngine(song,{mode:'omakase'},false).engine).toBe('jizura'));
 it('keeps standard motion for imagery without a lyric-first request',()=>expect(chooseLyricEngine(song,{mode:'omakase'},true).engine).toBe('standard'));
 it('preserves explicit motion and user override',()=>{
  expect(chooseLyricEngine(song,{lyrics:{lines:{'0':'handwriting'}}},false).engine).toBe('standard');
  expect(chooseLyricEngine(song,{lyrics:{params:{reveal:{rise:.2}}}},false).engine).toBe('standard');
  for(const lyrics of [{position:'top' as const},{size:1.5},{palette:{fill:'#ff0000'}},{fontKeywords:{夜:'noto_sans'}},{variety:.2},{textY:.3},{textYShift:.1}])
   expect(chooseLyricEngine(song,{lyrics},false).engine).toBe('standard');
  expect(chooseLyricEngine(song,{lyricEngine:'standard'},false).engine).toBe('standard');
  expect(chooseLyricEngine(song,{lyricEngine:'jizura'},true).engine).toBe('jizura');
 });
 it('avoids JIZURA for dense lyrics, absent lyrics and automatic tachie',()=>{
  expect(chooseLyricEngine({...song,lines:song.lines.map(l=>({...l,text:'長い歌詞が続いてとても速い',end:l.start+.2}))},{},false).engine).toBe('standard');
  expect(chooseLyricEngine({...song,lines:[]},{},false).engine).toBe('standard');
  expect(chooseLyricEngine(song,{combo:['tachie']},false).engine).toBe('standard');
 });
});
