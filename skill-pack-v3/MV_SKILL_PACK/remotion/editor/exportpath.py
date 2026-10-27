"""Export destination helpers (folder picker, name rules, validation). Pure parts are unit-tested."""
import os,re,sys,json,subprocess,tempfile
from pathlib import Path
BAD=re.compile(r'[<>:"/\\|?*\x00-\x1f]')
RESERVED={'CON','PRN','AUX','NUL',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}
def safe_name(name,title='MV',n=1):
    """file name only (no folders), Windows-safe, always .mp4. Empty -> <title>_v<n>.mp4"""
    s=str(name or '').strip()
    if not s:s=f'{title or "MV"}_v{n}'
    s=BAD.sub('_',Path(s.replace('\\','/')).name).strip(' .')
    if s.lower().endswith('.mp4'):s=s[:-4].rstrip(' .')
    if not s or s.upper() in RESERVED:s='_'+s if s else 'MV'
    return s[:120]+'.mp4'
def unique_path(folder,name):
    """never overwrite: a.mp4 -> a (2).mp4 -> a (3).mp4"""
    p=Path(folder)/name;stem,ext=p.stem,p.suffix;k=2
    while p.exists():p=Path(folder)/f'{stem} ({k}){ext}';k+=1
    return p
def check_folder(path):
    """returns an absolute Path that exists and is writable; Japanese ValueError otherwise."""
    s=str(path or '').strip().strip('"')
    if not s:raise ValueError('保存先フォルダを指定してください')
    p=Path(os.path.expandvars(os.path.expanduser(s)))
    if not p.is_absolute():raise ValueError('保存先は「C:\\Users\\…」のようなフルパスで指定してください')
    if p.exists() and not p.is_dir():raise ValueError('指定した保存先はフォルダではありません（ファイルです）')
    try:p.mkdir(parents=True,exist_ok=True)
    except OSError as e:raise ValueError(f'保存先フォルダを作れませんでした：{p}（{e.strerror or e}）')
    try:
        fd,t=tempfile.mkstemp(dir=p,prefix='.mv-write-test-');os.close(fd);os.unlink(t)
    except OSError:raise ValueError(f'このフォルダには書き込めません：{p}（別のフォルダを選んでください）')
    return p.resolve()
TK="import tkinter as t,tkinter.filedialog as f,sys\nr=t.Tk();r.withdraw();r.attributes('-topmost',True);r.update()\nd=f.askdirectory(parent=r,initialdir=sys.argv[1] or None,title='MP4の保存先フォルダを選ぶ',mustexist=False)\nprint(d or '',end='')"
PS=("Add-Type -AssemblyName System.Windows.Forms;$f=New-Object System.Windows.Forms.FolderBrowserDialog;$f.Description='MP4の保存先フォルダを選ぶ';"
    "$f.SelectedPath=$env:MV_INIT;$w=New-Object System.Windows.Forms.Form;$w.TopMost=$true;if($f.ShowDialog($w) -eq 'OK'){[Console]::OutputEncoding=[Text.Encoding]::UTF8;Write-Output $f.SelectedPath}")
def pick_folder(initial=''):
    """native dialog on the user's PC. returns (folder or '', available:boolean)."""
    if os.environ.get('MV_NO_PICKER'):return '',False
    try:
        r=subprocess.run([sys.executable,'-c',TK,str(initial or '')],capture_output=True,text=True,encoding='utf-8',timeout=600)
        if r.returncode==0:return r.stdout.strip(),True
    except Exception:pass
    if os.name=='nt':
        try:
            r=subprocess.run(['powershell','-NoProfile','-STA','-Command',PS],capture_output=True,text=True,encoding='utf-8',timeout=600,env={**os.environ,'MV_INIT':str(initial or '')})
            if r.returncode==0:return r.stdout.strip(),True
        except Exception:pass
    return '',False
def open_folder(p):
    p=str(p)
    if os.name=='nt':os.startfile(p)  # type: ignore[attr-defined]
    elif sys.platform=='darwin':subprocess.Popen(['open',p])
    else:subprocess.Popen(['xdg-open',p],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def next_version(folder,title):
    pat=re.compile(re.escape(safe_name(title or 'MV')[:-4])+r'_v(\d+)')
    ns=[int(m.group(1)) for f in Path(folder).glob('*.mp4') if (m:=pat.match(f.stem))] if Path(folder).is_dir() else []
    return max(ns,default=0)+1
