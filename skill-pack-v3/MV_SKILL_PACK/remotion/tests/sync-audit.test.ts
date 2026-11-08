import {describe,it,expect} from 'vitest';
import {syncAudit} from '../src/lib/syncAudit';
import {beatEvidence} from '../src/lib/beatEvidence';

describe('vocal and beat review',()=>{
 it('reports short and overlapping lines without modifying timing',()=>{
  const lines=[{text:'あいうえお',start:1,end:1.2},{text:'次',start:1.1,end:2}];
  const result=syncAudit(lines,30,{bpm:120,phase:.1});
  expect(result.lyric.status).toBe('not-listened');expect(result.lyric.issues).toHaveLength(2);
  expect(result.beat.alternatives).toEqual([60,240]);expect(lines[1].start).toBe(1.1);
 });
 it('reports a late onset grid in the last section of a synthetic click track',()=>{
  const sr=10000,samples=new Float32Array(sr*18);
  for(let t=.25;t<18;t+=.5){const shifted=t>=12?t+.16:t;const i=Math.round(shifted*sr);for(let j=0;j<100&&i+j<samples.length;j++)samples[i+j]=.8;}
  const w=beatEvidence(samples,sr,120,.25);expect(w).toHaveLength(3);
  expect(Math.abs(w[0].offset!)).toBeLessThan(.06);expect(w[2].needsReview).toBe(true);expect(w[2].offset!).toBeGreaterThan(.1);
 });
 it('flags audio estimates that differ and low text matches without treating them as truth',()=>{
  const lines=[{text:'歌詞',start:1,end:2},{text:'次',start:3,end:4}];
  const result=syncAudit(lines,10,{bpm:100,phase:0},[{text:'歌詞',start:2,end:3,matchedChars:2,totalChars:2},{text:'次',start:3,end:4,matchedChars:0,totalChars:1}]);
  expect(result.lyric.audioComparison).toBe('automatic-estimate');expect(result.lyric.issues).toHaveLength(2);
  expect(syncAudit(lines,10,{bpm:100,phase:0},[{text:'別',start:0,end:1}]).lyric.audioComparison).toBe('unavailable');
 });
});
