// SourceReference
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

// Condition
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

// RequirementItem
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

// 문서 구조
export interface DocumentOutlineNode {
  id: string;
  title: string;
  page: number;
  requirementCount?: number;
  children?: DocumentOutlineNode[];
}
