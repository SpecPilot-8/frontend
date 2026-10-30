import type { TestCase, TestStep } from '../types/test';
import type { TestRequirement } from './testEvidence';

export interface PinnedRequirement { requirement_id: string; revision: number }
export const designDecisionLabels = {adequate: '설계 적합', needs_changes: '보완 필요', uncertain: '판단 보류'};
export interface ComparedStep {
  case_id: string; test_no: string; step_key: string; order: number;
  action: string; expected: string; rationale?: string;
}

/** 연결 기록만 계산한다. 문장 유사도나 코드 판정으로 설계 적합/실제 통과를 만들지 않는다. */
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
