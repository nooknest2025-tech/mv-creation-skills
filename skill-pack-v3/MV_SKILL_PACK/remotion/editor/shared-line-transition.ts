/** A cross-engine lyric transition works only across adjacent non-overlapping lines. */
export function lineTransitionStatus(data:any,id:string){
 const lines=(data.lyrics??[]).filter((l:any)=>!l.extra&&!String(l.motion??'').startsWith('dvd_')&&typeof l.text==='string'&&l.text.trim()&&Number.isFinite(l.start)&&Number.isFinite(l.end)&&l.end>l.start).slice().sort((a:any,b:any)=>a.start-b.start);
 const i=lines.findIndex((l:any)=>l.id===id),to=lines[i],kind=to?.jizura?.lineTrans;
 if(!kind)return '';
 if(i<1)return 'この歌詞より前に切り替え元の歌詞がありません。';
 const from=lines[i-1],gap=to.start-from.end,shared=kind.startsWith('shared_');
 if(gap>=.06)return `前の歌詞との間が${gap.toFixed(2)}秒空いているため切り替わりません。時刻を近づけてください。`;
 if(gap<=-.06||(shared&&gap<-.001))return `前の歌詞と${Math.abs(gap).toFixed(2)}秒重なっているため切り替わりません。時刻を調整してください。`;
 if(!shared&&(!data.jizura?.enabled||from.jizura?.engine==='standard'||to.jizura?.engine==='standard'))return 'この切り替えはJIZURA同士で使えます。通常モーションを含む場合は「共通」の切り替えを選んでください。';
 const requested=Number(to.jizura?.lineTransDuration),max=(to.end-to.start)*.45;
 if(Number.isFinite(requested)&&requested>=.1&&requested<=2&&requested>max)return `次の歌詞が短いため、実際の切り替え時間は約${max.toFixed(2)}秒になります。`;
 return 'この歌詞の開始時に切り替えます。';
}

export function sharedLineTransition(data:any,t:number){
 const lines=(data.lyrics??[]).filter((l:any)=>!l.extra&&!String(l.motion??'').startsWith('dvd_')&&Number.isFinite(l.start)&&Number.isFinite(l.end)).slice().sort((a:any,b:any)=>a.start-b.start);
 for(let i=1;i<lines.length;i++){
  const from=lines[i-1],to=lines[i],kind=to.jizura?.lineTrans;if(!['shared_fade','shared_wipe','shared_slide','shared_zoom'].includes(kind)||Math.abs(from.end-to.start)>=.06||from.end>to.start+.001)continue;
  const previousTime=Math.max(from.start+.001,from.end-Math.min(.32,(from.end-from.start)*.25));
  const requested=Number(to.jizura?.lineTransDuration),duration=Number.isFinite(requested)&&requested>=.1&&requested<=2?requested:.35;
  const dur=Math.max(.05,Math.min(duration,(to.end-to.start)*.45));if(t<previousTime||t>=to.start+dur)continue;
  const p=Math.max(0,Math.min(1,(t-to.start)/dur));return {from,to,kind,p,previousTime,fromOpacity:kind==='shared_wipe'||kind==='shared_slide'?1:1-p,toOpacity:kind==='shared_wipe'||kind==='shared_slide'?1:p};
 }
 return null;
}

/** Common geometry for CSS lyric layers and canvas lyric layers. */
export function sharedLineStyle(s:NonNullable<ReturnType<typeof sharedLineTransition>>,previous:boolean,W:number,H:number){
 const p=s.p,opacity=previous?s.fromOpacity:s.toOpacity;
 if(s.kind==='shared_wipe')return {opacity,clipPath:previous?`inset(0 0 0 ${p*100}%)`:`inset(0 ${(1-p)*100}% 0 0)`,translateX:0,scale:1};
 if(s.kind==='shared_slide')return {opacity,clipPath:'',translateX:(previous?-p:1-p)*W,scale:1};
 if(s.kind==='shared_zoom')return {opacity,clipPath:'',translateX:0,scale:previous?1+.12*p:.88+.12*p};
 return {opacity,clipPath:'',translateX:0,scale:1};
}
