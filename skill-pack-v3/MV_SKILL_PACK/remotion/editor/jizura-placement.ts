export type Bounds={x:number;y:number;w:number;h:number};

/** Place the measured artwork without changing the requested size unless it cannot fit. */
export function placeJizura(line:any,b:Bounds,W:number,H:number,fit=true){
 const padX=W*.05,padY=H*.06,maxW=W-2*padX,maxH=H-2*padY;
 const requested=Number.isFinite(line.scale)?Math.max(.1,Math.min(3,line.scale)):1;
 const angle=Number.isFinite(line.angle)?line.angle:0,rad=angle*Math.PI/180,c=Math.abs(Math.cos(rad)),s=Math.abs(Math.sin(rad));
 const rotatedW=b.w*c+b.h*s,rotatedH=b.w*s+b.h*c;
 let factor=2*requested;
 if(fit)factor=Math.min(factor,maxW/Math.max(1,rotatedW),maxH/Math.max(1,rotatedH));
 const width=rotatedW*factor,height=rotatedH*factor,p=line.position??'manual';
 let x=Number.isFinite(line.boxX)?line.boxX*W:(Number.isFinite(line.x)?line.x:.5)*W-width/2;
 let y=Number.isFinite(line.boxY)?line.boxY*H:(Number.isFinite(line.y)?line.y:.5)*H-height/2;
 if(p!=='manual'&&/^[tcb][lcr]$/.test(p)){
  x=p[1]==='l'?padX:p[1]==='r'?W-padX-width:(W-width)/2;
  y=p[0]==='t'?padY:p[0]==='b'?H-padY-height:(H-height)/2;
 }
 if(fit){x=Math.max(padX,Math.min(W-padX-width,x));y=Math.max(padY,Math.min(H-padY-height,y))}
 const pivotX=x+width/2,pivotY=y+height/2;
 return {x:pivotX-(b.x+b.w/2)*factor,y:pivotY-(b.y+b.h/2)*factor,factor,pivotX,pivotY,angle,bounds:{x,y,w:width,h:height}};
}
