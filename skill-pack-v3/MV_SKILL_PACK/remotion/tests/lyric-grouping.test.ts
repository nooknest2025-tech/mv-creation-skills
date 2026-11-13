import {describe,it,expect} from 'vitest';
import {splitLyric,joinLyrics} from '../editor/lyric-grouping';
import {validateParts} from '../editor/jizura-parts';
import {plansFor} from '../editor/JizuraStage';

const row=(id='L001',text='夜空の向こう',start=1,end=5):any=>({id,text,start,end,motion:'reveal',jizura:{layout:'center',parts:[{text,start:0,end:end-start,enter:'wipe'}]}});
const valid=(rows:any[])=>rows.forEach(l=>expect(validateParts(l.jizura.parts,l.end-l.start)).toBeNull());
const coverage=(rows:any[])=>rows.flatMap(l=>(l.sourceParts??[{line:l.id,start:0,end:Array.from(l.text).length}]).flatMap((p:any)=>Array.from({length:p.end-p.start},(_,i)=>`${p.line}:${p.start+i}`)));
const J={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:(p:any)=>{const l=p.mvEditorLines[0];return {cuts:[{line:0,utext:l.text,start:l.start,end:l.end}],events:[]}}};
const visible=(rows:any[])=>plansFor({lyrics:rows,width:1280,height:720,duration:20},J,[]).map(x=>x.plan.cuts.map((c:any)=>c.utext).join(''));

describe('editable lyric grouping',()=>{
 it('splits a full manual part with source coverage and both displayed halves intact',()=>{
  const a=row(),before=structuredClone(a),result=splitLyric(a,3,'SPLIT_1');valid(result);
  expect(result.map(l=>l.text)).toEqual(['夜空の','向こう']);expect(visible(result)).toEqual(['夜空の','向こう']);
  expect(coverage(result)).toEqual(coverage([a]));expect(a).toEqual(before);expect(result[0].jizura.parts[0].enter).toBe('wipe');
 });
 it('supports unicode, internal gaps, repeated recaps and per-part choices',()=>{
  const a=row('L001','君🌙と夜空',0,8);a.jizura.parts=[{text:'君🌙',start:0,end:1,layout:'type'},{text:'と夜空',start:2,end:4,enter:'blur'},{text:a.text,start:5,end:8}];
  const result=splitLyric(a,2,'SPLIT_2');valid(result);expect(result.map(l=>l.text)).toEqual(['君🌙','と夜空']);
  expect(result[1].jizura.parts[0].enter).toBe('blur');expect(coverage(result)).toEqual(coverage([a]));
  expect(result[0].jizura.parts.map((p:any)=>p.text)).toEqual(['君🌙','君🌙']);
 });
 it('joins adjacent manual/automatic rows without losing the second text or pause',()=>{
  const a=row('L001','夜空',0,2),b=row('L002','の向こう',3,5);delete b.jizura.parts;
  const result=joinLyrics(a,b,4);valid(result);expect(visible(result)).toEqual(['夜空の向こう']);
  expect(result[0].jizura.parts.map((p:any)=>[p.start,p.end])).toEqual([[0,2],[3,5]]);
  expect(coverage(result)).toEqual(coverage([a,b]));
 });
 it('fits overlapping manual rows sequentially, retaining every phrase',()=>{
  const a=row('L001','夜空の向こう ',.66,4.48),b=row('L002','届く声は',3,4.48),result=joinLyrics(a,b,4);valid(result);
  expect(visible(result)).toEqual([a.text+b.text]);expect(result[0].jizura.parts[0].end).toBeCloseTo(result[0].jizura.parts[1].start);
  expect(coverage(result)).toEqual(coverage([a,b]));
 });
 it('joins part of the next row and leaves its remainder valid and editable',()=>{
  const a=row('L001','夜空',0,2),b=row('L002','の向こうへ',2,6),before=structuredClone(b),result=joinLyrics(a,b,2);valid(result);
  expect(result.map(l=>l.text)).toEqual(['夜空の向','こうへ']);expect(visible(result)).toEqual(['夜空の向','こうへ']);
  expect(coverage(result)).toEqual(coverage([a,b]));expect(b).toEqual(before);
 });
 it('keeps ordinary rows automatic and rejects ambiguous or excessive parts before mutation',()=>{
  const a=row(),b=row('L002','明日へ',5,8);delete a.jizura.parts;delete b.jizura.parts;
  expect(splitLyric(a,3,'SPLIT_3')[0].jizura.parts).toBeUndefined();expect(joinLyrics(a,b,3)[0].jizura.parts).toBeUndefined();
  a.jizura.parts=[{text:'別の文字',start:0,end:4}];const before=structuredClone(a);expect(()=>splitLyric(a,3,'X')).toThrow(/元歌詞/);expect(a).toEqual(before);
  a.jizura.parts=Array.from({length:24},(_,i)=>({text:a.text,start:i/6,end:(i+1)/6}));b.jizura.parts=[{text:b.text,start:0,end:3}];
  expect(()=>joinLyrics(a,b,3)).toThrow(/1〜24/);
 });
});
