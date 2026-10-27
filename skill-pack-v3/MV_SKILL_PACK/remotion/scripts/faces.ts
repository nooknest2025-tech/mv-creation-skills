// npm run faces [-- --project 曲名 --port 5179]
// Browser picker for the face rig used by native 目パチ / 口パク: click 左目 → 右目 → 口 on each image,
// adjust size, or mark 顔なし. Saves projects/<曲名>/faces_manual.json (applied on the next npm run preview / mv).
import http from "node:http";
import { PROJECTS_DIR, REMOTION_DIR, UserError, fail, fs, log, parseArgs, path } from "./common";
import { readJson, writeJson } from "./project";

const { o } = parseArgs(process.argv.slice(2));
function latest() {
  const ds = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "media.json"))) : [];
  const n = (o.project as string) ?? ds.sort((a, b) => fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs - fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs)[0];
  if (!n) throw new UserError("プロジェクトがありません", "先に npm run preview を1回実行してください。");
  return path.join(PROJECTS_DIR, n);
}

const HTML = `<!doctype html><meta charset="utf-8"><title>顔の位置（目パチ・口パク）</title><style>body{background:#16141c;color:#eee;font-family:sans-serif;margin:14px}.c{display:inline-block;margin:8px;vertical-align:top;background:#221e2a;padding:8px;border-radius:8px}canvas{max-width:460px;cursor:crosshair}button{margin:3px;padding:5px 9px;border:0;border-radius:5px}</style>
<h2>🙂 目と口の位置</h2><p>画像をクリック: <b>①左目 → ②右目 → ③口</b>（3回で1セット）。大きさはスライダー。顔がない画像は「顔なし」。最後に「保存して作り直す」。</p>
<button id=save style="background:#2a9d5a;color:#fff">💾 保存して作り直す</button> <span id=msg></span><div id=L></div>
<script>let D;const st={};
async function load(){D=await fetch('/data').then(r=>r.json());const L=document.getElementById('L');L.innerHTML='';
D.items.forEach(it=>{st[it.orig]=it.face&&it.face!=='none'?JSON.parse(JSON.stringify(it.face)):(it.face==='none'?'none':null);
const c=document.createElement('div');c.className='c';c.innerHTML='<div>'+it.orig+' <small>'+(it.source||'')+'</small></div><canvas></canvas><br>目の大きさ <input type=range min=0.01 max=0.12 step=0.002 class=es> 口 <input type=range min=0.01 max=0.12 step=0.002 class=ms><br><button class=none>顔なし</button><button class=clr>クリア</button>';
L.appendChild(c);const cv=c.querySelector('canvas'),im=new Image();im.src='/img/'+encodeURIComponent(it.src);let clicks=[];
const draw=()=>{cv.width=im.width;cv.height=im.height;const x=cv.getContext('2d');x.drawImage(im,0,0);const f=st[it.orig];if(f==='none'){x.fillStyle='rgba(0,0,0,.5)';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#fff';x.font=(cv.width/12)+'px sans-serif';x.fillText('顔なし',20,cv.width/8);return}
if(!f)return;x.lineWidth=Math.max(2,cv.width/300);(f.eyes||[]).forEach(e=>{x.strokeStyle='#0f0';x.beginPath();x.ellipse(e[0]*cv.width,e[1]*cv.height,e[2]*cv.width,e[3]*cv.height,0,0,7);x.stroke()});if(f.mouth){const m=f.mouth;x.strokeStyle='#f0f';x.beginPath();x.ellipse(m[0]*cv.width,m[1]*cv.height,m[2]*cv.width,m[3]*cv.height,0,0,7);x.stroke()}};
im.onload=()=>{draw();const f=st[it.orig];if(f&&f.eyes&&f.eyes[0])c.querySelector('.es').value=f.eyes[0][2];if(f&&f.mouth)c.querySelector('.ms').value=f.mouth[2]};
cv.onclick=ev=>{const r=cv.getBoundingClientRect(),u=(ev.clientX-r.left)/r.width,v=(ev.clientY-r.top)/r.height;clicks.push([u,v]);const es=+c.querySelector('.es').value||0.035,ms=+c.querySelector('.ms').value||0.04;
const a=im.width/im.height;if(clicks.length===1)st[it.orig]={eyes:[[u,v,es,es*a*0.8]],mouth:null};else if(clicks.length===2)st[it.orig].eyes.push([u,v,es,es*a*0.8]);else{st[it.orig].mouth=[u,v,ms,ms*a*0.55];clicks=[]}draw()};
c.querySelector('.es').oninput=e=>{const f=st[it.orig];if(f&&f.eyes)f.eyes.forEach(q=>{q[2]=+e.target.value;q[3]=q[2]*im.width/im.height*0.8});draw()};
c.querySelector('.ms').oninput=e=>{const f=st[it.orig];if(f&&f.mouth){f.mouth[2]=+e.target.value;f.mouth[3]=f.mouth[2]*im.width/im.height*0.55}draw()};
c.querySelector('.none').onclick=()=>{st[it.orig]='none';clicks=[];draw()};c.querySelector('.clr').onclick=()=>{st[it.orig]=null;clicks=[];draw()}})}
document.getElementById('save').onclick=async()=>{const m=document.getElementById('msg');m.textContent='保存中…';const r=await fetch('/save',{method:'POST',body:JSON.stringify(st)}).then(r=>r.json());m.textContent=r.ok?'✅ 保存しました。npm run preview で確認してください':'⚠️ '+r.log;load()};load()</script>`;

if (process.argv[1]?.match(/faces\.ts$/)) {
  try {
    const dir = latest(), port = Number(o.port ?? 5179);
    http.createServer((req, res) => {
      try {
        if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HTML); return; }
        if (req.url === "/data") {
          const media = readJson<any[]>(path.join(dir, "media.json"), []).filter((m) => m.kind === "image");
          const manual = readJson<Record<string, any>>(path.join(dir, "faces_manual.json"), {});
          const items = media.map((m) => ({ src: m.src, orig: m.orig, face: manual[m.orig] ?? (m.face ? { eyes: m.face.eyes, mouth: m.face.mouth } : null), source: manual[m.orig] ? "手動" : m.face ? "自動" : "未検出" }));
          const b = JSON.stringify({ items }); res.writeHead(200, { "content-type": "application/json" }); res.end(b); return;
        }
        if (req.url?.startsWith("/img/")) { const f = path.join(REMOTION_DIR, "public", decodeURIComponent(req.url.slice(5))); res.writeHead(200); fs.createReadStream(f).pipe(res); return; }
        if (req.url === "/save" && req.method === "POST") {
          let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
            const st = JSON.parse(b), manual = readJson<Record<string, any>>(path.join(dir, "faces_manual.json"), {});
            for (const [k, v] of Object.entries(st)) { if (v === null) delete manual[k]; else manual[k] = v; }
            writeJson(path.join(dir, "faces_manual.json"), manual);
            const body = JSON.stringify({ ok: true, log: "" });
            res.writeHead(200, { "content-type": "application/json" }); res.end(body);
          }); return;
        }
        res.writeHead(404); res.end();
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    }).listen(port, "127.0.0.1", () => log(`🙂 顔の位置エディタ: http://127.0.0.1:${port}/ （保存すると次の npm run mv / preview に反映。Ctrl+C で終了）`));
  } catch (e) { fail(e); }
}
