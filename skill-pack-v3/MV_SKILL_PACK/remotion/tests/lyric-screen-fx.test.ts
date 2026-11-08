import {describe,it,expect} from 'vitest';
import {lyricScreenFx} from '../editor/lyric-screen-fx';

describe('lyric screen effects',()=>{
 const data={lyrics:[{start:1,end:4,jizura:{screenFx:'flash',screenFxTime:.5,screenFxDuration:1,screenFxStrength:1}}]};
 it('affects the whole screen only inside the chosen time range',()=>{
  expect(lyricScreenFx(data,1.49).flash).toBe(0);
  expect(lyricScreenFx(data,2).flash).toBeCloseTo(.8);
  expect(lyricScreenFx(data,2.5).flash).toBe(0);
 });
 it('combines effects from overlapping lyrics without discarding either',()=>{
  const result=lyricScreenFx({lyrics:[...data.lyrics,{start:1,end:4,jizura:{screenFx:'invert',screenFxTime:.5,screenFxDuration:1}}]},2);
  expect(result.flash).toBeCloseTo(.8);expect(result.filter).toContain('invert(');
 });
 it('bridges supported JIZURA effects to the entire frame only when requested',()=>{
  const line=(fx:string,fxScope?:string)=>({start:1,end:4,jizura:{fx,fxScope,fxTime:.5,fxStrength:1}});
  expect(lyricScreenFx({lyrics:[line('flash')]},1.5+2/24).flash).toBe(0);
  expect(lyricScreenFx({lyrics:[line('flash','screen')]},1.5+2/24).flash).toBeCloseTo(.8);
  expect(lyricScreenFx({lyrics:[line('invert','screen')]},1.5+2/24).filter).toContain('invert(');
  expect(lyricScreenFx({lyrics:[line('defocus','screen')]},1.5+4/24).filter).toContain('blur(');
  expect(lyricScreenFx({lyrics:[line('shake','screen')]},1.5+2/24).transform).toContain('translate(');
  expect(lyricScreenFx({lyrics:[line('mosaic','screen')]},1.5+2/24).filter).toBe('');
 });
});
