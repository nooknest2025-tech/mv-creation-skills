import {describe,it,expect} from 'vitest';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {splitSceneAt,resolveClipChains,mergeSceneWithNext,prepareTrim,trimBoundary,editSceneBoundary} from '../editor/timeline';
import {clipPlan,clipSourceTime,setClipSpeed} from '../src/lib/clipspeed';
import {Scene} from '../editor/editor-scene';
import {makeOverlay,resizeOverlay,moveOverlayPicture,resizeOverlayPicture} from '../editor/overlay-track';
const D=10,L=30,info=(s:any)=>({video:s.asset===0,clipDur:s.asset===0?L:undefined});
function at(sc:any[],t:number,L1=L){const i=sc.findIndex((s,k)=>t>=s.start&&t<(sc[k+1]?.start??D));return clipSourceTime(clipPlan(sc[i],(sc[i+1]?.start??D)-sc[i].start,L1),t-sc[i].start)}
function styles(sc:any[],t:number){const d={duration:D,width:1280,height:720,fps:30,assets:['a.png','b.png'],scenes:sc,lyrics:[]};const html=renderToStaticMarkup(<Scene data={d} t={t}/>);return [...html.matchAll(/<img[^>]+style="([^"]*)"/g)].map(x=>x[1])}
describe('media edit continuity',()=>{
 it.each([1,4,4.5,6])('keeps every source frame when splitting an eased ramp at %s (where valid)',cut=>{
  const original=[{id:'A',asset:0,start:0,clipFrom:2,segments:[{at:0,speed:1},{at:4,speed:.25},{at:7,speed:.75}],ease:2,tail:'hold'}],sc=structuredClone(original);
  expect(splitSceneAt(sc,0,cut,D,{video:true,clipDur:L})).toBeNull();resolveClipChains(sc,D,()=>true,()=>L);
  const reloaded=JSON.parse(JSON.stringify(sc));for(let t=0;t<D;t+=1/30)expect(at(reloaded,t)).toBeCloseTo(at(original,t),7);
 });
 it.each(['hold','loop'] as const)('preserves a %s tail when cut after the source runs out',tail=>{
  const original=[{id:'A',asset:0,start:0,clipFrom:0,speed:1,tail}],sc=structuredClone(original);
  expect(splitSceneAt(sc,0,4,D,{video:true,clipDur:2})).toBeNull();for(let t=0;t<D;t+=1/30)expect(at(sc,t,2)).toBeCloseTo(at(original,t,2),7);
 });
 it('keeps camera poses in both halves and unrelated later scenes, including repeated splits',()=>{
  const original=[{id:'A',asset:0,start:0,transition:0,cameraMove:'kb_in',cameraStrength:'strong'},{id:'B',asset:1,start:8,transition:0,cameraMove:'sway'}],sc=structuredClone(original);
  splitSceneAt(sc,0,4,D);splitSceneAt(sc,1,6,D);
  for(const t of [0,1,3.99,4,4.01,5.99,6,7.9,8,8.2,9.9])expect(styles(sc,t)).toEqual(styles(original,t));
 });
 it('trims through a smooth speed change while keeping later footage and camera progress',()=>{
  const original=[{id:'A',asset:1,start:0,transition:0,cameraMove:'none'},{id:'B',asset:0,start:2,clipFrom:10,transition:0,cameraMove:'kb_in',segments:[{at:0,speed:1},{at:3,speed:.25}],ease:2,tail:'hold'}],sc=structuredClone(original);
  prepareTrim(sc,1,D,info);trimBoundary(sc,1,4.5,D,info);
  for(let t=4.5;t<D;t+=1/30){expect(at(sc,t)).toBeCloseTo(at(original,t),7);expect(styles(sc,t)).toEqual(styles(original,t))}
 });
 it('numeric trim and pointer trim have the same source mapping; cut-only remains explicit',()=>{
  const original=[{id:'A',asset:1,start:0},{id:'B',asset:0,start:4,clipFrom:10,speed:1,tail:'hold'}],numeric=structuredClone(original),pointer=structuredClone(original),cut=structuredClone(original);
  editSceneBoundary(numeric,1,5,D,info,'trim');prepareTrim(pointer,1,D,info);trimBoundary(pointer,1,5,D,info);
  expect(numeric).toEqual(pointer);expect(at(numeric,6)).toBe(12);editSceneBoundary(cut,1,5,D,info,'cut');expect(at(cut,6)).toBe(11);
 });
 it('refuses a destructive merge before any mutation and can rejoin an eased split',()=>{
  const bad=[{id:'A',asset:0,start:0,clipFrom:0,speed:1,cameraMove:'none'},{id:'B',asset:0,start:4,clipFrom:15,speed:1,cameraMove:'none'}],before=structuredClone(bad);
  expect(mergeSceneWithNext(bad,0,D,{video:true,clipDur:L})).toMatch(/連続/);expect(bad).toEqual(before);
  const original=[{id:'A',asset:0,start:0,clipFrom:0,segments:[{at:0,speed:1},{at:4,speed:.25}],ease:2}],sc=structuredClone(original);
  splitSceneAt(sc,0,4.5,D,{video:true,clipDur:L});expect(mergeSceneWithNext(sc,0,D,{video:true,clipDur:L})).toBeNull();
  for(let t=0;t<D;t+=1/30)expect(at(sc,t)).toBeCloseTo(at(original,t),7);
 });
 it('direct speed or IN edits replace the retained curve instead of silently overriding user input',()=>{
  const sc:any[]=[{id:'A',asset:0,start:0,speed:1}];splitSceneAt(sc,0,4,D,{video:true,clipDur:L});
  sc[1].clipChain=false;sc[1].clipFrom=12;sc[1].speed=.5;expect(at(sc,6)).toBe(13);
 });
 it('changes only the chosen middle cut; following the source IN of the next cut is optional',()=>{
  const sc:any[]=[{id:'A',asset:0,start:0,speed:1}];splitSceneAt(sc,0,3,D,{video:true,clipDur:L});splitSceneAt(sc,1,6,D,{video:true,clipDur:L});
  const first=structuredClone(sc[0]),next=structuredClone(sc[2]);setClipSpeed(sc[1],.5);delete sc[2].clipChain;resolveClipChains(sc,D,()=>true,()=>L);
  expect(sc[0]).toEqual(first);expect(sc[2].clipFrom).toBe(next.clipFrom);expect(clipPlan(sc[1],3,L).rate).toBe(.5);expect(at(sc,5)).toBeCloseTo(4);
  sc[2].clipChain=true;resolveClipChains(sc,D,()=>true,()=>L);expect(sc[2].clipFrom).toBe(4.5);expect(clipPlan(sc[2],4,L).rate).toBe(1);
  setClipSpeed(sc[1],4);expect(clipPlan(sc[1],3,4).mode).toBe('hold');expect(clipPlan(sc[1],3,4).rate).toBe(4);
 });
 it('retains animation and panel footage in a composited scene after splitting',()=>{
  const sc:any[]=[{id:'A',asset:0,start:0,transition:0,comp:{panels:[{asset:0,box:[0,0,100,100],from:2,z:1,z1:1.4}],shake:4,punch:.1}}];
  const data=(scenes:any[])=>({duration:D,width:1280,height:720,fps:30,assets:['a.png'],scenes,lyrics:[]});
  const before=renderToStaticMarkup(<Scene data={data(sc)} t={5}/>),after=structuredClone(sc);splitSceneAt(after,0,4,D);
  const html=renderToStaticMarkup(<Scene data={data(after)} t={5}/>);
  // React keys do not appear in markup; all visual styles must remain identical.
  expect(html).toBe(before);
 });
 it('upper visuals can move outside the frame, keep aspect ratio and trim at their selected speed',()=>{
  const c=makeOverlay('O',0,2,20,8)!;moveOverlayPicture(c,.2,-.1);expect([c.x,c.y]).toEqual([.2,-.1]);
  c.w=.8;c.h=.4;resizeOverlayPicture(c,'w',.4);expect([c.w,c.h]).toEqual([.4,.2]);
  c.rate=2;resizeOverlay(c,{...c},'start',3,20,true,8);expect(c.from).toBe(2);
 });
});
