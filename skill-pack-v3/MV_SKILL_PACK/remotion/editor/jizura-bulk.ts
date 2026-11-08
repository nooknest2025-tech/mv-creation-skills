// Copy the visual choices, preserving each line's words, timings and manual parts.
const visualKeys=['engine','layout','enter','hold','exit','treat','cam','decor','bg','trans','lineTrans','lineTransDuration','colorMode'] as const;
export function copyJizuraLook(source:any,target:any){
 const next={...(target??{})};
 for(const key of visualKeys){
  if(source?.[key]===undefined)delete next[key];
  else next[key]=structuredClone(source[key]);
 }
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
