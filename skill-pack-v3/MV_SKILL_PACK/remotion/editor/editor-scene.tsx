import {editorLook} from '../src/lib/editorLook';
import React from 'react';
import {STYLES} from '../src/styles/styles';
import {CATALOG} from '../src/lib/catalog';
import {cameraPose,FxStage,activeFx,CAMERA_MOVES,EFFECT_FX,STRENGTH,SYNC} from '../src/render/SceneFx';
export {CAMERA_MOVES,EFFECT_FX,STRENGTH,SYNC};
export const sceneMove=(s:any)=>s.cameraMove??(s.camera===false?'none':'sway');
import FONT_OPTIONS from './font-options.json';
import {sectionTypeOf} from '../src/lib/song';
import {clipPlan,clipSourceTime} from '../src/lib/clipspeed';
import {TachieStage} from '../src/render/Tachie';
import {stopTimeOf} from '../src/lib/tachie';
import {stageFor} from '../src/lib/stagePatch';
import {moBg,moTop} from '../src/render/MoGraph';
import {mographEditAt,mographProps} from '../src/lib/mographEdit';
import {CompScene} from '../src/render/Compose';
import {hasComp,globalComp,panelSourceTime} from '../src/lib/compose';
import {combined,wantsEditorMotion,isEdited,effectFilter,outlineFilter,SCENE_EDIT_KEYS} from '../src/lib/lyricEdits';
export {combined};
export const isTachieAsset=(a:any)=>!!a&&typeof a==='object'&&a.kind==='tachie'&&!!a.stage;
export {clipPlan,clipSourceTime};
/** section label/type for a lyric (pro_* styles print them); never undefined. */
export function sectionFor(sections:any[]|undefined,t:number){const s=(sections??[]).find((x:any)=>t>=x.start&&t<x.end)??(sections??[])[0];const label=String(s?.label??'');return {section:label,sectionType:s?.type??(label?sectionTypeOf(label):'other')}}
/** one broken lyric style must not blank the whole preview (pictures included). */
class LyricGuard extends React.Component<{children:any;id:string},{err:boolean}>{state={err:false};static getDerivedStateFromError(){return {err:true}}componentDidCatch(e:any){console.warn('lyric render failed',this.props.id,e)}render(){return this.state.err?null:this.props.children}}
export {FONT_OPTIONS};
export const POSITIONS:any={manual:'自由（現在位置）',tl:'左上',tc:'上中央',tr:'右上',ml:'左中央',mc:'中央',mr:'右中央',bl:'左下',bc:'下中央',br:'右下'};
export const EFFECTS:any={none:'なし',double:'二重文字',shadow:'影',glow:'光彩',rgb:'色ずれ（二重）',outline:'縁取り＋影（明るい背景でも読める）'};
export const TRANSITIONS:any={none:'基本のまま',lr:'左右に分かれる',tb:'上下に分かれる',fade:'フェード'};
export {CATALOG};
export const VIDEO_EXT=/\.(mp4|mov|m4v|webm)$/i;
export const isVideoAsset=(a:any)=>!!a&&(a.kind==='video'||VIDEO_EXT.test(typeof a==='string'?a:a.src??''));
/** browser preview: a MUTED <video> that only shows the clip frame the shared mapping asks for (seeks when it drifts). Its own sound is never played. */
function PreviewVideo({src,time,style}:{src:string;time:number;style:any}){const ref=React.useRef<HTMLVideoElement>(null);
 React.useEffect(()=>{const v=ref.current;if(!v)return;v.muted=true;v.volume=0;const d=v.duration;const want=Number.isFinite(d)&&d>0?Math.min(time,d-.04):time;if(Math.abs(v.currentTime-want)>.06)try{v.currentTime=want}catch{}});
 return <video ref={ref} src={src} muted playsInline preload="auto" style={style}/>}
/** srcTime = seconds inside the clip (already speed / in-point / tail mapped by clipPlan). */
export type VideoRenderer=(src:string,srcTime:number,style:any,key:any)=>React.ReactNode;
/** where a scene's clip is at `t` (shared by preview + export). */
export function sceneClipTime(data:any,i:number,t:number){const s=data.scenes[i],end=data.scenes[i+1]?.start??data.duration,a=data.assets[s.asset];return clipSourceTime(clipPlan(s,end-s.start,typeof a==='object'?a.duration:undefined),t-s.start)}

