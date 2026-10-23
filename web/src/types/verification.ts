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

export interface RequirementCondition {
  id: string;
  stable_key?: string;
  text: string;
  category: string;
  verifiable?: string;
}

export interface Requirement {
  id?: string;
  document_id?: string;
  stable_key: string;
  title?: string;
  original_text: string;
  source_refs?: SourceRef[];
  conditions?: RequirementCondition[];
}

// GET /verification-runs/{v}/requirements/{r} 의 condition_verdicts
export interface ConditionVerdictItem {
  condition_id: string;
  status: string | null;
  reason: string;
  evidence_ids: string[];
  message_match?: string;
  server_validation?: string;
  spec_suspect?: string;
}
