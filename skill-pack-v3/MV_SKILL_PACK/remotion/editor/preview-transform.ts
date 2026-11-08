type Options={selected:()=>any;changed:()=>void;setMove:(on:boolean)=>void;getMove:()=>boolean};

/** Controls sit over the preview; they are editor UI and are not part of the render. */
export function installPreviewTransform(screen:HTMLElement,bar:HTMLElement,o:Options){
 let panel=screen.querySelector<HTMLElement>('#previewTransformPanel');
 let toggle=bar.querySelector<HTMLButtonElement>('#previewTransformToggle');
 if(!panel){
  panel=document.createElement('div');panel.id='previewTransformPanel';panel.hidden=true;
  panel.innerHTML='<strong>選択中の歌詞</strong><label><input id="previewMove" type="checkbox"> 画面をドラッグして移動</label><label>大きさ <input id="previewScale" aria-label="プレビュー上の文字の大きさ" type="range" min="0.3" max="3" step="0.01"><output id="previewScaleValue"></output></label><label>角度 <input id="previewAngle" aria-label="プレビュー上の文字の角度" type="range" min="-180" max="180" step="1"><output id="previewAngleValue"></output></label>';
  screen.append(panel);
 }
 if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.id='previewTransformToggle';bar.append(toggle)}
 const get=(id:string)=>panel!.querySelector<HTMLInputElement>('#'+id)!;
 const show=()=>{
  const line=o.selected(),scale=Number.isFinite(line?.scale)?line.scale:.72,angle=Number.isFinite(line?.angle)?line.angle:0;
  get('previewMove').checked=o.getMove();get('previewScale').value=String(scale);get('previewAngle').value=String(angle);
  panel!.querySelector('#previewScaleValue')!.textContent=`${scale.toFixed(2)}倍`;
  panel!.querySelector('#previewAngleValue')!.textContent=`${angle}°`;
  toggle!.textContent=panel!.hidden?'プレビューで調整':'調整を閉じる';toggle!.setAttribute('aria-pressed',String(!panel!.hidden));
 };
 toggle.onclick=()=>{panel!.hidden=!panel!.hidden;if(panel!.hidden)o.setMove(false);show()};
 get('previewMove').onchange=()=>{o.setMove(get('previewMove').checked);show()};
 for(const [id,key,inspector] of [['previewScale','scale','editScale'],['previewAngle','angle','lookAngle']] as const){
  get(id).oninput=()=>{const line=o.selected();if(!line)return;line[key]=Number(get(id).value);const input=document.getElementById(inspector) as HTMLInputElement|null;if(input)input.value=get(id).value;o.changed();show()};
 }
 show();return show;
}
