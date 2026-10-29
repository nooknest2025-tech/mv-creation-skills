import {describe,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {TOOL_TABS,toolUnavailable} from '../editor/tool-status';
import {execFileSync} from 'node:child_process';

describe('consistent editor runtime',()=>{
 it('keeps both auxiliary tabs and explains disabled startup',()=>{
  expect(TOOL_TABS).toEqual(['timing','faces']);
  expect(toolUnavailable('faces','--no-tools で起動')).toContain('--no-tools');
  expect(toolUnavailable('timing')).toContain('起動していません');
 });
 it('builds the same version for different projects without changing their saved edits',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'editor-update-'));
  try{
   const a=path.join(base,'a'),b=path.join(base,'b');
   for(const [i,rt] of [a,b].entries()){fs.mkdirSync(rt);fs.writeFileSync(path.join(rt,'editor-state.json'),JSON.stringify({revision:i+7,data:{title:'user edits '+i}}));}
   const before=[a,b].map(rt=>fs.readFileSync(path.join(rt,'editor-state.json'),'utf8'));
   const build=(rt:string)=>JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'../editor/build.mjs'),rt],{encoding:'utf8'}));
   const x=build(a),y=build(b);
   expect(x.buildId).toBe(y.buildId);
   expect(JSON.parse(fs.readFileSync(path.join(a,'editor-version.json'),'utf8')).buildId).toBe(x.buildId);
   expect([a,b].map(rt=>fs.readFileSync(path.join(rt,'editor-state.json'),'utf8'))).toEqual(before);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
 },30000);
});
