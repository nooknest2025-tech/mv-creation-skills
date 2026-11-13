// Copy the visual choices, preserving each line's words, timings and manual parts.
const visualKeys=['engine','layout','enter','hold','exit','treat','cam','decor','bg','trans','lineTrans','lineTransDuration','colorMode','fx','fxScope','fxStrength','fxTime','screenFx','screenFxTime','screenFxDuration','screenFxStrength'] as const;
export function copyJizuraLook(source:any,target:any,sourceDuration?:number,targetDuration?:number){
 const next={...(target??{})};
 for(const key of visualKeys){
  if(source?.[key]===undefined)delete next[key];
  else next[key]=structuredClone(source[key]);
 }
 const ratio=sourceDuration&&targetDuration?targetDuration/sourceDuration:1;
 for(const key of ['fxTime','screenFxTime'])if(Number.isFinite(next[key]))next[key]=Math.max(0,Math.min(targetDuration?(key==='screenFxTime'?Math.max(0,targetDuration-1e-6):targetDuration):Infinity,next[key]*ratio));
 // The target's words/timing stay intact, while explicit row choices win over old part choices.
 if(Array.isArray(next.parts))next.parts=next.parts.map((part:any)=>{const p={...part};for(const key of ['layout','enter','hold','exit']){if(source?.[key]===undefined)delete p[key];else p[key]=source[key]}return p});
 return Object.keys(next).length?next:undefined;
}

/** Copy placement and wrapping without changing other per-line motion parameters. */
export function copyLyricLayout(source:any,target:any){
 const params={...(target.params??{})};
 if(source.params?.noWrap)params.noWrap=true;
 else delete params.noWrap;
 return {x:source.x,boxX:source.boxX,boxY:source.boxY,stageStyle:source.stageStyle,
  params:Object.keys(params).length?params:undefined};
}
