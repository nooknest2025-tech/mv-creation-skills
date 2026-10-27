import React from 'react';
import {STYLES} from '../src/styles/styles';
import {CATALOG} from '../src/lib/catalog';
import {cameraPose,FxStage,activeFx,CAMERA_MOVES,EFFECT_FX,STRENGTH,SYNC} from '../src/render/SceneFx';
export {CAMERA_MOVES,EFFECT_FX,STRENGTH,SYNC};
export const sceneMove=(s:any)=>s.cameraMove??(s.camera===false?'none':'sway');
import FONT_OPTIONS from './font-options.json';
export {FONT_OPTIONS};
export const POSITIONS:any={manual:'自由（現在位置）',tl:'左上',tc:'上中央',tr:'右上',ml:'左中央',mc:'中央',mr:'右中央',bl:'左下',bc:'下中央',br:'右下'};
export const EFFECTS:any={none:'なし',double:'二重文字',shadow:'影',glow:'光彩',rgb:'色ずれ（二重）'};
export const TRANSITIONS:any={none:'基本のまま',lr:'左右に分かれる',tb:'上下に分かれる',fade:'フェード'};
function combined(el:React.ReactNode,l:any,t:number,cx:number,cy:number,W:number,H:number){
 const enter=l.entrance??'none',exit=l.departure??'none',duration=Math.max(.05,Math.min(l.transitionDuration??.7,(l.end-l.start)/2));
 const p=Math.max(0,Math.min(1,(t-l.start)/duration)),q=Math.max(0,Math.min(1,(t-(l.end-duration))/duration));
 const kind=p<1&&enter!=='none'?enter:q>0&&exit!=='none'?exit:'none';
 if(kind==='none')return el;
 const amount=p<1&&enter!=='none'?Math.pow(1-p,3):q*q;
 if(kind==='fade')return <div style={{position:'absolute',inset:0,opacity:1-amount}}>{el}</div>;
 return <>{[-1,1].map(sign=><div key={sign} style={{position:'absolute',inset:0,transform:`translate(${kind==='lr'?sign*W*.42*amount:0}px,${kind==='tb'?sign*H*.42*amount:0}px)`,opacity:1-amount*.8}}><div style={{position:'absolute',inset:0,clipPath:kind==='lr'?(sign<0?`inset(0 ${W-cx}px 0 0)`:`inset(0 0 0 ${cx}px)`):(sign<0?`inset(0 0 ${H-cy}px 0)`:`inset(${cy}px 0 0 0)`)}}>{el}</div></div>)}</>;
}
export {CATALOG};
export const VIDEO_EXT=/\.(mp4|mov|m4v|webm)$/i;
export const isVideoAsset=(a:any)=>!!a&&(a.kind==='video'||VIDEO_EXT.test(typeof a==='string'?a:a.src??''));
/** browser preview: a muted <video> kept in sync with the editor clock (seeks only when it drifts). */
function PreviewVideo({src,time,style}:{src:string;time:number;style:any}){const ref=React.useRef<HTMLVideoElement>(null);
 React.useEffect(()=>{const v=ref.current;if(!v)return;const d=v.duration;const want=Number.isFinite(d)&&d>0?time%d:time;if(Math.abs(v.currentTime-want)>.2)try{v.currentTime=want}catch{}});
 return <video ref={ref} src={src} muted playsInline preload="auto" style={style}/>}
export type VideoRenderer=(src:string,sceneStart:number,localT:number,style:any,key:any)=>React.ReactNode;

