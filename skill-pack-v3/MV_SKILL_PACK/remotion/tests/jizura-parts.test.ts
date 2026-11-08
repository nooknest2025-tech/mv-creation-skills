import {describe,it,expect} from 'vitest';
import {applyParts,validateParts,type LyricPart} from '../editor/jizura-parts';
const line={text:'夜空の向こう 届く声は',start:1,end:5,jizura:{}};
const base={cuts:[{line:0,utext:'夜空の',start:1,end:2,index:0},{line:0,utext:'向こう',start:2,end:3,index:1},{line:0,utext:line.text,start:3,end:5,index:2,recap:true}],events:[]};
const make=(p:LyricPart,i:number)=>({cuts:[{line:0,utext:p.text,start:line.start+p.start,end:line.start+p.end,index:0}],events:[{t:line.start+p.start,type:'x',i}]});
describe('JIZURA editable display parts',()=>{
 it('leaves legacy auto unchanged and can remove only the recap',()=>{
  expect(applyParts(base,line,make)).toBe(base);
  const p=applyParts(base,{...line,jizura:{recap:'off'}},make);
  expect(p.cuts.map(c=>c.utext)).toEqual(['夜空の','向こう']);expect(p.cuts[1].end).toBe(5);expect(p.cuts[1].dur).toBe(3);
 });
 it('creates a full-line recap when requested',()=>{
  const noRecap={...base,cuts:base.cuts.slice(0,2).map((c,i)=>({...c,end:i===1?5:c.end}))};
  const p=applyParts(noRecap,{...line,jizura:{recap:'on'}},make);
  expect(p.cuts.map(c=>c.utext)).toEqual(['夜空の','向こう',line.text]);
  expect(p.cuts.at(-1).end).toBe(5);
 });
 it('uses exact user text and relative times; preserves gaps and order',()=>{
  const parts=[{text:'夜空の',start:0,end:.8},{text:'向こう',start:1,end:1.8},{text:line.text,start:2,end:4}];
  const p=applyParts(base,{...line,jizura:{parts}},make);
  expect(p.cuts.map(c=>[c.utext,c.start,c.end,c.index])).toEqual([['夜空の',1,1.8,0],['向こう',2,2.8,1],[line.text,3,5,2]]);
 });
 it('rejects overlaps, empty text, out-of-line and invalid options',()=>{
  expect(validateParts([{text:'x',start:0,end:2},{text:'y',start:1,end:3}],4)).toBeTruthy();
  expect(validateParts([{text:' ',start:0,end:1}],4)).toBeTruthy();
  expect(validateParts([{text:'x',start:0,end:5}],4)).toBeTruthy();
  expect(validateParts([{text:'x',start:0,end:1,layout:'bad key'}],4)).toBeTruthy();
  expect(applyParts(base,{...line,jizura:{parts:[{text:'x',start:0,end:5}]}},make).cuts).toEqual([]);
 });
});
