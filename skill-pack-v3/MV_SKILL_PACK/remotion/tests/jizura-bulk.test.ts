import {describe,it,expect} from 'vitest';
import {copyJizuraLook,copyLyricLayout} from '../editor/jizura-bulk';

describe('copying a JIZURA look',()=>{
 it('copies the visual choices while preserving the target line timing and parts',()=>{
  const source={engine:'standard',layout:'center',enter:'fade',decor:['rings'],lineTrans:'shared_wipe',lineTransDuration:.8,seed:4,parts:[{text:'source',start:0,end:1}],fxTime:.2};
  const target={layout:'mixed',exit:'fade',seed:9,parts:[{text:'target',start:0,end:3}],fxTime:2};
  const result=copyJizuraLook(source,target)!;
  expect(result).toEqual({engine:'standard',layout:'center',enter:'fade',decor:['rings'],lineTrans:'shared_wipe',lineTransDuration:.8,seed:9,parts:target.parts,fxTime:2});
  expect(result.decor).not.toBe(source.decor);
  expect(target.layout).toBe('mixed');
 });
 it('restores automatic choices instead of retaining old overrides',()=>{
  expect(copyJizuraLook({}, {layout:'center',engine:'standard'})).toBeUndefined();
  expect(copyJizuraLook({}, {layout:'center',parts:[{text:'kept'}]})).toEqual({parts:[{text:'kept'}]});
 });
 it('copies position and wrapping without overwriting other motion settings',()=>{
  const source={x:.25,boxX:.1,stageStyle:'manual',params:{noWrap:true,enter:2}};
  const target={x:.8,boxY:.3,params:{noWrap:false,enter:.5}};
  expect(copyLyricLayout(source,target)).toEqual({x:.25,boxX:.1,boxY:undefined,stageStyle:'manual',params:{noWrap:true,enter:.5}});
  expect(target.params).toEqual({noWrap:false,enter:.5});
  expect(copyLyricLayout({},target)).toEqual({x:undefined,boxX:undefined,boxY:undefined,stageStyle:undefined,params:{enter:.5}});
 });
});
