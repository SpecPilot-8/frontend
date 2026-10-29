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
  verification_run_id: string;
  revision: number;
  status: string;
  test_case_ids: string[];
  origin?: string;
  generation_status?: string;
  warnings?: {code: string; message: string}[];
  uncovered_conditions?: {requirement_id: string; condition_id: string; reason: string}[];
}