export function Scene({data,t,base='',video}:{data:any;t:number;base?:string;video?:VideoRenderer}) {
 const W=data.width??1280,H=data.height??720; const scenes=data.scenes;const assets=data.assets.map((a:any)=>typeof a==='string'?a:a.src);const kinds=data.assets.map((a:any)=>isVideoAsset(a));
 let idx=scenes.findIndex((s:any,i:number)=>t>=s.start&&t<(scenes[i+1]?.start??data.duration)); if(idx<0)idx=scenes.length-1;
 const beat={bpm:data.bpm??120,phase:data.phase??0,beatsPerBar:4};
 const bg=(i:number)=>{const s=scenes[i],end=scenes[i+1]?.start??data.duration,dur=Math.max(.1,end-s.start),p=Math.max(0,Math.min(1,(t-s.start)/dur));const zoom=s.zoom??1;
  const m=cameraPose(sceneMove(s),{p,t,t0:s.start,dur,beat,seed:i*7+1,W,sync:s.cameraSync,accents:data.accents},s.cameraStrength);
  const sc=zoom*m.s,maxX=(1.11*sc-1)*W/2,maxY=(1.11*sc-1)*H/2;const x=Math.max(-maxX,Math.min(maxX,m.x*W+(s.x??0)/100*(1.11*zoom-1)*W/2)),y=Math.max(-maxY,Math.min(maxY,m.y*H+(s.y??0)/100*(1.11*zoom-1)*H/2));const bl=m.blur+(m.focus??0);
  const st={position:'absolute',width:'111%',height:'111%',left:'-5.5%',top:'-5.5%',objectFit:'cover',transform:`perspective(1400px) translate(${x}px,${y}px) scale(${sc}) rotate(${m.r}deg) rotateY(${m.ry??0}deg)`,filter:bl>.2?`blur(${bl.toFixed(2)}px)`:undefined};
  if(kinds[s.asset]){const local=Math.max(0,t-s.start);return video?<React.Fragment key={i}>{video(base+assets[s.asset],s.start,local,st,i)}</React.Fragment>:<PreviewVideo key={i} src={base+assets[s.asset]} time={local} style={st}/>}
  return <img key={i} src={base+assets[s.asset]} style={st as any}/>};
 const fade=scenes[idx].transition??1.1;let blend=idx&&fade>0?Math.max(0,Math.min(1,(t-scenes[idx].start)/fade)):1;blend=blend*blend*(3-2*blend);
 const active=data.lyrics.filter((l:any)=>t>=l.start&&t<l.end&&t<data.duration-1);
 return <div style={{position:'relative',width:W,height:H,overflow:'hidden',background:'#19221c','--lyric-fill':'#f8f3e6','--lyric-stroke':'#1f271f','--lyric-accent':'#e6aa96','--lyric-font':"'Noto Serif JP'"} as any}>
 <FxStage W={W} H={H} t={t} frame={Math.round(t*(data.fps??24))} fx={activeFx(scenes[idx].effects,data.effectRanges,t)} t0={scenes[idx].start} t1={scenes[idx+1]?.start??data.duration} seed={idx*13+5} beat={beat} accents={data.accents} picture={()=><>{idx>0&&blend<1&&bg(idx-1)}<div style={{position:'absolute',inset:0,opacity:blend}}>{bg(idx)}</div></>}>
 <svg width={W} height={H} style={{position:'absolute',inset:0}}>{Array.from({length:12},(_,k)=>{const gain=Math.min(1,Math.max(0,(t-(data.particleStart??0))/Math.max(1,data.duration*.18)))*Math.min(1,Math.max(0,(data.duration-t)/5));let x=(k*151+t*(7+k%3))%(W+100)-50,y=90+(k*79+t*4)%420+12*Math.sin(t*.5+k);return <ellipse key={k} cx={x} cy={y} rx={5+k%4} ry={(5+k%4)*.43} transform={`rotate(${(t*.4+k)*180/Math.PI} ${x} ${y})`} fill={['#da9782','#9eb4a3','#b5a4bf','#c7ae77'][k%4]} opacity={gain*.57}/>})}</svg>
 {active.length>0&&<div style={{position:'absolute',inset:0,background:'linear-gradient(transparent 68%,rgba(15,25,21,.35))'}}/>}
 {active.map((l:any)=>{let style=l.motion??'simple';const defaults=CATALOG[style]?.defaults??{};const chars=Array.from(l.text as string).map((ch,ci)=>({ch,idx:ci,t0:l.start+(l.end-l.start)*ci/Array.from(l.text).length,t1:l.start+(l.end-l.start)*(ci+1)/Array.from(l.text).length}));const duration=l.motionDuration??.8;const charsTimed=chars.map((c,ci)=>({...c,t0:l.start+Math.min(l.end-l.start-.1,duration)*ci/chars.length,t1:l.start+Math.min(l.end-l.start-.1,duration)*(ci+1)/chars.length}));
 const L={...l,li:(parseInt(l.id?.replace(/[^0-9]/g,'')?.slice(0,8)??'0',10)||0),style,chars:charsTimed,words:[{i0:0,i1:chars.length,t:l.start}],params:{...defaults,enter:duration,lead:0,...l.params,...(l.fill?{color:l.fill}:{}),...(l.accent?{sung_color:l.accent,fill_color:l.accent,colors:[l.accent]}:{})},kw:[],seed:(parseInt(l.id?.replace(/[^0-9]/g,'')?.slice(0,8)??'0',10)||0)*7919+13,tOn:l.start,tOff:Math.max(l.start,l.end-.3),tEnd:l.end,exit:.3};
 const fn=STYLES[style];const rendered=fn?fn({L,t,P:L.params,W,H,beat:{bpm:data.bpm??120,phase:data.phase??0,beatsPerBar:4},k:l.scale??.72,textY:l.y??.84} as any):null;
 const boxes=rendered?.boxes?.filter(b=>b.every(Number.isFinite))??[];
 const x0=boxes.length?Math.min(...boxes.map(b=>b[0])):W*.1,y0=boxes.length?Math.min(...boxes.map(b=>b[1])):H*.7;
 const x1=boxes.length?Math.max(...boxes.map(b=>b[2])):W*.9,y1=boxes.length?Math.max(...boxes.map(b=>b[3])):H*.9;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,angle=l.angle??0,rad=angle*Math.PI/180;
 const out=combined(rendered?.el,l,t,cx,cy,W,H);
 const rw=Math.abs((x1-x0)*Math.cos(rad))+Math.abs((y1-y0)*Math.sin(rad)),rh=Math.abs((x1-x0)*Math.sin(rad))+Math.abs((y1-y0)*Math.cos(rad));
 const position=l.position??'manual',fit=position==='manual'?1:Math.min(1,(W-128)/Math.max(1,rw),(H-100)/Math.max(1,rh));
 const tx=position==='manual'?cx:position[1]==='l'?64+rw*fit/2:position[1]==='r'?W-64-rw*fit/2:W/2;
 const ty=position==='manual'?cy:position[0]==='t'?50+rh*fit/2:position[0]==='b'?H-50-rh*fit/2:H/2;
 const family=FONT_OPTIONS.find(f=>f.id===l.font)?.family??'Noto Serif JP';const effect=l.effect??'none',offset=l.effectOffset??6;
 return <div key={l.id} style={{position:'absolute',inset:0,opacity:Math.max(0,Math.min(1,(t-l.start)/.1,(l.end-t)/.15)),'--lyric-font':`'${family}'`,'--lyric-fill':l.fill??'#f8f3e6','--lyric-accent':l.accent??'#e6aa96','--lyric-stroke':l.stroke??'#1f271f'} as any}>
 <div style={{position:'absolute',inset:0,transformOrigin:`${cx}px ${cy}px`,transform:`translate(${tx-cx}px,${ty-cy}px) rotate(${angle}deg) scale(${fit})`,filter:effect==='shadow'?`drop-shadow(${offset}px ${offset}px 3px #101310)`:effect==='glow'?`drop-shadow(0 0 ${offset+2}px #f4dfb0) drop-shadow(0 0 ${offset*2+3}px #e6aa96)`:undefined}}>
 {(effect==='double'||effect==='rgb')&&<div style={{position:'absolute',inset:0,transform:`translate(${offset}px,${offset}px)`,opacity:.5,'--lyric-fill':effect==='rgb'?'#58dce6':undefined,'--lyric-accent':effect==='rgb'?'#58dce6':undefined} as any}>{out}</div>}
 {effect==='rgb'&&<div style={{position:'absolute',inset:0,transform:`translate(${-offset}px,0)`,opacity:.5,'--lyric-fill':'#ff75ad','--lyric-accent':'#ff75ad'} as any}>{out}</div>}
 {out}</div></div>})}
 </FxStage>
 <div style={{position:'absolute',inset:0,background:'#19221c',opacity:Math.max(0,Math.min(.8,(t-(data.duration-2.2))/2.2*.8))}}/>
 </div>
}


