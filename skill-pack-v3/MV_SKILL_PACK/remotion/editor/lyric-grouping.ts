import {retimeJizura,validateParts,type LyricPart} from './jizura-parts';

const choices=['layout','enter','hold','exit'] as const;
const chars=(s:string)=>Array.from(s);
const sourceParts=(l:any)=>l.sourceParts??[{line:l.id,start:0,end:chars(l.text).length}];
function splitSources(items:any[],count:number){
 const left:any[]=[],right:any[]=[];
 for(const p of items){const size=p.end-p.start;if(count>=size){left.push({...p});count-=size}else if(count<=0)right.push({...p});else{left.push({...p,end:p.start+count});right.push({...p,start:p.start+count});count=0}}
 return [left,right];
}
function inheritedPart(line:any):LyricPart {
 return {text:line.text,start:0,end:line.end-line.start,...Object.fromEntries(choices.filter(k=>line.jizura?.[k]).map(k=>[k,line.jizura[k]]))};
}
function check(parts:LyricPart[],duration:number){const error=validateParts(parts,duration);if(error)throw Error(error+'（表示パートを確認してください）');return parts}

/** Split text/source coverage and its choreography together, without mutating the input. */
export function splitLyric(line:any,count:number,rightId:string):[any,any] {
 const text=chars(line.text),duration=line.end-line.start;
 if(!Number.isInteger(count)||count<1||count>=text.length)throw Error('分ける文字位置を確認してください');
 const boundary=line.start+duration*count/text.length,[a,b]=splitSources(sourceParts(line),count);
 const left={...structuredClone(line),text:text.slice(0,count).join(''),end:boundary,sourceParts:a};
 const right={...structuredClone(line),id:rightId,text:text.slice(count).join(''),start:boundary,sourceParts:b};
 if(!left.text.trim()||!right.text.trim())throw Error('文字のない歌詞になる位置では分けられません');
 if(Array.isArray(line.jizura?.parts)){
  check(line.jizura.parts,duration);
  const buckets:LyricPart[][]=[[],[]];let cursor=0;
  for(const part of line.jizura.parts as LyricPart[]){
   // Recaps/repeated phrases may refer back to earlier characters.
   let at=line.text.indexOf(part.text,cursor);if(at<0)at=line.text.indexOf(part.text);
   if(at<0)throw Error('手動パートに元歌詞と異なる文字があるため分けられません。パートの文字を確認してください');
   cursor=at+part.text.length;const start=chars(line.text.slice(0,at)).length,content=chars(part.text),end=start+content.length;
   for(const [side,lo,hi] of [[0,0,count],[1,count,text.length]] as const){
    const from=Math.max(start,lo),to=Math.min(end,hi);if(to<=from)continue;
    const value=content.slice(from-start,to-start).join('');if(!value.trim())continue;
    buckets[side].push({...part,text:value,start:part.start+(part.end-part.start)*(from-start)/content.length,end:part.start+(part.end-part.start)*(to-start)/content.length});
   }
  }
  for(const [i,out] of [left,right].entries()){
   const selected=buckets[i],span=out.end-out.start;
   if(!selected.length){out.jizura.parts=[inheritedPart(out)];continue}
   // Keep the internal pauses and ordering; fit the selected sequence to its new interval.
   const lo=i===0?0:selected[0].start,hi=i===1?duration:selected.at(-1)!.end;
   out.jizura.parts=check(selected.map(p=>({...p,start:(p.start-lo)*span/(hi-lo),end:Math.min(span,(p.end-lo)*span/(hi-lo))})),span);
  }
 }
 for(const out of [left,right]){
  // Parts were rebuilt above; only scale the line-relative effect timestamps here.
  const saved=out.jizura?.parts;if(saved)delete out.jizura.parts;
  retimeJizura(out,duration);if(saved)out.jizura.parts=saved;
 }
 return [left,right];
}

/** Join all or part of the next row, retaining both texts and editable manual parts. */
export function joinLyrics(line:any,next:any,count:number):any[] {
 const length=chars(next.text).length;
 if(!Number.isInteger(count)||count<1||count>length)throw Error('つなぐ文字数を確認してください');
 const [take,remain]=count===length?[structuredClone(next),null]:splitLyric(next,count,next.id);
 const result={...structuredClone(line),text:line.text+take.text,end:Math.max(line.end,take.end),sourceParts:[...sourceParts(line),...sourceParts(take)]};
 if(line.jizura?.parts||take.jizura?.parts){
  const duration=result.end-result.start,overlap=take.start<line.end;
  const widthA=line.end-line.start,widthB=take.end-take.start;
  const join=duration*widthA/(widthA+widthB);
  const parts=[line,take].flatMap((l,i)=>{
   const own=l.jizura?.parts??[inheritedPart(l)];check(own,l.end-l.start);
   const offset=overlap?(i===0?0:join):l.start-result.start;
   const ratio=overlap?(i===0?join:duration-join)/(l.end-l.start):1;
   return own.map((p:LyricPart)=>({...Object.fromEntries(choices.filter(k=>l.jizura?.[k]).map(k=>[k,l.jizura[k]])),...p,start:offset+p.start*ratio,end:Math.min(duration,offset+p.end*ratio)}));
  });
  result.jizura={...(result.jizura??{}),parts:check(parts,duration)};
 }
 // Keep the first row's effects at their original offsets when extending the row.
 return remain?[result,remain]:[result];
}
