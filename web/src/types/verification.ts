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

const TARGET_KEYWORDS = [
  '로그인 방법', '로그인 방식', 'SNS 로그인', '소셜 로그인', '이메일 로그인', '자동 로그인', '로그인 유지', '로그인 상태',
  '비밀번호 확인', '비밀번호 변경', '비밀번호 찾기', '비밀번호 재설정', '비밀번호 입력', '비밀번호 조건', '비밀번호 규칙', '비밀번호 마스킹',
  '이메일 입력', '이메일 형식', '이메일 인증', '아이디 입력', '아이디 찾기', '닉네임 입력', '닉네임 중복',
  '인증번호 발송', '인증번호 확인', '인증번호 입력', '본인 인증',
  '약관 동의', '이용약관', '개인정보 처리방침',
  '오류 메시지', '경고 메시지', '안내 메시지', '안내 문구', '플레이스홀더',
  '취소 팝업', '확인 팝업', '알림 팝업', '모달 팝업', '팝업창', '모달창',
  '공지사항 목록', '공지사항 상세', '공지사항 등록', '공지사항 수정', '공지사항 삭제', '공지사항 검색', '상단 고정',
  '게시글 목록', '게시글 상세', '게시글 등록', '게시글 수정', '게시글 삭제',
  '댓글 목록', '댓글 등록', '댓글 수정', '댓글 삭제',
  '첨부파일', '파일 첨부', '파일 업로드', '파일 다운로드', '이미지 업로드',
  '프로필 이미지', '프로필 수정', '회원 정보', '내 정보', '회원가입', '회원 탈퇴', '로그아웃',
  '페이지네이션', '페이지 이동', '검색어 입력', '목록 조회', '필수 입력', '글자 수', '중복 확인', '외부 링크',
  '로그인 버튼', '등록 버튼', '수정 버튼', '삭제 버튼', '취소 버튼', '확인 버튼', '저장 버튼', '목록 버튼', '검색 버튼',
];

const SINGLE_KEYWORDS = [
  '이메일', '비밀번호', '아이디', '닉네임', '인증번호', '프로필',
  '공지사항', '게시글', '댓글', '검색어', '검색창', '입력창', '입력란', '제목', '내용',
  '체크박스', '드롭다운', '탭 메뉴', '팝업', '모달', '로고', '헤더', '푸터', '버튼', '목록', '링크',
];

const GENERIC_WORDS = new Set([
  '서비스', '시스템', '사용자', '관리자', '화면', '페이지', '영역', '기능', '경우',
  '내용', '항목', '부분', '전체', '기본', '해당', '통한', '대한', '위한', '따른',
  '방식', '형태', '상태', '결과', '정보', '데이터', '값',
]);

const ADVERBIAL_MODIFIERS = new Set([
  '기본', '자동', '수동', '필수', '선택', '최신순', '오름차순', '내림차순', '활성화', '비활성화',
]);

const ACTION_ENDINGS = /(?:조회|검색|등록|작성|수정|변경|삭제|제거|저장|이동|전환|검증|검사|확인|표시|노출|안내|처리|발송|전송|요청|동의|업로드|다운로드|초기화|제한|활성화|로그인|로그아웃|회원가입|탈퇴|찾기|열기)$/;

function stripObjectParticle(word: string): string {
  const stripped = word.replace(/(?:으로|에서|은|는|이|가|을|를|로)$/, '');
  return stripped.length >= 2 ? stripped : word;
}

function findEarliestKeyword(text: string, keywords: string[]): string {
  let best = '';
  let bestIdx = Infinity;
  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1 && (idx < bestIdx || (idx === bestIdx && kw.length > best.length))) {
      best = kw;
      bestIdx = idx;
    }
  }
  return best;
}

