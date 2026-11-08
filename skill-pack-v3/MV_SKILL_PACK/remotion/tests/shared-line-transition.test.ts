import {describe,it,expect} from 'vitest';
import {sharedLineTransition,sharedLineStyle,lineTransitionStatus} from '../editor/shared-line-transition';

describe('shared line transition',()=>{
 const data={lyrics:[{id:'A',start:0,end:2,jizura:{engine:'standard'}},{id:'B',start:2,end:4,jizura:{lineTrans:'shared_fade'}}]};
 it('transitions between standard and JIZURA while keeping the preceding line visible',()=>{
  const f=sharedLineTransition(data,2.175)!;expect(f.from.id).toBe('A');expect(f.to.id).toBe('B');
  expect(f.fromOpacity).toBeCloseTo(.5);expect(f.toOpacity).toBeCloseTo(.5);expect(f.previousTime).toBeLessThan(1.8);
  const hold=sharedLineTransition(data,1.9)!;expect(hold.fromOpacity).toBe(1);expect(hold.toOpacity).toBe(0);
 });
 it('does not transition across a gap or overlapping lines',()=>{
  expect(sharedLineTransition({lyrics:[data.lyrics[0],{...data.lyrics[1],start:2.2}]},2.25)).toBeNull();
  expect(sharedLineTransition({lyrics:[data.lyrics[0],{...data.lyrics[1],start:1.9}]},1.95)).toBeNull();
 });
 it('uses the requested duration and limits it to the next line',()=>{
  const custom={lyrics:[data.lyrics[0],{...data.lyrics[1],jizura:{lineTrans:'shared_fade',lineTransDuration:.8}}]};
  expect(sharedLineTransition(custom,2.4)?.p).toBeCloseTo(.5);
  const short={lyrics:[data.lyrics[0],{...data.lyrics[1],end:2.5,jizura:{lineTrans:'shared_fade',lineTransDuration:2}}]};
  expect(sharedLineTransition(short,2.1125)?.p).toBeCloseTo(.5);
  expect(sharedLineTransition(short,2.23)).toBeNull();
 });
 it('uses matching wipe, slide and zoom geometry across both renderers',()=>{
  for(const kind of ['shared_wipe','shared_slide','shared_zoom']){
   const transition=sharedLineTransition({lyrics:[data.lyrics[0],{...data.lyrics[1],jizura:{lineTrans:kind}}]},2.175)!;
   const from=sharedLineStyle(transition,true,1000,500),to=sharedLineStyle(transition,false,1000,500);
   if(kind==='shared_wipe'){expect(from.clipPath).toContain('inset(');expect(to.clipPath).toContain('inset(');expect(transition.p).toBeCloseTo(.5)}
   if(kind==='shared_slide'){expect(from.translateX).toBeCloseTo(-500);expect(to.translateX).toBeCloseTo(500)}
   if(kind==='shared_zoom'){expect(from.scale).toBeCloseTo(1.06);expect(to.scale).toBeCloseTo(.94)}
  }
 });
 it('explains why a selected transition cannot be shown',()=>{
  const line=(id:string,start:number,end:number,jizura:any={})=>({id,text:id,start,end,jizura});
  const next=(start:number,jizura:any)=>line('B',start,4,jizura);
  const a=line('A',0,2),common={lineTrans:'shared_fade'};
  expect(lineTransitionStatus({lyrics:[next(2,common)]},'B')).toContain('前に');
  expect(lineTransitionStatus({lyrics:[a,next(2.2,common)]},'B')).toContain('空いて');
  expect(lineTransitionStatus({lyrics:[a,next(1.8,common)]},'B')).toContain('重なって');
  expect(lineTransitionStatus({lyrics:[a,next(2,{lineTrans:'wipe'})]},'B')).toContain('JIZURA同士');
  expect(lineTransitionStatus({lyrics:[a,next(2,{...common,lineTransDuration:2})]},'B')).toContain('短い');
  expect(lineTransitionStatus({lyrics:[a,next(2,common)]},'B')).toContain('開始時');
  expect(lineTransitionStatus({jizura:{enabled:true},lyrics:[a,next(2,{lineTrans:'wipe'})]},'B')).toContain('開始時');
 });
});
