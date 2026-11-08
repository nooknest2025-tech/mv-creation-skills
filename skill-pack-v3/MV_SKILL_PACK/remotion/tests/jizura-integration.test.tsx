import {describe,expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {projectFor,plansFor,linePosition,supportsJizuraNoWrap} from '../editor/JizuraStage';
import fonts from '../editor/font-options.json';
import {Scene} from '../editor/editor-scene';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {prepareProject} from '../scripts/editor';

const line=(v:any)=>({id:'L001',text:'元の歌詞',start:1,end:4,motion:'reveal',scale:1,y:.7,motionDuration:.8,...v});
const base=(lyrics:any[])=>({title:'test',duration:10,width:1280,height:720,fps:30,bpm:120,assets:['test.png'],scenes:[{id:'S1',start:0,asset:0,transition:0}],lyrics,jizura:{enabled:true,style:'mono',seed:42}});

describe('JIZURA editor integration',()=>{
 it('reduces the preview canvas while keeping export at project resolution',()=>{
  const d={...base([line({})]),width:1920,height:1080};
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{
   expect(renderToStaticMarkup(<Scene data={d} t={2} preview/>)).toContain('<canvas width="960" height="540"');
   expect(renderToStaticMarkup(<Scene data={d} t={2} preview playing/>)).toContain('<canvas width="720" height="405"');
   expect(renderToStaticMarkup(<Scene data={d} t={2}/>)).toContain('<canvas width="1920" height="1080"');
  }finally{spy.mockRestore()}
 });
 it('exports current lyric starts and excludes separately rendered captions',()=>{
  const J={defaultProject:()=>({timing:{snap:true},fx:{}})};
  const data=base([line({}),line({id:'X1',text:'追加テキスト',extra:true,motion:'dvd_title'}),line({id:'L002',text:'次の行',start:4,end:6,jizura:{layout:'center',enter:'fade'}})]);
  const p=projectFor(data,J);
  expect(p.lyrics).toBe('[00:01.00]元の歌詞\n[00:04.00]次の行');
  expect(p.overrides).toEqual({1:{layout:'center',enter:'fade'}});
  expect(p.timing.snap).toBe(false);
  expect(p.seed).toBe(42);
 });
 it('plans overlapping literal lyrics with independent end times, fonts and positions',()=>{
  const font=fonts[0], calls:any[]=[];
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '700 24px Original, sans-serif'};
  J.plan=(p:any,audio:any)=>{calls.push({lines:p.mvEditorLines,override:p.overrides,font:J.fontCSS('x',24),beats:audio.beats});return {}};
  const data=base([line({text:'A/B | C!',start:1,end:4,font:font.id,x:.2,y:.3,jizura:{layout:'vcols'}}),line({id:'L002',text:'別の行',start:2,end:5,x:.8,y:.7})]);
  const result=plansFor(data,J,[.2,.7,1.35]);
  expect(result).toHaveLength(2);expect(calls[0].lines).toEqual([{text:'A/B | C!',start:1,end:4}]);
  expect(calls[1].lines).toEqual([{text:'別の行',start:2,end:5}]);expect(calls[0].override).toEqual({0:{layout:'vcols'}});
  expect(calls[0].beats).toEqual([.2,.7,1.35]);
  expect(calls[0].font).toContain(font.family);expect(calls[1].font).toContain('Original');
  expect(linePosition(data.lyrics[0])).toEqual({x:.2,y:.3});expect(linePosition({position:'br'})).toEqual({x:.9,y:.9});
 });
 it('keeps additional captions above the JIZURA layer',()=>{
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   const markup=renderToStaticMarkup(<Scene data={base([line({}),line({id:'X1',text:'追加テキスト',extra:true,motion:'dvd_title'})])} t={2}/>);
   expect(markup).toContain('<canvas');
   expect(markup).toContain('追加テキスト');
  } finally {spy.mockRestore()}
 });
 it('allows one standard lyric alongside a JIZURA lyric',()=>{
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:()=>({})};
  const d=base([line({text:'JIZURA'}),line({id:'L002',text:'通常の歌詞',start:2,end:5,jizura:{engine:'standard'}})]);
  expect(plansFor(d,J,[]).map(x=>x.line.text)).toEqual(['JIZURA']);
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});try{const html=renderToStaticMarkup(<Scene data={d} t={3}/>);expect(html).toContain('>通</div>');expect(html).toContain('>詞</div>')}finally{spy.mockRestore()}
 });
 it('sends manual parts and per-part motion to the actual plan input',()=>{
  const calls:any[]=[];
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original'};
  J.plan=(p:any)=>{calls.push(p);const l=p.mvEditorLines[0];return {cuts:[{line:0,utext:l.text,start:l.start,end:l.end,index:0}],events:[]}};
  const parts=[{text:'夜空の',start:0,end:1,enter:'blur'},{text:'向こう',start:1,end:2,layout:'center'},{text:'夜空の向こう',start:2,end:3}];
  const result=plansFor(base([line({text:'夜空の向こう',jizura:{parts,layout:'mixed'}})]),J,[]);
  expect(result[0].plan.cuts.map((c:any)=>[c.utext,c.start,c.end])).toEqual([['夜空の',1,2],['向こう',2,3],['夜空の向こう',3,4]]);
  expect(calls[1].overrides[0]).toMatchObject({single:true,layout:'mixed',enter:'blur'});
  expect(calls[2].overrides[0]).toMatchObject({single:true,layout:'center'});
 });
 it('preserves a locked line seed and passes edited colors without changing unedited defaults',()=>{
  const calls:any[]=[];const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:(p:any)=>{calls.push(p);return {}}};
  const lyrics=[line({jizura:{seed:123,colorMode:'editor'},fill:'#abcdef',accent:'#123456',stroke:'#334455'}),line({id:'L002',start:4,end:6})];
  const d=base(lyrics);plansFor(d,J,[]);d.jizura.seed=99;plansFor(d,J,[]);
  expect(calls[0].seed).toBe(123);expect(calls[2].seed).toBe(123);expect(calls[1].seed).not.toBe(calls[3].seed);
  expect(calls[0].colors).toEqual({enabled:true,accentOn:true,fg:'#abcdef',accent:'#123456',sub:'#334455'});
  expect(calls[1].colors).toBeUndefined();expect(calls[0].overrides).toEqual({});
 });
 it('passes selected camera, text treatment and decoration to JIZURA',()=>{
  const calls:any[]=[];const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',plan:(p:any)=>{calls.push(p);return {}}};
  plansFor(base([line({jizura:{cam:'push',treat:'none',decor:['rings'],bg:'none',trans:'wipe'}})]),J,[]);
  expect(calls[0].overrides[0]).toEqual({cam:'push',treat:'none',decor:['rings'],bg:'none',trans:'wipe'});
 });
 it('applies a chosen transition between adjacent manual parts only',()=>{
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',TRANS:{wipe:{dur:.3,plan:()=>({dir:1})}},rng:()=>({}),h:()=>42};
  J.plan=(p:any)=>{const l=p.mvEditorLines[0];return {style:{},cuts:[{line:0,utext:l.text,start:l.start,end:l.end,index:0,enter:'blur',exit:'blur'}],events:[]}};
  const parts=[{text:'A',start:0,end:1},{text:'B',start:1,end:2},{text:'C',start:2.2,end:3}];
  const p=plansFor(base([line({jizura:{trans:'wipe',parts}})]),J,[])[0].plan;
  expect(p.cuts[1]).toMatchObject({trans:'wipe',transP:{dir:1},transDur:.3,enter:'cut'});
  expect(p.cuts[0].exit).toBe('cut');expect(p.cuts[2].trans).toBeUndefined();
 });
 it('retains a deliberately selected background on busy layouts',()=>{
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',BG:{aurora:{plan:()=>({phase:1})}},rng:()=>({}),h:()=>42};
  J.plan=()=>({style:{},cuts:[{line:0,utext:'A',start:1,end:4,bg:'none'}],events:[]});
  const p=plansFor(base([line({jizura:{bg:'aurora'}})]),J,[])[0].plan;
  expect(p.cuts[0]).toMatchObject({bg:'aurora',bgP:{phase:1}});
 });
 it('passes an explicit effect and edited entrance duration to the chosen line',()=>{
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',FXE:{flash:{amp:2,dur:6}}};
  J.plan=()=>({style:{},cuts:[{line:0,utext:'A',start:1,end:4,enter:'blur',inDur:.3,outDur:.4}],events:[]});
  const p=plansFor(base([line({motionDuration:.9,edited:['motionDuration'],jizura:{fx:'flash',fxTime:.5,fxStrength:1.5}})]),J,[])[0].plan;
  expect(p.cuts[0].inDur).toBe(.9);expect(p.events).toEqual([{t:1.5,type:'flash',amp:3,dur:.25}]);
  const whole=plansFor(base([line({jizura:{fx:'flash',fxScope:'screen'}})]),J,[])[0].plan;
  expect(whole.events).toEqual([]);
 });
 it('keeps central JIZURA text on one line without leaking into other lines',()=>{
  const split=(s:string)=>s.slice(0,2)+'\n'+s.slice(2),calls:string[]=[];
  const J:any={defaultProject:()=>({timing:{},fx:{}}),fontCSS:()=> '24px Original',splitLines:split};
  J.plan=()=>{calls.push(J.splitLines('ABCDEFGHIJKL',4));return {}};
  const central=line({jizura:{layout:'center'},params:{noWrap:true}}),other=line({id:'L002',start:4,end:6,jizura:{layout:'mixed'},params:{noWrap:true}});
  plansFor(base([central,other]),J,[]);expect(calls).toEqual(['ABCDEFGHIJKL','AB\nCDEFGHIJKL']);expect(J.splitLines).toBe(split);
  calls.length=0;plansFor(base([line({jizura:{layout:'type'},params:{noWrap:true}})]),J,[]);expect(calls).toEqual(['ABCDEFGHIJKL']);expect(J.splitLines).toBe(split);
  expect(supportsJizuraNoWrap({...central,jizura:{layout:'center',parts:[{layout:'vcols'}]}})).toBe(false);
  expect(supportsJizuraNoWrap({...central,jizura:{layout:'type',parts:[{layout:'center'}]}})).toBe(true);
  expect(supportsJizuraNoWrap({...central,jizura:{layout:'type',parts:[{layout:'mixed'}]}})).toBe(false);
 });
 const py=['python3','python'].find(c=>spawnSync(c,['--version']).status===0);
 it.skipIf(!py)('saves settings and rejects invalid settings',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-jizura-'));
  const prepared=prepareProject({demo:true,project:dir});
  const srv=spawn(py!,[path.resolve(__dirname,'../editor/server.py'),'--root',prepared.runtime,'--port','5789'],{stdio:['ignore','pipe','pipe']});
  const url:string=await new Promise((resolve,reject)=>{srv.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0])});setTimeout(()=>reject(Error('server timeout')),8000)});
  try{
   let s=await (await fetch(url+'/api/state')).json();
   const save=(j:any,lyrics=s.data.lyrics)=>fetch(url+'/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:s.revision,data:{...s.data,lyrics,jizura:j}})});
   const ordinary=s.data.lyrics.map((l:any,i:number)=>i===1?{...l,jizura:{lineTrans:'shared_fade',lineTransDuration:.8}}:l);
   expect((await save(undefined,ordinary)).status).toBe(200);
   s=await (await fetch(url+'/api/state')).json();expect(s.data.lyrics[1].jizura.lineTransDuration).toBe(.8);
   expect((await save({enabled:true,style:'invalid'})).status).toBe(400);
   const j={enabled:true,style:'mono',background:'transparent',motion:.45,decor:.3,seed:42,fit:false};
   expect((await save({...j,fit:'yes'})).status).toBe(400);
   expect((await save({...j,style:'sakura'})).status).toBe(200);
   s=await (await fetch(url+'/api/state')).json();expect(s.data.jizura.style).toBe('sakura');
   const lyrics=s.data.lyrics.map((l:any,i:number)=>i===0?{...l,jizura:{layout:'center',enter:'fade'}}:l);
   expect((await save(j,lyrics.map((l:any,i:number)=>i===0?{...l,jizura:{layout:'bad key'}}:l))).status).toBe(400);
   expect((await save(j,lyrics)).status).toBe(200);
   s=await (await fetch(url+'/api/state')).json();expect(s.data.jizura).toEqual(j);expect(s.data.lyrics[0].jizura).toEqual({layout:'center',enter:'fade'});
   const parts=[{text:'はじめの',start:0,end:.5,enter:'fade'},{text:'はじめの音を',start:.5,end:1.5}];
   const custom=s.data.lyrics.map((l:any,i:number)=>i===0?{...l,jizura:{recap:'off',parts}}:l);
   expect((await save(j,custom)).status).toBe(200);
   s=await (await fetch(url+'/api/state')).json();expect(s.data.lyrics[0].jizura.parts).toEqual(parts);
   const locked=s.data.lyrics.map((l:any,i:number)=>i===0?{...l,jizura:{seed:4294967295,colorMode:'editor',engine:'standard',cam:'push',treat:'none',decor:['rings'],bg:'none',trans:'wipe',lineTrans:'wipe',lineTransDuration:.8,fx:'flash',fxTime:.2,fxStrength:1.2,screenFx:'flash',screenFxTime:.5,screenFxDuration:.3,screenFxStrength:1.2}}:l);
   expect((await save(j,locked)).status).toBe(200);
   s=await (await fetch(url+'/api/state')).json();expect(s.data.lyrics[0].jizura.seed).toBe(4294967295);expect(s.data.lyrics[0].jizura.lineTransDuration).toBe(.8);
   const whole=locked.map((l:any,i:number)=>i===0?{...l,jizura:{fx:'flash',fxScope:'screen'}}:l);
   expect((await save(j,whole)).status).toBe(200);s=await (await fetch(url+'/api/state')).json();expect(s.data.lyrics[0].jizura.fxScope).toBe('screen');
   expect((await save(j,locked.map((l:any,i:number)=>i===0?{...l,jizura:{fx:'mosaic',fxScope:'screen'}}:l))).status).toBe(400);
   expect((await save(j,locked.map((l:any,i:number)=>i===0?{...l,jizura:{lineTransDuration:2.1}}:l))).status).toBe(400);
   expect((await save(j,locked.map((l:any,i:number)=>i===0?{...l,jizura:{seed:-1}}:l))).status).toBe(400);
   const bad=s.data.lyrics.map((l:any,i:number)=>i===0?{...l,jizura:{parts:[{text:'a',start:0,end:1},{text:'b',start:.5,end:1.2}]}}:l);
   expect((await save(j,bad)).status).toBe(400);
  } finally {srv.kill()}
 },20000);
});
