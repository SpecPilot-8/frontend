// 백엔드 enum 코드 (api/v2/verdict_adapter.py, docs/schemas/requirement-extraction.schema.json)
export type VerdictStatus =
  | 'implemented'
  | 'partial'
  | 'mismatch'
  | 'not_found'
  | 'needs_review'
  | 'not_statically_verifiable';

export type ConditionCategory =
  | 'display'
  | 'validation'
  | 'navigation'
  | 'business_logic'
  | 'data'
  | 'error_message';

// 화면은 5칸. 백엔드 상태 6개 중 needs_review와 not_statically_verifiable은 '확인 필요' 한 칸에 모으고
// 칸 안에서 'AI 판단 어려움 / 실행 확인 필요'로 나눠 보여준다.
export type StatusCell = 'IMPLEMENTED' | 'PARTIAL' | 'MISMATCHED' | 'UNIMPLEMENTED' | 'NEED_CHECK';

export const STATUS_CELLS: { cell: StatusCell; label: string; hint: string }[] = [
  { cell: 'IMPLEMENTED', label: '구현', hint: '기획서대로 구현됨' },
  { cell: 'PARTIAL', label: '부분 구현', hint: '조건 중 일부만 구현' },
  { cell: 'MISMATCHED', label: '불일치', hint: '값이나 동작이 기획서와 다름' },
  { cell: 'UNIMPLEMENTED', label: '미구현 후보', hint: '관련 코드를 찾지 못함' },
  { cell: 'NEED_CHECK', label: '확인 필요', hint: '사람이 확인해야 함' },
];

export const STATUS_CELL: Record<VerdictStatus, StatusCell> = {
  implemented: 'IMPLEMENTED',
  partial: 'PARTIAL',
  mismatch: 'MISMATCHED',
  not_found: 'UNIMPLEMENTED',
  needs_review: 'NEED_CHECK',
  not_statically_verifiable: 'NEED_CHECK',
};

// 배지에 쓰는 라벨. 확인 필요 두 가지는 무엇을 확인해야 하는지까지 적는다.
export const STATUS_LABEL: Record<VerdictStatus, string> = {
  implemented: '구현',
  partial: '부분 구현',
  mismatch: '불일치',
  not_found: '미구현 후보',
  needs_review: 'AI 판단 어려움',
  not_statically_verifiable: '실행 확인 필요',
};

export const CATEGORY_LABEL: Record<ConditionCategory, string> = {
  display: '화면 표시',
  validation: '입력값 검증',
  navigation: '경로 및 이동',
  business_logic: '비즈니스 로직',
  data: '데이터 저장',
  error_message: '오류 메시지',
};

export const CATEGORY_ORDER: ConditionCategory[] = [
  'display',
  'validation',
  'navigation',
  'business_logic',
  'data',
  'error_message',
];

export const REASON_KIND_LABEL: Record<string, string> = {
  llm: 'AI 판정',
  llm_invalid_output: 'AI 출력 검증 실패',
  rule_not_verifiable: '코드만으로 확인 불가',
  rule_match_invalid: '근거 찾기 검증 실패',
  rule_no_evidence: '이 화면 근거 없음',
  rule_other_screen_only: '다른 화면 코드만 있음',
};