export function formatRequirementTitle(
  rawTitle?: string,
  originalText?: string,
  conditionsOrFallback?: { text?: string; category?: string }[] | string,
): string {
  const title = (rawTitle || '').trim();
  const match = title.match(/^(.*?)\s+((?:Description|Action)\s+[A-Za-z0-9_-]+)$/i);
  if (!match) {
    return title || '요구사항';
  }

  const screenPrefix = match[1].trim();
  const tag = match[2].trim();
  const originLabel = screenPrefix ? `${screenPrefix} ${tag}` : tag;

  const condList = Array.isArray(conditionsOrFallback) ? conditionsOrFallback : [];
  const fallbackStr = typeof conditionsOrFallback === 'string' ? conditionsOrFallback : (condList[0]?.text || '');
  const primaryCategory = condList[0]?.category || '';

  const source = (originalText || fallbackStr || '').replace(/\s+/g, ' ').trim();
  if (!source) {
    return `${screenPrefix || '요구사항'} (${originLabel})`;
  }

  let body = source;
  let colonHead = '';

  const colonMatch = body.match(/^([^:：.]{2,20})\s*[:：]\s*(.+)$/);
  if (colonMatch) {
    const head = colonMatch[1].trim();
    const rest = colonMatch[2].trim();
    const cleanScreen = screenPrefix.replace(/\([^)]*\)/g, '').replace(/화면|페이지|영역|기능|팝업|모달|\s+/g, '');
    const cleanHead = head.replace(/\([^)]*\)/g, '').replace(/화면|페이지|영역|기능|설명|비고|안내|\s+/g, '');
    if (cleanHead && cleanHead !== cleanScreen) {
      if (!/(?:한다|된다|이다|경우|시)$/.test(head) && head.split(/\s+/).length <= 3) {
        colonHead = head.replace(/\s*(?:화면|페이지)$/, '').trim();
      }
    }
    body = rest;
  }

  const cleanedBody = body
    .replace(/\([^)]*서비스명[^)]*\)/g, '')
    .replace(/['"“”‘’][^'"“”‘’]{0,40}['"“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstClause = cleanedBody
    .split(/(?:\.\s+|\n|\(\d+\)|①|②|③|-\s+)/)[0]
    .trim();

  let targetNoun = '';

  // 1. 콜론(:) 앞에 명시된 항목/컴포넌트 라벨 (화면명 단순 반복이 아닌 경우 최우선)
  if (colonHead && !GENERIC_WORDS.has(colonHead)) {
    targetNoun = colonHead;
  }

  // 2. "<대상> 클릭/선택/터치 시" 패턴
  if (!targetNoun) {
    const triggerMatch = firstClause.match(
      /([가-힣A-Za-z0-9]{2,10}?(?:\s+(?:버튼|링크|아이콘|메뉴|탭|입력창|입력란|필드|체크박스|토글|화면|팝업|항목))?)(?:을|를|이|가)?\s*(?:클릭|선택|터치)\s*(?:할\s*경우|시|하면)/,
    );
    if (triggerMatch) {
      const candidate = triggerMatch[1]
        .split(/\s+/)
        .map(stripObjectParticle)
        .filter(w => w.length >= 2 && !GENERIC_WORDS.has(w))
        .join(' ');
      if (candidate) targetNoun = candidate;
    }
  }

  // 3. 첫 문장에서 가장 먼저 등장하는 핵심 복합 명사 키워드
  if (!targetNoun) {
    targetNoun = findEarliestKeyword(firstClause, TARGET_KEYWORDS) || findEarliestKeyword(cleanedBody, TARGET_KEYWORDS);
  }

  // 4. 이메일 + 비밀번호 동시 언급
  if (!targetNoun && firstClause.includes('이메일') && firstClause.includes('비밀번호')) {
    targetNoun = '이메일·비밀번호';
  }

  // 5. 첫 문장에서 가장 먼저 등장하는 단일 명사 키워드
  if (!targetNoun) {
    const single = findEarliestKeyword(firstClause, SINGLE_KEYWORDS) || findEarliestKeyword(cleanedBody, SINGLE_KEYWORDS);
    if (single) {
      if ((single === '이메일' || single === '비밀번호' || single === '아이디' || single === '제목' || single === '내용') && /입력/.test(firstClause)) {
        targetNoun = `${single} 입력`;
      } else {
        targetNoun = single;
      }
    }
  }

  // 6a. 목적격/주격 조사(을/를/이/가) 앞의 핵심 명사구 우선 추출 (non-greedy로 '으' 잘림 방지)
  if (!targetNoun) {
    const directObjMatch = firstClause.match(
      /([가-힣A-Za-z0-9]{2,8}?(?:\s+[가-힣A-Za-z0-9]{2,8}?)?)(?:을|를|이|가)(?=\s)/,
    );
    if (directObjMatch) {
      const words = directObjMatch[1]
        .split(/\s+/)
        .map(stripObjectParticle)
        .filter(w => w.length >= 2 && !GENERIC_WORDS.has(w) && !ADVERBIAL_MODIFIERS.has(w) && !/(?:한다|된다|이다|통한|대한|위한|있는|없는)$/.test(w));
      if (words.length > 0) {
        targetNoun = words.slice(-2).join(' ');
      }
    }
  }

  // 6b. 부사격 조사(으로/로) 앞의 명사구 추출 (non-greedy로 '새창으로' -> '새창' 정확히 분리)
  if (!targetNoun) {
    const advMatch = firstClause.match(
      /([가-힣A-Za-z0-9]{2,8}?(?:\s+[가-힣A-Za-z0-9]{2,8}?)?)(?:으로|로)(?=\s)/,
    );
    if (advMatch) {
      const words = advMatch[1]
        .split(/\s+/)
        .map(stripObjectParticle)
        .filter(w => w.length >= 2 && !GENERIC_WORDS.has(w) && !ADVERBIAL_MODIFIERS.has(w) && !/(?:한다|된다|이다|통한|대한|위한|있는|없는)$/.test(w));
      if (words.length > 0) {
        targetNoun = words.slice(-2).join(' ');
      }
    }
  }

  if (targetNoun === '새창' || targetNoun.includes('새창')) {
    targetNoun = targetNoun.replace(/새창/g, '새 창');
  }

  if (!targetNoun) {
    targetNoun = screenPrefix.replace(/\([^)]*\)/g, '').trim() || '기능';
  }

  // 기능 분류 단어: 문장 끝 서술어(동사)를 최우선으로 보고, 없으면 수락 조건 카테고리 → 문장 내 동사 순으로 결정
  const endClause = firstClause.replace(/[.。]+$/, '').trim();
  let actionNoun: string;
  if (/(?:조회|불러온|목록을\s*보여)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '조회';
  else if (/검색(?:한다|된다|함|됨|가능하다)?$/.test(endClause)) actionNoun = '검색';
  else if (/(?:등록|작성|추가)(?:한다|된다|함|됨|가능하다)?$/.test(endClause)) actionNoun = '등록';
  else if (/(?:수정|변경|편집)(?:한다|된다|함|됨|가능하다)?$/.test(endClause)) actionNoun = '수정';
  else if (/(?:삭제|제거)(?:한다|된다|함|됨|가능하다)?$/.test(endClause)) actionNoun = '삭제';
  else if (/저장(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '저장';
  else if (/(?:이동|전환|라우팅|리다이렉트)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '이동';
  else if (/(?:검증|검사|체크)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '검증';
  else if (/초기화(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '초기화';
  else if (/(?:제한|차단|비활성화)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '제한';
  else if (/활성화(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '활성화';
  else if (/(?:열린다|띄운다|열기)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '열기';
  else if (/(?:제시|표시|노출|출력|보여준다|제공)(?:한다|된다|함|됨)?$/.test(endClause)) actionNoun = '표시';
  else if (primaryCategory === 'validation') actionNoun = '검증';
  else if (primaryCategory === 'navigation') actionNoun = '이동';
  else if (primaryCategory === 'error_message') actionNoun = '표시';
  else if (primaryCategory === 'data') actionNoun = '저장';
  else if (/이동|전환/.test(firstClause)) actionNoun = '이동';
  else if (/검증|유효성|형식/.test(firstClause)) actionNoun = '검증';
  else if (/제시|표시|노출|출력/.test(firstClause)) actionNoun = '표시';
  else if (primaryCategory === 'business_logic') actionNoun = '처리';
  else if (primaryCategory === 'display') actionNoun = '표시';
  else actionNoun = /^Action/i.test(tag) ? '동작' : '표시';

  let nounTitle = targetNoun;
  if (!targetNoun.endsWith(actionNoun) && !ACTION_ENDINGS.test(targetNoun)) {
    nounTitle = `${targetNoun} ${actionNoun}`;
  } else if (
    targetNoun.split(/\s+/).length === 1 &&
    !targetNoun.endsWith(actionNoun)
  ) {
    nounTitle = `${targetNoun} ${actionNoun}`;
  }

  return `${nounTitle} (${originLabel})`;
}
