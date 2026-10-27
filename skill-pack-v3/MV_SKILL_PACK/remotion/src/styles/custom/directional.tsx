import {clamp,easeOut} from '../../lib/core';
import {layoutH} from '../layout';
import {drawH,type StyleFn} from '../prims';
/** Opposing line halves; preserve shared glyph, keyword and palette rendering. */
export function directional(axis:'x'|'y',leaving:boolean):StyleFn{return c=>{
 const lay=layoutH(c.L,c.W,c.H,{size:.074,v:c.textY,k:c.k,maxw:.84});
 const duration=Math.max(.1,Number(c.P.enter??.7));
 const enter=clamp((c.t-c.L.tOn)/duration);
 const outDuration=Math.min(.8,Math.max(.15,(c.L.end-c.L.start)*.3));
 const exit=clamp((c.t-(c.L.end-outDuration))/outDuration);
 const offset=leaving?easeOut(exit,2):1-easeOut(enter,3);
 const distance=(axis==='x'?c.W:c.H)*.42;
 return drawH(c,lay,i=>({a:leaving?1-exit:clamp(enter*4),dx:axis==='x'?(i<c.L.chars.length/2?-1:1)*distance*offset:0,dy:axis==='y'?(i<c.L.chars.length/2?-1:1)*distance*offset:0}),{font:'lyrics',sw:.05,exit:'none'});
}}
