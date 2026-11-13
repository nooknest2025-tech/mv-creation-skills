import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {prepareProject} from '../scripts/editor';
import {splitLyric,joinLyrics} from '../editor/lyric-grouping';
import {applyLyricSettings} from '../editor/lyric-look';
import {splitSceneAt,editSceneBoundary} from '../editor/timeline';
import {makeOverlay} from '../editor/overlay-track';
const py=['python3','python'].find(c=>spawnSync(c,['--version']).status===0);

it.skipIf(!py)('saves grouped manual lyrics, full look and standard motion through the actual API',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-lyric-save-')),p=prepareProject({demo:true,project:dir});
 const server=spawn(py!,[path.resolve(__dirname,'../editor/server.py'),'--root',p.runtime,'--port','0'],{stdio:['ignore','pipe','pipe']});
 const url:string=await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0])});setTimeout(()=>reject(Error('server timeout')),8000)});
 try{
  let state=await (await fetch(url+'/api/state')).json();const data=state.data;data.jizura={enabled:true,style:'mono'};
  const a=data.lyrics[0];a.jizura={layout:'center',parts:[{text:a.text,start:0,end:a.end-a.start,enter:'wipe'}]};
  const save=async()=>{const r=await fetch(url+'/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,data})});const result=await r.json();expect(r.status,JSON.stringify(result)).toBe(200);state=await (await fetch(url+'/api/state')).json();};
  const count=Array.from(a.text).length;data.lyrics.splice(0,1,...splitLyric(a,2,'SPLIT_TEST'));await save();
  expect(state.data.lyrics[0].jizura.parts[0].text).toBe(data.lyrics[0].text);
  data.lyrics.splice(0,2,...joinLyrics(data.lyrics[0],data.lyrics[1],count-2));await save();expect(state.data.lyrics[0].text).toBe(a.text);
  const b=data.lyrics[1];a.opacity=.35;data.lyrics[0].opacity=.35;data.lyrics[0].jizura.screenFx='shake';data.lyrics[0].jizura.screenFxTime=.1;
  applyLyricSettings(data,data.lyrics[0],[b],'look');await save();expect(state.data.lyrics[1].opacity).toBe(.35);expect(state.data.lyrics[1].jizura.screenFx).toBe('shake');
  applyLyricSettings(data,data.lyrics[0],[b],'motion','bounce');await save();expect(state.data.lyrics[1].jizura.engine).toBe('standard');
  data.scenes=[{...data.scenes[0],start:0,transition:0,cameraMove:'none',clipFrom:0,speed:1,tail:'hold',segments:[{at:0,speed:1},{at:data.duration*.5,speed:.5}],ease:1}];
  expect(splitSceneAt(data.scenes,0,data.duration*.5,data.duration,{video:true,clipDur:30})).toBeNull();
  const overlay=makeOverlay('OVER_TEST',0,0,data.duration)!;overlay.x=-.2;overlay.rate=2;overlay.w=1.2;data.overlays=[overlay];await save();
  expect(state.data.scenes[1].playback).toBeTruthy();expect(state.data.scenes[1].motionClock).toBeTruthy();expect(state.data.overlays[0].x).toBe(-.2);
  const sourcePath=path.join(p.runtime,'original-source.json'),emptySource=JSON.parse(fs.readFileSync(sourcePath,'utf8'));emptySource.lyrics=[];emptySource.sourceLyrics=[];fs.writeFileSync(sourcePath,JSON.stringify(emptySource));data.lyrics=[];await save();expect(state.data.lyrics).toEqual([]);
  const disk=JSON.parse(fs.readFileSync(path.join(p.runtime,'editor-state.json'),'utf8'));expect(disk.data.lyrics).toEqual(state.data.lyrics);
 }finally{server.kill()}
},20000);
