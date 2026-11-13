import {describe,it,expect} from 'vitest';
import {moveLyricEdge,moveLyric} from '../editor/timeline';
import {validateParts} from '../editor/jizura-parts';
import {plansFor} from '../editor/JizuraStage';

const lyric=()=>({id:'L001',text:'夜空の向こう',start:1,end:5,font:'noto_serif',jizura:{seed:42,recap:'off',fxTime:3.8,screenFxTime:3.9,parts:[{text:'夜空の',start:0,end:1,enter:'blur'},{text:'向こう',start:2,end:4,layout:'center'}]}});
const engine={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:(p:any)=>{const l=p.mvEditorLines[0];return {cuts:[{line:0,utext:l.text,start:l.start,end:l.end}],events:[]}}};
const plan=(l:any)=>plansFor({lyrics:[l],width:1920,height:1080,duration:10,jizura:{enabled:true}},engine,[])[0].plan;

describe('JIZURA timing edits',()=>{
 it.each([['start',1.5,3.5],['end',3,2],['start',0,5],['end',7,6]] as const)('keeps every displayed phrase when %s becomes %s',(edge,value,duration)=>{
  const l=lyric();moveLyricEdge(l,edge,value,10);
  expect(validateParts(l.jizura.parts,l.end-l.start)).toBeNull();
  expect(l.jizura.parts[1].end).toBeCloseTo(duration);
  const p=plan(l);expect(p.cuts.map((c:any)=>c.utext)).toEqual(['夜空の','向こう']);
  expect(p.cuts[1].end).toBeCloseTo(l.end);
  expect(l.jizura.parts[1].start-l.jizura.parts[0].end).toBeCloseTo(duration/4);
  expect(l.jizura.parts[0].enter).toBe('blur');expect(l.jizura.parts[1].layout).toBe('center');
  expect(l.jizura.fxTime).toBeLessThanOrEqual(duration);expect(l.jizura.screenFxTime).toBeLessThan(duration);
  expect(l.jizura.seed).toBe(42);expect(l.jizura.recap).toBe('off');
 });
 it('preserves relative timing when moving the whole block',()=>{
  const l=lyric(),before=structuredClone(l.jizura);moveLyric(l,2,10);
  expect(l.jizura).toEqual(before);expect(plan(l).cuts[0].start).toBe(3);
 });
 it('supports repeated edge drags, minimum length and undo snapshots without losing text',()=>{
  const l=lyric(),before=JSON.stringify(l);
  for(const t of [1.5,2,4,4.99,3,1])moveLyricEdge(l,'start',t,10);
  expect(validateParts(l.jizura.parts,4)).toBeNull();expect(plan(l).cuts).toHaveLength(2);
  expect(l.jizura.parts[1].end).toBeCloseTo(4);
  expect(JSON.parse(before)).toEqual(lyric());
 });
 it('does not add JIZURA settings to ordinary lyrics or accept nonfinite timing',()=>{
  const l={start:1,end:5};moveLyricEdge(l,'end',3,10);expect(l).toEqual({start:1,end:3});
  moveLyricEdge(l,'start',NaN,10);expect(l.start).toBe(1);
 });
});
