/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 기획서 문서 분석을 통해 추출된 요구사항과 수락 조건의 데이터 타입을 정의한 파일
 * - 주요 기능:
 *   1) 원문 출처 참조와 세부 수락 조건 인터페이스 정의
 *   2) 요구사항 항목 및 문서 구조 노드 인터페이스 정의
 */

export interface SourceReference {
  block_id?: string;
  quote?: string;
  location?: {
    kind?: string;
    index?: number;
    bbox?: number[];
  };
  [key: string]: unknown;
}

export interface Condition {
  id?: string;
  stable_key: string;
  text: string;
  category:
    | "display"
    | "validation"
    | "navigation"
    | "business_logic"
    | "data"
    | "error_message";
  target: "frontend" | "backend" | "both" | "unknown";
  verifiable: "code" | "not_statically_verifiable";
  source_refs?: SourceReference[];
  ambiguity?: string[];
  related_condition_ids?: string[];
  constraint?: { field: string; operator: string; value: number; unit: string; unit_definition?: string | null } | null;
}

export interface RequirementItem {
  id: string;
  stable_key: string;
  subtopic_id?: string | null;
  screen_id?: string | null;
  title: string;
  original_text: string;
  condition: string;
  action: string;
  expected: string;
  req_type: "functional" | "non_functional";
  review_status: string;
  conditions: Condition[];
}

export interface DocumentOutlineNode {
  id: string;
  title: string;
  page: number;
  requirementCount?: number;
  children?: DocumentOutlineNode[];
}
