import {describe,it,expect} from 'vitest';
import {setLineEngine} from '../editor/line-engine';

describe('line engine selection',()=>{
 it('enables only the chosen line when JIZURA was off',()=>{
  const data:any={lyrics:[{id:'A',jizura:{layout:'center'}},{id:'B',jizura:{layout:'mixed'}},{id:'C',extra:true}]};
  setLineEngine(data,data.lyrics[0],'jizura');
  expect(data.jizura.enabled).toBe(true);
  expect(data.lyrics[0].jizura).toEqual({layout:'center'});
  expect(data.lyrics[1].jizura).toEqual({layout:'mixed',engine:'standard'});
  expect(data.lyrics[2].jizura).toBeUndefined();
 });
 it('leaves other JIZURA lines alone when already enabled',()=>{
  const data:any={jizura:{enabled:true,style:'mono'},lyrics:[{id:'A',jizura:{engine:'standard'}},{id:'B'}]};
  setLineEngine(data,data.lyrics[0],'jizura');
  expect(data.lyrics[0].jizura).toBeUndefined();expect(data.lyrics[1].jizura).toBeUndefined();
  setLineEngine(data,data.lyrics[0],'standard');expect(data.lyrics[0].jizura.engine).toBe('standard');
 });
});
