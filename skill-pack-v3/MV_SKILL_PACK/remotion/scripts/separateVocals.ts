import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Optional, offline, local only. Do not treat an older output as a new result.
export function separateVocals(python:string|null,audio:string,outDir:string,script:string) {
 if(!python)return {status:'unavailable' as const,reason:'Python が見つかりません'};
 const deps=path.resolve(path.dirname(script),'..','..','.python-deps');
 const env={...process.env,PYTHONPATH:[deps,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PYTHONIOENCODING:'utf-8'};
 const available=spawnSync(python,['-c',"import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('demucs') else 1)"],{windowsHide:true,env});
 if(available.status!==0)return {status:'unavailable' as const,reason:'歌声分離ツール Demucs が導入されていません'};
 try {
  fs.mkdirSync(outDir,{recursive:true});
  const runDir=fs.mkdtempSync(path.join(outDir,'attempt-'));
  const run=spawnSync(python,[script,audio,runDir],{encoding:'utf8',windowsHide:true,timeout:1200000,maxBuffer:4*1024*1024,env});
  if(run.status!==0)return {status:'unavailable' as const,reason:(run.stderr||run.stdout||run.error?.message||'歌声分離に失敗').trim().slice(-600)};
  const expected=path.join(runDir,'htdemucs',path.basename(audio,path.extname(audio)),'vocals.wav');
  if(!fs.existsSync(expected))return {status:'unavailable' as const,reason:'歌声分離の出力が見つかりません'};
  return {status:'separated' as const,path:expected};
 }catch(e){return {status:'unavailable' as const,reason:e instanceof Error?e.message:String(e)};}
}
