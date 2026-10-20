// Condition
export interface Condition {
  id?: string;
  stable_key: string;
  text: string;
  category: 'display' | 'validation' | 'navigation' | 'business_logic' | 'data' | 'error_message';
  target: 'frontend' | 'backend' | 'both' | 'unknown';
  verifiable: 'code' | 'not_statically_verifiable';
  source_refs?: any[];
  ambiguity?: string[];
  related_condition_ids?: string[];
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
  req_type: 'functional' | 'non_functional';
  review_status: string;    
  conditions: Condition[];
}

// 문서 구조 (유지)
export interface DocumentOutlineNode {
  id: string;
  title: string;
  page: number;
  requirementCount?: number;
  children?: DocumentOutlineNode[];
}