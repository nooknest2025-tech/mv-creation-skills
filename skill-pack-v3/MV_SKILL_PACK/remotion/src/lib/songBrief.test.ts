import {describe,it,expect} from 'vitest';
import {parseSongBrief} from './songBrief';
import {pickPreset} from './pipeline';
import type {Song} from './types';
describe('song genre and mood confirmation',()=>{
 it('keeps the original and distinguishes explicit genre from mood',()=>{
  expect(parseSongBrief('アコースティックで切ない')).toMatchObject({text:'アコースティックで切ない',genre:'acoustic',mood:'melancholy',unresolved:[]});
  expect(parseSongBrief('切ない')).toMatchObject({mood:'melancholy',unresolved:['ジャンルは未特定']});
  expect(parseSongBrief('切ないアコースティックギターバラード')).toMatchObject({genre:'ballad',mood:'melancholy',unresolved:[]});
 });
 it('does not silently collapse mixed moods or multiple genres',()=>{
  const a=parseSongBrief('明るいけれど静かなポップ');
  expect(a.genre).toBe('idol_pop'); expect(a.mood).toBeUndefined();
  expect(a.unresolved.join()).toContain('複数の曲調');
  expect(parseSongBrief('ロックとジャズ').genre).toBeUndefined();
 });
 it('treats calm and melancholic as compatible for the available motion recipe',()=>expect(parseSongBrief('繊細で切ない').mood).toBe('melancholy'));
 it('does not turn an acoustic arrangement into a live-performance assumption',()=>{
  const song:Song={title:'test',duration:30,fps:30,bpm:100,phase:0,beatsPerBar:4,sections:[],energy:[],energyHz:20,lines:[]};
  expect(pickPreset(song,{genre:'acoustic',songBrief:'アコースティックで切ない',combo:['typography']},false).preset.id).not.toBe('firsttake');
  expect(pickPreset(song,{genre:'acoustic',songBrief:'アコースティックで切ない'},false).preset.id).toBe('story');
  expect(pickPreset(song,{genre:'acoustic',songBrief:'弾き語り'},false).preset.id).toBe('firsttake');
 });
});
