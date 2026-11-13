import {editorLook} from '../src/lib/editorLook';
import {copyJizuraLook,copyLyricLayout} from './jizura-bulk';
import {applyStandardMotion} from './line-engine';

export function setLyricY(line:any,y:number){line.y=y;line.position='manual';delete line.boxY}

/** Apply the same edit path used by the UI, keeping undo records for every changed field. */
export function applyLyricSettings(data:any,source:any,targets:any[],kind:string,sampleMotion?:string|null){
 const keys=kind==='motion'?['motion']:kind==='font'?['font']:kind==='colors'?['fill','accent','stroke']:['motion','font','scale','y','position','angle','effect','effectOffset','opacity','entrance','departure','transitionDuration','motionDuration','fill','accent','stroke'];
 const defaults:any={font:'noto_serif',fill:'#f8f3e6',accent:'#e6aa96',stroke:'#1f271f',angle:0,position:'manual',effect:'none',effectOffset:6,opacity:1,entrance:'none',departure:'none',transitionDuration:.7};
 const changes:any[]=[],original=structuredClone(source);
 const set=(l:any,key:string,value:any)=>{changes.push({id:l.id,key,before:l[key],after:value});if(value===undefined)delete l[key];else l[key]=value};
 for(const l of targets){
  for(const key of keys){const value=key==='motion'?(sampleMotion??original.motion):(original[key]??(editorLook(original) as any)[key]??defaults[key]);if(value!==undefined)set(l,key,value)}
  if(kind==='motion'){
   const before=l.jizura;applyStandardMotion(data,l,l.motion);changes.push({id:l.id,key:'jizura',before,after:l.jizura});
  }
  if(kind==='look'){
   for(const [key,value] of Object.entries(copyLyricLayout(original,l)))set(l,key,value);
   set(l,'jizura',copyJizuraLook(original.jizura,l.jizura,original.end-original.start,l.end-l.start));
  }
 }
 return changes;
}
