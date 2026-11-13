import {describe,it,expect} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {createRenderCache,renderCodeKey} from '../editor/render-cache.mjs';
function fixture(run:(root:string,src:string,dest:string)=>void){const root=fs.mkdtempSync(path.join(os.tmpdir(),'mv-render-cache-'));try{const src=path.join(root,'source.txt'),dest=path.join(root,'.render-public','asset.txt');fs.writeFileSync(src,'original');run(root,src,dest)}finally{fs.rmSync(root,{recursive:true,force:true})}}
describe('prepared render cache',()=>{
 it('reuses unchanged files after restart, but refreshes changed or deleted media',()=>fixture((root,src,dest)=>{
  const a=createRenderCache(root);expect(a.copy(src,dest)).toBe(true);const key=a.publicKey();a.save();
  const b=createRenderCache(root);expect(b.copy(src,dest)).toBe(false);expect(b.publicKey()).toBe(key);
  const time=fs.statSync(src).mtime;fs.writeFileSync(src,'modified');fs.utimesSync(src,time,time);
  expect(b.copy(src,dest)).toBe(true);expect(fs.readFileSync(dest,'utf8')).toBe('modified');expect(b.publicKey()).not.toBe(key);
  fs.writeFileSync(dest,'tampered');expect(b.copy(src,dest)).toBe(true);fs.unlinkSync(dest);expect(b.copy(src,dest)).toBe(true);
 }));
 it('keeps graded copies without applying the grade twice; changing a LUT restores the original input',()=>fixture((root,src,dest)=>{
  const a=createRenderCache(root);a.copy(src,dest,'mono');fs.writeFileSync(dest,'graded!');a.refresh(dest);a.save();
  const b=createRenderCache(root);expect(b.copy(src,dest,'mono')).toBe(false);expect(fs.readFileSync(dest,'utf8')).toBe('graded!');
  expect(b.copy(src,dest,'new LUT')).toBe(true);expect(fs.readFileSync(dest,'utf8')).toBe('original');
 }));
 it('removes obsolete prepared copies while keeping source media and unrelated files',()=>fixture((root,src,dest)=>{
  const extra=path.join(root,'.render-public','old.txt'),unrelated=path.join(root,'.render-public','user.txt');
  const a=createRenderCache(root);a.copy(src,dest);a.copy(src,extra);a.save();fs.writeFileSync(unrelated,'keep');
  const b=createRenderCache(root);b.copy(src,dest);b.prune(path.dirname(dest));
  expect(fs.existsSync(extra)).toBe(false);expect(fs.readFileSync(src,'utf8')).toBe('original');expect(fs.readFileSync(dest,'utf8')).toBe('original');expect(fs.readFileSync(unrelated,'utf8')).toBe('keep');
 }));
 it('rejects an incomplete or modified bundle and an unrelated directory',()=>fixture((root,src,dest)=>{
  const a=createRenderCache(root),dir=fs.mkdtempSync(path.join(root,'.render-bundle-'));fs.writeFileSync(path.join(dir,'bundle.js'),'code');
  a.copy(src,dest);a.setBundle('A',dir);a.save();const b=createRenderCache(root);expect(b.bundle('A')).toBe(dir);expect(b.bundle('B')).toBeNull();
  fs.unlinkSync(path.join(dir,'bundle.js'));expect(b.bundle('A')).toBeNull();
  const meta=path.join(root,'.render-cache.json'),data=JSON.parse(fs.readFileSync(meta,'utf8'));data.bundle.dir='..';fs.writeFileSync(meta,JSON.stringify(data));expect(createRenderCache(root).bundle('A')).toBeNull();
 }));
 it('invalidates compiled code for a changed vendor engine, not for editable snapshot data',()=>fixture(root=>{
  for(const d of ['editor','src','vendor'])fs.mkdirSync(path.join(root,d));
  const engine=path.join(root,'vendor','engine.js');fs.writeFileSync(engine,'one');const key=renderCodeKey(root);
  fs.writeFileSync(path.join(root,'editor-state.json'),'changed lyrics');expect(renderCodeKey(root)).toBe(key);
  fs.writeFileSync(engine,'two');expect(renderCodeKey(root)).not.toBe(key);
 }));
});
