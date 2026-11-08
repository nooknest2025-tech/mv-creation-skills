import {describe, expect, it} from 'vitest';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {muxArgs} from '../editor/export-mux.mjs';

const ffmpeg = spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status === 0;
describe.skipIf(!ffmpeg)('editor MP4 audio',()=>{
  it('preserves the complete PCM audio stream when muxing',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mv-mux-'));
    try {
      const wav=path.join(dir,'audio.wav'), video=path.join(dir,'video.mp4'), out=path.join(dir,'out.mp4');
      const run=(args:string[])=>{const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error',...args],{encoding:'utf8'});expect(p.status,p.stderr).toBe(0);return p.stdout.trim();};
      run(['-f','lavfi','-i','sine=frequency=440:duration=1','-c:a','pcm_s16le','-y',wav]);
      run(['-f','lavfi','-i','color=size=64x64:rate=24:duration=1','-c:v','libx264','-an','-y',video]);
      run(muxArgs(video,wav,1,out));
      const md5=(f:string)=>run(['-i',f,'-map','0:a:0','-c','copy','-f','md5','-']);
      expect(md5(out)).toBe(md5(wav));
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  });
});
