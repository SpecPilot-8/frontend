/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 테스트 케이스에 연결된 요구사항과 원문 출처 근거를 해석하는 파일
 * - 주요 기능:
 *   1) 시험에 고정된 요구사항 개정과 수락 조건 매핑
 *   2) 수락 조건 및 요구사항의 원문 출처 추출
 *   3) 현재 시험 개정과 생성 당시 설계 설명의 일치 여부 확인
 */

import type { RequirementItem, SourceReference } from '../types/analysis';
import type { RequirementLink, TestCase } from '../types/test';

export type TestRequirement = RequirementItem & {
  revision: number;
  document_id?: string;
  document_revision?: number;
  source_refs?: SourceReference[];
  review_reasons?: string[];
};

// 시험에 연결된 요구사항 개정과 수락 조건을 묶어주는 로직
export function resolveTestEvidence(links: RequirementLink[], requirements: TestRequirement[]) {
  const grouped = new Map<string, RequirementLink>();
  for (const link of links) {
    const key = `${link.requirement_id}:${link.requirement_revision}`;
    const previous = grouped.get(key);
    grouped.set(key, { ...link, condition_ids: [...new Set([...(previous?.condition_ids || []), ...link.condition_ids])] });
  }
  return [...grouped.values()].map(link => {
    const requirement = requirements.find(r => r.id === link.requirement_id && r.revision === link.requirement_revision);
    return {
      link,
      requirement,
      conditions: link.condition_ids.map(id => ({ id, condition: requirement?.conditions.find(c => c.id === id) })),
    };
  });
}

export function evidenceSources(condition: { source_refs?: SourceReference[] }, requirement: TestRequirement) {
  return condition.source_refs?.length
    ? { refs: condition.source_refs, kind: 'condition' as const }
    : { refs: requirement.source_refs || [], kind: 'requirement' as const };
}

export function currentDesign(test: Pick<TestCase, 'revision' | 'design'>) {
  return !!test.design && test.design.generated_revision === test.revision;
}
