import {describe,it,expect} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {colorPlan,probeVideo,taggedForWebCodecs,tagVideoCopy} from '../editor/video-color.mjs';
const hasTools=['ffmpeg','ffprobe'].every(exe=>spawnSync(exe,['-version'],{windowsHide:true}).status===0);
const run=(args:string[])=>{const r=spawnSync('ffmpeg',['-v','error',...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim()};
describe('video decoder colour compatibility',()=>{
 it('keeps unsupported, HDR, rotated, shifted and anamorphic clips on the legacy path',()=>{
  const base={codec_name:'h264',pix_fmt:'yuv420p'};expect(colorPlan(base)).toMatchObject({matrix:6,full:false});
  for(const override of [{codec_name:'hevc'},{pix_fmt:'yuv420p10le'},{color_transfer:'smpte2084'},{color_primaries:'bt2020'},{color_primaries:'smpte432'},{side_data_list:[{rotation:90}]},{sample_aspect_ratio:'2:1'},{start_time:'0.08'},{color_space:'bt2020nc'}])expect(colorPlan({...base,...override})).toBeNull();
  expect(taggedForWebCodecs(base)).toBe(false);
 });
 for(const full of [false,true])it.skipIf(!hasTools)(`preserves every decoded pixel, PTS and source byte for ${full?'full':'limited'} range`,()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-video-color-'));
  try{
   const original=path.join(dir,'source.mp4'),copy=path.join(dir,'prepared.mp4');
   run(['-f','lavfi','-i','testsrc2=size=64x48:rate=30:duration=1','-c:v','libx264','-pix_fmt',full?'yuvj420p':'yuv420p','-color_range',full?'pc':'tv',original]);
   const bytes=fs.readFileSync(original);fs.copyFileSync(original,copy);
   const pixels=(file:string)=>run(['-i',file,'-map','0:v:0','-pix_fmt','rgb24','-f','hash','-hash','sha256','-']);
   const pts=(file:string)=>spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','packet=pts,dts,duration','-of','json',file],{encoding:'utf8',windowsHide:true}).stdout;
   const before=pixels(copy),timing=pts(copy);expect(tagVideoCopy('ffmpeg','ffprobe',copy).decoder).toBe('webcodecs');
   const v=probeVideo('ffprobe',copy);expect(taggedForWebCodecs(v)).toBe(true);expect(v.color_range).toBe(full?'pc':'tv');
   expect(pixels(copy)).toBe(before);expect(pts(copy)).toBe(timing);expect(fs.readFileSync(original)).toEqual(bytes);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 },20000);
 it.skipIf(!hasTools)('falls back after a tagging failure without replacing the prepared video',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-video-color-failure-'));
  try{const f=path.join(dir,'video.mp4');run(['-f','lavfi','-i','color=size=64x48:duration=0.1','-c:v','libx264',f]);const before=fs.readFileSync(f);expect(tagVideoCopy(path.join(dir,'missing-ffmpeg'),'ffprobe',f).decoder).toBe('offthread');expect(fs.readFileSync(f)).toEqual(before);expect(fs.readdirSync(dir)).toEqual(['video.mp4'])}finally{fs.rmSync(dir,{recursive:true,force:true})}
 },20000);
});
