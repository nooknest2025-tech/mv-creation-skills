import {build} from 'esbuild';
import YAML from 'yaml';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath,pathToFileURL} from 'node:url';
export const editorDir=path.dirname(fileURLToPath(import.meta.url));
export const remotionDir=path.resolve(editorDir,'..');
export const packDir=path.resolve(remotionDir,'..');
export function editorBuildId(){
 const hash=crypto.createHash('sha256');
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).forEach(e=>{
  if(e.name.startsWith('.')||['sample','node_modules','__pycache__'].includes(e.name))return;
  const file=path.join(dir,e.name);
  if(e.isDirectory())walk(file);else if(/\.(tsx?|mjs|json|css|html)$/.test(e.name)&&e.name!=='style-catalog.json'){
   hash.update(path.relative(remotionDir,file).replaceAll('\\','/'));hash.update('\0');hash.update(fs.readFileSync(file));
  }
 });
 walk(editorDir);walk(path.join(remotionDir,'src'));return hash.digest('hex').slice(0,12);
}
export async function buildEditor(runtime){
 fs.mkdirSync(runtime,{recursive:true});
 const registry=YAML.parse(fs.readFileSync(path.join(packDir,'fonts.yaml'),'utf8')).fonts;
 const extras=JSON.parse(fs.readFileSync(path.join(editorDir,'extra-fonts.json'),'utf8'));
 const fonts=[...registry,...extras].filter(f=>f.jp&&fs.existsSync(path.join(remotionDir,'public/fonts',f.file)));
 if(!fonts.length)throw Error('日本語フォントがありません。remotionで npm run fonts:fetch を実行してください。');
 fs.writeFileSync(path.join(editorDir,'font-options.json'),JSON.stringify(fonts,null,2));
 const dest=path.join(runtime,'editor-fonts');fs.mkdirSync(dest,{recursive:true});
 for(const f of fonts){fs.mkdirSync(path.dirname(path.join(dest,f.file)),{recursive:true});fs.copyFileSync(path.join(remotionDir,'public/fonts',f.file),path.join(dest,f.file))}
 fs.writeFileSync(path.join(runtime,'font-options.css'),fonts.map(f=>`@font-face{font-family:'${f.family}';src:url('editor-fonts/${f.file}');font-display:block}`).join('\n'));
 for(const name of ['editor.html','editor.css','editor-layout.css'])fs.copyFileSync(path.join(editorDir,name),path.join(runtime,name));
 const buildId=editorBuildId();
 await build({entryPoints:[path.join(editorDir,'editor-entry.tsx')],bundle:true,outfile:path.join(runtime,'editor.js'),define:{'process.env.NODE_ENV':'"production"','__EDITOR_BUILD__':JSON.stringify(buildId)}});
 fs.writeFileSync(path.join(runtime,'editor-version.json'),JSON.stringify({buildId,fonts:fonts.length}));
 const generated=path.join(editorDir,'.generated');fs.mkdirSync(generated,{recursive:true});
 const catalogFile=path.join(generated,'catalog.mjs');
 await build({entryPoints:[path.join(remotionDir,'src/lib/catalog.ts')],bundle:true,platform:'node',format:'esm',outfile:catalogFile});
 const {CATALOG}=await import(pathToFileURL(catalogFile).href+'?t='+Date.now());
 fs.writeFileSync(path.join(editorDir,'style-catalog.json'),JSON.stringify(CATALOG,null,2));
 return {fonts:fonts.length,motions:Object.keys(CATALOG).length,buildId};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await buildEditor(path.resolve(process.argv[2]));console.log(JSON.stringify(r));}
