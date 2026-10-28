"""Project-local edit/save/render API. One canonical state; immutable export snapshots."""
import os,json,re,math,threading,subprocess,time,hashlib,shutil
from pathlib import Path
import sys;sys.path.insert(0,str(Path(__file__).resolve().parent))
from exportpath import safe_name,unique_path,check_folder,pick_folder,open_folder,next_version,save_as,resolve_target
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--root',required=True)
parser.add_argument('--port',type=int,default=5195)
args=parser.parse_args()
EDITOR=Path(__file__).resolve().parent
ROOT=Path(args.root).resolve()
os.chdir(ROOT)
STATE=ROOT/'editor-state.json'
LOCK=threading.RLock(); JOB={'status':'idle'}
if not STATE.exists():raise SystemExit('編集データがありません。npm run editor -- --project ... から起動してください')

ADD_EXT={'.png','.jpg','.jpeg','.webp','.gif','.svg','.mp4','.mov','.m4v','.webm'};VIDEO_EXT={'.mp4','.mov','.m4v','.webm'};ADD_MAX=2*1024**3
SETTINGS_NAME='export-settings.json'
def settings():
    try:return json.loads((ROOT/SETTINGS_NAME).read_text(encoding='utf-8'))
    except Exception:return {}
def export_info():
    st=settings();folder=st.get('folder') or str(ROOT)
    if not Path(folder).is_dir():folder=str(ROOT)
    title=(read()['data'].get('title') or 'MV')
    return {'folder':folder,'default':str(ROOT),'suggestedName':safe_name('',title,next_version(folder,title))}
def read():return json.loads(STATE.read_text(encoding='utf-8'))
LYRIC_EDIT_KEYS=['motion','params','font','fill','stroke','accent','scale','y','position','angle','effect','effectOffset','motionDuration','entrance','departure','transitionDuration','stageStyle']
SCENE_EDIT_KEYS=['stage','camera','cameraMove','cameraStrength','cameraSync','zoom','x','y']
STAGE_STYLES=['auto','tate','bigBehind','band','pop','ghost','center']
def mark_edited(d):
    """v6.5 (mirror of src/lib/lyricEdits.tsx): built-in look = default, editor edits always win. `edited` = keys that differ from original-source.json."""
    try:orig=json.loads((ROOT/'original-source.json').read_text(encoding='utf-8'))
    except Exception:return d
    L={l.get('id'):l for l in orig.get('lyrics',[])};S={x.get('id'):x for x in orig.get('scenes',[])}
    def diff(x,base,keys):
        if not base:return []
        out=[]
        for k in keys:
            if k not in x and k not in base:continue
            if k=='stageStyle' and x.get(k,'auto')==base.get(k,'auto'):continue
            if json.dumps(x.get(k),sort_keys=True)!=json.dumps(base.get(k),sort_keys=True):out.append(k)
        return out
    for l in d.get('lyrics',[]):
        e=diff(l,L.get(l.get('id')) or L.get(((l.get('sourceParts') or [{}])[0]).get('line')),LYRIC_EDIT_KEYS)
        if e:l['edited']=e
        else:l.pop('edited',None)
    if isinstance(d.get('stage'),dict) and d['stage'] and not orig.get('stage'):d['editedStage']=True
    else:d.pop('editedStage',None)
    for x in d.get('scenes',[]):
        e=diff(x,S.get(x.get('id')),SCENE_EDIT_KEYS)
        if e:x['edited']=e
        else:x.pop('edited',None)
    return d
