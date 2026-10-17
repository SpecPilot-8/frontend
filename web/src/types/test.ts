// 개별 테스트 케이스 항목
export interface TestCaseItem {
  id: string;
  procedure: string;
  inputValue: string;
  expectedResult: string;
  codeBasedPrediction: string;
  actualStatus: string;
  actualResultNote?: string;
  evidenceNote?: string;
  [key: string]: any;
}

// 요구사항별 테스트 사양서 그룹
export interface TestSpecificationGroup {
  requirementId: string;
  groupTitle: string;
  precondition: string;
  totalTests: number;
  testCases: TestCaseItem[];
  [key: string]: any;
}