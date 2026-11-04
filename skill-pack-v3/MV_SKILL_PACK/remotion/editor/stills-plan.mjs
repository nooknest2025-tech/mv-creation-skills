// Pure helpers for stills-check.mjs (kept separate so tests can import them without Remotion).
import fs from 'node:fs';import path from 'node:path';
/** QA rule (skills/mv-qa, mv-workflow): always look at 0, 1, 2 and 3 s before the real export. */
export const HOOK_SECONDS=[0,1,2,3];
/** "0,1,2.5" / ["0","1"] -> sorted unique seconds inside the song (a time at/after the end becomes the last frame). Throws in Japanese. */
export function parseSeconds(arg,duration){
 const raw=arg===undefined||arg===null||arg===''?HOOK_SECONDS:(Array.isArray(arg)?arg:String(arg).split(/[,\s]+/)).filter(x=>String(x).trim()!=='').map(Number);
 if(!raw.length||raw.some(v=>!Number.isFinite(v)||v<0))throw Error('秒数は 0 以上の数をカンマ区切りで指定してください（例: --at 0,1,2,3）');
 const end=Number.isFinite(duration)&&duration>0?duration:Infinity;
 return [...new Set(raw.map(v=>Math.min(v,end)))].sort((a,b)=>a-b);
}
/** seconds -> frame number, clamped to the composition. */
export const frameAt=(sec,fps,frames)=>Math.max(0,Math.min(Math.max(0,(frames??Infinity)-1),Math.round(sec*fps)));
export const stillName=sec=>`still-${sec.toFixed(2).replace('.','_')}s.jpg`;
/** ffmpeg xstack layout for n same-size pictures, as a grid with ceil(sqrt(n)) columns. */
export function sheetLayout(n){
 const cols=Math.ceil(Math.sqrt(n)),pos=[];
 for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);pos.push(`${c?Array(c).fill('w0').join('+'):'0'}_${r?Array(r).fill('h0').join('+'):'0'}`)}
 return {cols,rows:Math.ceil(n/cols),layout:pos.join('|')};
}
/** project name / runtime folder / editor-state.json -> the editor-state.json to check. */
export function resolveState(arg,packDir){
 const cands=[];if(arg){cands.push(path.resolve(arg),path.resolve(arg,'editor-state.json'),path.resolve(arg,'out/editor/editor-state.json'),path.join(packDir,'projects',arg,'out/editor/editor-state.json'))}
 const hit=cands.find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());if(hit)return hit;
 const projects=path.join(packDir,'projects'),have=fs.existsSync(projects)?fs.readdirSync(projects).filter(p=>fs.existsSync(path.join(projects,p,'out/editor/editor-state.json'))):[];
 if(!arg&&have.length===1)return path.join(projects,have[0],'out/editor/editor-state.json');
 throw Error((arg?`「${arg}」の編集データ（editor-state.json）が見つかりません。`:'どのプロジェクトを確認するか指定してください。')+(have.length?` 編集データがあるプロジェクト: ${have.join(', ')}`:' 先に npm run editor -- --project <名前> で編集画面を一度開いてください。'));
}
