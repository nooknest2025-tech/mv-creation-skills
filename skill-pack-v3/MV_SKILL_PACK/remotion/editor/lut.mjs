// Colour grade for the editor export (data.comp.grade). The grade is a setting, never baked into the source clips:
// the export copies each picture/clip into .render-public and applies a 3D LUT there with FFmpeg (lut3d).
//  - ink : monochrome ink grey; only the `keep` colours survive (ported from the v8 battle LUT generator)
//  - mono: monochrome ink grey, nothing kept
//  - cube: a .cube file inside the project (grade.lut)
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
function hsv(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}return [h,mx?d/mx:0,mx]}
const hd=(a,b)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d)};
const ss=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};
/** .cube text. keep = colours that survive (hue window `width` degrees), base = saturation left everywhere else. */
export function inkCube({keep=[],base=.1,width=26,N=33}={}){
 const ks=keep.map(hexRgb).map(c=>({c,h:hsv(...c)[0]}));const out=[`LUT_3D_SIZE ${N}`];
 for(let bi=0;bi<N;bi++)for(let gi=0;gi<N;gi++)for(let ri=0;ri<N;ri++){
  const r=ri/(N-1),g=gi/(N-1),b=bi/(N-1);const [h,s,v]=hsv(r,g,b);const L=.299*r+.587*g+.114*b;
  let Lc=ss(.06,.92,L);Lc=.85*Lc+.15*L;
  let best=null,w=0;for(const k of ks){const x=Math.exp(-((hd(h,k.h)/width)**2));if(x>w){w=x;best=k}}
  const keepK=best?w*ss(.18,.45,s)*ss(.08,.25,v):0;const kk=Math.max(base,Math.min(1,keepK*1.25));
  const tc=best?best.c:[Lc,Lc,Lc];const cv=Math.max(v,Lc);const cc=best?tc.map(x=>x*cv*1.05):[Lc,Lc,Lc];
  const mix=(a,c)=>Math.max(0,Math.min(1,a*(1-kk)+c*kk));
  out.push(`${mix(Lc,cc[0]).toFixed(5)} ${mix(Lc,cc[1]).toFixed(5)} ${mix(Lc,cc[2]).toFixed(5)}`);
 }
 return out.join('\n')+'\n';
}
/** returns the .cube path to use for this grade, or null for no grade. */
export function gradeCube(data,runtime){
 const g=data.comp?.grade;if(!g||g.look==='none')return null;
 if(g.look==='cube'){const f=path.resolve(runtime,g.lut);if(!f.startsWith(runtime+path.sep)||!fs.existsSync(f))throw Error('LUTファイルが見つかりません: '+g.lut);return f}
 const colors={red:'#E0182D',teal:'#2FF5D0',...(data.comp?.colors??{})};
 const keep=g.look==='mono'?[]:(g.keep??[colors.red,colors.teal]);
 const f=path.join(runtime,'.render-luts',`${g.look}-${keep.join('-').replaceAll('#','')}-${g.base??.1}.cube`);
 if(!fs.existsSync(f)){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,inkCube({keep,base:g.look==='mono'?0:(g.base??.1)}))}
 return f;
}
/** grade the copies in publicDir in place (images and clips). */
export function gradeCopies(ff,cube,files){
 for(const file of files){
  const ext=path.extname(file).toLowerCase(),tmp=file+'.graded'+ext;const video=['.mp4','.mov','.m4v','.webm'].includes(ext);
  const enc=video?(ext==='.webm'?['-c:v','libvpx-vp9','-crf','18','-b:v','0']:['-c:v','libx264','-crf','12','-preset','fast','-pix_fmt','yuv420p']):[];
  const r=spawnSync(ff,['-y','-v','error','-i',file,'-vf',`lut3d=file='${cube.replaceAll('\\','/').replaceAll(':','\\:').replaceAll("'","\\'")}'`,...enc,'-an',...(video?[]:['-frames:v','1']),tmp],{encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw Error('色調（ルック）の適用に失敗しました: '+(r.stderr||'').slice(-400));
  fs.renameSync(tmp,file);
 }
}
