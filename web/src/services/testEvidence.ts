import type { RequirementItem, SourceReference } from '../types/analysis';
import type { RequirementLink } from '../types/test';

export type TestRequirement = RequirementItem & {
  revision: number;
  document_id?: string;
  document_revision?: number;
  source_refs?: SourceReference[];
  review_reasons?: string[];
};

/** 시험에 고정된 개정과 조건 ID만 해석한다. 최신 요구사항으로 대체하지 않는다. */
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
