import {describe,it,expect} from 'vitest';
import {editorLook} from '../src/lib/editorLook';

describe('effective editor appearance',()=>{
  it('retains imported font and palette across JSON save/reload',()=>{
    const line={params:{font:'noto_sans',palette:{fill:'#111111',accent:'#222222',stroke:'#333333'}}};
    expect(editorLook(JSON.parse(JSON.stringify(line)))).toEqual({font:'noto_sans',fill:'#111111',accent:'#222222',stroke:'#333333'});
  });
  it('manual edits win independently and do not erase inherited fields',()=>{
    const line={font:'klee',fill:'#abcdef',params:{font:'noto_sans',palette:{fill:'#111111',accent:'#222222'}}};
    expect(editorLook(line)).toMatchObject({font:'klee',fill:'#abcdef',accent:'#222222'});
  });
});
