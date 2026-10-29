import {TOOL_TABS,toolUnavailable} from './tool-status';
declare const __EDITOR_BUILD__: string;
import {editorLook} from '../src/lib/editorLook';
import React from 'react';
import {markEdited,STAGE_STYLES} from '../src/lib/lyricEdits';
import {stagePanel} from './stage-panel';
import {mographPanel} from './mograph-panel';
let origSource:any=null;
import {createRoot} from 'react-dom/client';
import {lyricRange,sceneRange,loopStep} from './loop';
import {sceneName} from '../src/lib/editstate';
import {History,isTextField} from './history';
import {snapTime,pinDefault,resizeBoundary,sceneEdges,sceneBoundaryIndex,splitSceneAt,mergeSceneWithNext,resolveClipChains,resizeSceneOnly,moveSceneOnly,resetClipForAsset,ADD_ASSET_EXT,isVideoName,moveLyricEdge,moveLyric,slideInPoint,fmt} from './timeline';
import {clipPlan,clipSummary,trimSpan,SPEED_PRESETS,TAILS,SPEED_MIN,SPEED_MAX} from '../src/lib/clipspeed';
import {Scene,isVideoAsset,CATALOG,FONT_OPTIONS,POSITIONS,EFFECTS,TRANSITIONS,CAMERA_MOVES,EFFECT_FX,STRENGTH,SYNC,sceneMove} from './editor-scene';
const root=createRoot(document.getElementById('stage')!);
let data:any,revision=0,dirty=false,t=0,mode='live',busy=false,lastJob:any=null;
let refreshLineList=()=>{};
let refreshSceneList=()=>{};
let selectSceneUi=(_i:number)=>{},selectLyricUi=(_id:string)=>{},drawTimeline=()=>{},refreshClip=()=>{};
const lyricHistory:any[]=[];
const checkedLyrics=new Set<string>();let sampleMotion:string|null=null;const bulkHistory:any[][]=[];
function parts(l:any){return l.sourceParts??[{line:l.id,start:0,end:Array.from(l.text).length}]}
function splitParts(items:any[],n:number){const left:any[]=[],right:any[]=[];for(const p of items){const size=p.end-p.start;if(n>=size){left.push({...p});n-=size}else if(n<=0)right.push({...p});else{left.push({...p,end:p.start+n});right.push({...p,start:p.start+n});n=0}}return [left,right]}
function redrawLyrics(id:string){tables();appearance();$('lookLine').value=id;$('lookLine').dispatchEvent(new Event('change'));change()}
const $=(id:string)=>document.getElementById(id) as any;
const audio=$('audio') as HTMLAudioElement;
const styles=Object.entries(CATALOG);
function motionGroup(k:string){if(/^pro_/.test(k))return 'プロ演出（pro）';if(/^(join|leave)_(left_right|top_bottom)$/.test(k))return '追加：合流・分離';if(/leave|shatter/.test(k))return '離れる・散る';if(/join|reveal|scatter|fly3d|blur_in|particles|handwriting|outline|typewriter/.test(k))return '集まる・現れる';if(/neon|glitch|trail|spotlight/.test(k))return '光・質感';if(/tategaki|circular|ticker|collage|word_stack|ui_window/.test(k))return '配置・組版';return 'リズム・変形'}
const motionGroups=[...new Set(styles.map(([k])=>motionGroup(k)))];
const optionHtml=motionGroups.map(group=>`<optgroup label="${group}">${styles.filter(([k])=>motionGroup(k)===group).map(([k,v])=>`<option value="${k}">${v.short}</option>`).join('')}</optgroup>`).join('');
function fit(){const W=data?.width??1280,H=data?.height??720,st=$('stage');st.style.width=W+'px';st.style.height=H+'px';if(document.fullscreenElement===$('screen')){const k=Math.min(innerWidth/W,innerHeight/H);st.style.position='absolute';st.style.left=(innerWidth-W*k)/2+'px';st.style.top=(innerHeight-H*k)/2+'px';st.style.transform=`scale(${k})`;$('screen').style.height='';return}st.style.position='';st.style.left='';st.style.top='';const w=$('screen').clientWidth;st.style.transform=`scale(${w/W})`;$('screen').style.height=`${w*H/W}px`}
function draw(){root.render(<Scene data={data} t={t}/>);$('time').textContent=t.toFixed(2)+'秒';$('seek').value=t;if(!$('fsBar').hidden){$('fsSeek').value=t;$('fsTime').textContent=`${t.toFixed(2)} / ${data.duration.toFixed(2)}秒`}const ph=$('tlHead');if(ph)ph.style.left=(t*pxs)+'px'}
let pxs=40;
function status(){ $('status').textContent=dirty?'未保存（プレビューに反映中）':`編集版 ${revision} 保存済み`;$('render').disabled=dirty||busy;$('save').disabled=!dirty||busy;if(lastJob?.status==='done'&&(dirty||lastJob.revision!==revision))$('exportStatus').textContent=`書き出し未反映（前の出力は編集版 ${lastJob.revision}）`;}
function sanitizeRamps(){for(let i=0;i<data.scenes.length;i++){const s=data.scenes[i];if(!s.segments)continue;const d=sceneDur(i);s.segments=s.segments.filter((g:any,k:number)=>k===0||g.at<d-.05);if(s.segments.length<2){delete s.segments;delete s.solve}else if(s.solve!==undefined&&s.solve>=s.segments.length)s.solve=s.segments.length-1}}
const hist=new History(100,700);let applyingHistory=false,pointerHeld=false;
document.addEventListener('pointerdown',()=>{pointerHeld=true},true);document.addEventListener('pointerup',()=>{pointerHeld=false;hist.cut()},true);document.addEventListener('contextmenu',()=>{pointerHeld=false;hist.cut()},true);window.addEventListener('blur',()=>{pointerHeld=false});
function undoUi(){const u=document.getElementById('undoBtn') as HTMLButtonElement|null,r=document.getElementById('redoBtn') as HTMLButtonElement|null;if(u)u.disabled=!hist.canUndo;if(r)r.disabled=!hist.canRedo}
function applySnapshot(snap:string|null,label:string){if(!snap)return;const sceneTab=$('scenesTab').getAttribute('aria-pressed')==='true',cs=currentScene(),line=$('lookLine')?.value;
 applyingHistory=true;try{for(const k of Object.keys(data))delete data[k];Object.assign(data,JSON.parse(snap));tables();appearance();sceneInspector();
  const l=data.lyrics.find((x:any)=>x.id===line)??data.lyrics[0];$('lookLine').value=l.id;$('lookLine').dispatchEvent(new Event('change'));
  if(sceneTab)selectSceneUi(Math.min(cs,data.scenes.length-1));else showTab(false);change();refreshClip()}finally{applyingHistory=false}
 dirty=true;status();drawTimeline();draw();undoUi();$('sample').textContent=label}