export function Scene({data,t:tIn,base='',video}:{data:any;t:number;base?:string;video?:VideoRenderer}) {
 /* 立ち絵: the whole picture (fx, particles, stage) freezes at the end of the last lyric */const lastScene=data.scenes?.find((s:any,i:number)=>tIn>=s.start&&tIn<(data.scenes[i+1]?.start??Infinity))??data.scenes?.at(-1);const stopT=isTachieAsset(data.assets?.[lastScene?.asset])?stopTimeOf(data.lyrics,data.duration,data.assets[lastScene.asset].stage.stopAt,data.fps??30):undefined;const t=stopT!=null?Math.min(tIn,stopT):tIn;
 const W=data.width??1280,H=data.height??720; const scenes=data.scenes;const assets=data.assets.map((a:any)=>typeof a==='string'?a:a.src);const kinds=data.assets.map((a:any)=>isVideoAsset(a));
 let idx=scenes.findIndex((s:any,i:number)=>t>=s.start&&t<(scenes[i+1]?.start??data.duration)); if(idx<0)idx=scenes.length-1;
 const beat={bpm:data.bpm??120,phase:data.phase??0,beatsPerBar:4};
 const mo=data.mograph?mographProps(data) as any:null;
 const bg=(i:number)=>{const s=scenes[i],end=scenes[i+1]?.start??data.duration,dur=Math.max(.1,end-s.start),p=Math.max(0,Math.min(1,(t-s.start)/dur));const zoom=s.zoom??1;
  const m=cameraPose(sceneMove(s),{p,t,t0:s.start,dur,beat,seed:i*7+1,W,sync:s.cameraSync,accents:data.accents},s.cameraStrength);
  const sc=zoom*m.s,maxX=(1.11*sc-1)*W/2,maxY=(1.11*sc-1)*H/2;const x=Math.max(-maxX,Math.min(maxX,m.x*W+(s.x??0)/100*(1.11*zoom-1)*W/2)),y=Math.max(-maxY,Math.min(maxY,m.y*H+(s.y??0)/100*(1.11*zoom-1)*H/2));const bl=m.blur+(m.focus??0);
  const st={position:'absolute',width:'111%',height:'111%',left:'-5.5%',top:'-5.5%',objectFit:'cover',transform:`perspective(1400px) translate(${x}px,${y}px) scale(${sc}) rotate(${m.r}deg) rotateY(${m.ry??0}deg)`,filter:bl>.2?`blur(${bl.toFixed(2)}px)`:undefined};
  {const a=data.assets[s.asset];if(isTachieAsset(a))return <div key={i} style={{position:'absolute',inset:0,...(isEdited(s,...SCENE_EDIT_KEYS)?{transform:`translate(${x}px,${y}px) scale(${sc}) rotate(${m.r}deg)`,filter:st.filter}:{})/* v6.5: the stage's own cuts are the default; camera/zoom/position edits from the editor still apply */}}><TachieStage st={stageFor(data,i,a.stage)} t={t} t0={s.start} data={data} base={base} W={W} H={H}/></div>}
  if(hasComp(s)){/* editor compositing: panels/effects from scene.comp (projects without comp never reach this) */const media=(ai:number,srcTime:number,mst:any,key:string)=>{const a=data.assets[ai];const at=panelSourceTime({from:srcTime},0,typeof a==='object'?a?.duration:undefined,data.fps??30);if(kinds[ai])return video?<React.Fragment key={key}>{video(base+assets[ai],at,mst,key)}</React.Fragment>:<PreviewVideo key={key} src={base+assets[ai]} time={at} style={mst}/>;return <img key={key} src={base+assets[ai]} style={mst}/>};return <CompScene key={i} data={data} i={i} t={t} W={W} H={H} media={media} graded={!!data._gradeBaked}/>}
  if(kinds[s.asset]){const at=sceneClipTime(data,i,t);return video?<React.Fragment key={i}>{video(base+assets[s.asset],at,st,i)}</React.Fragment>:<PreviewVideo key={i} src={base+assets[s.asset]} time={at} style={st}/>}
  return <img key={i} src={base+assets[s.asset]} style={st as any}/>};
 const fade=scenes[idx].transition??1.1;let blend=idx&&fade>0?Math.max(0,Math.min(1,(t-scenes[idx].start)/fade)):1;blend=blend*blend*(3-2*blend);
 const stageLyr=isTachieAsset(data.assets[scenes[idx]?.asset])&&data.assets[scenes[idx].asset].stage.lyrics!=='editor';const active=data.lyrics.filter((l:any)=>t>=l.start&&t<l.end&&t<data.duration-1&&(!stageLyr||wantsEditorMotion(l)))/* v6.5: 立ち絵 stage draws untouched lines itself (with the editor's font/colour/size/position edits); a line given a motion sample in the editor is drawn here by the normal motion renderer */;
 return <div style={{position:'relative',width:W,height:H,overflow:'hidden',background:'#19221c','--lyric-fill':'#f8f3e6','--lyric-stroke':'#1f271f','--lyric-accent':'#e6aa96','--lyric-font':"'Noto Serif JP'"} as any}>
 <FxStage W={W} H={H} t={t} frame={Math.round(t*(data.fps??24))} fx={activeFx(scenes[idx].effects,data.effectRanges,t)} t0={scenes[idx].start} t1={scenes[idx+1]?.start??data.duration} seed={idx*13+5} beat={beat} accents={data.accents} picture={()=><>{idx>0&&blend<1&&bg(idx-1)}<div style={{position:'absolute',inset:0,opacity:blend}}>{bg(idx)}</div>{mo&&moBg(mo,t,W,H,mographEditAt(data,t))/* 文字PV: the same mograph layer as npm run mv (editor edits win) */}</>}>
 {!mo&&(!data.comp||globalComp(data).particles)&&<svg width={W} height={H} style={{position:'absolute',inset:0}}>{Array.from({length:12},(_,k)=>{const gain=Math.min(1,Math.max(0,(t-(data.particleStart??0))/Math.max(1,data.duration*.18)))*Math.min(1,Math.max(0,(data.duration-t)/5));let x=(k*151+t*(7+k%3))%(W+100)-50,y=90+(k*79+t*4)%420+12*Math.sin(t*.5+k);return <ellipse key={k} cx={x} cy={y} rx={5+k%4} ry={(5+k%4)*.43} transform={`rotate(${(t*.4+k)*180/Math.PI} ${x} ${y})`} fill={['#da9782','#9eb4a3','#b5a4bf','#c7ae77'][k%4]} opacity={gain*.57}/>})}</svg>}
 {active.length>0&&(!data.comp||globalComp(data).shade)&&!isTachieAsset(data.assets[scenes[idx]?.asset])&&<div style={{position:'absolute',inset:0,background:'linear-gradient(transparent 68%,rgba(15,25,21,.35))'}}/>}
 {active.map((l:any)=>{let style=l.motion??'simple';const defaults=CATALOG[style]?.defaults??{};const chars=Array.from(l.text as string).map((ch,ci)=>({ch,idx:ci,t0:l.start+(l.end-l.start)*ci/Array.from(l.text).length,t1:l.start+(l.end-l.start)*(ci+1)/Array.from(l.text).length}));const duration=l.motionDuration??.8;const charsTimed=chars.map((c,ci)=>({...c,t0:l.start+Math.min(l.end-l.start-.1,duration)*ci/chars.length,t1:l.start+Math.min(l.end-l.start-.1,duration)*(ci+1)/chars.length}));
 const L={...l,...sectionFor(data.sections,l.start),li:Math.max(0,data.lyrics.indexOf(l)),style,chars:charsTimed,words:[{i0:0,i1:chars.length,t:l.start}],params:{...defaults,enter:duration,lead:0,...l.params,...(l.fill?{color:l.fill}:{}),...(l.accent?{sung_color:l.accent,fill_color:l.accent,colors:[l.accent]}:{})},kw:[],seed:(parseInt(l.id?.replace(/[^0-9]/g,'')?.slice(0,8)??'0',10)||0)*7919+13,tOn:l.start,tOff:Math.max(l.start,l.end-.3),tEnd:l.end,exit:.3};
 L.lead=Number(L.params.lead??0)||0;L.exit=Number(L.params.exit??.3);/* same fields the final render's resolve() fills; pro_* styles read them */
 const fn=STYLES[style];const rendered=fn?fn({L,t,P:L.params,W,H,beat:{bpm:data.bpm??120,phase:data.phase??0,beatsPerBar:4},k:l.scale??.72,textY:l.y??.84} as any):null;
 const boxes=rendered?.boxes?.filter(b=>b.every(Number.isFinite))??[];
 const x0=boxes.length?Math.min(...boxes.map(b=>b[0])):W*.1,y0=boxes.length?Math.min(...boxes.map(b=>b[1])):H*.7;
 const x1=boxes.length?Math.max(...boxes.map(b=>b[2])):W*.9,y1=boxes.length?Math.max(...boxes.map(b=>b[3])):H*.9;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,angle=l.angle??0,rad=angle*Math.PI/180;
 const out=combined(rendered?.el,l,t,cx,cy,W,H);
 const rw=Math.abs((x1-x0)*Math.cos(rad))+Math.abs((y1-y0)*Math.sin(rad)),rh=Math.abs((x1-x0)*Math.sin(rad))+Math.abs((y1-y0)*Math.cos(rad));
 const tachie=isTachieAsset(data.assets[scenes[idx]?.asset])&&l.position===undefined&&!isEdited(l,'y','scale');let frw=rw,frh=rh;if(tachie&&fn){/* measure the fully revealed line so the fit doesn't change while characters pop in */const full=fn({L,t:Math.max(l.start,L.tOff-.01),P:L.params,W,H,beat:{bpm:data.bpm??120,phase:data.phase??0,beatsPerBar:4},k:l.scale??.72,textY:l.y??.84} as any);const fb=full?.boxes?.filter((b:any)=>b.every(Number.isFinite))??[];if(fb.length){frw=Math.max(rw,Math.max(...fb.map((b:any)=>b[2]))-Math.min(...fb.map((b:any)=>b[0])));frh=Math.max(rh,Math.max(...fb.map((b:any)=>b[3]))-Math.min(...fb.map((b:any)=>b[1])))}}/* 立ち絵 stage: keep lyrics in the top band above the characters' heads */
 const position=l.position??'manual',fit=tachie?Math.min(1.1,(W-96)/Math.max(1,frw),H*.17/Math.max(1,frh)):position==='manual'?1:Math.min(1,(W-128)/Math.max(1,rw),(H-100)/Math.max(1,rh));
 const tx=tachie?W/2:position==='manual'?cx:position[1]==='l'?64+rw*fit/2:position[1]==='r'?W-64-rw*fit/2:W/2;
 const ty=tachie?H*.105:position==='manual'?cy:position[0]==='t'?50+rh*fit/2:position[0]==='b'?H-50-rh*fit/2:H/2;
 const family=FONT_OPTIONS.find(f=>f.id===(editorLook(l).font))?.family??'Noto Serif JP';const effect=l.effect??'none',offset=l.effectOffset??6;
 return <LyricGuard key={l.id} id={l.id}><div style={{position:'absolute',inset:0,opacity:Math.max(0,Math.min(1,(t-l.start)/.1,(l.end-t)/.15)),'--lyric-font':`'${family}'`,'--lyric-fill':editorLook(l).fill,'--lyric-accent':editorLook(l).accent,'--lyric-stroke':editorLook(l).stroke} as any}>
 <div style={{position:'absolute',inset:0,transformOrigin:`${cx}px ${cy}px`,transform:`translate(${tx-cx}px,${ty-cy}px) rotate(${angle}deg) scale(${fit})`,filter:effect==='outline'?outlineFilter(offset,editorLook(l).stroke):effect==='shadow'?`drop-shadow(${offset}px ${offset}px 3px #101310)`:effect==='glow'?`drop-shadow(0 0 ${offset+2}px #f4dfb0) drop-shadow(0 0 ${offset*2+3}px #e6aa96)`:undefined}}>
 {(effect==='double'||effect==='rgb')&&<div style={{position:'absolute',inset:0,transform:`translate(${offset}px,${offset}px)`,opacity:.5,'--lyric-fill':effect==='rgb'?'#58dce6':undefined,'--lyric-accent':effect==='rgb'?'#58dce6':undefined} as any}>{out}</div>}
 {effect==='rgb'&&<div style={{position:'absolute',inset:0,transform:`translate(${-offset}px,0)`,opacity:.5,'--lyric-fill':'#ff75ad','--lyric-accent':'#ff75ad'} as any}>{out}</div>}
 {out}</div></div></LyricGuard>})}
 {mo&&moTop(mo,t,W,H,Math.round(t*(data.fps??24)),data.fps??24,(tt:number)=>mographEditAt(data,tt))}
 </FxStage>
 {!isTachieAsset(data.assets[scenes[idx]?.asset])&&(!data.comp||globalComp(data).endFade)&&<div style={{position:'absolute',inset:0,background:'#19221c',opacity:Math.max(0,Math.min(.8,(t-(data.duration-2.2))/2.2*.8))}}/>/* 立ち絵: no fade-out, the final kime pose holds to the last frame */}
 </div>
}


