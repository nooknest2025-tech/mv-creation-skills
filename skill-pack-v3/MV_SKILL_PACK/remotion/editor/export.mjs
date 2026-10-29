import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition,RenderInternals} from '@remotion/renderer';
import {gradeCube,gradeCopies} from './lut.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const editor=path.dirname(fileURLToPath(import.meta.url)),remotion=path.resolve(editor,'..'),pack=path.resolve(remotion,'..');
const snapshotFile=path.resolve(process.argv[2]),snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8')),runtime=path.dirname(snapshotFile),output=path.resolve(process.argv[3]);
function browserPath(){if(process.env.MVPACK_BROWSER)return process.env.MVPACK_BROWSER;const candidates=process.platform==='win32'?[path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')]:process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];return candidates.find(f=>fs.existsSync(f))??null}
const bundledFF=RenderInternals.getExecutablePath({type:'ffmpeg',binariesDirectory:null,indent:false,logLevel:'error'});
let ff=process.env.MVPACK_FFMPEG;
if(!ff){const probe=spawnSync('ffmpeg',['-version'],{encoding:'utf8',windowsHide:true});if(probe.status===0)ff='ffmpeg';}
if(!ff){const tools=path.join(pack,'tools/ffmpeg');if(fs.existsSync(tools)){const dirs=fs.readdirSync(tools);for(const d of dirs){const candidate=path.join(tools,d,'bin',process.platform==='win32'?'ffmpeg.exe':'ffmpeg');if(fs.existsSync(candidate)){ff=candidate;break}}}}
let binariesDirectory=null;
if(ff&&process.platform==='win32'){
 const local=path.join(runtime,'.render-binaries');if(!fs.existsSync(local))fs.cpSync(path.dirname(bundledFF),local,{recursive:true});
 let resolved=ff;if(ff==='ffmpeg'){const where=spawnSync('where.exe',['ffmpeg'],{encoding:'utf8',windowsHide:true});resolved=where.stdout.trim().split(/\r?\n/)[0]}
 fs.copyFileSync(resolved,path.join(local,'ffmpeg.exe'));binariesDirectory=local;
}
ff=ff??bundledFF;
const browserExecutable=browserPath();
/** v6.3: floating stickers (v5.8 floaters) and guests (v6.0) are bundled too, not only rig parts */
const stickerFiles=st=>[...(st.floaters?.items??[]).flatMap(it=>Object.values(it.frames??{}).map(f=>(st.floaters.base??'')+f)),...Object.values(st.guests?.items??{}).flatMap(it=>Object.values(it.frames??{}).map(f=>(st.guests.base??'')+f))];
const publicDir=path.join(runtime,'.render-public');fs.mkdirSync(publicDir,{recursive:true});
for(const item of [...snapshot.data.assets.flatMap(a=>typeof a==='string'?[a]:a.kind==='tachie'?[a.src,...a.stage.chars.flatMap(c=>c.rig.parts.flatMap(p=>[p.src,...Object.values(p.states??{})]).map(f=>c.base+f)),...stickerFiles(a.stage)]:[a.src]),snapshot.data.audioFile,'editor.css','font-options.css']){const src=path.resolve(runtime,item),dest=path.resolve(publicDir,item);if(!src.startsWith(runtime+path.sep)||!dest.startsWith(publicDir+path.sep))throw Error('Media path must stay inside project output');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest)}
/* data.comp.grade: exact LUT on the copied pictures/clips only (sources untouched); the preview uses an SVG approximation */
const cube=gradeCube(snapshot.data,runtime);if(cube)gradeCopies(ff??bundledFF,cube,[...new Set(snapshot.data.assets.filter(a=>typeof a==='string'||a.kind!=='tachie').map(a=>path.resolve(publicDir,typeof a==='string'?a:a.src)))]);
fs.cpSync(path.join(runtime,'editor-fonts'),path.join(publicDir,'editor-fonts'),{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(editor,'export-entry.tsx'),publicDir});
const gl=process.env.MVPACK_GL||(process.platform==='win32'?'angle':null);const chromiumOptions=gl?{gl}:{};
const inputProps={data:cube?{...snapshot.data,_gradeBaked:true}:snapshot.data};const composition=await selectComposition({serveUrl,id:'EditableMV',inputProps,browserExecutable,chromiumOptions});
const silent=output.replace(/\.mp4$/,'.silent.mp4'),qa=snapshot.qaFrames;
await renderMedia({serveUrl,composition,inputProps,browserExecutable,chromiumOptions,binariesDirectory,outputLocation:silent,muted:true,codec:'h264',pixelFormat:'yuv420p',crf:20,concurrency:Number(process.env.MVPACK_CONCURRENCY||2),frameRange:qa?[0,qa-1]:undefined,scale:Number(process.env.MVPACK_SCALE||1),onProgress:p=>console.log(Math.min(98,Math.round(p.progress*98))),logLevel:'error'});
const audio=path.resolve(runtime,snapshot.data.audioFile);
if(!audio.startsWith(runtime+path.sep))throw Error('Audio must be inside project editor output');
const args=['-y','-v','error','-i',silent,'-i',audio,'-map','0:v','-map','1:a','-vf','scale=out_range=tv,format=yuv420p','-c:v','libx264','-preset','fast','-crf','20','-color_range','tv','-c:a','aac','-b:a','256k','-t',String(qa?Math.min(snapshot.data.duration,qa/snapshot.data.fps):snapshot.data.duration),'-movflags','+faststart',output];
const result=spawnSync(ff,args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error(result.stderr||'FFmpeg failed. Install FFmpeg or set MVPACK_FFMPEG.');
fs.rmSync(silent,{force:true});console.log('DONE');
