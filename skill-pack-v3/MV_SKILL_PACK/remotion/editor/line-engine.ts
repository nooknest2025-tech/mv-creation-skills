/** Enable JIZURA for one line while preserving the visible mode of other lines. */
export function setLineEngine(data:any,line:any,engine:'standard'|'jizura'){
 if(engine==='standard'){
  line.jizura={...(line.jizura??{}),engine:'standard'};
  return;
 }
 if(!data.jizura?.enabled){
  for(const other of data.lyrics??[]){
   if(other.id!==line.id&&!other.extra&&!String(other.motion??'').startsWith('dvd_'))other.jizura={...(other.jizura??{}),engine:'standard'};
  }
 }
 const j={...(line.jizura??{})};delete j.engine;
 if(Object.keys(j).length)line.jizura=j;else delete line.jizura;
 data.jizura={...(data.jizura??{}),enabled:true};
}

/** Choosing a named standard motion must also choose its renderer. */
export function applyStandardMotion(data:any,line:any,motion:string){
 line.motion=motion;setLineEngine(data,line,'standard');
}

export function motionSample(data:any,line:any,motion:string){
 const demo=structuredClone(data),sample={...structuredClone(line),start:0,end:3.5};
 demo.lyrics=[sample];applyStandardMotion(demo,sample,motion);return demo;
}