function undo(){applySnapshot(hist.undo(JSON.stringify(data)),'元に戻しました（Ctrl+Y でやり直し）')}
function redo(){applySnapshot(hist.redo(),'やり直しました')}
function change(){if(data){markEdited(data,origSource);sanitizeRamps();resolveClipChains(data.scenes,data.duration,(x:any)=>isVideoAsset(data.assets[x.asset]),clipLen);data.scenes.forEach((s:any,i:number)=>{const d=sceneDur(i);if((s.transition??1.1)>d)s.transition=Math.floor(d*100)/100})}dirty=true;mode='live';draw();status();refreshLineList();refreshSceneList();drawTimeline();refreshClip();if(data&&!applyingHistory){hist.record(JSON.stringify(data),Date.now(),pointerHeld);undoUi()}}
function input(value:any,fn:(v:number)=>void,label:string,min=0,max=data.duration,step=.05){const e=document.createElement('input');e.type='number';e.value=value;e.min=String(min);e.max=String(max);e.step=String(step);e.setAttribute('aria-label',label);e.oninput=()=>{if(e.value===''||!Number.isFinite(Number(e.value)))return;fn(Number(e.value));change()};return e}
function cell(tr:any,content:any){const td=document.createElement('td');if(typeof content==='string')td.textContent=content;else td.append(content);tr.append(td);return td}
function seek(at:number,play=false){t=Math.max(0,Math.min(data.duration,at));audio.currentTime=t;draw();if(play)audio.play().catch(()=>{})}
let loopRange:null|(()=>[number,number])=null,loopOn=true;
function playRange(get:()=>[number,number]){loopRange=get;mode='live';$('sample').textContent='';seek(get()[0],true);loopUi()}
function cue(at:number){loopRange=null;audio.pause();mode='live';seek(at);loopUi()}
function stopRange(){loopRange=null;audio.pause();loopUi()}
function loopUi(){const b=$('loopToggle');if(b){b.textContent=loopOn?'ループ ON':'ループ OFF';b.setAttribute('aria-pressed',String(loopOn))}const st=$('loopState');if(st)st.textContent=loopRange?(()=>{const [x,y]=loopRange!();return `範囲再生 ${x.toFixed(2)}〜${y.toFixed(2)}秒`})():''}
function appearance(){
 const panel=$('appearance');panel.innerHTML='<h2>選択中の歌詞</h2><label class="linePicker">歌詞 <select id="lookLine" aria-label="見た目を編集する歌詞"></select></label><div class="lineNav"><button id="prevLine">← 前の行</button><button id="lookPreview">この行を確認</button><button id="nextLine">次の行 →</button></div><h3>タイミング・動き</h3><div class="lookControls"><label>開始秒 <input id="editStart" aria-label="選択行の開始秒" type="number" step="0.05"></label><label>終了秒 <input id="editEnd" aria-label="選択行の終了秒" type="number" step="0.05"></label><label class="wide">モーション <select id="editMotion" aria-label="選択行のモーション"></select></label><label>文字倍率 <input id="editScale" aria-label="選択行の文字倍率" type="number" min="0.3" max="3" step="0.05"></label><label>出現秒 <input id="editDuration" aria-label="選択行の出現秒" type="number" min="0.1" max="3" step="0.1"></label></div><h3>書体・効果</h3><div class="lookControls"><label class="wide">書体 <select id="lookFont" aria-label="書体"></select></label><label>角度（度） <input id="lookAngle" aria-label="文字の角度" type="number" min="-180" max="180" step="1"></label><label>効果 <select id="lookEffect" aria-label="文字の効果"></select></label><label>効果の強さ <input id="lookOffset" aria-label="効果の強さ" type="number" min="1" max="24" step="1"></label><label>自由な縦位置 <input id="editY" aria-label="選択行の縦位置" type="number" min="0.15" max="0.85" step="0.01"></label></div><h3>位置をそろえる</h3><div id="positionGrid"></div><p id="positionName"></p>';
 $('editMotion').innerHTML=optionHtml;
 const fontCategory=document.createElement('select');fontCategory.id='fontCategory';fontCategory.setAttribute('aria-label','書体のカテゴリ');$('lookFont').parentElement.insertBefore(fontCategory,$('lookFont'));
 [...new Set(FONT_OPTIONS.map(f=>f.category))].forEach(cat=>{const o=document.createElement('option');o.value=cat;o.textContent=cat;fontCategory.append(o)});
 const fontSample=document.createElement('p');fontSample.id='fontSample';$('lookFont').parentElement.append(fontSample);const fontCredit=document.createElement('p');fontCredit.id='fontCredit';fontCredit.style.fontSize='12px';$('lookFont').parentElement.append(fontCredit);
 const advanced=document.createElement('section');advanced.className='advancedControls';advanced.innerHTML='<h3>入り方＋基本モーション＋消え方</h3><div class="lookControls"><label>入り方 <select id="editEntrance" aria-label="文字の入り方"></select></label><label>消え方 <select id="editDeparture" aria-label="文字の消え方"></select></label><label>切替の長さ（秒） <input id="editTransition" aria-label="文字の切替時間" type="number" min="0.1" max="2" step="0.1"></label></div><h3>色</h3><div class="colorControls"><label>文字 <input id="editFill" aria-label="文字色" type="color"></label><label>強調 <input id="editAccent" aria-label="強調色" type="color"></label><label>縁取り <input id="editStroke" aria-label="縁取り色" type="color"></label></div><p>多色・装飾スタイルには固有の色が残る場合があります。</p>';
 for(const id of ['editEntrance','editDeparture']){const sel=advanced.querySelector('#'+id)!;for(const [key,label] of Object.entries(TRANSITIONS)){const o=document.createElement('option');o.value=key;o.textContent=key==='lr'&&id==='editEntrance'?'左右から合流':key==='tb'&&id==='editEntrance'?'上下から合流':String(label);sel.append(o)}}
 panel.append(advanced);
 {/* v6.5: stage-native lyric styles (立ち絵 etc.) per line; 'auto' keeps the built-in look */const ss=document.createElement('section');ss.className='stageStyleControls';ss.innerHTML='<h3>ステージの文字スタイル（立ち絵など）</h3><label>この行のスタイル <select id="editStageStyle" aria-label="ステージの文字スタイル"></select></label><p id="editedNote" style="font-size:12px"></p>';panel.append(ss);for(const [k,v] of Object.entries(STAGE_STYLES)){const o=document.createElement('option');o.value=k;o.textContent=v;ss.querySelector('#editStageStyle')!.append(o)}}
 const bulk=document.createElement('section');bulk.className='bulkControls';bulk.innerHTML='<h3>見本・設定をまとめて適用</h3><label>適用先 <select id="applyScope" aria-label="一括適用の対象"><option value="current">選択中の1行</option><option value="checked">チェックした歌詞</option><option value="all">全歌詞</option></select></label><label>適用する項目 <select id="applyKind" aria-label="一括適用する項目"><option value="motion">モーションだけ（見本を優先）</option><option value="font">書体だけ</option><option value="colors">色だけ</option><option value="look">組み合わせ・見た目すべて</option></select></label><p id="bulkMotionChoice"></p><p id="bulkTarget"></p><button id="applySettings">指定先に適用</button><button id="undoBulk">直前の一括適用を戻す</button><p>開始・終了時刻、歌詞本文は変えません。</p>';panel.insertBefore(bulk,panel.querySelector('h3'));
 const grouping=document.createElement('section');grouping.className='joinControls';grouping.innerHTML='<h3>歌詞をつなぐ・分ける</h3><p id="nextLyricText"></p><label>次の行から取り込む文字数 <input id="joinCount" aria-label="次の行からつなぐ文字数" type="number" min="1" step="1"></label><button id="joinLyric">次の行とつなぐ</button><p>全文字数なら行全体、それより少なければ途中までつなぎます。</p><label>この行を何文字目で分けるか <input id="splitCount" aria-label="歌詞を分ける文字位置" type="number" min="1" step="1" value="1"></label><button id="splitLyric">ここで二つに分ける</button><button id="undoGrouping">直前の結合・分割を戻す</button><p>表示グループを変更します。元の歌詞は保持します。境目の秒数は文字数からの仮配置なので、再生して調整してください。</p>';
 panel.append(grouping);
 data.lyrics.forEach((l:any)=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.text;$('lookLine').append(o)});
 const fillFonts=(id:string)=>{const chosen=FONT_OPTIONS.find(f=>f.id===id)??FONT_OPTIONS[0];fontCategory.value=chosen.category;$('lookFont').replaceChildren();FONT_OPTIONS.filter(f=>f.category===chosen.category).forEach(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=(f as any).label??f.family;$('lookFont').append(o)});$('lookFont').value=chosen.id;fontSample.style.fontFamily=`'${chosen.family}'`;{const c:any=chosen;fontCredit.replaceChildren();if(c.author){fontCredit.append(`作者: ${c.author}（${c.license}）　`);const a=document.createElement('a');a.href=c.permissionSource??c.source;a.target='_blank';a.rel='noopener';a.textContent='利用条件のページ';fontCredit.append(a)}}fontSample.textContent=data.lyrics.find((l:any)=>l.id===$('lookLine').value)?.text??'MVエディター'};
 Object.entries(EFFECTS).forEach(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=String(label);$('lookEffect').append(o)});
 const selected=()=>data.lyrics.find((l:any)=>l.id===$('lookLine').value);
 const show=()=>{const l=selected();$('editStageStyle').value=l.stageStyle??'auto';$('editedNote').textContent=l.edited?.length?'編集済み: '+l.edited.join(', ')+'（元の見た目より優先されます）':'未編集（元の見た目のまま）';fillFonts(editorLook(l).font);$('lookAngle').value=l.angle??0;$('lookEffect').value=l.effect??'none';$('lookOffset').value=l.effectOffset??6;for(const [id,key] of [['editStart','start'],['editEnd','end'],['editMotion','motion'],['editScale','scale'],['editY','y'],['editDuration','motionDuration']])$(id).value=l[key];for(const [id,key,fallback] of [['editEntrance','entrance','none'],['editDeparture','departure','none'],['editTransition','transitionDuration',.7],['editFill','fill','#f8f3e6'],['editAccent','accent','#e6aa96'],['editStroke','stroke','#1f271f']])$(String(id)).value=l[String(key)]??(editorLook(l) as any)[String(key)]??fallback;$('positionName').textContent=`配置：${POSITIONS[l.position??'manual']}`;for(const b of $('positionGrid').children)b.setAttribute('aria-pressed',String(b.dataset.position===(l.position??'manual')));const i=data.lyrics.findIndex((x:any)=>x.id===l.id),next=data.lyrics[i+1];$('nextLyricText').textContent=next?`次の歌詞：${next.text}`:'最後の歌詞です';$('joinCount').value=next?Array.from(next.text).length:0;$('joinCount').max=next?Array.from(next.text).length:0;$('joinLyric').disabled=!next;$('splitCount').max=Array.from(l.text).length-1;$('undoGrouping').disabled=lyricHistory.length===0;$('undoBulk').disabled=bulkHistory.length===0;refreshLineList()};
 const preview=()=>{const id=$('lookLine').value;playRange(()=>lyricRange(data.lyrics.find((l:any)=>l.id===id)??selected(),data.duration))};
 const select=(id:string)=>{$('lookLine').value=id;show();cue(selected().start)};selectLyricUi=(id:string)=>{showTab(false);$('lookLine').value=id;show();drawTimeline()};
 $('lookLine').onchange=()=>{show();cue(selected().start)};$('lookPreview').onclick=preview;
 for(const [id,delta] of [['prevLine',-1],['nextLine',1]] as const)$(id).onclick=()=>{const i=data.lyrics.findIndex((l:any)=>l.id===selected().id);select(data.lyrics[Math.max(0,Math.min(data.lyrics.length-1,i+delta))].id)};
 $('lineList').replaceChildren();data.lyrics.forEach((l:any,i:number)=>{const row=document.createElement('div');row.className='lineRow';const check=document.createElement('input');check.type='checkbox';check.checked=checkedLyrics.has(l.id);check.setAttribute('aria-label',`一括適用に含める ${l.text}`);check.onchange=()=>{if(check.checked)checkedLyrics.add(l.id);else checkedLyrics.delete(l.id);refreshLineList()};const b=document.createElement('button');b.className='lyricItem';b.dataset.line=l.id;b.setAttribute('aria-label',`歌詞を選択 ${l.text}`);const n=document.createElement('small');n.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span');text.textContent=l.text;const timing=document.createElement('small');timing.className='lineTime';b.append(n,text,timing);b.onclick=()=>select(l.id);row.append(check,b);$('lineList').append(row)});
 refreshLineList=()=>{if($('bulkMotionChoice'))$('bulkMotionChoice').textContent='適用モーション：'+(CATALOG[sampleMotion??selected().motion]?.short??'未選択')+(sampleMotion?'（見本で選択）':'（選択行）');for(const b of $('lineList').querySelectorAll('button[data-line]')){const l=data.lyrics.find((l:any)=>l.id===b.dataset.line);b.setAttribute('aria-pressed',String(l.id===selected().id));b.classList.toggle('edited',!!l.edited?.length);b.title=l.edited?.length?'編集済み: '+l.edited.join(', '):'';b.querySelector('.lineTime').textContent=`${l.start.toFixed(2)}–${l.end.toFixed(2)}`}$('bulkTarget').textContent=`チェック済み ${data.lyrics.filter((l:any)=>checkedLyrics.has(l.id)).length}行／全${data.lyrics.length}行`};
 for(const [id,key] of [['lookFont','font'],['lookAngle','angle'],['lookEffect','effect'],['lookOffset','effectOffset']]){$(id).oninput=()=>{const value=$(id).value;if(value==='')return;selected()[key]=['angle','effectOffset'].includes(key)?Number(value):value;change()}};
 fontCategory.onchange=()=>{const f=FONT_OPTIONS.find(f=>f.category===fontCategory.value)!;selected().font=f.id;fillFonts(f.id);change()};$('lookFont').oninput=()=>{selected().font=$('lookFont').value;fillFonts(selected().font);change()};
 for(const [id,key] of [['editEntrance','entrance'],['editDeparture','departure'],['editTransition','transitionDuration'],['editFill','fill'],['editAccent','accent'],['editStroke','stroke']])$(id).oninput=()=>{const value=$(id).value;if(value==='')return;selected()[key]=key==='transitionDuration'?Number(value):value;change()};
 $('applySettings').onclick=()=>{const source=selected(),scope=$('applyScope').value,kind=$('applyKind').value;const targets=data.lyrics.filter((l:any)=>scope==='all'||(scope==='checked'?checkedLyrics.has(l.id):l.id===source.id));if(!targets.length){$('error').textContent='適用する歌詞にチェックを入れてください';return}const keys=kind==='motion'?['motion']:kind==='font'?['font']:kind==='colors'?['fill','accent','stroke']:['motion','font','scale','y','position','angle','effect','effectOffset','entrance','departure','transitionDuration','motionDuration','fill','accent','stroke'];const defaults:any={font:'noto_serif',fill:'#f8f3e6',accent:'#e6aa96',stroke:'#1f271f',angle:0,position:'manual',effect:'none',effectOffset:6,entrance:'none',departure:'none',transitionDuration:.7};const changes:any[]=[];for(const l of targets)for(const key of keys){const value=key==='motion'?(sampleMotion??source.motion):(source[key]??(editorLook(source) as any)[key]??defaults[key]);if(value===undefined)continue;changes.push({id:l.id,key,before:l[key],after:value});l[key]=value}bulkHistory.push(changes);$('error').textContent='';$('sample').textContent=`${targets.length}行へ${kind==='motion'?'モーション':kind==='font'?'書体':kind==='colors'?'色':'組み合わせ・見た目'}を適用しました（時刻は保持）`;show();change()};
 $('editStageStyle').oninput=()=>{const v=$('editStageStyle').value;if(v==='auto')delete selected().stageStyle;else selected().stageStyle=v;change();show()};
 $('undoBulk').onclick=()=>{const changes=bulkHistory.pop();if(!changes)return;for(const c of changes){const l=data.lyrics.find((l:any)=>l.id===c.id);if(l&&l[c.key]===c.after){if(c.before===undefined)delete l[c.key];else l[c.key]=c.before}}show();change()};
 for(const [id,key] of [['editStart','start'],['editEnd','end'],['editMotion','motion'],['editScale','scale'],['editY','y'],['editDuration','motionDuration']])$(id).oninput=()=>{const v=$(id).value;if(v==='')return;selected()[key]=key==='motion'?v:Number(v);if(key==='motion')sampleMotion=null;if(key==='y'){selected().position='manual';$('positionName').textContent='配置：自由（現在位置）'}change()};
 $('joinLyric').onclick=()=>{const l=selected(),i=data.lyrics.findIndex((x:any)=>x.id===l.id),next=data.lyrics[i+1];if(!next)return;const chars=Array.from(next.text as string),n=Number($('joinCount').value);if(!Number.isInteger(n)||n<1||n>chars.length){$('error').textContent='つなぐ文字数を確認してください';return}lyricHistory.push(structuredClone(data.lyrics));const [take,remain]=splitParts(parts(next),n),boundary=next.start+(next.end-next.start)*n/chars.length;const combined={...l,text:l.text+chars.slice(0,n).join(''),end:Math.max(l.end,boundary),sourceParts:[...parts(l),...take]};if(n===chars.length)data.lyrics.splice(i,2,combined);else data.lyrics.splice(i,2,combined,{...next,text:chars.slice(n).join(''),start:boundary,sourceParts:remain});$('error').textContent='';redrawLyrics(l.id)};
 $('splitLyric').onclick=()=>{const l=selected(),chars=Array.from(l.text as string),n=Number($('splitCount').value);if(!Number.isInteger(n)||n<1||n>=chars.length){$('error').textContent='分ける文字位置を確認してください';return}lyricHistory.push(structuredClone(data.lyrics));const [a,b]=splitParts(parts(l),n),boundary=l.start+(l.end-l.start)*n/chars.length;const i=data.lyrics.findIndex((x:any)=>x.id===l.id);data.lyrics.splice(i,1,{...l,text:chars.slice(0,n).join(''),end:boundary,sourceParts:a},{...l,id:`SPLIT_${Date.now()}`,text:chars.slice(n).join(''),start:boundary,sourceParts:b});$('error').textContent='';redrawLyrics(l.id)};
 $('undoGrouping').onclick=()=>{if(!lyricHistory.length)return;data.lyrics=lyricHistory.pop();redrawLyrics(data.lyrics[0].id)};
 for(const [id,name] of Object.entries(POSITIONS)){const b=document.createElement('button');b.textContent=String(name);b.dataset.position=id;b.setAttribute('aria-label',`配置 ${name}`);b.onclick=()=>{selected().position=id;show();change()};$('positionGrid').append(b)}show();
}
function sceneInspector(){
 let current=0;
 const panel=$('sceneAppearance');panel.innerHTML='<h2>選択中のシーン</h2><h3 id="sceneTitle"></h3><div class="lineNav"><button id="prevScene">← 前</button><button id="scenePreview">シーンを確認</button><button id="nextScene">次 →</button></div><h3>切替・長さ</h3><div class="lookControls"><label>開始秒 <input id="sceneStart" aria-label="シーン開始秒" type="number" step="0.05"></label><label>終了秒 <input id="sceneEnd" aria-label="シーン終了秒" type="number" step="0.05"></label><label class="wide">フェード秒（0で瞬時） <input id="sceneFade" aria-label="シーンのフェード秒" type="number" min="0" max="4" step="0.1"></label></div><p>終了秒を変えると、次のシーンの開始も動きます。</p><h3>画の位置・大きさ</h3><div class="lookControls"><label class="wide">素材 <select id="sceneAsset" aria-label="シーンの素材"></select></label><div class="wide addAsset" id="assetDrop">画像・動画をPCから追加して差し替え：<input id="assetFile" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.m4v" aria-label="画像・動画ファイルを追加"><small>ここにファイルをドラッグ＆ドロップしてもOK（mp4 / mov / webm / png / jpg）</small></div><label>拡大率 <input id="sceneZoom" aria-label="画像の拡大率" type="number" min="1" max="3" step="0.05"></label><label>左右位置 <input id="sceneX" aria-label="画像の左右位置" type="number" min="-100" max="100" step="1"></label><label>上下位置 <input id="sceneY" aria-label="画像の上下位置" type="number" min="-100" max="100" step="1"></label></div><p>位置は画像を切り抜ける余白の範囲です。拡大すると移動できる幅も増えます。</p><button id="sceneCenter">画像を中央に戻す</button><div id="clipPanel"></div><div id="camFxPanel"></div>';
 data.assets.forEach((asset:any,index:number)=>{const o=document.createElement('option');o.value=String(index);o.textContent=asset.label??('素材 '+(index+1));$('sceneAsset').append(o)});
 const preview=()=>{const i=current;playRange(()=>sceneRange(data.scenes,i,data.duration))};
 let show=()=>{const s=data.scenes[current];$('sceneTitle').textContent=sceneName(s,current,data.sections);for(const [id,key,fallback] of [['sceneStart','start',0],['sceneFade','transition',1.1],['sceneAsset','asset',0],['sceneZoom','zoom',1],['sceneX','x',0],['sceneY','y',0]])$(String(id)).value=s[String(key)]??fallback;$('sceneEnd').value=data.scenes[current+1]?.start??data.duration;$('sceneStart').disabled=current===0;$('sceneEnd').disabled=current===data.scenes.length-1;refreshSceneList()};
 const select=(i:number)=>{current=i;show();cue(data.scenes[i].start)};
 $('sceneList').replaceChildren();data.scenes.forEach((s:any,i:number)=>{const b=document.createElement('button');b.className='lyricItem';b.dataset.scene=s.id;b.setAttribute('aria-label',`${sceneName(s,i,data.sections)}を選択`);const name=document.createElement('span');name.textContent=sceneName(s,i,data.sections);const timing=document.createElement('small');timing.className='sceneTime';b.append(name,timing);b.onclick=()=>select(i);$('sceneList').append(b)});
 refreshSceneList=()=>{for(const b of $('sceneList').children){const i=data.scenes.findIndex((s:any)=>s.id===b.dataset.scene),s=data.scenes[i];if(!s)continue;b.setAttribute('aria-pressed',String(i===current));b.querySelector('.sceneTime').textContent=`${s.start.toFixed(2)}–${(data.scenes[i+1]?.start??data.duration).toFixed(2)}`}};
 const fillAssets=()=>{const sel=$('sceneAsset');sel.replaceChildren();data.assets.forEach((asset:any,index:number)=>{const o=document.createElement('option');o.value=String(index);o.textContent=(isVideoAsset(asset)?'🎞 ':'')+(asset.label??('素材 '+(index+1)));sel.append(o)});sel.value=String(data.scenes[current].asset)};
 const setAsset=(n:number)=>{const s=data.scenes[current];if(s.asset===n)return;s.asset=n;resetClipForAsset(s,isVideoAsset(data.assets[n]));change();show();preview()};
 $('sceneAsset').onchange=()=>setAsset(Number($('sceneAsset').value));
 const addFile=async(f:File)=>{if(!ADD_ASSET_EXT.test(f.name)){$('error').textContent='追加できるのは mp4 / mov / webm / png / jpg / webp / gif / svg です';return}
  let dur=0;if(isVideoName(f.name))dur=await new Promise<number>(ok=>{const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>ok(v.duration||0);v.onerror=()=>ok(0);v.src=URL.createObjectURL(f)});
  $('status').textContent='素材を追加中…';const r=await fetch(`/api/add-asset?name=${encodeURIComponent(f.name)}&duration=${dur}`,{method:'POST',body:f});const d=await r.json();if(!r.ok){$('error').textContent=d.error||'追加に失敗しました';return}
  data.assets.push(d.asset);fillAssets();setAsset(data.assets.length-1);tables();$('status').textContent='素材を追加しました（保存してください）'};
 $('assetFile').onchange=()=>{const f=$('assetFile').files?.[0];if(f)addFile(f);$('assetFile').value=''};
 const dz=$('assetDrop');dz.ondragover=(e:DragEvent)=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');dz.ondrop=(e:DragEvent)=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer?.files?.[0];if(f)addFile(f)};
 for(const [id,key] of [['sceneStart','start'],['sceneFade','transition'],['sceneZoom','zoom'],['sceneX','x'],['sceneY','y']])$(id).oninput=()=>{const v=$(id).value;if(v==='')return;data.scenes[current][key]=key==='camera'?v==='true':Number(v);change()};
 $('sceneEnd').oninput=()=>{if($('sceneEnd').value!==''&&data.scenes[current+1]){data.scenes[current+1].start=Number($('sceneEnd').value);change()}};
 const clipUi=clipPanel(()=>current,preview);refreshClip=clipUi;const fxUi0=camFxPanel(()=>current,preview);const fxUi=()=>{fxUi0();clipUi()};const show0=show;show=()=>{show0();fxUi()};const stUi=stagePanel($('sceneAppearance'),{data:()=>data,current:()=>current,change,now:()=>t});const show1=show;show=()=>{show1();stUi()};const moUi=mographPanel($('sceneAppearance'),{data:()=>data,current:()=>current,change,preview});const show2=show;show=()=>{show2();moUi()};
 $('scenePreview').onclick=preview;$('prevScene').onclick=()=>select(Math.max(0,current-1));$('nextScene').onclick=()=>select(Math.min(data.scenes.length-1,current+1));$('sceneCenter').onclick=()=>{data.scenes[current].x=0;data.scenes[current].y=0;show();change()};
 selectSceneUi=(i:number)=>{current=i;showTab(true,false);show();drawTimeline()};
 const tab=(scenes:boolean,cueIt=true)=>{$('lineList').hidden=scenes;$('sceneList').hidden=!scenes;$('appearance').hidden=scenes;$('sceneAppearance').hidden=!scenes;$('lyricsTab').setAttribute('aria-pressed',String(!scenes));$('scenesTab').setAttribute('aria-pressed',String(scenes));$('listTitle').textContent=scenes?'シーンを選ぶ':'歌詞を選ぶ';if(scenes){show();if(cueIt)cue(data.scenes[current].start)}};showTab=tab;
 currentScene=()=>current;
 $('lyricsTab').onclick=()=>{tab(false);drawTimeline()};$('scenesTab').onclick=()=>{tab(true);drawTimeline()};show();
}
let showTab=(_s:boolean,_c?:boolean)=>{},currentScene=()=>0;
const sceneDur=(i:number)=>(data.scenes[i+1]?.start??data.duration)-data.scenes[i].start;
const clipLen=(s:any)=>{const a=data.assets[s.asset];return typeof a==='object'?a.duration:undefined};
/** 動画クリップの速さ・切り取り・スピードランプ（画像の場面では隠す）。曲の音は一切変わらない。 */
const stripCache:any={};
function filmstrip(src:string,len:number,done:()=>void){if(stripCache[src])return stripCache[src];const c=document.createElement('canvas');c.width=8*80;c.height=45;stripCache[src]=c;const v=document.createElement('video');v.muted=true;v.preload='auto';v.src=src;let k=0;
 const next=()=>{if(k>=8){v.removeAttribute('src');v.load();return}v.currentTime=Math.min(len-.05,(k+.5)*len/8)};v.onseeked=()=>{try{c.getContext('2d')!.drawImage(v,k*80,0,80,45)}catch{}k++;done();next()};v.onloadeddata=next;return c}
function clipPanel(cur:()=>number,preview:()=>void){
 const P=$('clipPanel');
 P.innerHTML=`<section class="clipBox"><h3>動画の速さ・切り取り</h3><p class="hint">動画の<b>画だけ</b>を変えます。曲の音・テンポ・長さは変わりません（動画の音は使いません）。</p>
 <h4>速さ</h4><div class="lineNav" id="speedPresets"></div>
 <div class="speedRow"><button id="speedDown" title="0.05倍おそく">−0.05</button><input id="clipSpeedNum" type="number" min="${SPEED_MIN}" max="${SPEED_MAX}" step="0.01" aria-label="動画の速さ（倍）" title="マウスホイールで0.01ずつ（Shiftで0.05ずつ）"><span>倍</span><button id="speedUp" title="0.05倍はやく">＋0.05</button></div>
 <input id="clipSpeed" type="range" min="${SPEED_MIN}" max="${SPEED_MAX}" step="0.01" aria-label="動画の速さ" class="full"><b id="clipSpeedVal"></b>
 <label class="check"><input id="clipFit" type="checkbox" aria-label="場面の長さに合わせる"> 場面の長さに合わせる <small>（使う部分がちょうど場面の終わりで終わる速さに自動調整）</small></label>
 <h4>切り取り（使う部分）</h4><p class="hint">下の帯の黄色いつまみをドラッグして、使い始め（IN）と使い終わり（OUT）を決めます。</p>
 <canvas id="clipStrip" width="640" height="62" aria-label="動画の切り取り帯"></canvas>
 <div class="lookControls"><label>IN（秒） <input id="clipFrom" type="number" min="0" step="0.01" aria-label="動画の使い始め"></label><label>OUT（秒） <input id="clipTo" type="number" min="0" step="0.01" aria-label="動画の使い終わり"></label></div>
 <h4>スピードランプ（途中で速さを変える）</h4>
 <label class="check"><input id="rampOn" type="checkbox"> 途中から速さを変える</label>
 <div id="rampBox"><p class="hint">下の帯は<b>場面の時間</b>です。白いつまみ＝速さが切り替わる位置。ドラッグで動かせます。</p><canvas id="rampBar" width="640" height="34" aria-label="速さの切替位置"></canvas>
 <div class="lookControls"><label>切替位置（場面の何秒目） <input id="rampAt" type="number" min="0" step="0.01"></label><label>なめらかに変える（秒） <input id="rampEase" type="number" min="0" max="2" step="0.05" title="0で一瞬で切替。0.5〜1でスピードランプらしくなります"></label>
 <label>前半の速さ <input id="rampV1" type="number" min="${SPEED_MIN}" max="${SPEED_MAX}" step="0.01"></label><label>後半の速さ <input id="rampV2" type="number" min="${SPEED_MIN}" max="${SPEED_MAX}" step="0.01"></label>
 <label class="wide">自動で合わせる側 <select id="rampSolve"><option value="1">後半を自動（前半はそのまま）</option><option value="0">前半を自動（後半はそのまま）</option><option value="">自動にしない（両方手入力）</option></select></label></div></div>
 <button id="rampFit" class="primary">途中からスローで帳尻合わせ</button><p class="hint">前半は今の速さのまま、切替位置から後をゆっくりにして、使う部分がぴったり場面の終わりで終わるようにします。</p>
 <h4>動画が足りないとき</h4><select id="clipTail" aria-label="動画が足りないとき">${Object.entries(TAILS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
 <p id="clipInfo" class="result"></p><p class="hint">タイムラインで動画の帯の真ん中をドラッグすると、使う部分（IN〜OUT）をまとめてずらせます。</p></section>`;
 const S=()=>data.scenes[cur()],D=()=>sceneDur(cur());
 const setSpeed=(v:number)=>{if(!Number.isFinite(v))return;const s=S();v=Math.round(Math.max(SPEED_MIN,Math.min(SPEED_MAX,v))*100)/100;s.speed=v;delete s.fit;if(s.segments){s.segments[0].speed=v}change()};
 for(const [label,v] of SPEED_PRESETS){const b=document.createElement('button');b.textContent=label;b.dataset.speed=String(v);b.onclick=()=>{setSpeed(v);preview()};$('speedPresets').append(b)}
 $('clipSpeed').oninput=()=>setSpeed(Number($('clipSpeed').value));$('clipSpeed').onchange=preview;
 $('clipSpeedNum').oninput=()=>{if($('clipSpeedNum').value!=='')setSpeed(Number($('clipSpeedNum').value))};
 $('clipSpeedNum').addEventListener('wheel',(e:WheelEvent)=>{e.preventDefault();setSpeed((S().speed??1)+(e.deltaY<0?1:-1)*(e.shiftKey?.05:.01))},{passive:false});
 $('speedDown').onclick=()=>setSpeed((S().speed??1)-.05);$('speedUp').onclick=()=>setSpeed((S().speed??1)+.05);
 $('clipFit').onchange=()=>{const s=S();if($('clipFit').checked){s.fit=true;delete s.segments;delete s.solve}else delete s.fit;change();preview()};
 const num=(id:string,fn:(v:number)=>void)=>{$(id).oninput=()=>{const v=Number($(id).value);if($(id).value===''||!Number.isFinite(v))return;fn(v);change()}};
 const len=()=>clipLen(S())??1e9;
 num('clipFrom',v=>{const s=S();delete s.clipChain;s.clipFrom=Math.max(0,Math.min(v,(s.clipTo??len())-.05))});
 num('clipTo',v=>{const s=S();s.clipTo=Math.min(len(),Math.max(v,(s.clipFrom??0)+.05))});
 const ensureRamp=()=>{const s=S();if(!s.segments||s.segments.length<2){s.segments=[{at:0,speed:s.speed??1},{at:Math.round(D()*.5*100)/100,speed:s.speed??1}];s.solve=1;s.ease??=.5;delete s.fit}};
 $('rampOn').onchange=()=>{const s=S();if($('rampOn').checked)ensureRamp();else{delete s.segments;delete s.solve;delete s.ease}change();preview()};
 num('rampAt',v=>{ensureRamp();S().segments[1].at=Math.max(.05,Math.min(D()-.05,v))});
 num('rampEase',v=>{S().ease=Math.max(0,Math.min(2,v))});
 num('rampV1',v=>{ensureRamp();const s=S();s.segments[0].speed=s.speed=Math.max(SPEED_MIN,Math.min(SPEED_MAX,v))});
 num('rampV2',v=>{ensureRamp();S().segments[1].speed=Math.max(SPEED_MIN,Math.min(SPEED_MAX,v))});
 $('rampSolve').onchange=()=>{const s=S();ensureRamp();if($('rampSolve').value==='')delete s.solve;else s.solve=Number($('rampSolve').value);change()};
 $('rampFit').onclick=()=>{ensureRamp();const s=S();s.solve=1;s.segments[0].speed=s.speed??1;change();preview()};
 $('clipTail').onchange=()=>{S().tail=$('clipTail').value;change();preview()};
 // drag handles: IN/OUT on the film strip, switch point on the scene bar
 const strip=$('clipStrip'),bar=$('rampBar');let drag:any=null;
 const fx=(c:HTMLCanvasElement,e:PointerEvent)=>{const r=c.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))};
 strip.onpointerdown=(e:PointerEvent)=>{const s=S(),L=clipLen(s);if(!L)return;const x=fx(strip,e)*L,a=s.clipFrom??0,b=s.clipTo??L;drag={c:strip,k:Math.abs(x-a)<=Math.abs(x-b)?'in':'out'};strip.setPointerCapture(e.pointerId)};
 bar.onpointerdown=(e:PointerEvent)=>{ensureRamp();drag={c:bar,k:'at'};bar.setPointerCapture(e.pointerId);move(e)};
 const move=(e:PointerEvent)=>{if(!drag)return;const s=S(),L=clipLen(s)??1;const f=fx(drag.c,e);const tip=$('tlTip');let msg='';
  if(drag.k==='in'){delete s.clipChain;s.clipFrom=Math.round(Math.max(0,Math.min(f*L,(s.clipTo??L)-.05))*100)/100;msg=`IN ${s.clipFrom.toFixed(2)}秒`}
  else if(drag.k==='out'){s.clipTo=Math.round(Math.min(L,Math.max(f*L,(s.clipFrom??0)+.05))*100)/100;msg=`OUT ${s.clipTo.toFixed(2)}秒`}
  else{s.segments[1].at=Math.round(Math.max(.05,Math.min(D()-.05,f*D()))*100)/100;msg=`切替 場面の ${s.segments[1].at.toFixed(2)}秒目`}
  tip.hidden=false;tip.textContent=msg;tip.style.left=e.clientX+12+'px';tip.style.top=e.clientY-34+'px';change()};
 for(const c of [strip,bar]){c.onpointermove=move;c.onpointerup=c.onpointercancel=()=>{if(drag){drag=null;$('tlTip').hidden=true;preview()}}}
 const paint=()=>{for(const c of [strip,bar]){const w=Math.round(c.clientWidth||640);if(w&&c.width!==w)c.width=w}const s=S(),L=clipLen(s),g=strip.getContext('2d')!,W=strip.width,H=strip.height;g.fillStyle='#111';g.fillRect(0,0,W,H);
  if(L){const src=data.assets[s.asset].src;const fs=filmstrip(src,L,()=>paint());{const tw=80*(45/45),n=Math.ceil(W/tw);for(let k=0;k<n;k++){const sk=Math.min(7,Math.floor(k*8/n));g.drawImage(fs,sk*80,0,80,45,k*tw,(H-45)/2,tw,45)}}const a=(s.clipFrom??0)/L*W,b=(s.clipTo??L)/L*W;g.fillStyle='#000a';g.fillRect(0,0,a,H);g.fillRect(b,0,W-b,H);g.fillStyle='#f1c84b';g.fillRect(a-3,0,6,H);g.fillRect(b-3,0,6,H);g.fillRect(a,0,b-a,3);g.fillRect(a,H-3,b-a,3);g.fillStyle='#fff';g.font='12px sans-serif';g.fillText(`IN ${(s.clipFrom??0).toFixed(2)}`,Math.min(W-70,a+5),H-4);g.fillText(`OUT ${(s.clipTo??L).toFixed(2)}`,Math.max(0,b-75),14)}
  else{g.fillStyle='#ccc';g.fillText('動画の長さが分からないため帯は表示できません（数値で指定できます）',8,30)}
  const p=clipPlan(s,D(),L),h=bar.getContext('2d')!,BW=bar.width;h.fillStyle='#1d2a22';h.fillRect(0,0,BW,34);const segs=s.segments??[{at:0}];segs.forEach((sg:any,i:number)=>{const x0=sg.at/D()*BW,x1=(segs[i+1]?.at??D())/D()*BW;h.fillStyle=['#4f6f8f','#8f5f8f','#6f8f4f'][i%3];h.fillRect(x0,6,x1-x0,22);h.fillStyle='#fff';h.font='12px sans-serif';h.fillText(`${p.speeds[i]?.toFixed(2)}倍`,x0+6,22)});if(segs[1]){const x=segs[1].at/D()*BW;h.fillStyle='#fff';h.fillRect(x-3,0,6,34)}};
 return ()=>{const s=S();const vid=isVideoAsset(data.assets[s.asset]);P.hidden=!vid;if(!vid)return;const L=clipLen(s),p=clipPlan(s,D(),L),ramp=(s.segments?.length??0)>1;
  const keep=(id:string,v:any)=>{if(document.activeElement!==$(id))$(id).value=String(v)};
  keep('clipSpeedNum',(s.speed??1).toFixed(2));$('clipSpeed').value=String(s.speed??1);
  $('clipSpeedVal').textContent=ramp?'（スピードランプ中：下で区間ごとに設定）':`実際の速さ ${p.rate.toFixed(2)}倍`+(!s.fit&&Math.abs(p.rate-(s.speed??1))>.001?`（選んだ ${(s.speed??1).toFixed(2)}倍では使う部分が足りない／長すぎるため自動調整）`:'');
  $('clipFit').checked=!!s.fit;for(const id of ['clipSpeed','clipSpeedNum','speedDown','speedUp'])$(id).disabled=!!s.fit;
  keep('clipFrom',(s.clipFrom??0).toFixed(2));keep('clipTo',(s.clipTo??L??0).toFixed?.(2)??'');if(L){$('clipFrom').max=String(L);$('clipTo').max=String(L)}$('clipTail').value=s.tail??'auto';
  $('rampOn').checked=ramp;$('rampBox').hidden=!ramp;if(ramp){keep('rampAt',s.segments[1].at.toFixed(2));keep('rampEase',(s.ease??0).toFixed(2));keep('rampV1',p.speeds[0].toFixed(2));keep('rampV2',p.speeds[1].toFixed(2));$('rampSolve').value=s.solve===undefined?'':String(s.solve);$('rampV1').disabled=s.solve===0;$('rampV2').disabled=s.solve===1}
  for(const b of $('speedPresets').children)b.setAttribute('aria-pressed',String(!s.fit&&Number(b.dataset.speed)===(s.speed??1)));
  const sp=p.speeds.map((v:number)=>v.toFixed(2)+'倍');
  $('clipInfo').textContent=(ramp?`結果：前半 ${sp[0]} → 後半 ${sp[1]}（場面 ${s.segments[1].at.toFixed(2)}秒目で切替${s.ease?`、${s.ease}秒かけてなめらかに`:''}）`:`結果：${clipSummary(p,D())}`)+(L?`／使う部分 ${trimSpan(s,L).span.toFixed(2)}秒（動画全体 ${L.toFixed(2)}秒）→ 場面 ${D().toFixed(2)}秒`:'')+(p.mode!=='play'?`　※${p.mode==='hold'?'足りない分は最後の画で止めます':'足りない分はくり返します'}`:'');
  paint()}
}
/** タイムライン（マウスで編集）。data（editor-state）だけを書き換える＝唯一の正。 */
const PIN_KEY='mvEditor.pinTimeline.v2'; /* v6.4: new key -> an old saved ON is ignored; default OFF (only the preview stays on top) */
const pinWanted=()=>{let v:string|null=null;try{v=localStorage.getItem(PIN_KEY)}catch{}return pinDefault(v,innerHeight)};
function timeline(){
 const host=$('timeline');host.innerHTML=`<div class="tlBar"><b>タイムライン</b><button id="pinToggle" class="pinToggle" aria-pressed="false" title="映像はいつも上に固定。タイムラインも一緒に固定するか">タイムラインも固定 OFF</button><label>ズーム <input id="tlZoom" type="range" min="10" max="200" value="${pxs}" aria-label="タイムラインのズーム"></label><button id="tlSplit" title="赤い線の位置でシーンを切る（S キー）">✂ ここで切る（S）</button><span class="hint tlKeys">端をドラッグ：隣も連動 ／ Ctrl＋ドラッグ：そのシーンだけ ／ Shift・Alt：拍に吸着しない ／ 右クリック：切る・つなげる ／ Ctrl+Z：元に戻す</span></div>
 <div id="tlScroll"><div id="tlInner"><div id="tlBeats"></div><div class="tlRow" id="tlScenes"></div><div class="tlRow" id="tlLyrics"></div><div id="tlHead"></div></div></div><div id="tlTip" hidden></div>`;
 const sc=$('tlScroll'),tip=$('tlTip');
 const sceneAt=(x:number)=>{let k=0;data.scenes.forEach((s:any,i:number)=>{if(s.start<=x+1e-6)k=i});return k};
 const opt=(i:number)=>({video:isVideoAsset(data.assets[data.scenes[i].asset]),clipDur:clipLen(data.scenes[i])});
 const restructure=(sel:number,msg:string)=>{hist.cut();tables();sceneInspector();selectSceneUi(sel);change();hist.cut();$('sample').textContent=msg;$('error').textContent=''};
 const doSplit=(x:number,i=sceneAt(x))=>{const err=splitSceneAt(data.scenes,i,snapTime(x,data.bpm||120,data.phase??0,0.0001),data.duration,opt(i));if(err){$('error').textContent=err;return}restructure(i+1,`シーンを ${fmt(data.scenes[i+1].start)} で2つに切りました（Ctrl+Z で戻せます）`)};
 const doMerge=(i:number)=>{const err=mergeSceneWithNext(data.scenes,i,data.duration,opt(i));if(err){$('error').textContent=err;return}restructure(i,'次のシーンとつなげました（Ctrl+Z で戻せます）')};
 $('tlSplit').onclick=()=>doSplit(t);
 document.addEventListener('keydown',e=>{if((e.key==='s'||e.key==='S')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isTextField(e.target)&&!/SELECT/.test((e.target as HTMLElement)?.tagName??'')){e.preventDefault();doSplit(t)}});
 const menu=document.createElement('div');menu.id='tlMenu';menu.hidden=true;document.body.append(menu);const hideMenu=()=>{menu.hidden=true};document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target as Node))hideMenu()});
 sc.addEventListener('contextmenu',(e:MouseEvent)=>{const blk=(e.target as HTMLElement).closest('[data-scene]') as HTMLElement|null;if(!blk)return;e.preventDefault();const i=Number(blk.dataset.scene),r=$('tlInner').getBoundingClientRect(),x=Math.max(0,Math.min(data.duration,(e.clientX-r.left)/pxs));
  menu.replaceChildren();const item=(label:string,fn:()=>void,dis=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=dis;b.onclick=()=>{hideMenu();fn()};menu.append(b)};
  item(`✂ ここで切る（${fmt(x)}）`,()=>doSplit(x,i));item('⇥ 次とつなげる',()=>doMerge(i),i>=data.scenes.length-1);
  menu.style.left=e.clientX+'px';menu.style.top=e.clientY+'px';menu.hidden=false});
 const pb=$('pinToggle'),pinSync=()=>{const on=pinWanted();document.body.classList.toggle('pinTimeline',on);const top=$('stickyTop'),tl=$('timeline');if(on){if(tl.parentElement!==top)top.append(tl)}else if(tl.parentElement===top)top.after(tl);pb.setAttribute('aria-pressed',String(on));pb.textContent='タイムラインも固定 '+(on?'ON':'OFF')};pb.onclick=()=>{try{localStorage.setItem(PIN_KEY,pinWanted()?'0':'1')}catch{}pinSync()};pinSync();
 $('tlZoom').oninput=()=>{const mid=(sc.scrollLeft+sc.clientWidth/2)/pxs;pxs=Number($('tlZoom').value);drawTimeline();sc.scrollLeft=mid*pxs-sc.clientWidth/2};
 const el=(cls:string,x0:number,x1:number,txt:string,attrs:any)=>{const d=document.createElement('div');d.className=cls;d.style.left=x0*pxs+'px';d.style.width=Math.max(2,(x1-x0)*pxs)+'px';d.textContent=txt;for(const k in attrs)d.dataset[k]=attrs[k];d.title=txt;return d};
 drawTimeline=()=>{if(!data)return;$('tlInner').style.width=data.duration*pxs+20+'px';
  const B=60/(data.bpm||120),beats=$('tlBeats');beats.replaceChildren();if(B*pxs>=4)for(let k=Math.ceil(-(data.phase??0)/B),x=0;(x=(data.phase??0)+k*B)<data.duration;k++){const d=document.createElement('i');d.className=k%4===0?'bar':'';d.style.left=x*pxs+'px';beats.append(d)}
  const cs=currentScene(),cl=$('lookLine')?.value,sceneTab=$('scenesTab').getAttribute('aria-pressed')==='true';
  $('tlScenes').replaceChildren(...data.scenes.map((s:any,i:number)=>{const vid=isVideoAsset(data.assets[s.asset]);const d=el('tlScene'+(vid?' video':'')+(sceneTab&&i===cs?' sel':''),s.start,s.start+sceneDur(i),(vid?'🎞 ':'')+sceneName(s,i,data.sections)+(vid?` ${clipPlan(s,sceneDur(i),clipLen(s)).speeds.map(v=>v.toFixed(2)).join('→')}倍`:''),{scene:String(i)});for(const e of sceneEdges(i,data.scenes.length)){const h=document.createElement('span');h.className='edge '+(e==='start'?'left':'right');h.dataset.edge=e;h.title=e==='start'?'左端：ドラッグで開始を変更':'右端：ドラッグで終わりを変更';d.append(h)}return d}));
  $('tlLyrics').replaceChildren(...data.lyrics.map((l:any)=>{const d=el('tlLyric'+(!sceneTab&&l.id===cl?' sel':''),l.start,l.end,l.text,{lyric:l.id});for(const e of ['start','end']){const h=document.createElement('span');h.className='edge '+(e==='start'?'left':'right');h.dataset.edge=e;h.title=e==='start'?'左端：開始を変更':'右端：終わりを変更';d.append(h)}return d}));
  $('tlHead').style.left=t*pxs+'px'};
 let drag:any=null;
 const at=(e:PointerEvent)=>{const r=$('tlInner').getBoundingClientRect();return Math.max(0,Math.min(data.duration,(e.clientX-r.left)/pxs))};
 sc.addEventListener('pointerdown',(e:PointerEvent)=>{if(e.button!==0)return;const tg=e.target as HTMLElement,blk=tg.closest('[data-scene],[data-lyric]') as HTMLElement|null;const x=at(e);
  if(!blk){cue(x);return}
  const edge=tg.dataset.edge;
  if(blk.dataset.scene){const i=Number(blk.dataset.scene),s=data.scenes[i];selectSceneUi(i);
   const solo=e.ctrlKey||e.metaKey;if(solo&&edge)drag={kind:'soloEdge',i,edge};else if(solo)drag={kind:'soloMove',i,x0:x,s0:s.start,e0:s.start+sceneDur(i),moved:false};else if(edge)drag={kind:'cut',i:sceneBoundaryIndex(i,edge as any)};else if(isVideoAsset(data.assets[s.asset]))drag={kind:'slide',i,x0:x,from0:s.clipFrom??0,to0:s.clipTo,rate:clipPlan(s,sceneDur(i),clipLen(s)).rate,moved:false};else drag=null}
  else{const id=blk.dataset.lyric!;selectLyricUi(id);drag=edge?{kind:'lyr',id,edge}:{kind:'lyrMove',id,x0:x,s0:data.lyrics.find((l:any)=>l.id===id).start,moved:false}}
  if(drag){sc.setPointerCapture(e.pointerId);e.preventDefault()}});
 sc.addEventListener('pointermove',(e:PointerEvent)=>{if(!drag)return;let x=at(e);const free=e.shiftKey||e.altKey;const snap=(v:number)=>free?v:snapTime(v,data.bpm||120,data.phase??0,Math.max(.04,6/pxs));let msg='';
  if(drag.kind==='cut'){const v=resizeBoundary(data.scenes,drag.i,snap(x),data.duration);msg=`切替 ${fmt(v)}（前の場面 ${sceneDur(drag.i-1).toFixed(2)}秒／この場面 ${sceneDur(drag.i).toFixed(2)}秒）`}
  else if(drag.kind==='soloEdge'){const v=resizeSceneOnly(data.scenes,drag.i,drag.edge,snap(x),data.duration);msg=`このシーンだけ：${drag.edge==='start'?'開始':'終わり'} ${fmt(v)}（長さ ${sceneDur(drag.i).toFixed(2)}秒）`}
  else if(drag.kind==='soloMove'){if(Math.abs(x-drag.x0)*pxs<3&&!drag.moved)return;drag.moved=true;moveSceneOnly(data.scenes,drag.i,drag.s0,drag.e0,snap(drag.s0+(x-drag.x0))-drag.s0,data.duration);msg=`このシーンだけ移動：${fmt(data.scenes[drag.i].start)}〜${fmt(data.scenes[drag.i].start+sceneDur(drag.i))}`}
  else if(drag.kind==='slide'){const s=data.scenes[drag.i];delete s.clipChain;const L=clipLen(s);if(drag.to0!==undefined){const w=drag.to0-drag.from0;s.clipFrom=slideInPoint(drag.from0,x-drag.x0,drag.rate,L!==undefined?L-w+.05:undefined);s.clipTo=+(s.clipFrom+w).toFixed(3)}else s.clipFrom=slideInPoint(drag.from0,x-drag.x0,drag.rate,L);drag.moved=true;msg=`使う部分 IN ${s.clipFrom.toFixed(2)}秒`+(s.clipTo!==undefined?`〜OUT ${s.clipTo.toFixed(2)}秒`:'')}
  else if(drag.kind==='lyr'){const l=data.lyrics.find((l:any)=>l.id===drag.id);const v=moveLyricEdge(l,drag.edge,snap(x),data.duration);msg=`${drag.edge==='start'?'開始':'終了'} ${fmt(v)}（長さ ${(l.end-l.start).toFixed(2)}秒）`}
  else{const l=data.lyrics.find((l:any)=>l.id===drag.id);if(Math.abs(x-drag.x0)*pxs<3&&!drag.moved)return;drag.moved=true;const len=l.end-l.start;moveLyric(l,snap(drag.s0+(x-drag.x0))-l.start,data.duration);msg=`歌詞 ${fmt(l.start)}〜${fmt(l.start+len)}`}
  tip.hidden=false;tip.textContent=msg+(free?'　（自由）':'　（拍にくっつく・Shift/Altで自由）');tip.style.left=e.clientX+12+'px';tip.style.top=e.clientY-34+'px';change()});
 const end=()=>{if(drag){if(drag.kind==='cut'||drag.kind==='soloEdge'||drag.kind==='soloMove')cue(data.scenes[drag.i].start)}drag=null;tip.hidden=true};
 sc.addEventListener('pointerup',end);sc.addEventListener('pointercancel',end);
 drawTimeline();
}
const grouped=(m:any)=>{const g:any={};for(const [k,v] of Object.entries<any>(m))(g[v.group]??=[]).push([k,v]);return Object.entries<any>(g).map(([n,l])=>`<optgroup label="${n}">`+l.map(([k,v]:any)=>`<option value="${k}">${v.label}</option>`).join('')+'</optgroup>').join('')};
const opts=(m:any)=>Object.entries<any>(m).map(([k,v])=>`<option value="${k}">${typeof v==='string'?v:v.label}</option>`).join('');
function camFxPanel(cur:()=>number,preview:()=>void){
 const P=$('camFxPanel');
 P.innerHTML=`<h3>カメラの動き</h3><div class="lookControls"><label class="wide">動き <select id="camMove" aria-label="カメラの動き">${grouped(CAMERA_MOVES)}</select></label><label>強さ <select id="camStrength" aria-label="カメラの強さ">${opts(STRENGTH)}</select></label><label>ビート <select id="camSync" aria-label="カメラのビート同期">${opts(SYNC)}</select></label></div>
 <div class="lineNav"><button id="camAll">全シーンに適用</button><button id="camSame">同じ種類のシーンに適用</button></div><p>選ぶとそのシーンをすぐ再生して見られます（プレビューと書き出しは同じ描画です）。</p>
 <h3>エフェクト</h3><label>表示 <select id="fxGroup" aria-label="エフェクトの分類"><option value="">すべて</option><option>基本</option><option>高級</option></select></label><div id="fxList" class="fxList"></div>
 <div class="lineNav"><button id="fxAll">全シーンに適用</button><button id="fxSame">同じ種類のシーンに適用</button><button id="fxClear">このシーンのエフェクトを外す</button></div>
 <h3>時間範囲のエフェクト（例：サビだけ）</h3><div class="lookControls"><label class="wide">エフェクト <select id="rgFx" aria-label="範囲エフェクト">${grouped(EFFECT_FX)}</select></label><label>開始秒 <input id="rgStart" type="number" step="0.05" aria-label="範囲の開始秒"></label><label>終了秒 <input id="rgEnd" type="number" step="0.05" aria-label="範囲の終了秒"></label><label>強さ <select id="rgAmt" aria-label="範囲の強さ">${opts(STRENGTH)}</select></label><label>ビート <select id="rgSync" aria-label="範囲のビート同期">${opts(SYNC)}</select></label></div>
 <div class="lineNav"><button id="rgScene">このシーンの範囲にする</button><button id="rgAdd">範囲を追加</button></div><div id="rgList"></div>`;
 const S=()=>data.scenes[cur()];
 const camSet=()=>{const s=S();s.cameraMove=$('camMove').value;s.cameraStrength=$('camStrength').value;s.cameraSync=$('camSync').value;delete s.camera;change();preview()};
 for(const id of ['camMove','camStrength','camSync'])$(id).onchange=camSet;
 const bulk=(same:boolean,fn:(s:any)=>void)=>{const lab=S().label;data.scenes.forEach((s:any)=>{if(!same||s.label===lab)fn(s)});change();refresh()};
 $('camAll').onclick=()=>{const s=S();bulk(false,o=>{o.cameraMove=sceneMove(s);o.cameraStrength=s.cameraStrength??'weak';o.cameraSync=s.cameraSync??'off';delete o.camera})};
 $('camSame').onclick=()=>{const s=S();bulk(true,o=>{o.cameraMove=sceneMove(s);o.cameraStrength=s.cameraStrength??'weak';o.cameraSync=s.cameraSync??'off';delete o.camera})};
 const copyFx=(s:any)=>JSON.parse(JSON.stringify(s.effects??[]));
 $('fxAll').onclick=()=>{const f=copyFx(S());bulk(false,o=>o.effects=JSON.parse(JSON.stringify(f)))};
 $('fxSame').onclick=()=>{const f=copyFx(S());bulk(true,o=>o.effects=JSON.parse(JSON.stringify(f)))};
 $('fxClear').onclick=()=>{S().effects=[];change();refresh()};
 $('fxGroup').onchange=()=>refresh();
 const list=()=>{const L=$('fxList');L.replaceChildren();const s=S();const g=$('fxGroup').value;
  for(const [id,d] of Object.entries<any>(EFFECT_FX)){if(g&&d.group!==g)continue;const u=(s.effects??[]).find((e:any)=>e.id===id);const row=document.createElement('div');row.className='fxRow';
   const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!u;cb.setAttribute('aria-label',d.label);const name=document.createElement('span');name.textContent=(d.group==='高級'?'★ ':'')+d.label;
   const am=document.createElement('select');am.innerHTML=opts(STRENGTH);am.value=u?.amount??'weak';am.setAttribute('aria-label',d.label+' 強さ');
   const sy=document.createElement('select');sy.innerHTML=opts(SYNC);sy.value=u?.sync??(d.beatDefault?'beat':'off');sy.setAttribute('aria-label',d.label+' ビート');
   const upd=()=>{s.effects=(s.effects??[]).filter((e:any)=>e.id!==id);if(cb.checked)s.effects.push({id,amount:am.value,sync:sy.value});change();preview()};
   cb.onchange=upd;am.onchange=()=>{if(cb.checked)upd()};sy.onchange=()=>{if(cb.checked)upd()};
   row.append(cb,name,am,sy);L.append(row)}};
 const ranges=()=>{const R=$('rgList');R.replaceChildren();(data.effectRanges??[]).forEach((r:any,i:number)=>{const row=document.createElement('div');row.className='fxRow';const tx=document.createElement('span');tx.textContent=`${EFFECT_FX[r.id]?.label??r.id}　${r.start.toFixed(2)}–${r.end.toFixed(2)}秒　${STRENGTH[r.amount as 'weak']?.label??''}／${SYNC[r.sync as 'off']??''}`;
  const pl=document.createElement('button');pl.textContent='確認';pl.onclick=()=>playRange(()=>[r.start,r.end]);const del=document.createElement('button');del.textContent='削除';del.onclick=()=>{data.effectRanges.splice(i,1);change();ranges()};row.append(tx,pl,del);R.append(row)})};
 $('rgScene').onclick=()=>{const i=cur();$('rgStart').value=data.scenes[i].start;$('rgEnd').value=data.scenes[i+1]?.start??data.duration};
 $('rgAdd').onclick=()=>{const a=Number($('rgStart').value),b=Number($('rgEnd').value);if(!(b>a)){$('error').textContent='範囲の終了秒は開始秒より後にしてください';return}(data.effectRanges??=[]).push({id:$('rgFx').value,start:a,end:b,amount:$('rgAmt').value,sync:$('rgSync').value});change();ranges();playRange(()=>[a,b])};
 const refresh=()=>{const s=S();$('camMove').value=sceneMove(s);$('camStrength').value=s.cameraStrength??'weak';$('camSync').value=s.cameraSync??'off';if($('rgStart').value==='')$('rgScene').click();list();ranges()};
 return refresh;
}
function tables(){
 $('cuts').replaceChildren();data.scenes.forEach((s:any,i:number)=>{let tr=document.createElement('tr');cell(tr,sceneName(s,i,data.sections));const a=input(s.start,v=>s.start=v,`${sceneName(s,i,data.sections)} 切替秒`,0,data.duration,.05);a.disabled=i===0;cell(tr,a);const sel=document.createElement('select');data.assets.forEach((asset:any,index:number)=>{const o=document.createElement('option');o.value=String(index);o.textContent=asset.label??('素材 '+(index+1));sel.append(o)});sel.value=s.asset;sel.setAttribute('aria-label',`${s.id} 素材`);sel.onchange=()=>{s.asset=Number(sel.value);resetClipForAsset(s,isVideoAsset(data.assets[s.asset]));change();refreshClip()};cell(tr,sel);cell(tr,input(s.transition,v=>s.transition=v,`${s.id} フェード秒`,0,4,.1));let b=document.createElement('button');b.textContent='切替を再生';b.onclick=()=>seek(Math.max(0,s.start-1),true);cell(tr,b);$('cuts').append(tr)});
 $('lyrics').replaceChildren();data.lyrics.forEach((l:any)=>{let tr=document.createElement('tr');cell(tr,l.text);cell(tr,input(l.start,v=>l.start=v,`${l.id} 開始秒`));cell(tr,input(l.end,v=>l.end=v,`${l.id} 終了秒`));const sel=document.createElement('select');sel.innerHTML=optionHtml;sel.value=l.motion;sel.setAttribute('aria-label',`${l.id} モーション`);sel.onchange=()=>{l.motion=sel.value;change()};cell(tr,sel);cell(tr,input(l.scale,v=>l.scale=v,`${l.id} 文字倍率`,.3,3,.05));cell(tr,input(l.y,v=>{l.y=v;l.position="manual"},`${l.id} 縦位置`,.15,.85,.01));cell(tr,input(l.motionDuration,v=>l.motionDuration=v,`${l.id} 出現秒`,.1,3,.1));let b=document.createElement('button');b.textContent='この行を確認';b.onclick=()=>playRange(()=>lyricRange(l,data.duration));cell(tr,b);$('lyrics').append(tr)});
 $('gallery').replaceChildren();const galleryFilter=document.createElement('select');galleryFilter.setAttribute('aria-label','モーション見本の分類');galleryFilter.innerHTML='<option value="all">すべて</option>'+motionGroups.map(g=>`<option>${g}</option>`).join('');galleryFilter.onchange=()=>{for(const b of $('gallery').querySelectorAll('button'))b.hidden=galleryFilter.value!=='all'&&b.dataset.group!==galleryFilter.value};$('gallery').append(galleryFilter);document.querySelector('.motionGallery summary')!.textContent=`モーションの見本（${styles.length}種類）`;
 styles.forEach(([key,v])=>{const b=document.createElement('button');b.dataset.group=motionGroup(key);b.textContent=v.short;b.title=v.ja;b.onclick=()=>{sampleMotion=key;refreshLineList();const l=data.lyrics.find((l:any)=>l.id===$('lookLine')?.value)??data.lyrics.find((l:any)=>t>=l.start&&t<l.end)??data.lyrics[0];$('sample').textContent=`見本：${v.short} — ${v.ja}（右の一括適用で指定先に反映できます）`;
 audio.pause();let begin=performance.now();let demo=JSON.parse(JSON.stringify(data));demo.lyrics=[{...l,start:0,end:3.5,motion:key}];mode='sample';function tick(now:number){if(mode!=='sample')return;const dt=(now-begin)/1000%4;root.render(<Scene data={demo} t={dt}/>);requestAnimationFrame(tick)}requestAnimationFrame(tick)};$('gallery').append(b)})
}
async function api(path:string,body?:any){const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||r.statusText);return d}
async function load(){const state=await api('/api/state');data=state.data;try{origSource=await (await fetch('original-source.json',{cache:'no-store'})).json()}catch{origSource=null}markEdited(data,origSource);revision=state.revision;audio.src=data.audioFile;$('projectTitle').textContent=data.title??'MVエディター';$('bpmNote').textContent=`この曲のテンポ: ${Math.round(data.bpm||120)} BPM（曲データから自動で読み込み）`;document.title=(data.title??'MV')+'｜編集';$('seek').max=data.duration;tables();appearance();sceneInspector();timeline();exportPanel();fit();draw();hist.reset(JSON.stringify(data));undoUi();dirty=false;status();$('catalogCount').textContent=`モーション${styles.length}種・書体${FONT_OPTIONS.length}種`}
audio.onpause=()=>{$('play').textContent='再生'};audio.onplay=()=>{mode='live';$('sample').textContent='';$('play').textContent='一時停止'};
$('play').onclick=()=>{mode='live';loopRange=null;loopUi();if(audio.paused)audio.play().catch(e=>$('error').textContent=e.message);else audio.pause();draw()};$('seek').oninput=()=>{mode='live';loopRange=null;loopUi();seek(Number($('seek').value))};$('live').onclick=()=>{mode='live';$('sample').textContent='';draw()};
$('save').onclick=async()=>{try{const r=await api('/api/save',{revision,data});revision=r.revision;dirty=false;$('error').textContent='';status()}catch(e:any){$('error').textContent=e.message}};
let exportFolder='';
/* 「MP4を書き出す」→ PCの「名前を付けて保存」画面 → 書き出し。画面が出せないPCではページ内の入力欄。 */
function exportPanel(){
 const hdr=$('render');const res=document.createElement('span');res.id='exDone';res.hidden=true;res.className='exDone';res.innerHTML='保存先：<b id="exSaved" class="exPath"></b><button id="exOpen">フォルダを開く</button>';hdr.after(res);
 const m=document.createElement('div');m.id='exModal';m.hidden=true;m.className='exModal';m.innerHTML=`<div class="exCard" role="dialog" aria-label="MP4の保存先"><h3>MP4の保存先</h3><p class="hint">PCの保存画面を開けなかったので、ここで指定してください。</p>
 <label>保存先フォルダ <input id="exPath" aria-label="保存先フォルダのパス" placeholder="例：C:\\Users\\あなた\\Videos"></label><label>ファイル名 <input id="exName" aria-label="書き出すファイル名"></label><p class="hint">同じ名前があるときは「 (2)」を付けて上書きしません。</p>
 <div class="lineNav"><button id="exGo" class="primary">この場所に書き出す</button><button id="exCancel">やめる</button></div></div>`;document.body.append(m);
 $('exOpen').onclick=async()=>{try{await api('/api/open-folder',{revision})}catch(e:any){$('error').textContent=e.message}};
 $('exCancel').onclick=()=>{m.hidden=true};
 $('exGo').onclick=()=>{m.hidden=true;startExport({folder:$('exPath').value,name:$('exName').value})};
 api('/api/export-settings').then((d:any)=>{exportFolder=d.folder}).catch(()=>{})}
