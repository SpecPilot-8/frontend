import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTestEvidence, evidenceSources, currentDesign } from '../src/services/testEvidence.ts';

const source = { block_id: 'paragraph', quote: '제목은 50자까지', location: { index: 8 } };
const requirement = { id: 'requirement', revision: 2, original_text: '제목은 50자까지', source_refs: [source],
  conditions: [{ id: 'limit', text: '제목 최대 50자', source_refs: [{ ...source, location: { index: 9 } }] }, { id: 'empty', text: '빈 제목 거부' }] };
const link = { requirement_id: 'requirement', requirement_revision: 2, condition_ids: ['limit'] };

test('시험에 고정한 개정을 사용하고 같은 요구사항의 중복 연결은 합친다', () => {
  const result = resolveTestEvidence([link, { ...link, condition_ids: ['limit', 'empty'] }], [requirement, { ...requirement, revision: 3 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].requirement.revision, 2);
  assert.deepEqual(result[0].conditions.map(c => c.id), ['limit', 'empty']);
  assert.deepEqual(link.condition_ids, ['limit']);
});

test('같은 ID의 최신 개정만 있어도 과거 개정의 근거로 대체하지 않는다', () => {
  const [result] = resolveTestEvidence([link], [{ ...requirement, revision: 3 }]);
  assert.equal(result.requirement, undefined);
  assert.equal(result.conditions[0].condition, undefined);
});

test('조건 연결이 깨지면 다른 조건을 대신 보여주지 않는다', () => {
  const [result] = resolveTestEvidence([{ ...link, condition_ids: ['missing'] }], [requirement]);
  assert.equal(result.conditions[0].condition, undefined);
});

test('조건별 인용과 요구사항 인용의 범위 및 쪽수를 구분한다', () => {
  const direct = evidenceSources(requirement.conditions[0], requirement);
  assert.equal(direct.kind, 'condition');
  assert.equal(direct.refs[0].location.index, 9);
  const fallback = evidenceSources(requirement.conditions[1], requirement);
  assert.equal(fallback.kind, 'requirement');
  assert.equal(fallback.refs[0].location.index, 8);
  assert.deepEqual(evidenceSources({}, { ...requirement, source_refs: [] }).refs, []);
});

test('기존 사양서에 사유를 만들지 않고 편집 후 생성 설명을 현재 근거로 취급하지 않는다', () => {
  assert.equal(currentDesign({revision: 1}), false);
  assert.equal(currentDesign({revision: 1, design: {generated_revision: 1}}), true);
  assert.equal(currentDesign({revision: 2, design: {generated_revision: 1}}), false);
});
