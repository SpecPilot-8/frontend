// 개별 테스트 케이스 항목
export interface TestCaseItem {
  id: string;
  testCode?: string;
  title?: string;
  status?: string;
  testType?: string;
  priority?: string;
  procedure: string;
  inputValue: string;
  expected: string;
  codeBasedPrediction: string;
  actualStatus: string;
  actualResultNote?: string;
  evidenceNote?: string;
  [key: string]: unknown;
}

// 요구사항별 테스트 사양서 그룹
export interface TestSpecificationGroup {
  requirementId: string;
  requirementCode?: string;
  groupTitle: string;
  precondition: string;
  totalTests: number;
  testCases: TestCaseItem[];
  [key: string]: unknown;
}

// 백엔드 v2 시험 (GET /test-cases). 한 시험 = 시험번호 하나, 단계 여러 개 (docs/TEST_OUTPUT_SPEC.md)
export interface TestRequirementLink {
  requirement_id: string;
  requirement_revision: number;
  condition_ids: string[];
}

export interface TestStepApi {
  step_key: string;
  order: number;
  action: string;
  expected: string;
  test_data: { account: string | null; input: string; notes: string };
  requirement_links: TestRequirementLink[];
}

export type TestPredictionStatus = 'normal_expected' | 'failure_expected' | 'needs_review' | 'unknown';

export interface TestCaseApi {
  id: string;
  test_no: string;
  export_section_key: string;
  subtopic_id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary';
  preconditions: string;
  requirement_links: TestRequirementLink[];
  steps: TestStepApi[];
  prediction: {
    status: TestPredictionStatus;
    reason: string;
    verification_run_id: string;
    primary_chunk_ids: string[];
  };
  assumptions: string[];
  warnings: { code: string; message: string }[];
  revision: number;
  origin: string;
}