async function startExport(dest:any){try{const r=await api('/api/render',{revision,...dest});busy=true;lastJob=r;status();poll()}catch(e:any){$('error').textContent=e.message;if(!dest.path){$('exModal').hidden=false}}}
const refreshExportName=()=>{};
$('render').onclick=async()=>{if(busy)return;$('error').textContent='';const b=$('render');b.disabled=true;const label=b.textContent;b.textContent='PCの保存画面で場所を選んでください…';
 try{const r=await api('/api/save-as',{revision});exportFolder=r.folder;
  if(!r.available){$('exPath').value=r.folder;$('exName').value=r.suggestedName;$('exModal').hidden=false;return}
  if(!r.path)return; await startExport({path:r.path})}catch(e:any){$('error').textContent=e.message}finally{b.textContent=label;status()}};
$('refreshCatalog').onclick=async()=>{try{$('refreshCatalog').disabled=true;if(dirty){const s=await api('/api/save',{revision,data});revision=s.revision;dirty=false}await api('/api/reload-catalog',{revision});window.location.reload()}catch(e:any){$('error').textContent=e.message;$('refreshCatalog').disabled=false}};
async function poll(){try{lastJob=await api('/api/job');$('exportStatus').textContent=lastJob.status==='running'?`書き出し中 ${lastJob.progress??0}%`:lastJob.status==='done'?`書き出し済み：編集版 ${lastJob.revision}`:lastJob.status==='failed'?`書き出し失敗：${lastJob.error}`:'まだ書き出していません';$('result').hidden=lastJob.status!=='done';$('exDone').hidden=lastJob.status!=='done'||!lastJob.path;if(lastJob.path){const sv=$('exSaved');sv.textContent=lastJob.path.split(/[\\/]/).pop();sv.title=lastJob.path;$('exOpen').title=lastJob.folder??''}if(lastJob.status==='done'&&!lastJob.url)$('result').hidden=true;if(lastJob.status==='done'&&lastJob.url){$('result').href=lastJob.url;$('result').textContent='書き出したMP4を開く';$('result').dataset.revision=lastJob.revision}const was=busy;busy=lastJob.status==='running';status();if(busy)setTimeout(poll,1500);}catch(e:any){$('error').textContent=e.message}}
window.addEventListener('resize',fit);window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
{const bar=$('play').parentElement;const lt=document.createElement('button');lt.id='loopToggle';lt.onclick=()=>{loopOn=!loopOn;loopUi()};const sp=document.createElement('button');sp.id='stopRange';sp.textContent='停止';sp.onclick=stopRange;const ls=document.createElement('span');ls.id='loopState';bar.append(lt,sp,ls);loopUi()}
document.addEventListener('keydown',e=>{if(e.code!=='Space')return;const tag=(e.target as HTMLElement)?.tagName;if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag??'')&&!(tag==='INPUT'&&(e.target as HTMLInputElement).type==='range'))return;e.preventDefault();mode='live';if(audio.paused){if(loopRange)seek(Math.max(loopRange()[0],Math.min(audio.currentTime,loopRange()[1]-.05)),true);else audio.play().catch(()=>{})}else audio.pause()});
let previous=-1;function tick(){if(loopRange&&(!audio.paused||audio.ended)){const r=loopRange();const step=audio.ended?(loopOn?'restart':'stop'):loopStep(audio.currentTime,r,loopOn);if(step==='restart')seek(r[0],true);else if(step==='stop'){audio.pause();audio.currentTime=r[1];loopRange=null;loopUi()}}if(data&&mode==='live'){let n=Math.floor(audio.currentTime*(data?.fps??24));if(n!==previous){t=audio.currentTime;draw();previous=n}}requestAnimationFrame(tick)}
async function toolTabs(){let tools:any={};try{const r=await fetch('tools.json',{cache:'no-store'});if(r.ok)tools=await r.json()}catch{}
 const names:any={timing:['タイミング','切替や歌詞のタイミングを細かく調整（保存は次の本番書き出し npm run mv に反映）'],faces:['顔の位置','目・口の位置を直す（保存は次の npm run mv に反映）']};
 const bar=$('scenesTab').parentElement!;const ov=document.createElement('div');ov.id='toolOverlay';ov.hidden=true;ov.style.cssText='position:fixed;inset:0;z-index:50;background:#111;display:flex;flex-direction:column';
 const head=document.createElement('div');head.style.cssText='display:flex;gap:10px;align-items:center;padding:8px 12px;background:#1d2620;color:#eee';const back=document.createElement('button');back.textContent='← 歌詞・映像の編集に戻る';back.onclick=()=>{ov.hidden=true};const note=document.createElement('span');head.append(back,note);
 const fr=document.createElement('iframe');fr.style.cssText='flex:1;border:0;background:#fff';ov.append(head,fr);document.body.append(ov);
 for(const key of TOOL_TABS){const b=document.createElement('button');b.id=key+'Tab';b.textContent=names[key][0];b.title=names[key][1];b.onclick=()=>{if(!tools[key]){$('error').textContent=toolUnavailable(key,tools.reason);return}audio.pause();if(fr.dataset.k!==key){fr.src=tools[key];fr.dataset.k=key}note.textContent=names[key][0]+'：'+names[key][1];ov.hidden=false};bar.append(b)}}
