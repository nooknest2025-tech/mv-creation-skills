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
