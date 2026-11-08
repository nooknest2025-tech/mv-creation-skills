import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import type {SyncLine,VocalCandidate} from '../src/lib/syncAudit';

// Locally estimate timing against supplied lyrics; never alter the user's lyrics.
// No model downloads: an unavailable dependency/model is reported as unverified.
export function vocalSyncEstimate(opts:{python:string|null;script:string;audio:string;vocals?:string;model:string;lines:SyncLine[];outDir:string}) {
 const {python,script,audio,vocals,model,lines,outDir}=opts;
 if(!lines.length)return {status:'no-lyrics' as const};
 if(!python)return {status:'unavailable' as const,reason:'Python が見つかりません'};
 try {
  fs.mkdirSync(outDir,{recursive:true});
  const source=vocals||audio, text=lines.map(l=>l.text.replace(/[\r\n]+/g,' ').trim()).join('\n');
  const hash=crypto.createHash('sha256').update(fs.readFileSync(source)).update('\0'+model+'\0'+text).digest('hex');
  const output=path.join(outDir,'sync-vocal-estimate.json'),meta=path.join(outDir,'sync-vocal-estimate-source.json'),lyrics=path.join(outDir,'sync-vocal-input.txt');
  if(fs.existsSync(output)&&fs.existsSync(meta)&&JSON.parse(fs.readFileSync(meta,'utf8')).hash===hash){
   return {status:'estimated' as const,lyrics:JSON.parse(fs.readFileSync(output,'utf8')).lyrics as VocalCandidate[],cached:true};
  }
  fs.writeFileSync(lyrics,text,'utf8');
  const tmp=path.join(outDir,'sync-vocal-estimate-pending.json');
  const r=spawnSync(python,[script,audio,'--text',lyrics,'--out',tmp,'--model',model,...(vocals?['--vocals',vocals]:[])],{encoding:'utf8',windowsHide:true,timeout:1200000,maxBuffer:4*1024*1024,env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PYTHONIOENCODING:'utf-8'}});
  if(r.status!==0)return {status:'unavailable' as const,reason:(r.stderr||r.stdout||r.error?.message||'音声解析に失敗').trim().slice(-800)};
  const parsed=JSON.parse(fs.readFileSync(tmp,'utf8'));
  if(!Array.isArray(parsed.lyrics))throw new Error('歌声解析の結果が不正です');
  fs.writeFileSync(output,JSON.stringify(parsed,null,2),'utf8');fs.writeFileSync(meta,JSON.stringify({hash,model,source:vocals?'vocals':'mix'},null,2),'utf8');
  return {status:'estimated' as const,lyrics:parsed.lyrics as VocalCandidate[],cached:false};
 } catch(e){return {status:'unavailable' as const,reason:e instanceof Error?e.message:String(e)};}
}