/* 全画面プレビュー（映像だけ・16:9のまま黒帯・曲はそのまま再生） */
{const scr=$('screen'),bar=$('fsBar');let hideT:any=0;
 const toggle=()=>{if(document.fullscreenElement)document.exitFullscreen();else scr.requestFullscreen?.().catch((e:any)=>$('error').textContent='全画面にできません：'+e.message)};
 const wake=()=>{if(!document.fullscreenElement)return;bar.classList.remove('idle');scr.style.cursor='';clearTimeout(hideT);hideT=setTimeout(()=>{bar.classList.add('idle');scr.style.cursor='none'},2200)};
 $('fullscreen').onclick=toggle;scr.ondblclick=toggle;$('fsExit').onclick=toggle;
 $('fsPlay').onclick=()=>$('play').click();$('fsSeek').oninput=()=>{mode='live';loopRange=null;seek(Number($('fsSeek').value))};
 scr.addEventListener('mousemove',wake);
 document.addEventListener('fullscreenchange',()=>{const on=document.fullscreenElement===scr;bar.hidden=!on;$('fsSeek').max=data.duration;fit();draw();if(on)wake();else{clearTimeout(hideT);scr.style.cursor=''}});
 document.addEventListener('keydown',e=>{const tag=(e.target as HTMLElement)?.tagName;if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(tag??'')){e.preventDefault();toggle()}});
 const sync=()=>{$('fsPlay').textContent=audio.paused?'再生':'一時停止'};audio.addEventListener('play',sync);audio.addEventListener('pause',sync)}
