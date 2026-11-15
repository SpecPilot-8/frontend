/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 테스트 케이스와 요구사항 수락 조건 간의 연결 관계를 대조하는 파일
 * - 주요 기능:
 *   1) 조건별로 연결된 테스트 단계 목록 집계
 *   2) 현재 선택된 시험과 다른 시험의 조건 참조 분리
 */

import type { TestCase, TestStep } from '../types/test';
import type { TestRequirement } from './testEvidence';

export interface PinnedRequirement { requirement_id: string; revision: number }
export const designDecisionLabels = {adequate: '설계 적합', needs_changes: '보완 필요', uncertain: '판단 보류'};
export interface ComparedStep {
  case_id: string; test_no: string; step_key: string; order: number;
  action: string; expected: string; rationale?: string;
}

// 요구사항 수락 조건과 테스트 단계의 연결 상태를 계산하는 로직
export function compareTestRequirements(
  versions: PinnedRequirement[], requirements: TestRequirement[], cases: TestCase[],
  active: TestCase, activeSteps: TestStep[] = active.steps,
) {
  const byCondition = new Map<string, ComparedStep[]>();
  for (const test of cases) {
    for (const step of test.id === active.id ? activeSteps : test.steps) {
      const seen = new Set<string>();
      for (const link of step.requirement_links) for (const id of link.condition_ids) {
        const key = `${link.requirement_id}:${link.requirement_revision}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ref = {case_id:test.id,test_no:test.test_no,step_key:step.step_key,order:step.order,
          action:step.action,expected:step.expected,rationale:step.design?.rationale};
        const refs = byCondition.get(key);
        if (refs) refs.push(ref); else byCondition.set(key,[ref]);
      }
    }
  }
  return versions.map(version => {
    const requirement = requirements.find(r => r.id === version.requirement_id && r.revision === version.revision);
    return { version, requirement, related: active.requirement_links.some(l => l.requirement_id === version.requirement_id && l.requirement_revision === version.revision),
      conditions: (requirement?.conditions || []).map(condition => {
        const references = condition.id ? byCondition.get(`${version.requirement_id}:${version.revision}:${condition.id}`) || [] : [];
        return { condition, selected: references.filter(r => r.case_id === active.id), other: references.filter(r => r.case_id !== active.id) };
      }),
    };
  });
}