def validate(d):
    orig=json.loads((ROOT/'original-source.json').read_text(encoding='utf-8'))
    if any(d.get(k)!=orig.get(k) for k in ['width','height','fps']):raise ValueError('画面サイズとfpsは元の設定を保持してください')
    if d.get('audioFile')!=orig['audioFile'] or d.get('assets')!=orig['assets']:raise ValueError('元素材の指定は保持してください')
    if d.get('duration')!=orig['duration'] or not 1<=len(d['lyrics'])<=200 or not 1<=len(d['scenes'])<=300:raise ValueError('曲尺・場面数（1〜300）または歌詞グループ数を確認してください')
    sids=[s.get('id') for s in d['scenes']]
    if any(not isinstance(x,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',x) for x in sids) or len(set(sids))!=len(sids):raise ValueError('場面IDを確認してください（切る・つなげるで重複しないように）')
    def finite(x):return isinstance(x,(float,int)) and math.isfinite(x)
    for i,s in enumerate(d['scenes']):
        if not finite(s['start']) or not 0<=s['start']<d['duration'] or s['asset'] not in range(len(orig['assets'])):raise ValueError('場面の設定を確認してください')
        if i==0 and s['start']!=0:raise ValueError('最初の場面は0秒からです')
        if i and s['start']<=d['scenes'][i-1]['start']+.05:raise ValueError('切替秒は前の場面より後にしてください')
        end=d['scenes'][i+1]['start'] if i<len(d['scenes'])-1 else d['duration']
        if not finite(s['transition']) or not 0<=s['transition']<=min(4,end-s['start']):raise ValueError('フェード秒は0〜4秒、かつ場面の長さ以内です')
        for key in ['x','y']:
            if not finite(s.get(key,0)) or not -100<=s.get(key,0)<=100:raise ValueError('画像位置は-100〜100です')
        if not finite(s.get('zoom',1)) or not 1<=s.get('zoom',1)<=3:raise ValueError('画像の拡大率は1〜3倍です')
        if not isinstance(s.get('camera',True),bool):raise ValueError('自動カメラの設定を確認してください')
        for key in ['cameraMove','cameraStrength','cameraSync']:
            if key in s and not (isinstance(s[key],str) and len(s[key])<40):raise ValueError('カメラの設定を確認してください')
        if 'speed' in s and not (finite(s['speed']) and .1<=s['speed']<=4):raise ValueError('動画の速さは0.1〜4倍です')
        if 'clipChain' in s and not isinstance(s['clipChain'],bool):raise ValueError('つなぎの設定を確認してください')
        if 'fit' in s and not isinstance(s['fit'],bool):raise ValueError('「場面の長さに合わせる」の設定を確認してください')
        if s.get('tail','auto') not in ['auto','hold','loop']:raise ValueError('動画が足りないときの動きを確認してください')
        a=orig['assets'][s['asset']];clip=a.get('duration') if isinstance(a,dict) else None
        if 'clipTo' in s and (not finite(s['clipTo']) or s['clipTo']<=s.get('clipFrom',0)+.04 or (finite(clip) and s['clipTo']>clip+.001)):raise ValueError('動画の終わり位置は開始位置より後・動画の長さ以内です')
        if 'segments' in s:
            g=s['segments']
            if not isinstance(g,list) or not 1<=len(g)<=8 or any(not isinstance(x,dict) or not finite(x.get('at')) or not finite(x.get('speed')) or not .1<=x['speed']<=4 for x in g):raise ValueError('速さの区間は1〜8個、速さは0.1〜4倍です')
            if g[0]['at']!=0 or any(not g[k-1]['at']<g[k]['at']<end-s['start'] for k in range(1,len(g))):raise ValueError('速さを変える位置は0秒から始めて順番に、場面の中に置いてください')
        if 'ease' in s and not (finite(s['ease']) and 0<=s['ease']<=2):raise ValueError('なめらかに変える時間は0〜2秒です')
        if 'solve' in s and not (isinstance(s['solve'],int) and not isinstance(s['solve'],bool) and 0<=s['solve']<len(s.get('segments',[]))):raise ValueError('自動で合わせる区間を確認してください')
        if 'clipFrom' in s:
            if not finite(s['clipFrom']) or s['clipFrom']<0 or (finite(clip) and s['clipFrom']>=clip):raise ValueError('動画の開始位置は0秒以上・動画の長さ未満です')
        if not isinstance(s.get('effects',[]),list) or len(s.get('effects',[]))>40 or any(not isinstance(e,dict) or not isinstance(e.get('id'),str) for e in s.get('effects',[])):raise ValueError('エフェクトの設定を確認してください')
    for r in d.get('effectRanges',[]) or []:
        if not isinstance(r,dict) or not isinstance(r.get('id'),str) or not finite(r.get('start')) or not finite(r.get('end')) or not r['end']>r['start']:raise ValueError('範囲エフェクトの開始・終了秒を確認してください')
    catalog=json.loads((EDITOR/'style-catalog.json').read_text(encoding='utf-8'))
    original={f'L{i+1:03}':line['text'] for i,line in enumerate(orig.get('sourceLyrics',orig['lyrics']))}
    expected=[(key,i) for key,text in original.items() for i in range(len(text))]
    coverage=[];ids=set()
    for i,l in enumerate(d['lyrics']):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',l['id']) or l['id'] in ids:raise ValueError('歌詞IDを確認してください')
        ids.add(l['id']);source=l.get('sourceParts',[{'line':l['id'],'start':0,'end':len(l['text'])}]);text=''
        for part in source:
            key=part['line'];a=part['start'];b=part['end']
            if key not in original or not isinstance(a,int) or not isinstance(b,int) or not 0<=a<b<=len(original[key]):raise ValueError('元の歌詞の範囲を確認してください')
            text+=original[key][a:b];coverage.extend((key,n) for n in range(a,b))
        if text!=l['text']:raise ValueError('元の歌詞を保持してください')
        for k in ['start','end','scale','y','motionDuration']:
            if not finite(l[k]):raise ValueError('数値を確認してください')
        if not 0<=l['start']<l['end']<=d['duration']-1:raise ValueError('歌詞の開始・終了を曲内に収めてください（最後の1秒は文字なし）')
        # Overlapping lines are supported by the shared scene renderer.
        if l['motion'] not in catalog or not .3<=l['scale']<=3 or not .15<=l['y']<=.85 or not .1<=l['motionDuration']<=3:raise ValueError('文字設定の範囲を確認してください')
        fonts=json.loads((EDITOR/'font-options.json').read_text(encoding='utf-8'))
        if l.get('font','noto_serif') not in [f['id'] for f in fonts]:raise ValueError('利用できる書体を選択してください')
        if not finite(l.get('angle',0)) or not -180<=l.get('angle',0)<=180:raise ValueError('角度は-180〜180度です')
        if l.get('position','manual') not in ['manual','tl','tc','tr','ml','mc','mr','bl','bc','br']:raise ValueError('配置を確認してください')
        if l.get('effect','none') not in ['none','double','shadow','glow','rgb'] or not finite(l.get('effectOffset',6)) or not 1<=l.get('effectOffset',6)<=24:raise ValueError('文字効果を確認してください')
        for key in ['entrance','departure']:
            if l.get(key,'none') not in ['none','lr','tb','fade']:raise ValueError('文字の入り方・消え方を確認してください')
        if not finite(l.get('transitionDuration',.7)) or not .1<=l.get('transitionDuration',.7)<=2:raise ValueError('文字の切替時間は0.1〜2秒です')
        if l.get('stageStyle','auto') not in STAGE_STYLES:raise ValueError('ステージの文字スタイルを確認してください')
        for key in ['fill','accent','stroke']:
            if key in l and not re.fullmatch(r'#[0-9a-fA-F]{6}',l[key]):raise ValueError('色を確認してください')
    for patch in [d.get('stage')]+[s.get('stage') for s in d['scenes']]:  # v6.6 editor stage patches (characters / guests / telops)
        if patch is not None and (not isinstance(patch,dict) or len(json.dumps(patch))>60000):raise ValueError('ステージ（キャラ・ゲスト・テロップ）の設定を確認してください')
    if coverage!=expected:raise ValueError('歌詞の欠落・重複・並び順を確認してください')

def render(snapshot,out):
    global JOB
    try:
        log=ROOT/(out.stem+'.log')
        with log.open('w',encoding='utf-8') as f:
            p=subprocess.Popen(['node',str(EDITOR/'export.mjs'),str(snapshot),str(out)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
            for line in p.stdout:
                f.write(line);f.flush()
                if line.strip().isdigit():
                    with LOCK:JOB['progress']=int(line.strip())
            if p.wait():raise RuntimeError('書き出しログを確認してください: '+log.name)
        if not out.exists():raise RuntimeError('出力ファイルがありません')
        with LOCK:
            JOB.update(status='done',progress=100,path=str(out),folder=str(out.parent),url=('/'+out.relative_to(ROOT).as_posix()) if out.parent==ROOT else None)
            (ROOT/'last-export.json').write_text(json.dumps(JOB,ensure_ascii=False),encoding='utf-8')
    except Exception as e:
        with LOCK:JOB.update(status='failed',error=str(e))

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store');super().end_headers()
    def respond(self,d,status=200):
        b=json.dumps(d,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        if self.path=='/api/state':
            with LOCK:return self.respond(read())
        if self.path=='/api/export-settings':
            with LOCK:return self.respond(export_info())
        if self.path=='/api/job':
            with LOCK:
                job=JOB.copy()
                if job['status']=='idle' and (ROOT/'last-export.json').exists():job=json.loads((ROOT/'last-export.json').read_text(encoding='utf-8'))
                return self.respond(job)
        super().do_GET()
    def add_asset(self,size):
        """add an image/video from the user's PC (raw body). Appended to assets in BOTH the state and original-source
        so the 'assets are preserved' check keeps passing; existing assets are never changed or removed."""
        from urllib.parse import urlparse,parse_qs
        q=parse_qs(urlparse(self.path).query);name=Path(q.get('name',[''])[0]).name
        ext=Path(name).suffix.lower()
        if ext not in ADD_EXT:return self.respond({'error':'追加できるのは mp4 / mov / webm / png / jpg / webp / gif / svg です'},400)
        if not 0<size<=ADD_MAX:return self.respond({'error':'ファイルが大きすぎるか空です（2GBまで）'},400)
        with LOCK:
            folder=ROOT/'assets';folder.mkdir(exist_ok=True)
            dest=folder/f'added-{time.time_ns()}{ext}';left=size
            with open(dest,'wb') as f:
                while left>0:
                    b=self.rfile.read(min(left,1<<20))
                    if not b:break
                    f.write(b);left-=len(b)
            if left:dest.unlink(missing_ok=True);return self.respond({'error':'アップロードが途中で切れました'},400)
            asset={'src':'assets/'+dest.name,'label':name+('（動画）' if ext in VIDEO_EXT else '')}
            if ext in VIDEO_EXT:
                asset['kind']='video'
                try:
                    dur=float(q.get('duration',['0'])[0])
                    if math.isfinite(dur) and dur>0:asset['duration']=round(dur,3)
                except ValueError:pass
            origp=ROOT/'original-source.json';orig=json.loads(origp.read_text(encoding='utf-8'));orig['assets'].append(asset)
            origp.write_text(json.dumps(orig,ensure_ascii=False,indent=2),encoding='utf-8')
            cur=read();cur['data']['assets'].append(asset);STATE.write_text(json.dumps(cur,ensure_ascii=False,indent=2),encoding='utf-8')
            return self.respond({'asset':asset,'index':len(orig['assets'])-1})
    def do_POST(self):
        global JOB
        try:
            origin=self.headers.get('Origin','')
            if origin and origin not in [f'http://127.0.0.1:{self.server.server_address[1]}',f'http://localhost:{self.server.server_address[1]}']:return self.respond({'error':'別のページからは保存できません'},403)
            size=int(self.headers.get('Content-Length','0'))
            if self.path.startswith('/api/add-asset'):return self.add_asset(size)
            if not 0<size<200000:return self.respond({'error':'入力サイズを確認してください'},400)
            body=json.loads(self.rfile.read(size))
            with LOCK:
                current=read()
                if body.get('revision')!=current['revision']:return self.respond({'error':'ほかの画面か日本語の指示（npm run edit）で内容が更新されています。ページを再読み込みすると最新の内容が表示されます（再読み込み前の未保存の変更は消えます）'},409)
                if self.path=='/api/reload-catalog':
                    if JOB['status']=='running':return self.respond({'error':'書き出し完了後に追加分を読み込んでください'},409)
                    result=subprocess.run(['node',str(EDITOR/'build.mjs'),str(ROOT)],capture_output=True,text=True,encoding='utf-8',errors='replace')
                    if result.returncode:raise RuntimeError('登録一覧の更新に失敗しました: '+result.stderr[-500:])
                    return self.respond({'ok':True})
                if self.path=='/api/save':
                    validate(body['data']);mark_edited(body['data']); rev=current['revision']+1
                    history=ROOT/'edit-history';history.mkdir(exist_ok=True)
                    shutil.copyfile(STATE,history/f'rev-{current["revision"]}-{time.time_ns()}.json')
                    new={'revision':rev,'data':body['data']};temp=STATE.with_suffix('.tmp');temp.write_text(json.dumps(new,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(STATE)
                    return self.respond({'revision':rev})
                if self.path=='/api/save-as':
                    info=export_info();path,ok=save_as(info['folder'],info['suggestedName'])
                    return self.respond({'path':path,'available':ok,'cancelled':ok and not path,**info})
                if self.path=='/api/pick-folder':
                    folder,ok=pick_folder(body.get('initial') or export_info()['folder'])
                    return self.respond({'folder':folder,'available':ok})
                if self.path=='/api/export-settings':
                    folder=check_folder(body.get('folder'));(ROOT/SETTINGS_NAME).write_text(json.dumps({**settings(),'folder':str(folder)},ensure_ascii=False,indent=2),encoding='utf-8')
                    return self.respond(export_info())
                if self.path=='/api/open-folder':
                    f=Path(JOB.get('folder') or (json.loads((ROOT/'last-export.json').read_text(encoding='utf-8')).get('folder') if (ROOT/'last-export.json').exists() else '') or ROOT)
                    if not f.is_dir():raise ValueError('フォルダが見つかりません：'+str(f))
                    open_folder(f);return self.respond({'ok':True,'folder':str(f)})
                if self.path=='/api/render':
                    if JOB['status']=='running':return self.respond({'error':'書き出し中です'},409)
                    validate(current['data']);stamp=time.time_ns();name=f'edit-r{current["revision"]}-{stamp}'
                    title=current['data'].get('title') or 'MV'
                    if body.get('path'):out=resolve_target(body['path']);folder=out.parent  # chosen in the Save-As dialog (overwrite confirmed there)
                    else:
                        folder=check_folder(body.get('folder') or export_info()['folder'])
                        out=unique_path(folder,safe_name(body.get('name'),title,next_version(folder,title)))
                    if body.get('path') or body.get('folder'):(ROOT/SETTINGS_NAME).write_text(json.dumps({**settings(),'folder':str(folder)},ensure_ascii=False,indent=2),encoding='utf-8')
                    mark_edited(current['data']);snapshot=ROOT/(name+'.json');snapshot.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf-8')
                    JOB={'status':'running','revision':current['revision'],'progress':0,'snapshot':snapshot.name,'hash':hashlib.sha256(snapshot.read_bytes()).hexdigest()}
                    threading.Thread(target=render,args=(snapshot,out),daemon=True).start();return self.respond(JOB)
                self.respond({'error':'見つかりません'},404)
        except (ValueError,KeyError,TypeError) as e:self.respond({'error':str(e)},400)
        except Exception as e:self.respond({'error':str(e)},500)
    def send_head(self):
        path=self.translate_path(self.path);match=re.match(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
        if not match or not os.path.isfile(path):return super().send_head()
        size=os.path.getsize(path);start=int(match[1]);end=min(int(match[2]) if match[2] else size-1,size-1)
        if start>=size or end<start:self.send_error(416);return None
        self.send_response(206);self.send_header('Content-Type',self.guess_type(path));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers();self.remaining=end-start+1;f=open(path,'rb');f.seek(start);return f
    def copyfile(self,source,output):
        if not hasattr(self,'remaining'):return super().copyfile(source,output)
        while self.remaining:
            b=source.read(min(65536,self.remaining))
            if not b:break
            output.write(b);self.remaining-=len(b)
        del self.remaining
# On Windows SO_REUSEADDR lets two servers share a port silently; keep binding exclusive.
class Server(ThreadingHTTPServer):allow_reuse_address=os.name!='nt'
server=None
for port in range(args.port,args.port+30):
    try:server=Server(('127.0.0.1',port),Handler);break
    except OSError:print(f'ポート {port} は使用中のため次を試します',flush=True)
if server is None:raise SystemExit(f'空きポートがありません（{args.port}〜{args.port+29}）。--port で別の番号を指定してください')
print(f'http://127.0.0.1:{server.server_address[1]}/editor.html',flush=True)
server.serve_forever()