load().then(()=>{requestAnimationFrame(tick);poll();toolTabs()}).catch(e=>$('error').textContent=e.message);





{const sv=$('save');const u=document.createElement('button');u.id='undoBtn';u.textContent='↶';u.title='元に戻す（Ctrl+Z）';u.setAttribute('aria-label','元に戻す');u.onclick=undo;const r=document.createElement('button');r.id='redoBtn';r.textContent='↷';r.title='やり直す（Ctrl+Y／Ctrl+Shift+Z）';r.setAttribute('aria-label','やり直す');r.onclick=redo;u.className=r.className='histBtn';sv.before(u,r);undoUi()}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||isTextField(e.target))return;const k=e.key.toLowerCase();
 if(k==='z'&&!e.shiftKey){e.preventDefault();undo()}else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo()}});

// Compare this loaded bundle with the runtime build without discarding edits.
{const v=document.createElement('span');v.id='editorVersion';v.style.fontSize='11px';v.textContent='エディター '+__EDITOR_BUILD__;$('catalogCount').after(v);const check=async()=>{try{const r=await fetch('editor-version.json',{cache:'no-store'});if(!r.ok)return;const n=await r.json();if(n.buildId!==__EDITOR_BUILD__)v.textContent='新しいエディターがあります。未保存の編集を保存してから再読み込みしてください。'}catch{}};window.addEventListener('focus',check);setInterval(check,30000);check()}
