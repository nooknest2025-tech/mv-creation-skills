import {moveOverlayPicture,type OverlayClip} from './overlay-track';

export function installOverlayTransform(screen:HTMLElement,stage:HTMLElement,o:{selected:()=>OverlayClip|undefined;enabled:()=>boolean;draw:()=>void;changed:()=>void;refresh:()=>void}){
 let drag:{clip:OverlayClip;x:number;y:number;px:number;py:number;width:number;height:number}|null=null;
 screen.addEventListener('pointerdown',e=>{
  const clip=o.selected();if(!clip||!o.enabled()||e.button!==0||(e.target as HTMLElement).closest('button,input,select,#previewTransformPanel'))return;
  const r=stage.getBoundingClientRect();drag={clip,x:clip.x,y:clip.y,px:e.clientX,py:e.clientY,width:r.width,height:r.height};screen.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();
 },true);
 screen.addEventListener('pointermove',e=>{if(!drag)return;moveOverlayPicture(drag.clip,drag.x+(e.clientX-drag.px)/drag.width,drag.y+(e.clientY-drag.py)/drag.height);o.draw()},true);
 const end=()=>{if(!drag)return;drag=null;o.changed();o.refresh()};screen.addEventListener('pointerup',end,true);screen.addEventListener('pointercancel',end,true);
}
