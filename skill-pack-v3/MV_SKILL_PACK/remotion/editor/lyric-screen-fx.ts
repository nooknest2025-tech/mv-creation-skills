/** Whole-frame approximations for JIZURA events; not the original canvas implementation. */
export const JIZURA_SCREEN_EFFECTS:Record<string,{kind:string;duration:number}>={
 flash:{kind:'flash',duration:4/24},invert:{kind:'invert',duration:4/24},shake:{kind:'shake',duration:4/24},defocus:{kind:'blur',duration:8/24},
};
export function lyricScreenFx(data:any,t:number){
 let invert=0,blur=0,shakeX=0,shakeY=0,flash=0;
 for(const line of data.lyrics??[]){
  const j=line.jizura;if(!j||!Number.isFinite(line.start)||!Number.isFinite(line.end))continue;
  const bridge=j.fxScope==='screen'?JIZURA_SCREEN_EFFECTS[j.fx]:undefined;
  const events=[...(j.screenFx?[{kind:j.screenFx,time:j.screenFxTime,duration:j.screenFxDuration??.35,strength:j.screenFxStrength}]:[]),...(bridge?[{kind:bridge.kind,time:j.fxTime,duration:bridge.duration,strength:j.fxStrength}]:[])];
  for(const event of events){
  const start=line.start+(Number(event.time)||0),dur=Math.max(.05,Math.min(Number(event.duration)||.35,line.end-start));
  if(t<start||t>=start+dur)continue;
  const k=Math.sin(Math.PI*(t-start)/dur)*Math.max(.1,Math.min(2,Number(event.strength)||1));
  if(event.kind==='flash')flash=Math.max(flash,Math.min(1,k*.8));
  if(event.kind==='invert')invert=Math.max(invert,Math.min(1,k));
  if(event.kind==='blur')blur=Math.max(blur,k*6);
  if(event.kind==='shake'){shakeX+=Math.sin(t*61)*k*8;shakeY+=Math.cos(t*47)*k*6}
  }
 }
 return {filter:[invert?`invert(${invert})`:'',blur?`blur(${blur}px)`:''].filter(Boolean).join(' '),transform:shakeX||shakeY?`translate(${shakeX}px,${shakeY}px) scale(1.02)`:'',flash};
}
