export interface RequirementLink {
  requirement_id: string;
  requirement_revision: number;
  condition_ids: string[];
}

export interface TestData {
  account: string | null;
  input: string;
  notes: string;
}

export interface TestStep {
  step_key: string;
  order: number;
  action: string;
  expected: string;
  test_data: TestData;
  requirement_links: RequirementLink[];
  design?: StepDesign | null;
}

export interface StepDesign {
  intent_ids: string[];
  rationale: string;
  input_rationale: string;
  basis: 'specification' | 'review_needed';
}

export type DesignDecision = 'adequate' | 'needs_changes' | 'uncertain';
export interface ConditionDesignReview {
  requirement_id: string;
  requirement_revision: number;
  condition_id: string;
  decision: DesignDecision;
  reason: string;
}
export interface HumanDesignReview {
  test_case_id: string;
  test_case_revision: number;
  version: number;
  origin: 'manual';
  status: DesignDecision | 'pending';
  items: ConditionDesignReview[];
  updated_at: string | null;
  summary: {linked_conditions: number; reviewed_conditions: number; adequate: number; needs_changes: number; uncertain: number};
}

export interface DesignIntent {
  id: string;
  requirement_id: string;
  requirement_revision: number;
  requirement_title: string;
  condition_id: string;
  condition_key: string;
  condition_text: string;
  perspective: string;
  label: string;
  reason: string;
}

export interface DesignPlan {
  version: string;
  origin: 'rule_suggestion';
  items: DesignIntent[];
  summary: { condition_count: number; intent_count: number; perspectives: Record<string, number> };
  limitations: string[];
}

export interface DesignTestReference {
  case_id: string;
  test_no: string;
  step_key: string;
  step_order: number;
  basis: string;
  stale: boolean;
}

export interface DesignReview {
  test_specification_id: string;
  specification_revision: number;
  plan_available: boolean;
  plan_version: string | null;
  items: (DesignIntent & { status: 'written' | 'review_needed' | 'missing'; gap_reason: string; test_refs: DesignTestReference[] })[];
  conditions: {requirement_id: string; requirement_revision: number; requirement_title: string; condition_id: string; condition_text: string; test_refs: DesignTestReference[]}[];
  summary: {conditions_total: number; conditions_linked: number; intents_total: number; intents_written: number; intents_review_needed: number; intents_missing: number};
  limitations: string[];
}

export interface TestCase {
  id: string;
  test_no: string;
  export_section_key: string;
  subtopic_id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary';
  preconditions: string;
  steps: TestStep[];
  requirement_links: RequirementLink[];
  revision: number;
  origin: string;
  assumptions?: string[];
  warnings?: {code: string; message: string}[];
  design?: {rationale: string; generated_revision: number; origin: 'model'};
  prediction?: {
    status: string;
    reason: string;
    primary_chunk_ids: string[];
  };
}

export interface StepResult {
  step_key: string;
  status: 'not_run' | 'passed' | 'failed' | 'on_hold';
  actual: string;
  notes: string;
  performed_at: string | null;
}

export interface TestExecution {
  id: string;
  test_case_id: string;
  test_case_revision: number;
  version: number;
  attempt_no: number;
  status: string;
  step_results: StepResult[];
  environment: string;
  tested_build: string;
  updated_at: string;
}

export interface TestSpecification {
  id: string;
  created_at?: string;
  model_config_snapshot?: {provider?: string; model?: string; config_version?: number};
  verification_run_id: string;
  revision: number;
  status: string;
  test_case_ids: string[];
  origin?: string;
  generation_status?: string;
  design_plan_version?: string | null;
  warnings?: {code: string; message: string}[];
  uncovered_conditions?: {requirement_id: string; condition_id: string; reason: string}[];
}
