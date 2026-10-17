// 수락 조건 항목
export interface AcceptanceCriteria {
  category: string;
  count: number;
  description: string;
  [key: string]: any;
}

// 요구사항 개별 명세 항목
export interface RequirementItem {
  id: string;
  title: string;
  sourceDoc: string;
  sourcePage: string;
  originalText: string;
  actor: string;
  condition: string;
  action: string;
  expectedResult: string;
  criteria: AcceptanceCriteria[];
  reviewStatus: string;
  [key: string]: any;
}

// 문서 구조
export interface DocumentOutlineNode {
  id: string;
  title: string;
  page: number;
  requirementCount?: number;
  children?: DocumentOutlineNode[];
  [key: string]: any;
}