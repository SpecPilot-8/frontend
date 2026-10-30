import assert from 'node:assert/strict';
import test from 'node:test';
import { compareTestRequirements } from '../src/services/testComparison.ts';

const link = (id, rev = 2) => ({requirement_id:'r',requirement_revision:rev,condition_ids:[id]});
const step = (key, id, rev = 2) => ({step_key:key,order:1,action:'입력 후 저장',expected:'명세의 허용 결과',requirement_links:[link(id,rev)]});
const requirement = {id:'r',revision:2,title:'제목과 저장',original_text:'제목은 50자 이하이고 비어 있으면 저장하지 않는다.',conditions:[{id:'c1',text:'제목 50자 이하'},{id:'c2',text:'빈 제목 저장 금지'},{id:'c3',text:'저장 후 목록 이동'}]};
const selected = {id:'a',test_no:'TC-1',requirement_links:[link('c1')],steps:[step('s1','c1')]};
const other = {id:'b',test_no:'TC-2',requirement_links:[link('c2')],steps:[step('s2','c2')]};

test('요구사항 전체 조건을 유지하고 이 시험·다른 시험·연결 없는 조건을 구분한다',()=>{
  const rows=compareTestRequirements([{requirement_id:'r',revision:2}],[requirement],[selected,other],selected);
  assert.equal(rows[0].requirement.original_text,requirement.original_text);
  assert.equal(rows[0].conditions.length,3);
  assert.equal(rows[0].conditions[0].selected[0].expected,'명세의 허용 결과');
  assert.equal(rows[0].conditions[1].selected.length,0);
  assert.equal(rows[0].conditions[1].other[0].test_no,'TC-2');
  assert.equal(rows[0].conditions[2].selected.length+rows[0].conditions[2].other.length,0);
  assert.ok(!JSON.stringify(rows).includes('adequate'));
});
test('같은 ID의 다른 개정이나 원문 없는 자료를 현재 근거로 대체하지 않는다',()=>{
  const rows=compareTestRequirements([{requirement_id:'r',revision:1}],[requirement],[selected],selected);
  assert.equal(rows[0].requirement,undefined);
  assert.equal(rows[0].conditions.length,0);
  const old={...other,steps:[step('old','c2',1)]};
  const fixed=compareTestRequirements([{requirement_id:'r',revision:2}],[requirement],[selected,old],selected);
  assert.equal(fixed[0].conditions[1].other.length,0);
});
test('편집 초안의 실제 단계 연결을 사용하고 시험의 상위 참조만으로 조건을 채우지 않는다',()=>{
  const rows=compareTestRequirements([{requirement_id:'r',revision:2}],[requirement],[selected],selected,[step('new','c2')]);
  assert.equal(rows[0].conditions[0].selected.length,0);
  assert.equal(rows[0].conditions[1].selected[0].step_key,'new');
});
