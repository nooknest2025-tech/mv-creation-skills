import {describe,it,expect} from 'vitest';
import {trackAudioBeats} from '../src/lib/beatTrack';
import {snapToBeat,cutTimes} from '../src/lib/cuts';
import {beatPulse} from '../src/lib/core';
import {applyTiming} from '../src/lib/pipeline';
import {snapTime} from '../editor/timeline';

describe('audio-onset beat tracking',()=>{
 it('tracks actual clicks as tempo changes instead of inventing a fixed grid',()=>{
  const sr=10000,duration=22,x=new Float32Array(sr*duration),truth:number[]=[];
  for(let t=.2;t<duration-.3;){truth.push(t);let at=Math.round(t*sr);for(let i=0;i<150;i++)x[at+i]=.8;t+=t<10?.5:2/3;}
  const r=trackAudioBeats(x,sr,120);expect(r.status).toBe('estimated');
  const near=(t:number)=>Math.min(...r.beats.map(b=>Math.abs(b-t)));
  expect(truth.filter(t=>near(t)<.04).length/truth.length).toBeGreaterThan(.8);
  const early=r.beats.filter(t=>t>2&&t<8),late=r.beats.filter(t=>t>14&&t<20);
  expect(early[1]-early[0]).toBeCloseTo(.5,1);expect(late[1]-late[0]).toBeCloseTo(2/3,1);
 });
 it('does not invent beats for silence',()=>{expect(trackAudioBeats(new Float32Array(100000),10000).status).toBe('insufficient')});
 it('uses editable nonuniform beats for cuts, pulses and editor snapping',()=>{
  const song:any={bpm:120,phase:0,beatsPerBar:4,beats:[0,.5,1.1,1.8,2.6,3.5],duration:4,lines:[],sections:[]};
  expect(snapToBeat(song,1.75,1)).toBeCloseTo(1.8);expect(cutTimes(song,0,3.5,1)).toEqual([0,.5,1.1,1.8,2.6]);
  expect(beatPulse(song,1.8)).toBeCloseTo(1);expect(snapTime(1.76,120,0,.1,false,song.beats)).toBeCloseTo(1.8);
  expect(applyTiming(song,{timing:{bpm:100}}).beats).toBeUndefined();
  expect(applyTiming(song,{timing:{beats:[0,.6,1.25]}}).beats).toEqual([0,.6,1.25]);
 });
});
