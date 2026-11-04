import React from 'react';
// 「ライブDVD風」 captions in the editor preview and the MP4 export. Lines whose motion is dvd_* are drawn here (shared drawing:
// src/styles/custom/dvd.tsx) instead of the normal motion path. Fields on the line: text, sub, pre, beat (title), params.dim (dim),
// params.exit (fade-out s), motionDuration (fade-in s), scale, accent (rule colour / subtitle glow), fill, font.
import {dvdDraw,dvdBeat,isDvdMotion,DVD_DEFAULTS} from '../src/styles/custom/dvd';
export const isDvd=(l:any)=>isDvdMotion(l?.motion);
const num=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
export function dvdSpec(l:any,o:{fps?:number,bpm?:number,family?:string}={}){
  const dim=num(l.params?.dim)??(l.motion==='dvd_dim'&&num(l.scale)!==undefined&&l.scale<=1?l.scale:undefined)/* older projects stored the darkness in scale */;
  return {motion:l.motion,text:String(l.text??''),start:l.start,end:l.end,sub:typeof l.sub==='string'?l.sub:undefined,pre:typeof l.pre==='string'?l.pre:undefined,
    enter:num(l.motionDuration)??DVD_DEFAULTS.enter,exit:num(l.params?.exit)??DVD_DEFAULTS.exit,scale:l.motion==='dvd_dim'?1:num(l.scale)??1,
    accent:l.accent,fill:l.fill,glow:l.motion==='dvd_sub'&&l.accent&&l.accent.toLowerCase()!=='#ffffff'?l.accent:undefined,
    font:o.family?`'${o.family}','Noto Sans JP',sans-serif`:undefined,beat:dvdBeat(num(l.beat)??num(l.params?.beat),o.bpm),fps:o.fps,dim};
}
export function dvdLine(l:any,t:number,W:number,H:number,o:{fps?:number,bpm?:number,family?:string}={}):React.ReactNode{return dvdDraw(dvdSpec(l,o),t,W,H).el}
