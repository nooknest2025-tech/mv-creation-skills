import { makeOverlay, resizeOverlay,resizeOverlayPicture, type OverlayClip } from './overlay-track';

type Ctx = { data: () => any; now: () => number; asset: () => number; video: (a: any) => boolean; change: () => void; error: (s: string) => void; refresh: () => void;cue:(at:number)=>void;getMove:()=>boolean;setMove:(on:boolean)=>void };
export function overlayPanel(host: HTMLElement, ctx: Ctx) {
  let id: string | null = null,keepAspect=true;
  const clips = (): OverlayClip[] => ctx.data().overlays ?? [];
  const selected = () => clips().find(o => o.id === id);
  const draw = () => {
    const d = ctx.data(); if (id && !selected()) id = null; const o = selected(); host.replaceChildren();
    const title = document.createElement('strong'); title.textContent = '上段（重ねる映像）'; host.append(title);
    const list = document.createElement('select'); list.setAttribute('aria-label', '重ねる映像を選択');
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = '上段の映像を選択'; list.append(empty);
    for (const c of clips()) { const opt = document.createElement('option'); opt.value = c.id; const a = d.assets[c.asset]; opt.textContent = `${c.start.toFixed(2)}–${c.end.toFixed(2)}秒 ${a?.label ?? (typeof a === 'string' ? a : a?.src) ?? '素材'}`; list.append(opt); }
    list.value = id ?? ''; list.onchange = () => { id = list.value || null; const clip=selected();if(clip&&(ctx.now()<clip.start||ctx.now()>=clip.end))ctx.cue(clip.start);draw(); ctx.refresh(); }; host.append(list);
    const add = document.createElement('button'); add.textContent = '＋上段に重ねる'; add.onclick = () => {
      const asset = ctx.asset(), a = d.assets[asset];
      if (!a || (typeof a === 'object' && a.kind === 'tachie')) return ctx.error('上段には画像か動画の素材を選んでください');
      if (clips().length >= 100) return ctx.error('上段に追加できるのは100個までです');
      const next = makeOverlay(`OVER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, asset, ctx.now(), d.duration, ctx.video(a) && typeof a === 'object' ? a.duration : undefined);
      if (!next) return ctx.error('曲の終わりより前に赤い線を移動してください');
      (d.overlays ??= []).push(next); id = next.id; ctx.error(''); ctx.change(); draw();
    }; host.append(add);
    if (!o) { const hint = document.createElement('span'); hint.textContent = '素材を選び、赤い線の位置に追加します。上段の長さと位置は下段と別に編集できます。'; host.append(hint); return; }
    const remove = document.createElement('button'); remove.textContent = '選択した上段を削除'; remove.onclick = () => { d.overlays = clips().filter(c => c.id !== id); id = null; ctx.change(); draw(); }; host.append(remove);
    const assetLabel=document.createElement('label');assetLabel.textContent='上段の素材 ';const assetChoice=document.createElement('select');assetChoice.setAttribute('aria-label','上段の素材を差し替える');
    d.assets.forEach((a:any,i:number)=>{if(a?.kind==='tachie')return;const op=document.createElement('option');op.value=String(i);op.textContent=a?.label??(typeof a==='string'?a:a.src);assetChoice.append(op)});assetChoice.value=String(o.asset);assetChoice.onchange=()=>{o.asset=Number(assetChoice.value);o.from=0;ctx.change();draw()};assetLabel.append(assetChoice);host.append(assetLabel);
    for(const [name,checked,set] of [['画面上で上段を移動',ctx.getMove(),(v:boolean)=>ctx.setMove(v)],['縦横比を保つ',keepAspect,(v:boolean)=>{keepAspect=v}]] as const){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=checked;box.setAttribute('aria-label',name);box.onchange=()=>set(box.checked);label.append(box,name);host.append(label)}
    const fields: [string, keyof OverlayClip, number, number, number, number][] = [
      ['開始秒', 'start', 0, d.duration, .05, 1], ['終了秒', 'end', 0, d.duration, .05, 1],
      ['素材の開始秒', 'from', 0, 36000, .05, 1], ['左位置 %', 'x', -100, 100, 1, 100], ['上位置 %', 'y', -100, 100, 1, 100],
      ['幅 %', 'w', 5, 200, 1, 100], ['高さ %', 'h', 5, 200, 1, 100], ['不透明度 %', 'opacity', 0, 100, 1, 100],
    ];
    if(ctx.video(d.assets[o.asset]))fields.push(['動画の速さ（倍）','rate',.1,4,.05,1]);
    const box = document.createElement('div'); box.className = 'overlayFields';
    for (const [name, key, min, max, step, factor] of fields) {
      const label = document.createElement('label'); label.textContent = name + ' ';
      const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(Math.round(((o[key]??1) as number) * factor * 1000) / 1000); input.setAttribute('aria-label', `上段 ${name}`);
      input.onchange = () => {
        const v = Number(input.value) / factor, n = { ...o, [key]: v }, a = d.assets[n.asset], len = typeof a === 'object' ? a.duration : undefined;
        if (key === 'start' && Number.isFinite(v)) { resizeOverlay(n, o, 'start', v, d.duration, ctx.video(a), len); if (Math.abs(n.start - v) > .001) { ctx.error('素材の開始位置と動画の長さを確認してください'); input.value = String(o.start); return; } }
        if((key==='w'||key==='h')&&Number.isFinite(v)){n[key]=o[key];resizeOverlayPicture(n,key,v,keepAspect);}
        const ok = input.value !== '' && Number.isFinite(v) && v >= min / factor && v <= max / factor && n.end - n.start >= .049 && n.end <= d.duration && !(ctx.video(a) && Number.isFinite(len) && len > 0 && n.from >= len);
        if (!ok) { ctx.error('上段の時間・位置・大きさを確認してください'); input.value = String(((o[key]??1) as number) * factor); return; }
        Object.assign(o, n); ctx.error(''); ctx.change(); draw();
      };
      label.append(input); box.append(label);
    }
    host.append(box);
    const hint = document.createElement('span'); hint.textContent = '画面外にはみ出した部分は切れます。上段同士が重なる場合は、後に追加した素材が手前。長さが分かる動画は、尺が足りないと最後の画で止まります。'; host.append(hint);
  };
  return { draw, clip:selected, selected: () => id, select: (next: string | null) => { id = next;const clip=selected();if(clip&&(ctx.now()<clip.start||ctx.now()>=clip.end))ctx.cue(clip.start);draw(); } };
}
