import React from 'react';
import FONT_OPTIONS from './font-options.json';
import '../vendor/jizura/engine.js';
import {placeJizura,type Bounds} from './jizura-placement';
import {applyParts,type LyricPart} from './jizura-parts';
import {effectFilter} from '../src/lib/lyricEdits';
import {sharedLineTransition,sharedLineStyle} from './shared-line-transition';

// JIZURA is MIT-licensed; see vendor/jizura/LICENSE and INTEGRATION.md.
const lyricLines=(data:any)=>(data.lyrics??[]).filter((l:any)=>l.extra!==true&&l.jizura?.engine!=='standard'&&!String(l.motion??'').startsWith('dvd_')&&typeof l.text==='string'&&l.text.trim()&&Number.isFinite(l.start)&&Number.isFinite(l.end)&&l.end>l.start).slice().sort((a:any,b:any)=>a.start-b.start);
export function projectFor(data:any,J:any) {
  const aspect=data.width/data.height;
  const choices:[string,number][]=[['16:9',16/9],['9:16',9/16],['1:1',1],['4:5',4/5],['4:3',4/3],['3:4',3/4],['21:9',21/9]];
  const shape=choices.reduce((a,b)=>Math.abs(a[1]-aspect)<Math.abs(b[1]-aspect)?a:b)[0];
  const stamp=(s:number)=>{const n=Math.max(0,Math.round(s*100));return `${String(Math.floor(n/6000)).padStart(2,'0')}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`};
  const lines=lyricLines(data), lyrics=lines.map((l:any)=>`[${stamp(l.start)}]${l.text.replace(/[\r\n]+/g,' ')}`).join('\n');
  const overrides=Object.fromEntries(lines.map((l:any,i:number)=>[i,l.jizura]).filter(([,v]:any)=>v&&Object.keys(v).length));
  const settings=data.jizura??{};
  return {...J.defaultProject(),lyrics,overrides,title:'',artist:'',aspect:shape,fps:data.fps??30,style:settings.style??'mono',seed:settings.seed??20260922,unify:true,wa:false,extra:true,typeset:false,timing:{...J.defaultProject().timing,snap:false},fx:{...J.defaultProject().fx,flash:false,glitch:0,chroma:0,texture:0,hud:'off',motion:settings.motion??0.45,decor:settings.decor??0.3}};
}
const fontCaches=new WeakMap<object,Map<string,{metrics:Map<any,any>;glyphs:Map<any,any>;tint:Map<any,any>}>>();
// Apply the selected editor font to JIZURA's canvas text during planning and drawing.
export function supportsJizuraNoWrap(line:any){const safe=(v:any)=>v==='center'||v==='type';return safe(line?.jizura?.layout)&&(!Array.isArray(line.jizura.parts)||line.jizura.parts.every((p:any)=>!p.layout||safe(p.layout)))}
function withFont<T>(J:any,family:string|undefined,fn:()=>T,noWrap=false):T {
  const originalSplit=J.splitLines;
  if(noWrap&&originalSplit)J.splitLines=(text:string)=>String(text).replace(/[\r\n]+/g,' ');
  if(!family){try{return fn()}finally{if(originalSplit)J.splitLines=originalSplit}}
  const original=J.fontCSS, originalVar=J.varFontCSS, oldMetrics=J.metrics?.m, oldGlyphs=J.glyphs?.map, oldTint=J.glyphs?.tint;
  let all=fontCaches.get(J);if(!all){all=new Map();fontCaches.set(J,all)}
  let cache=all.get(family);if(!cache){cache={metrics:new Map(),glyphs:new Map(),tint:new Map()};all.set(family,cache)}
  if(J.metrics)J.metrics.m=cache.metrics;if(J.glyphs){J.glyphs.map=cache.glyphs;J.glyphs.tint=cache.tint}
  const replace=(css:string)=>css.replace(/px\s+.+$/,`px ${JSON.stringify(family)}, sans-serif`);
  J.fontCSS=(key:string,px:number)=>replace(original(key,px));
  if(originalVar)J.varFontCSS=(key:string,px:number,e:number)=>replace(originalVar(key,px,e));
  try{return fn()}finally{if(originalSplit)J.splitLines=originalSplit;J.fontCSS=original;if(originalVar)J.varFontCSS=originalVar;if(J.metrics)J.metrics.m=oldMetrics;if(J.glyphs){J.glyphs.map=oldGlyphs;J.glyphs.tint=oldTint}}
}
export function linePosition(l:any) {
  const p=l.position??'manual';
  if(p!=='manual'&&/^[tcb][lcr]$/.test(p))return {x:p[1]==='l'?.1:p[1]==='r'?.9:.5,y:p[0]==='t'?.1:p[0]==='b'?.9:.5};
  return {x:Number.isFinite(l.boxX)?l.boxX:Number.isFinite(l.x)?l.x:.5,y:Number.isFinite(l.boxY)?l.boxY:Number.isFinite(l.y)?l.y:.5};
}
export function beatsForData(data:any):number[] {
  if(Array.isArray(data.beats)&&data.beats.length>=2)return [...data.beats];
  const bpm=Number(data.bpm)||120,phase=Number(data.phase)||0,beats:number[]=[];
  for(let x=Math.max(0,phase);x<data.duration;x+=60/bpm)beats.push(x);
  return beats;
}
export function plansFor(data:any,J:any,beats:number[]) {
  const common=projectFor(data,J);
  return lyricLines(data).map((line:any,index:number)=>{
    const family=FONT_OPTIONS.find(f=>f.id===line.font)?.family;
    const {parts:_,recap:__,seed:lineSeed,colorMode,engine,fx:lineFx,fxScope,fxTime,fxStrength,lineTrans,lineTransDuration,screenFx,screenFxTime,screenFxDuration,screenFxStrength,...overrides}=line.jizura??{};
    const changed=new Set(line.edited??[]), useColor=colorMode==='editor'||(colorMode!=='style'&&['fill','accent','stroke'].some(k=>changed.has(k)));
    const colors=useColor?{enabled:true,accentOn:true,...(line.fill?{fg:line.fill}:{}),...(line.accent?{accent:line.accent}:{}),...(line.stroke?{sub:line.stroke}:{})}:undefined;
    const project={...common,...(colors?{colors}:{}),...(lineFx==='chroma'?{fx:{...common.fx,chroma:.7}}:{}),seed:Number.isInteger(lineSeed)?lineSeed:(Number(common.seed)+index*7919)>>>0,overrides:Object.keys(overrides).length?{0:overrides}:{},mvEditorLines:[{text:line.text.replace(/[\r\n]+/g,' '),start:line.start,end:line.end}]};
    const audio={duration:data.duration,beats};
    const plan=withFont(J,family,()=>{
      const base=J.plan(project,audio);
      if(!Array.isArray(base.cuts))return base;
      const planned=applyParts(base,line,(part:LyricPart,i:number)=>{
        const partOverrides={...overrides,...Object.fromEntries(['layout','enter','hold','exit'].filter(k=>(part as any)[k]).map(k=>[k,(part as any)[k]])),single:true};
        return J.plan({...project,seed:(project.seed+i*104729)>>>0,overrides:{0:partOverrides},mvEditorLines:[{text:part.text.replace(/[\r\n]+/g,' '),start:line.start+part.start,end:line.start+part.end}]},audio);
      });
      // A deliberate background choice wins even for layouts that suppress random backgrounds.
      const background=overrides.bg&&J.BG?.[overrides.bg];
      if(background)for(let i=0;i<planned.cuts.length;i++){
        const cut=planned.cuts[i];cut.bg=overrides.bg;
        cut.bgP=background.plan?background.plan(J.rng(J.h(project.seed,i,94)),planned.style):{};
      }
      // Individual manual parts are planned independently, so join touching cuts explicitly.
      const transition=line.jizura?.trans,TD=transition&&J.TRANS?.[transition];
      if(TD&&Array.isArray(line.jizura?.parts))for(let i=1;i<planned.cuts.length;i++){
        const prev=planned.cuts[i-1],cut=planned.cuts[i],duration=cut.end-cut.start;
        if(Math.abs(prev.end-cut.start)>=.06||duration<=.5)continue;
        const rng=J.rng(J.h(project.seed,i,96));cut.trans=transition;cut.transP=TD.plan?TD.plan(rng,planned.style):{};cut.transDur=Math.max(.12,Math.min(TD.dur||.35,.6,duration*.45));cut.enter='cut';cut.inDur=.12;prev.exit='cut';prev.outDur=0;
      }
      if(changed.has('motionDuration')&&Number.isFinite(line.motionDuration))for(const cut of planned.cuts){
        if(cut.trans||cut.morph||cut.enter==='cut')continue;
        const span=Math.max(.01,cut.end-cut.start),out=Math.max(0,Number(cut.outDur)||0);
        cut.inDur=Math.max(.01,Math.min(line.motionDuration,span*.92-out));
      }
      const event=fxScope!=='screen'&&lineFx&&J.FXE?.[lineFx];
      if(event){const start=line.start+Math.max(0,Math.min(line.end-line.start,Number(fxTime)||0));planned.events=[...planned.events,{t:start,type:lineFx,amp:(event.amp||1)*(Number(fxStrength)||1),dur:(event.dur||4)/24}].sort((a:any,b:any)=>a.t-b.t)}
      return planned;
    },!!line.params?.noWrap&&supportsJizuraNoWrap(line));
    return {line,family,plan};
  });
}
function measureArtwork(J:any,renderer:any,tc:CanvasRenderingContext2D,item:any,W:number,H:number,fast:boolean):Bounds {
  const {line,plan,family}=item, small=document.createElement('canvas');small.width=320;small.height=Math.max(1,Math.round(320*H/W));
  const sx=small.getContext('2d',{willReadFrequently:true});if(!sx)return {x:W*.25,y:H*.25,w:W*.5,h:H*.5};
  const cuts=plan.cuts.filter((c:any)=>c.line===0&&c.end>line.start&&c.start<line.end);
  const times=cuts.flatMap((c:any)=>[.05,.2,.5,.8,.95,.99].map(f=>c.start+(c.end-c.start)*f)).slice(0,72);
  if(!times.length)times.push((line.start+line.end)/2);
  let left=small.width,top=small.height,right=-1,bottom=-1;
  for(const time of times){
    // Measure on the small canvas directly rather than rendering six full-size
    // frames and shrinking each one before scanning its pixels.
    if(fast)withFont(J,family,()=>renderer.frame(sx,plan,time,{scale:small.width/plan.W/2,offsetX:small.width/4,offsetY:small.height/4,transparent:true,noTrans:!line.jizura?.trans,noPost:!line.jizura?.fx||line.jizura?.fxScope==='screen'}),!!line.params?.noWrap&&supportsJizuraNoWrap(line));
    else {withFont(J,family,()=>renderer.frame(tc,plan,time,{scale:W/plan.W/2,offsetX:W/4,offsetY:H/4,transparent:true,noTrans:!line.jizura?.trans,noPost:!line.jizura?.fx||line.jizura?.fxScope==='screen'}),!!line.params?.noWrap&&supportsJizuraNoWrap(line));sx.clearRect(0,0,small.width,small.height);sx.drawImage(tc.canvas,0,0,small.width,small.height)}
    const rgba=sx.getImageData(0,0,small.width,small.height).data;
    for(let y=0;y<small.height;y++)for(let x=0;x<small.width;x++)if(rgba[(y*small.width+x)*4+3]>=16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  }
  if(right<left)return {x:W*.25,y:H*.25,w:W*.5,h:H*.5};
  const px=W/small.width,py=H/small.height;
  return {x:Math.max(0,left*px-2*px),y:Math.max(0,top*py-2*py),w:Math.min(W,(right-left+5)*px),h:Math.min(H,(bottom-top+5)*py)};
}
/** Apply shared editor effects to the rendered JIZURA composition, including its decoration. */
export function drawPlacedJizura(ctx:CanvasRenderingContext2D,temp:HTMLCanvasElement,line:any,t:number,W:number,H:number,p:ReturnType<typeof placeJizura>,effectScale=1){
  const effect=line.effect??'none',offset=Math.max(1,Math.min(24,Number(line.effectOffset)||6));
  const duration=Math.max(.05,Math.min(Number(line.transitionDuration)||.7,(line.end-line.start)/2));
  const progress=Math.max(0,Math.min(1,(t-line.start)/duration)),leaving=Math.max(0,Math.min(1,(t-(line.end-duration))/duration));
  const kind=progress<1&&line.entrance&&line.entrance!=='none'?line.entrance:leaving>0&&line.departure&&line.departure!=='none'?line.departure:'none';
  const amount=progress<1&&line.entrance&&line.entrance!=='none'?Math.pow(1-progress,3):leaving*leaving;
  const tint=(color:string)=>{const c=document.createElement('canvas');c.width=temp.width;c.height=temp.height;const x=c.getContext('2d');if(!x)return temp;x.drawImage(temp,0,0);x.globalCompositeOperation='source-in';x.fillStyle=color;x.fillRect(0,0,c.width,c.height);return c};
  const cyan=effect==='rgb'?tint('#58dce6'):null,magenta=effect==='rgb'?tint('#ff75ad'):null;
  const lineOpacity=Math.max(0,Math.min(1,Number.isFinite(line.opacity)?line.opacity:1));
  // MV fix: fade the finished look (fill + outline filter) as one layer; globalAlpha before ctx.filter lets the dark outline show through the fill.
  const layerCanvas=lineOpacity<1&&typeof document!=='undefined'?document.createElement('canvas'):null;
  if(layerCanvas){layerCanvas.width=ctx.canvas.width;layerCanvas.height=ctx.canvas.height}
  const draw=(dx:number,dy:number,alpha:number,split:number)=>{
    const target=ctx;let ctx2=target;
    if(layerCanvas){const l=layerCanvas.getContext('2d');if(l){l.setTransform(1,0,0,1,0,0);l.clearRect(0,0,layerCanvas.width,layerCanvas.height);l.setTransform(target.getTransform());ctx2=l}}
    drawOne(ctx2,dx,dy,ctx2===target?alpha*lineOpacity:alpha,split);
    if(ctx2!==target){target.save();target.setTransform(1,0,0,1,0,0);target.globalAlpha*=lineOpacity;target.drawImage(layerCanvas as HTMLCanvasElement,0,0);target.restore()}
  };
  const drawOne=(ctx:CanvasRenderingContext2D,dx:number,dy:number,alpha:number,split:number)=>{
    ctx.save();ctx.translate(dx,dy);ctx.globalAlpha*=alpha;
    if(split){ctx.beginPath();if(kind==='lr')ctx.rect(split<0?0:p.pivotX,0,split<0?p.pivotX:W-p.pivotX,H);else ctx.rect(0,split<0?0:p.pivotY,W,split<0?p.pivotY:H-p.pivotY);ctx.clip()}
    ctx.translate(p.pivotX,p.pivotY);ctx.rotate(p.angle*Math.PI/180);ctx.translate(-p.pivotX,-p.pivotY);
    const image=(img:CanvasImageSource,x=0,y=0)=>ctx.drawImage(img,p.x+x,p.y+y,W*p.factor,H*p.factor);
    if(effect==='double'||effect==='rgb'){ctx.save();ctx.globalAlpha*=.5;image(cyan??temp,offset*effectScale,offset*effectScale);if(magenta)image(magenta,-offset*effectScale,0);ctx.restore()}
    ctx.filter=effectFilter(effect,offset,line.stroke,effectScale)??'none';image(temp);ctx.restore();
  };
  if(kind==='lr'||kind==='tb')for(const sign of [-1,1])draw(kind==='lr'?sign*W*.42*amount:0,kind==='tb'?sign*H*.42*amount:0,1-amount*.8,sign);
  else draw(0,0,kind==='fade'?1-amount:1,0);
}
export function JizuraStage({data,t,W,H,fastMeasure=false}:{data:any;t:number;W:number;H:number;fastMeasure?:boolean}) {
  const canvas=React.useRef<HTMLCanvasElement>(null),scratch=React.useRef<HTMLCanvasElement|null>(null),backgroundScratch=React.useRef<HTMLCanvasElement|null>(null),joins=React.useRef<HTMLCanvasElement[]>([]),renderer=React.useRef<any>(null),cache=React.useRef<{key:string;plans:any[]}|null>(null);
  const key=JSON.stringify({lyrics:data.lyrics,duration:data.duration,fps:data.fps,bpm:data.bpm,phase:data.phase,beats:data.beats,settings:data.jizura,W,H});
  React.useLayoutEffect(()=>{
    const J=(window as any).J,el=canvas.current;if(!J?.Renderer||!el)return;
    try {
      if(!cache.current||cache.current.key!==key){
        cache.current={key,plans:plansFor(data,J,beatsForData(data))};
      }
      renderer.current??=new J.Renderer();scratch.current??=document.createElement('canvas');
      const temp=scratch.current;if(temp.width!==W)temp.width=W;if(temp.height!==H)temp.height=H;
      const ctx=el.getContext('2d'),tc=temp.getContext('2d'),plans=cache.current.plans;if(!ctx||!tc)return;
      ctx.clearRect(0,0,W,H);
      if(data.jizura?.background==='jizura'&&plans.length){const p=plans[0].plan;renderer.current.frame(ctx,{...p,cuts:[],events:[]},t,{scale:W/p.W});}
      if(t>=data.duration-1)return;
      if(data.jizura?.background==='jizura')for(const item of plans){const {line,plan}=item;if(t<line.start||t>=line.end||!line.jizura?.bg||line.jizura.bg==='none')continue;
        backgroundScratch.current??=document.createElement('canvas');const bg=backgroundScratch.current;if(bg.width!==W)bg.width=W;if(bg.height!==H)bg.height=H;const bc=bg.getContext('2d');if(!bc)continue;
        const bgPlan={...plan,cuts:plan.cuts.map((c:any)=>({...c,decor:[]}))};renderer.current.frame(bc,bgPlan,t,{scale:W/plan.W,transparent:true,layer:'back',noTrans:true,noPost:true,noHud:true});ctx.drawImage(bg,0,0);
      }
      const drawLine=(target:CanvasRenderingContext2D,item:any,time:number)=>{const {line,plan,family}=item;
        item.bounds??=measureArtwork(J,renderer.current,tc,item,W,H,fastMeasure);
        withFont(J,family,()=>renderer.current.frame(tc,plan,time,{scale:W/plan.W/2,offsetX:W/4,offsetY:H/4,transparent:true,noTrans:!line.jizura?.trans,noPost:!line.jizura?.fx||line.jizura?.fxScope==='screen'}),!!line.params?.noWrap&&supportsJizuraNoWrap(line));
        const placement=placeJizura(line,item.bounds,W,H,data.jizura?.fit!==false);drawPlacedJizura(target,temp,line,time,W,H,placement,fastMeasure?W/data.width:1);
      };
      const shared=sharedLineTransition(data,t);
      for(let i=0;i<plans.length;i++){const item=plans[i],{line,plan}=item,isPrevious=shared?.from.id===line.id;if((t<line.start||t>=line.end)&&!isPrevious)continue;
        if(shared&&(isPrevious||shared.to.id===line.id)){const style=sharedLineStyle(shared,isPrevious,W,H);ctx.save();ctx.globalAlpha*=style.opacity;if(shared.kind==='shared_wipe'){ctx.beginPath();ctx.rect(isPrevious?shared.p*W:0,0,isPrevious?(1-shared.p)*W:shared.p*W,H);ctx.clip()}ctx.translate(style.translateX+W/2,H/2);ctx.scale(style.scale,style.scale);ctx.translate(-W/2,-H/2);drawLine(ctx,item,isPrevious?shared.previousTime:t);ctx.restore();continue}
        const prev=plans[i-1],key=line.jizura?.lineTrans,TD=key&&J.TRANS?.[key],requested=Number(line.jizura?.lineTransDuration),duration=Math.max(.05,Math.min(Number.isFinite(requested)&&requested>=.1&&requested<=2?requested:Math.min(TD?.dur||.35,.6),(line.end-line.start)*.45));
        if(TD&&prev&&Math.abs(prev.line.end-line.start)<.06&&t-line.start<duration){
          while(joins.current.length<3)joins.current.push(document.createElement('canvas'));
          for(const c of joins.current){if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;c.getContext('2d')?.clearRect(0,0,W,H)}
          const [A,B,C]=joins.current,ax=A.getContext('2d'),bx=B.getContext('2d'),cx=C.getContext('2d');if(!ax||!bx||!cx){drawLine(ctx,item,t);continue}
          drawLine(ax,prev,Math.max(prev.line.start,prev.line.end-.001));drawLine(bx,item,t);
          const sc=plan.style.schemes[0],psc=prev.plan.style.schemes[0],rng=J.rng(J.h(plan.seed||0,i,96)),P=TD.plan?TD.plan(rng,plan.style):{};
          try{TD.draw(cx,A,B,J.clamp((t-line.start)/duration),{cw:W,ch:H,sc,scPrev:psc,st:plan.style,P,step:Math.floor(t*24),t,scale:W/plan.W,allowFilter:true,seed:plan.seed|0,tmp:(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c}});ctx.drawImage(C,0,0)}catch(e){console.warn('JIZURA line transition failed',e);drawLine(ctx,item,t)}
        }else drawLine(ctx,item,t);
      }
    } catch(e){console.error('JIZURA preview failed',e)}
  },[key,t,W,H,fastMeasure]);
  return <canvas ref={canvas} width={W} height={H} style={{position:'absolute',inset:0,width:W,height:H,pointerEvents:'none'}}/>;
}
