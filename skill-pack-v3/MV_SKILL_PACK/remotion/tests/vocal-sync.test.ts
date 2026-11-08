import {it,expect} from 'vitest';
import {vocalSyncEstimate} from '../scripts/vocalSync';

it('reports missing local analysis without changing supplied lyric timing',()=>{
 const lines=[{text:'テスト',start:1,end:2}];
 const result=vocalSyncEstimate({python:null,script:'none',audio:'none',model:'small',lines,outDir:'unused'});
 expect(result.status).toBe('unavailable');expect(lines).toEqual([{text:'テスト',start:1,end:2}]);
});
