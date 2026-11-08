// Re-check a saved editor snapshot without modifying its timings or source audio.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {decodeMono,durationOf,REMOTION_DIR} from './common';
import {vocalSyncEstimate} from './vocalSync';
import {syncAudit} from '../src/lib/syncAudit';
import {lyricTimeline} from '../src/lib/lyricTimeline';
import {separateVocals} from './separateVocals';
import {beatEvidence} from '../src/lib/beatEvidence';
import {trackAudioBeats} from '../src/lib/beatTrack';

const file=process.argv[2];
if(!file){console.error('使い方: npm run sync:review -- <editor-state.json> [出力フォルダ] [--vocals 歌声音源]');process.exit(1)}
const state=path.resolve(file),runtime=path.dirname(state),data=JSON.parse(fs.readFileSync(state,'utf8')).data;
const audio=path.resolve(runtime,data.audioFile),relative=path.relative(runtime,audio);
if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('音声はプロジェクトの編集フォルダ内に必要です');
const args=process.argv.slice(3), stemIndex=args.indexOf('--vocals');
if(stemIndex>=0 && (!args[stemIndex+1] || args[stemIndex+1].startsWith('--')))throw new Error('--vocals に歌声音源のパスを指定してください');
let stem=stemIndex>=0?path.resolve(args[stemIndex+1]):undefined;
if(stem && !fs.existsSync(stem))throw new Error(`歌声音源が見つかりません: ${stem}`);
const outArg=args.find((a,i)=>!a.startsWith('--') && (stemIndex<0 || i!==stemIndex+1));
const outDir=outArg?path.resolve(outArg):path.join(runtime,'sync-review');
const py=[process.env.MVPACK_PYTHON,'python3','python','py'].filter((s):s is string=>!!s).find(p=>spawnSync(p,['--version'],{windowsHide:true}).status===0)??null;
const lines=(data.lyrics??[]).filter((l:any)=>!l.extra&&!String(l.motion??'').startsWith('dvd_'));
const separation=!stem && lines.length?separateVocals(py,audio,path.join(outDir,'vocal-separation'),path.join(REMOTION_DIR,'scripts','separate_vocals.py')):undefined;
if(separation?.status==='separated')stem=separation.path;
console.log('歌声と拍のローカル解析を実行中（聴取確認ではありません）…');
const estimateOptions={python:py,script:path.join(REMOTION_DIR,'scripts','transcribe.py'),model:'small',lines};
const vocal=vocalSyncEstimate({...estimateOptions,audio,outDir:path.join(outDir,'sync-sources','mix')});
const stemEstimate=stem?vocalSyncEstimate({...estimateOptions,audio:stem,outDir:path.join(outDir,'sync-sources','vocals')}):undefined;
let stemDuration:number|undefined;
if(stem)try{stemDuration=durationOf(stem)}catch{/* duration remains unverified */}
const timeline=lyricTimeline(lines,data.duration,vocal,stemEstimate,stemDuration,separation?.status==='unavailable'?separation.reason:undefined);
let windows:ReturnType<typeof beatEvidence>=[],beatReason:string|undefined,track:ReturnType<typeof trackAudioBeats>|undefined;
try{const samples=decodeMono(audio,10000);windows=beatEvidence(samples,10000,Number(data.bpm)||120,Number(data.phase)||0);track=trackAudioBeats(samples,10000,Number(data.bpm)||120)}catch(e){beatReason=e instanceof Error?e.message:String(e);console.error('拍の解析は未実施:',beatReason)}
const audit=syncAudit(lines,data.duration,{bpm:Number(data.bpm)||120,phase:Number(data.phase)||0},vocal.status==='estimated'?vocal.lyrics:undefined,windows);
const report={...audit,lyric:{...audit.lyric,analysisStatus:vocal.status,...(vocal.status==='unavailable'?{reason:vocal.reason}:{})},beat:{...audit.beat,...(beatReason?{reason:beatReason}:{})}};
fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'sync-audit.json'),JSON.stringify(report,null,2),'utf8');
fs.writeFileSync(path.join(outDir,'lyric-timeline.json'),JSON.stringify(timeline,null,2),'utf8');
if(track)fs.writeFileSync(path.join(outDir,'beat-track.json'),JSON.stringify({...track,used:false,note:'音声からの拍候補。既存の編集時刻は変更していません。'},null,2),'utf8');
console.log(`歌声照合: ${vocal.status} / 確認候補: ${audit.lyric.issues.length} 行 / 拍: ${windows.filter(w=>w.needsReview).length} 区間`);
if(vocal.status==='unavailable')console.log(`歌声照合は未実施: ${vocal.reason}`);
console.log(`結果: ${path.join(outDir,'sync-audit.json')}（歌声と拍の聴取は未確認）`);
console.log(`歌唱時刻の候補: ${path.join(outDir,'lyric-timeline.json')}（表示時刻は変更していません）`);
if(!stem)console.log(`歌声分離できず原曲のみで推定: ${separation?.status==='unavailable'?separation.reason:'歌声素材なし'}`);
