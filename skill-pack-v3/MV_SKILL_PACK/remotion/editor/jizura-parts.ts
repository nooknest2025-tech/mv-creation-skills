export type LyricPart={text:string;start:number;end:number;layout?:string;enter?:string;hold?:string;exit?:string};

// Part timings are relative to the beginning of the containing lyric line.
export function validateParts(parts:unknown,duration:number):string|null {
 if(!Array.isArray(parts)||parts.length<1||parts.length>24)return '表示パートは1〜24個です';
 let previous=0;
 for(const p of parts){
  if(!p||typeof p!=='object'||typeof p.text!=='string'||!p.text.trim()||p.text.length>500)return '各パートに500文字以内の表示文字を入力してください';
  if(!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<0||p.end<=p.start||p.start<previous-.001||p.end>duration+.001)return 'パートは行の範囲内で、開始・終了を重ならない順に入力してください';
  for(const key of ['layout','enter','hold','exit'])if(p[key]!==undefined&&(typeof p[key]!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(p[key])))return 'パートの演出設定を確認してください';
  if(Object.keys(p).some(k=>!['text','start','end','layout','enter','hold','exit'].includes(k)))return 'パートの設定を確認してください';
  previous=p.end;
 }
 return null;
}
type Plan={cuts:any[];events:any[];[key:string]:any};
type MakePart=(part:LyricPart,index:number)=>Plan;
function combine(base:Plan,parts:LyricPart[],make:MakePart):Plan {
 const plans=parts.map(make);
 const cuts=plans.flatMap(p=>p.cuts.filter((c:any)=>c.line===0&&c.utext!=null)).sort((a:any,b:any)=>a.start-b.start).map((c:any,index:number)=>({...c,index}));
 return {...base,cuts,events:plans.flatMap(p=>p.events??[]).sort((a:any,b:any)=>a.t-b.t)};
}
export function applyParts(base:Plan,line:any,make:MakePart):Plan {
 const opts=line.jizura??{},duration=line.end-line.start;
 if(opts.parts) return validateParts(opts.parts,duration)?{...base,cuts:[],events:[]}:combine(base,opts.parts,make);
 if(opts.recap==='off') {
  const cuts=base.cuts.filter((c:any)=>!c.recap).map((c:any)=>({...c}));
  if(cuts.length&&cuts.length!==base.cuts.length){const last=cuts[cuts.length-1];last.end=line.end;last.dur=last.end-last.start;}
  cuts.forEach((c:any,i:number)=>c.index=i);
  return {...base,cuts};
 }
 if(opts.recap==='on'&&!base.cuts.some((c:any)=>c.recap)) {
  const cuts=base.cuts.filter((c:any)=>c.line===0&&c.utext!=null);
  if(!cuts.length)return base;
  const parts:LyricPart[]=cuts.map((c:any)=>({text:String(c.utext),start:Math.max(0,c.start-line.start),end:Math.min(duration,c.end-line.start)}));
  const last=parts[parts.length-1],span=last.end-last.start;
  if(span<.002)return base;
  const boundary=last.end-Math.min(1,span*.45);last.end=boundary;
  parts.push({text:line.text,start:boundary,end:duration});
  return combine(base,parts,make);
 }
 return base;
}
