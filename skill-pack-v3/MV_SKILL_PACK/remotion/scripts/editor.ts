/** Portable visual-editor entrypoint. Project data is kept under projects/<name>/out/editor. */
import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import crypto from 'node:crypto';
import {PACK_DIR,REMOTION_DIR,PROJECTS_DIR,parseArgs,UserError,fail} from './common';
import {buildEditor} from '../editor/build.mjs';
import {ensureEditorFonts} from './editor_fonts';
import {mergeSceneSlivers} from '../src/lib/sceneSlivers';

const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
export function normalizeLyrics(raw:any,duration:number){const lines=raw.lines??raw.lyrics??raw;return lines.map((l:any,i:number)=>({...l,id:l.id??`L${String(i+1).padStart(3,'0')}`,start:Number(l.start??l.startSeconds),end:Math.min(duration-1,Number(l.end??l.endSeconds)),motion:l.motion??'simple',scale:l.scale??.72,y:l.y??.8,motionDuration:l.motionDuration??.8}));}
function tone(file:string){const rate=48000,duration=8,n=rate*duration,data=Buffer.alloc(n*2);const notes=[261.63,329.63,392,523.25,440,392,329.63,261.63];for(let i=0;i<n;i++){const t=i/rate,local=t%1,env=Math.min(1,local/.025)*Math.exp(-local*2.5);data.writeInt16LE(Math.round(Math.sin(2*Math.PI*notes[Math.floor(t)]*t)*env*4500),i*2)}const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);fs.writeFileSync(file,Buffer.concat([h,data]));}
function writeDemo(runtime:string){const assets=path.join(runtime,'assets');fs.mkdirSync(assets,{recursive:true});tone(path.join(assets,'demo.wav'));for(let i=0;i<2;i++)fs.writeFileSync(path.join(assets,`demo-${i}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g"><stop stop-color="${i?'#533959':'#153d46'}"/><stop offset="1" stop-color="${i?'#b98562':'#376853'}"/></linearGradient></defs><path fill="url(#g)" d="M0 0H1280V720H0z"/><circle cx="${i?920:330}" cy="280" r="170" fill="#ebd7b2" opacity=".15"/><path d="M-100 580Q350 320 750 600T1400 540" fill="none" stroke="#e2d9ad" opacity=".35" stroke-width="3"/></svg>`);
 const data:any={title:'共通エディター・サンプル',duration:8,width:1280,height:720,fps:24,bpm:120,particleStart:3,audioFile:'assets/demo.wav',assets:[{src:'assets/demo-0.svg',label:'青緑の背景'},{src:'assets/demo-1.svg',label:'夕色の背景'}],scenes:[{id:'S001',start:0,end:4,asset:0,transition:0,label:'はじめの景色'},{id:'S002',start:4,end:8,asset:1,transition:.7,label:'次の景色'}],sections:[{type:'verse',label:'Aメロ',start:0,end:4},{type:'chorus',label:'サビ',start:4,end:8}],lyrics:normalizeLyrics([{text:'はじめの音を',start:.4,end:2.5},{text:'重ねてみよう',start:2.6,end:4.8},{text:'ここから新しい景色へ',start:4.9,end:6.8}],8)};return data;
}
const IMG=/\.(png|jpe?g|webp|svg)$/i,VID=/\.(mp4|mov|m4v|webm)$/i;
/** copy one image or video clip into the editor folder (videos keep their length for looping). */
export function assetFor(file:string,i:number,runtime:string){
 if(!fs.existsSync(file))throw new UserError('素材ファイルが見つかりません: '+file,'ファイルの場所を確認してください。');
 const ext=path.extname(file).toLowerCase();
 if(IMG.test(file)){const dest=`assets/image-${i}${ext}`;fs.copyFileSync(file,path.join(runtime,dest));return {src:dest,label:path.basename(file)}}
 if(VID.test(file)){const dest=`assets/video-${i}${ext}`;fs.copyFileSync(file,path.join(runtime,dest));const r=spawnSync(process.env.MVPACK_FFPROBE??'ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8',windowsHide:true});const d=Number(r.stdout?.trim());return {src:dest,label:path.basename(file)+'（動画）',kind:'video',...(Number.isFinite(d)&&d>0?{duration:+d.toFixed(3)}:{})}}
 throw new UserError('この形式の素材は使えません: '+path.basename(file),'画像は png/jpg/webp/svg、動画は mp4/mov/m4v/webm に対応しています。');
}
export function prepareProject(o:Record<string,any>){
 const project=o.project?path.resolve(PROJECTS_DIR,String(o.project)):path.join(PROJECTS_DIR,'editor-demo');
 const runtime=path.join(project,'out','editor');fs.mkdirSync(runtime,{recursive:true});
 const manifestFile=o.manifest?path.resolve(String(o.manifest)):path.join(project,'out','editor-input.json');
 const manifest=fs.existsSync(manifestFile)?read(manifestFile):{};
 const stateFile0=path.join(runtime,'editor-state.json');
 if(fs.existsSync(stateFile0)){const st=read(stateFile0);const merged=Array.isArray(st.data.scenes)?mergeSceneSlivers(st.data.scenes,st.data.duration):st.data.scenes;const fix=merged?.length!==st.data.scenes?.length;if(fix)st.data.scenes=merged;if(fix||(!st.data.sections&&manifest.sections)){if(!st.data.sections&&manifest.sections)st.data.sections=manifest.sections;fs.writeFileSync(stateFile0,JSON.stringify(st,null,2))}return {project,runtime,reused:true};}
 let data:any,sourceLyrics:any[];
 if(o.demo){data=writeDemo(runtime);sourceLyrics=data.lyrics.map((l:any)=>({text:l.text}));}
 else{
  const stateFile=o['from-state']?path.resolve(String(o['from-state'])):manifest.stateFile;
  const imported=stateFile?read(stateFile):null;
  const audio=String(o.audio??manifest.audio??'');
  const images=o.images?String(o.images).split(',').map(p=>path.resolve(p)):manifest.images??[];
  const lyricsFile=String(o.lyrics??manifest.lyrics??'');
  if(!audio||!fs.existsSync(audio)||!(images.length||(o.videos||manifest.videos?.length))||!lyricsFile||!fs.existsSync(lyricsFile))throw new UserError('編集用の音源・画像・歌詞が見つかりません','npm run editor -- --demo、または --project <名前> --audio <音源> --lyrics <同期JSON> --images <画像1,画像2>（動画は --videos <動画1.mp4,動画2.mov>）。npm run mv後は --project <名前> で再開できます。');
  const raw=read(lyricsFile),duration=Number(imported?.data?.duration??raw.duration??raw.audio?.duration);
  if(!Number.isFinite(duration)||duration<=1)throw new UserError('歌詞JSONに曲尺が必要です','song.jsonのduration、またはlyrics JSONのaudio.durationを指定してください。');
  const assetsDir=path.join(runtime,'assets');fs.mkdirSync(assetsDir,{recursive:true});
  const audioFile='assets/original'+path.extname(audio).toLowerCase();fs.copyFileSync(audio,path.join(runtime,audioFile));
  const videos=o.videos?String(o.videos).split(',').map(p=>path.resolve(p)):manifest.videos??[];
  const assets=[...images,...videos].map((file:string,i:number)=>assetFor(file,i,runtime));
  const lyrics=normalizeLyrics(imported?.data?.lyrics??raw,duration);
  if(!imported&&manifest.lyricStyles)lyrics.forEach((l:any,i:number)=>Object.assign(l,manifest.lyricStyles[i]??{}));
  const scenes0=imported?.data?.scenes??manifest.scenes??assets.map((_:any,i:number)=>({id:`S${String(i+1).padStart(3,'0')}`,start:i*duration/assets.length,end:(i+1)*duration/assets.length,asset:i,transition:i?.7:0,label:`シーン ${i+1}`}));const scenes=mergeSceneSlivers(scenes0,duration);
  data={...(imported?.data??{}),title:manifest.title??raw.title??raw.projectName??path.basename(project),duration,fps:imported?.data?.fps??manifest.fps??raw.fps??24,width:imported?.data?.width??manifest.width??1280,height:imported?.data?.height??manifest.height??720,bpm:raw.bpm||120,phase:raw.phase??0,lyrics,scenes,assets,audioFile,sections:imported?.data?.sections??manifest.sections??raw.sections?.map((x:any)=>({type:x.type,label:x.label,start:x.start,end:x.end}))};
  const sourceFile=o['source-lyrics']?String(o['source-lyrics']):manifest.sourceLyrics;
  const original=sourceFile?read(sourceFile):raw;sourceLyrics=(original.lines??original.lyrics??original).map((l:any)=>({text:l.text}));
 }
 for(const s of data.scenes)if(!Number.isInteger(s.asset)||s.asset<0||s.asset>=data.assets.length)throw new UserError('シーンの画像番号を確認してください','画像は0始まりです。');
 const source={...structuredClone(data),sourceLyrics};fs.writeFileSync(path.join(runtime,'original-source.json'),JSON.stringify(source,null,2));fs.writeFileSync(path.join(runtime,'editor-state.json'),JSON.stringify({revision:1,data},null,2));
 fs.writeFileSync(path.join(runtime,'audio-integrity.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(runtime,data.audioFile))).digest('hex'),note:'元音声は保持。MP4はAACへ変換します。'},null,2));return {project,runtime,reused:false};
}
async function main(){const {o}=parseArgs(process.argv.slice(2));if(!o.project&&!o.demo)throw new UserError('--projectまたは--demoを指定してください','例: npm run editor -- --demo');const p=prepareProject(o);if(!o['no-font-download'])await ensureEditorFonts({quiet:true});const counts=await buildEditor(p.runtime);console.log(`共通編集UI: ${counts.motions}モーション / ${counts.fonts}書体${p.reused?'（保存済み編集を再利用）':''}`);if(o['prepare-only']){console.log(p.runtime);return}const python=[process.env.MVPACK_PYTHON,'python3','python','py'].filter(Boolean).find(c=>spawnSync(c as string,['--version'],{windowsHide:true}).status===0) as string|undefined;if(!python)throw new UserError('Pythonが見つかりません','Python 3.9以上をインストールするかMVPACK_PYTHONを指定してください。');const tools=o.demo||o['no-tools']?[]:await startTools(p.project,p.runtime);const child=spawn(python,[path.join(REMOTION_DIR,'editor/server.py'),'--root',p.runtime,'--port',String(o.port??5194)],{stdio:'inherit',windowsHide:true});const stop=()=>{for(const t of tools)try{t.kill()}catch{}};process.on('SIGINT',()=>{stop();process.exit(0)});child.on('exit',code=>{stop();process.exit(code??1)});}
/** timing / faces editors as tabs inside the editor: started on free ports, URLs written to tools.json. */
export async function freePort(from:number){const net=await import('node:net');for(let p=from;p<from+40;p++){const ok=await new Promise<boolean>(r=>{const s=net.createServer();s.once('error',()=>r(false));s.listen({port:p,host:'127.0.0.1',exclusive:true},()=>s.close(()=>r(true)))});if(ok)return p}throw new UserError('空きポートが見つかりません','ほかのエディターを閉じてから再度お試しください。')}
async function startTools(project:string,runtime:string){const out:any={},kids:any[]=[];const name=path.basename(project);
 const has=fs.existsSync(path.join(project,'song.json'));
 if(has)for(const [key,script,base] of [['timing','timing.ts',5177],['faces','faces.ts',5179]] as const){try{const port=await freePort(base);const k=spawn(process.execPath,[path.join(REMOTION_DIR,'node_modules','tsx','dist','cli.mjs'),path.join(REMOTION_DIR,'scripts',script),'--project',name,'--port',String(port)],{cwd:REMOTION_DIR,stdio:'ignore',windowsHide:true});kids.push(k);out[key]=`http://127.0.0.1:${port}/`}catch{}}
 fs.writeFileSync(path.join(runtime,'tools.json'),JSON.stringify(out));return kids}
if(process.argv[1]?.endsWith('editor.ts'))main().catch(fail);
