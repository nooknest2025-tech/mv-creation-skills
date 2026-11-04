// Still frames of the edited video (the same drawing as the editor's MP4 export), without rendering the whole MP4.
//   npm run editor:stills -- <project name | folder | editor-state.json> [--at 0,1,2,3] [--out <folder>] [--scale 0.5]
// Default --at 0,1,2,3 = the mandatory "first 3 seconds" hook check (skills/mv-qa). Also writes sheet.jpg (all stills in a grid) when FFmpeg is available.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {parseSeconds,frameAt,stillName,sheetLayout,resolveState} from './stills-plan.mjs';
const editor=path.dirname(fileURLToPath(import.meta.url)),pack=path.resolve(editor,'..','..');
const argv=process.argv.slice(2),opt=k=>{const i=argv.indexOf(k);if(i<0)return undefined;const v=argv[i+1];argv.splice(i,2);return v};
const at=opt('--at'),outArg=opt('--out'),scaleArg=opt('--scale');
try{
 const stateFile=resolveState(argv[0],pack),state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
 const seconds=parseSeconds(at,state.data?.duration);
 const outDir=path.resolve(outArg??path.join(path.dirname(stateFile),'stills-check'));fs.mkdirSync(outDir,{recursive:true});
 const scale=Number(scaleArg??process.env.MVPACK_SCALE??1);if(!(scale>0&&scale<=2))throw Error('--scale は 0〜2 です');
 const {renderStill}=await import('@remotion/renderer');const {prepareRender}=await import('./render-setup.mjs');
 const {ff,binariesDirectory,browserExecutable,chromiumOptions,serveUrl,composition,inputProps}=await prepareRender(stateFile);
 const files=[];
 for(const sec of seconds){const file=path.join(outDir,stillName(sec));await renderStill({serveUrl,composition,inputProps,browserExecutable,chromiumOptions,binariesDirectory,frame:frameAt(sec,composition.fps,composition.durationInFrames),output:file,imageFormat:'jpeg',jpegQuality:85,scale});files.push(file);console.log(`still ${sec}s -> ${path.relative(process.cwd(),file)}`)}
 if(files.length>1){const {layout}=sheetLayout(files.length),sheet=path.join(outDir,'sheet.jpg');
  const r=spawnSync(ff,['-y','-v','error',...files.flatMap(f=>['-i',f]),'-filter_complex',`${files.map((_,i)=>`[${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`,'-frames:v','1',sheet],{encoding:'utf8',windowsHide:true});
  console.log(r.status===0?`sheet -> ${path.relative(process.cwd(),sheet)}`:'（一覧画像 sheet.jpg は作れませんでした。静止画はそのまま使えます）')}
 console.log(`STILLSDONE ${files.length}枚: ${outDir}`);
}catch(e){console.error('静止画チェックに失敗しました: '+(e?.message??e));process.exit(1)}
