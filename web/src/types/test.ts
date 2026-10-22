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
