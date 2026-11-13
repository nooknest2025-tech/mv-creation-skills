/** A split/trim retains the original animation's clock and random seed. */
export function sceneClock(s:any,index:number,end:number,t:number){
 const c=s.motionClock,offset=Number.isFinite(c?.offset)?c.offset:0,duration=Number.isFinite(c?.duration)&&c.duration>0?c.duration:Math.max(.1,end-s.start);
 return {local:t-s.start+offset,start:s.start-offset,duration,index:Number.isInteger(c?.index)?c.index:index,id:c?.id??s.id};
}
export function keepSceneClocks(sc:any[],duration:number){
 for(let i=0;i<sc.length;i++)if(!sc[i].motionClock)sc[i].motionClock={offset:0,duration:Math.max(.1,(sc[i+1]?.start??duration)-sc[i].start),index:i,id:sc[i].id};
}
