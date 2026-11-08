// Shared setup for the editor's MP4 export (export.mjs) and the still-frame check (stills-check.mjs):
// finds Chrome/FFmpeg, copies the project media into .render-public, applies the LUT grade, bundles export-entry.tsx, selects the composition.
import {bundle} from '@remotion/bundler';
import {selectComposition,RenderInternals} from '@remotion/renderer';
import {gradeCube,gradeCopies} from './lut.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const editor=path.dirname(fileURLToPath(import.meta.url)),remotion=path.resolve(editor,'..'),pack=path.resolve(remotion,'..');
export async function prepareRender(snapshotPath,options={}){
const snapshotFile=path.resolve(snapshotPath),snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8')),runtime=path.dirname(snapshotFile);
// A still check may run while an MP4 job is using its binaries and public assets.
const work=options.isolate?fs.mkdtempSync(path.join(runtime,'.render-stills-')):runtime;
function browserPath(){if(process.env.MVPACK_BROWSER)return process.env.MVPACK_BROWSER;const candidates=process.platform==='win32'?[path.join(process.env.PROGRAMFILES??'C:/Program Files','Google/Chrome/Application/chrome.exe'),path.join(process.env['PROGRAMFILES(X86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')]:process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];return candidates.find(f=>fs.existsSync(f))??null}
const bundledFF=RenderInternals.getExecutablePath({type:'ffmpeg',binariesDirectory:null,indent:false,logLevel:'error'});
let ff=process.env.MVPACK_FFMPEG;
if(!ff){const probe=spawnSync('ffmpeg',['-version'],{encoding:'utf8',windowsHide:true});if(probe.status===0)ff='ffmpeg';}
if(!ff){const tools=path.join(pack,'tools/ffmpeg');if(fs.existsSync(tools)){const dirs=fs.readdirSync(tools);for(const d of dirs){const candidate=path.join(tools,d,'bin',process.platform==='win32'?'ffmpeg.exe':'ffmpeg');if(fs.existsSync(candidate)){ff=candidate;break}}}}
let binariesDirectory=null;
if(ff&&process.platform==='win32'){
 const local=path.join(work,'.render-binaries');if(!fs.existsSync(local))fs.cpSync(path.dirname(bundledFF),local,{recursive:true});
 let resolved=ff;if(ff==='ffmpeg'){const where=spawnSync('where.exe',['ffmpeg'],{encoding:'utf8',windowsHide:true});resolved=where.stdout.trim().split(/\r?\n/)[0]}
 fs.copyFileSync(resolved,path.join(local,'ffmpeg.exe'));binariesDirectory=local;
}
ff=ff??bundledFF;
const browserExecutable=browserPath();
/** v6.3: floating stickers (v5.8 floaters) and guests (v6.0) are bundled too, not only rig parts */
const stickerFiles=st=>[...(st.floaters?.items??[]).flatMap(it=>Object.values(it.frames??{}).map(f=>(st.floaters.base??'')+f)),...Object.values(st.guests?.items??{}).flatMap(it=>Object.values(it.frames??{}).map(f=>(st.guests.base??'')+f))];
const publicDir=path.join(work,'.render-public');fs.mkdirSync(publicDir,{recursive:true});
for(const item of [...snapshot.data.assets.flatMap(a=>typeof a==='string'?[a]:a.kind==='tachie'?[a.src,...a.stage.chars.flatMap(c=>c.rig.parts.flatMap(p=>[p.src,...Object.values(p.states??{})]).map(f=>c.base+f)),...stickerFiles(a.stage)]:[a.src]),snapshot.data.audioFile,'editor.css','font-options.css']){const src=path.resolve(runtime,item),dest=path.resolve(publicDir,item);if(!src.startsWith(runtime+path.sep)||!dest.startsWith(publicDir+path.sep))throw Error('Media path must stay inside project output');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest)}
/* data.comp.grade: exact LUT on the copied pictures/clips only (sources untouched); the preview uses an SVG approximation */
const cube=gradeCube(snapshot.data,runtime);if(cube)gradeCopies(ff??bundledFF,cube,[...new Set(snapshot.data.assets.filter(a=>typeof a==='string'||a.kind!=='tachie').map(a=>path.resolve(publicDir,typeof a==='string'?a:a.src)))]);
fs.cpSync(path.join(runtime,'editor-fonts'),path.join(publicDir,'editor-fonts'),{recursive:true});
// Windows app-container TEMP paths may contain "!", reserved by Webpack loaders.
// Keep bundle output beside the immutable export snapshot instead of OS TEMP.
const bundleDir=fs.mkdtempSync(path.join(work,'.render-bundle-'));
const serveUrl=await bundle({entryPoint:path.join(editor,'export-entry.tsx'),publicDir,outDir:bundleDir});
const gl=process.env.MVPACK_GL||(process.platform==='win32'?'angle':null);const chromiumOptions=gl?{gl}:{};
const inputProps={data:cube?{...snapshot.data,_gradeBaked:true}:snapshot.data};const composition=await selectComposition({serveUrl,id:'EditableMV',inputProps,browserExecutable,chromiumOptions});
const cleanup=()=>{if(!options.isolate||path.dirname(work)!==runtime||!path.basename(work).startsWith('.render-stills-'))return;try{fs.rmSync(work,{recursive:true,force:true,maxRetries:3,retryDelay:150})}catch(e){console.warn('静止画の一時ファイルを削除できませんでした: '+work)}};
return {snapshot,runtime,ff,binariesDirectory,browserExecutable,chromiumOptions,serveUrl,composition,inputProps,cleanup};
}
