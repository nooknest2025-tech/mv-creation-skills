/** One independent upper visual track. Times are absolute project seconds. */
export type OverlayClip = { id: string; asset: number; start: number; end: number; from: number; x: number; y: number; w: number; h: number; opacity: number;rate?:number };
const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export function makeOverlay(id: string, asset: number, at: number, duration: number, clipDuration?: number): OverlayClip | null {
  const start = clamp(at, 0, duration);
  const end = Math.min(duration, start + Math.min(4, clipDuration && clipDuration > 0 ? clipDuration : 4));
  if (end - start < 0.05) return null;
  return { id, asset, start: round(start), end: round(end), from: 0, x: 0, y: 0, w: 1, h: 1, opacity: 1 };
}
/** Clips may overlap: later entries render on top and remain selectable in the list. */
export function moveOverlay(clip: OverlayClip, start: number, duration: number) {
  const len = clip.end - clip.start, s = clamp(start, 0, Math.max(0, duration - len));
  clip.start = round(s); clip.end = round(s + len);
}
/** Resizing the left edge also moves the video in-point; moving the clip does not. */
export function resizeOverlay(clip: OverlayClip, original: OverlayClip, edge: 'start' | 'end', at: number, duration: number, video: boolean, clipDuration?: number) {
  if (edge === 'start') {
    const rate=original.rate??1;
    const minStart = video ? Math.max(0, original.start - original.from/rate) : 0;
    const maxStart = video && clipDuration ? Math.min(original.end - 0.05, original.start + Math.max(0, clipDuration - 0.001 - original.from)/rate) : original.end - 0.05;
    const start = clamp(at, minStart, maxStart);
    clip.start = round(start); if (video) clip.from = round(original.from + (start - original.start)*rate);
  } else clip.end = round(clamp(at, original.start + 0.05, duration));
}

export function moveOverlayPicture(clip:OverlayClip,x:number,y:number){clip.x=round(clamp(x,-1,1));clip.y=round(clamp(y,-1,1))}
export function resizeOverlayPicture(clip:OverlayClip,key:'w'|'h',value:number,keepAspect=true){
 const scale=value/clip[key];if(keepAspect){const actual=clamp(scale,Math.max(.05/clip.w,.05/clip.h),Math.min(2/clip.w,2/clip.h));clip.w=round(clip.w*actual);clip.h=round(clip.h*actual)}else clip[key]=round(clamp(value,.05,2));
}
