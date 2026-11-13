import {describe,it,expect,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {applyLyricSettings,setLyricY} from '../editor/lyric-look';
import {placeJizura} from '../editor/jizura-placement';
import {motionSample} from '../editor/line-engine';
import {setJizuraChoice} from '../editor/jizura-parts';
import {plansFor} from '../editor/JizuraStage';
import {Scene} from '../editor/editor-scene';

const row=(id:string,start=1,end=5):any=>({id,text:'歌詞の文字',start,end,motion:'reveal',scale:.7,y:.5,motionDuration:.5,jizura:{layout:'center',parts:[{text:'歌詞の文字',start:0,end:end-start,layout:'center',enter:'wipe'}]}});
const data=()=>({duration:20,width:1280,height:720,fps:30,bpm:120,assets:['test.svg'],scenes:[{id:'S1',start:0,asset:0,transition:0}],lyrics:[row('L001'),row('L002',6,8),row('L003',9,11)],jizura:{enabled:true,style:'mono'}});
describe('editor look and motion actions',()=>{
 it('uses the standard renderer for a motion sample, without changing project settings',()=>{
  const d=data(),before=structuredClone(d),demo=motionSample(d,d.lyrics[0],'bounce');
  expect(d).toEqual(before);expect(demo.lyrics[0].jizura.engine).toBe('standard');expect(demo.lyrics[0].end).toBe(3.5);
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});try{const html=renderToStaticMarkup(<Scene data={demo} t={1}/>);expect(html).toContain('>歌</div>')}finally{spy.mockRestore()}
 });
 it('applies a named motion to selected targets and records engine switching for undo',()=>{
  const d=data(),parts=structuredClone(d.lyrics[1].jizura.parts),history=applyLyricSettings(d,d.lyrics[0],[d.lyrics[1]],'motion','bounce');
  expect(d.lyrics[1].motion).toBe('bounce');expect(d.lyrics[1].jizura.engine).toBe('standard');expect(d.lyrics[1].jizura.parts).toEqual(parts);
  expect(d.lyrics[2].jizura.engine).toBeUndefined();
  for(const c of history){const l=d.lyrics.find(x=>x.id===c.id)!;if(c.before===undefined)delete l[c.key];else l[c.key]=c.before}
  expect(d.lyrics[1].jizura.engine).toBeUndefined();expect(d.lyrics[1].motion).toBe('reveal');
 });
 it('copies opacity and all effects while fitting event offsets to the target interval',()=>{
  const d=data(),a=d.lyrics[0],b=d.lyrics[1],before=structuredClone(b);a.opacity=.4;
  Object.assign(a.jizura,{enter:'fade',layout:'type',fx:'flash',fxTime:3,fxScope:'screen',fxStrength:1.5,screenFx:'shake',screenFxTime:3.8,screenFxDuration:.7,screenFxStrength:.8});
  applyLyricSettings(d,a,[b],'look');
  expect(b.opacity).toBe(.4);expect(b.jizura).toMatchObject({fx:'flash',fxTime:1.5,fxScope:'screen',fxStrength:1.5,screenFx:'shake',screenFxTime:1.9,screenFxDuration:.7,screenFxStrength:.8});
  expect(b.jizura.parts[0]).toMatchObject({text:before.text,start:0,end:2,layout:'type',enter:'fade'});expect([b.start,b.end]).toEqual([before.start,before.end]);
  a.opacity=undefined;a.jizura={};applyLyricSettings(d,a,[b],'look');expect(b.opacity).toBe(1);expect(b.jizura.fx).toBeUndefined();expect(b.jizura.screenFx).toBeUndefined();
 });
 it('row-wide choices update manual parts but keep words, time and unrelated per-part choices',()=>{
  const l=row('L001'),before=structuredClone(l);setJizuraChoice(l,'layout','type');setJizuraChoice(l,'enter','fade');
  const calls:any[]=[];const J={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:(p:any)=>{calls.push(p);return {cuts:[],events:[]}}};
  plansFor({...data(),lyrics:[l]},J,[]);expect(calls[1].overrides[0]).toMatchObject({layout:'type',enter:'fade'});
  expect(l.jizura.parts[0].text).toBe(before.text);expect(l.jizura.parts[0].end).toBe(4);
  setJizuraChoice(l,'layout','');expect(l.jizura.layout).toBeUndefined();expect(l.jizura.parts[0].layout).toBeUndefined();expect(l.jizura.parts[0].enter).toBe('fade');
 });
 it('font/color-only bulk edits do not switch engines or overwrite choreography',()=>{
  const d=data(),a=d.lyrics[0],b=d.lyrics[1],before=structuredClone(b.jizura);a.font='noto_sans';a.fill='#123456';
  applyLyricSettings(d,a,[b],'font');applyLyricSettings(d,a,[b],'colors');expect(b.font).toBe('noto_sans');expect(b.fill).toBe('#123456');expect(b.jizura).toEqual(before);
 });
 it('a vertical-position edit overrides a saved box anchor in the actual placement helper',()=>{
  const l={x:.5,y:.3,boxY:.1,scale:.5},bounds={x:100,y:100,w:200,h:100};
  const before=placeJizura(l,bounds,1000,500);setLyricY(l,.7);const after=placeJizura(l,bounds,1000,500);
  expect(l.boxY).toBeUndefined();expect(after.pivotY).toBeCloseTo(350);expect(after.pivotY).not.toBe(before.pivotY);
 });
});
