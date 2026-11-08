import {describe,it,expect} from 'vitest';
import {placeJizura} from '../editor/jizura-placement';

describe('JIZURA measured placement',()=>{
 it('fits rotated artwork around the chosen position',()=>{
  const p=placeJizura({x:.5,y:.5,scale:3,angle:90},{x:100,y:100,w:600,h:200},1000,500);
  expect(p.bounds.w).toBeCloseTo(146.6666667);expect(p.bounds.h).toBeCloseTo(440);
  expect(p.pivotX).toBeCloseTo(500);expect(p.pivotY).toBeCloseTo(250);expect(p.angle).toBe(90);
 });
 const W=1280,H=720,b={x:220,y:160,w:420,h:170};
 it('centres the measured artwork on an explicit position',()=>{
  const p=placeJizura({x:.5,y:.5,scale:.5},b,W,H);
  expect(p.bounds.x+p.bounds.w/2).toBeCloseTo(W/2);
  expect(p.bounds.y+p.bounds.h/2).toBeCloseTo(H/2);
 });
 it('fits a large moved layout within margins without stretching it',()=>{
  const p=placeJizura({x:.03,y:.97,scale:3},b,W,H);
  expect(p.bounds.x).toBeGreaterThanOrEqual(W*.05-1e-6);
  expect(p.bounds.y+p.bounds.h).toBeLessThanOrEqual(H*.94+1e-6);
  expect(p.bounds.w/p.bounds.h).toBeCloseTo(b.w/b.h);
 });
 it('anchors an explicit box corner and supports intentional cropping',()=>{
  const p=placeJizura({boxX:.2,boxY:.3,scale:.5},b,W,H);
  expect(p.bounds.x).toBeCloseTo(W*.2);expect(p.bounds.y).toBeCloseTo(H*.3);
  const cropped=placeJizura({x:0,y:0,scale:2},b,W,H,false);
  expect(cropped.bounds.x).toBeLessThan(0);
 });
});
