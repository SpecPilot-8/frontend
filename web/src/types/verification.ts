// 코드 근거 항목
export interface CodeEvidence {
  id: string;
  filePath: string;
  lineNumber: number | string;
  status: string;
  title: string;
  issueCode?: string;
  description?: string;
  suggestedFix?: string;
  [key: string]: unknown;
}

// 검증 결과 개별 항목
export interface VerificationResultItem {
  id: string;
  requirementId: string;
  functionName: string;
  status: string;
  connectedCode: string;
  summary: string;
  matchedCriteriaCount: number;
  totalCriteriaCount: number;
  callChain?: string[];
  evidenceList: CodeEvidence[];
  [key: string]: unknown;
}

export interface SourceRef {
  block_id: string;
  quote: string;
  location?: {
    kind: string;
    index: number;
    bbox?: number[];
  };
}

export interface Requirement {
  id?: string;
  stable_key: string;
  title?: string;
  original_text: string;
  source_refs?: SourceRef[];
  // 원본 PDF 조회용 (GET /documents/{document_id}/file)
  document_id?: string;
}
