// Cache prepared files and compiled code, never the editable data or rendered frames.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function stamp(file){const s=fs.statSync(file,{bigint:true});return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':')}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?files(p):e.isFile()?[p]:[]})}
export function renderCodeKey(remotion){
 const hash=crypto.createHash('sha256');
 for(const name of ['editor','src','vendor'])for(const file of files(path.join(remotion,name))){
  const rel=path.relative(remotion,file).replaceAll('\\','/');
  if(rel.split('/').some(p=>p.startsWith('.')||p==='node_modules'||p==='__pycache__')||! /\.(tsx?|m?js|json|css|html)$/.test(rel)||rel.endsWith('/style-catalog.json'))continue;
  hash.update(rel);hash.update('\0');hash.update(fs.readFileSync(file));
 }
 for(const name of ['package-lock.json','tsconfig.json','remotion.config.ts']){const p=path.join(remotion,name);if(fs.existsSync(p)){hash.update(name);hash.update(fs.readFileSync(p))}}
 return hash.digest('hex');
}
export function createRenderCache(work){
 const filename=path.join(work,'.render-cache.json');let state;
 try{state=JSON.parse(fs.readFileSync(filename,'utf8'))}catch{}
 if(state?.version!==1||!state.files||typeof state.files!=='object'||Array.isArray(state.files))state={version:1,files:{}};
 const used=new Map();let copied=0,reused=0;
 const relative=file=>{const rel=path.relative(work,file);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Render cache path must stay inside project output');return rel.replaceAll('\\','/')};
 const matches=(file,value)=>{try{return stamp(file)===value}catch{return false}};
 return {
  copy(source,dest,transform=''){
   const rel=relative(dest),key=JSON.stringify([path.resolve(source),stamp(source),transform]);used.set(rel,key);
   const old=state.files[rel];if(old?.key===key&&matches(dest,old.stamp)){reused++;return false}
   fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);state.files[rel]={key,stamp:stamp(dest)};copied++;return true;
  },
  refresh(dest){state.files[relative(dest)].stamp=stamp(dest)},
  copyTree(source,dest){for(const file of files(source))this.copy(file,path.join(dest,path.relative(source,file)))},
  prune(dir){
   const prefix=path.resolve(dir)+path.sep;relative(dir);
   for(const [rel,old] of Object.entries(state.files)){
    const file=path.resolve(work,rel);if(!file.startsWith(prefix)||used.has(rel))continue;
    if(matches(file,old.stamp))fs.unlinkSync(file);
    if(!fs.existsSync(file))delete state.files[rel];
   }
  },
  publicKey(){return digest(JSON.stringify([...used].sort(([a],[b])=>a.localeCompare(b,'en'))))},
  bundle(key){
   const old=state.bundle;if(old?.key!==key||typeof old.dir!=='string'||!Array.isArray(old.files))return null;
   const dir=path.resolve(work,old.dir);if(path.dirname(dir)!==path.resolve(work)||!path.basename(dir).startsWith('.render-bundle-'))return null;
   if(!old.files.length||!old.files.every(item=>{if(!Array.isArray(item)||item.length!==2||item.some(v=>typeof v!=='string'))return false;const [name,value]=item,p=path.resolve(dir,name);return p.startsWith(dir+path.sep)&&matches(p,value)}))return null;
   return dir;
  },
  setBundle(key,dir){state.bundle={key,dir:relative(dir),files:files(dir).map(file=>[path.relative(dir,file),stamp(file)])}},
  save(){const temp=filename+'.tmp-'+process.pid;fs.writeFileSync(temp,JSON.stringify(state));fs.renameSync(temp,filename)},
  get stats(){return {copied,reused}},
 };
}
