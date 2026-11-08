import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareProject} from '../../scripts/editor';

// Synthetic test data: no personal projects or copyrighted lyrics are required.
export const lyrics = Array.from({length:12},(_,i)=>({id:`L${String(i+1).padStart(3,'0')}`,text:`言葉 ${i+1}`,start:i<8?1+i*3:35+(i-8)*4,end:i<8?3+i*3:38+(i-8)*4,motion:'simple',scale:.72,y:.8,motionDuration:.8}));
export const rig = {name:'test',size:[640,640],parts:[{id:'body',src:'body.png',kind:'body',pivot:[320,600],z:1},{id:'mouth',src:'mouth.png',kind:'mouth',parent:'body',pivot:[320,250],z:2,states:{a:'mouth-a.png'}}]};
export const chars=['black','gothic','cafe'].map((id,i)=>({id,rig,base:'',x:.25+i*.25,h:.65,motion:i===0?'guitar':'dance'}));
export const stage:any={kind:'tachie',bg:'grid',palette:['#ffffff','#ffcc00','#00bbcc','#111111'],chars,singerIdx:['black','gothic','cafe','black','gothic','cafe','all'],guests:{items:{seal:{name:'Seal',frames:{open:'seal.png'}},puppy:{name:'Puppy',frames:{open:'puppy.png'}}},group:[{id:'seal',x:.2,h:.3}],tag:'GUEST'}};
export function tachieFixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mv-tachie-fixture-'));
 const runtime=prepareProject({demo:true,project:root}).runtime;
 const file=path.join(runtime,'editor-state.json'), orig=path.join(runtime,'original-source.json');
 const state=JSON.parse(fs.readFileSync(file,'utf8')), d=state.data;
 d.duration=55; d.lyrics=structuredClone(lyrics); d.assets=[{kind:'tachie',src:'test.json',label:'synthetic stage',stage:structuredClone(stage)},{kind:'tachie',src:'pause.json',label:'synthetic pause',stage:{...structuredClone(stage),pause:{start:30,telop:'Welcome',intro:[{id:'seal',x:.5,t:30}]}}}];
 d.scenes=[0,6,12,18,24,30,34].map((start,i,all)=>({id:`S${i+1}`,start,end:all[i+1]??55,asset:i===5?1:0,transition:0}));
 fs.writeFileSync(file,JSON.stringify(state));fs.writeFileSync(orig,JSON.stringify({...structuredClone(d),sourceLyrics:d.lyrics.map((l:any)=>({text:l.text}))}));
 return runtime;
}
