// Match the legacy FFmpeg YUV -> RGB interpretation without re-encoding source frames.
// Only prepared copies are tagged. Other codecs, HDR, rotation and non-square pixels keep the legacy decoder.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
export const videoCopyCandidate=file=>/\.(mp4|m4v|mov)$/i.test(file);
export function probeVideo(ffprobe,file){
 const r=spawnSync(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,color_space,color_range,color_transfer,color_primaries,start_time,sample_aspect_ratio,nb_frames:stream_side_data=rotation','-of','json',file],{encoding:'utf8',windowsHide:true});
 if(r.status!==0)return null;try{return JSON.parse(r.stdout).streams?.[0]??null}catch{return null}
}
export function colorPlan(v){
 if(!v||v.codec_name!=='h264'||!['yuv420p','yuvj420p'].includes(v.pix_fmt))return null;
 if(![undefined,'unknown','unspecified','bt709','bt470bg','smpte170m'].includes(v.color_primaries)||![undefined,'unknown','unspecified','bt709','gamma22','gamma28','smpte170m','iec61966-2-1'].includes(v.color_transfer))return null;
 if(v.sample_aspect_ratio&&!['1:1','0:1','N/A'].includes(v.sample_aspect_ratio))return null;
 if(v.start_time&&Math.abs(Number(v.start_time))>.00001)return null;
 if(v.side_data_list?.some(s=>Math.abs(s.rotation??0)>.001))return null;
 const matrix=({bt709:1,bt470bg:5,smpte170m:6,unknown:6,unspecified:6})[v.color_space??'unknown'];
 if(!matrix)return null;
 return {matrix,space:matrix===1?'bt709':matrix===5?'bt470bg':'smpte170m',full:v.color_range==='pc'||v.pix_fmt==='yuvj420p'};
}
export function taggedForWebCodecs(v){return !!colorPlan(v)&&v.color_primaries==='bt709'&&v.color_transfer==='iec61966-2-1'&&['pc','tv'].includes(v.color_range)}
export function tagVideoCopy(ff,ffprobe,file){
 const before=probeVideo(ffprobe,file),plan=colorPlan(before);if(!plan)return {decoder:'offthread'};
 const ext=path.extname(file),tmp=file+'.color-'+process.pid+ext;
 try{
  const bsf=`h264_metadata=matrix_coefficients=${plan.matrix}:colour_primaries=1:transfer_characteristics=13:video_full_range_flag=${plan.full?1:0}`;
  const r=spawnSync(ff,['-v','error','-y','-i',file,'-map','0:v:0','-an','-sn','-dn','-c:v','copy','-bsf:v',bsf,'-color_primaries','bt709','-color_trc','iec61966-2-1','-colorspace',plan.space,'-color_range',plan.full?'pc':'tv',tmp],{encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw Error((r.stderr??'FFmpeg failed').slice(-500));
  const after=probeVideo(ffprobe,tmp);
  if(!taggedForWebCodecs(after)||before.nb_frames&&after.nb_frames!==before.nb_frames)throw Error('Tagged copy metadata or frame count differs');
  fs.renameSync(tmp,file);return {decoder:'webcodecs'};
 }catch(e){return {decoder:'offthread',warning:String(e)}}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
}
