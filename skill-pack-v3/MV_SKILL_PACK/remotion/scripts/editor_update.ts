/** Refresh runtime UI files only; never rewrite saved edits or media. */
import fs from 'node:fs';
import path from 'node:path';
import {PROJECTS_DIR,parseArgs,UserError,fail} from './common';
import {buildEditor} from '../editor/build.mjs';

async function main(){
 const {o}=parseArgs(process.argv.slice(2));
 if(!o.all&&!o.project)throw new UserError('--all または --project <名前> を指定してください');
 const dirs=o.all?fs.readdirSync(PROJECTS_DIR,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(PROJECTS_DIR,d.name)):[path.join(PROJECTS_DIR,path.basename(String(o.project)))];
 for(const dir of dirs){const rt=path.join(dir,'out','editor');if(!fs.existsSync(path.join(rt,'editor-state.json')))continue;
  const result=await buildEditor(rt);console.log(`${path.basename(dir)}: ${result.buildId}（編集データ保持）`);
 }
 console.log('開いている画面は、未保存の変更を保存してから再読み込みしてください。');
}
main().catch(fail);
