import {describe,it,expect} from 'vitest';
import {lyricTimeline} from './lyricTimeline';

const lines=[{text:'ひかり',start:2,end:4,tOn:1.5,tEnd:4.5},{text:'ひかり',start:5,end:7}];
const mix={status:'estimated' as const,lyrics:[{text:'ひかり',start:2.1,end:3.8,matchedChars:3,totalChars:3},{text:'ひかり',start:5.1,end:6.8,matchedChars:1,totalChars:3}]};
describe('internal lyric timeline',()=>{
 it('keeps display edits separate from each repeated sung line',()=>{
  const t=lyricTimeline(lines,10,mix);
  expect(t.lines[0].display).toEqual({start:1.5,end:4.5});
  expect(t.lines.map(l=>l.vocal.start)).toEqual([2.1,5.1]);
  expect(t.lines[1].vocal.reasons.join()).toContain('補間');
  expect(t.sources.vocals.status).toBe('unavailable');
 });
 it('retains differing stem evidence without adopting unverified offset',()=>{
  const stem={status:'estimated' as const,lyrics:mix.lyrics.map(c=>({...c,start:c.start+1,end:c.end+1}))};
  const t=lyricTimeline(lines,10,mix,stem,10);
  expect(t.lines[0].vocal.start).toBe(2.1);
  expect(t.lines[0].vocal.vocals?.start).toBe(3.1);
  expect(t.lines[0].vocal.reasons.join()).toContain('食い違う');
  expect(t.sources.vocals).toMatchObject({alignment:'unverified'});
 });
 it('flags incompatible duration and malformed or missing analysis',()=>{
  const bad={status:'estimated' as const,lyrics:[{text:'異なる',start:0,end:1},{text:'ひかり',start:NaN,end:7}]};
  const t=lyricTimeline(lines,10,bad,mix,8);
  expect(t.lines[0].vocal.source).toBeNull();
  expect(t.lines[1].vocal.source).toBeNull();
  expect(t.lines[0].vocal.reasons.join()).toContain('長さ');
 });
});
