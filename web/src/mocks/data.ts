import type {
  AIModelOption,
  RecentProject,
  ProjectSetupData,
  RequirementItem,
  DocumentOutlineNode,
  VerificationResultItem,
  TestSpecificationGroup,
} from '../types';

// AI 모델 목록
export const mockAIModels: AIModelOption[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic' },
];

// 최근 프로젝트 목록
export const mockRecentProjects: RecentProject[] = [
  {
    id: 'proj-001',
    name: 'ThinkTree Notice Platform',
    updatedAt: '2026-10-17 14:20',
    techStack: 'Java · Spring Boot',
    status: '검증 완료',
  },
  {
    id: 'proj-002',
    name: 'SpecPilot Core Gateway',
    updatedAt: '2026-10-15 18:05',
    techStack: 'FastAPI · Python 3.12',
    status: '분석 완료',
  },
  {
    id: 'proj-003',
    name: 'Campus LMS Auth Service',
    updatedAt: '2026-10-12 09:30',
    techStack: 'Node.js · NestJS',
    status: '설정 중',
  },
];

// 프로젝트 설정
export const mockProjectSetup: ProjectSetupData = {
  projectName: 'ThinkTree Notice Platform',
  specFile: {
    fileName: '한성대_specpilot_기획서_v0.2.pdf',
    pageCount: 12,
    version: 'v0.2',
    uploaded: true,
  },
  codeSource: {
    type: 'ZIP',
    sourceName: 'thinktree-source.zip',
    fileCount: 142,
    snapshotId: 'S-014',
  },
  techStack: 'Java · Spring Boot',
  analysisScope: 'src/main/java · 28개 파일',
  aiConfig: {
    modelId: 'gemini-2.5-flash',
    apiKey: '************************',
    isConnected: true,
  },
};

// 명세 분석 - 요구사항 목록
export const mockRequirements: RequirementItem[] = [
  {
    id: 'REQ-001',
    stable_key: 'NOTICE-001',
    title: '공지사항 목록 조회',
    original_text: '사용자는 등록된 공지사항 목록을 페이징하여 조회할 수 있다.',
    condition: '조회 권한 보유 시',
    action: '목록 조회 요청',
    expected: '공지사항 페이징 목록 반환',
    req_type: 'functional',
    review_status: 'approved',
    conditions: [
      {
        stable_key: 'COND-001-1',
        text: '페이지 번호 및 사이즈 검증',
        category: 'validation',
        target: 'unknown',
        verifiable: 'code',
      },
      {
        stable_key: 'COND-001-2',
        text: '최신순 기본 정렬',
        category: 'business_logic',
        target: 'unknown',
        verifiable: 'code',
      }
    ],
  }
];

// 명세서 문서 구조
export const mockDocumentOutline: DocumentOutlineNode[] = [
  {
    id: 'sec-1',
    title: '1. 프로젝트 개요',
    page: 1,
    children: [
      { id: 'sec-1-1', title: '1.1 개발 배경 및 목표', page: 2 },
      { id: 'sec-1-2', title: '1.2 시스템 아키텍처', page: 3 },
    ],
  },
  {
    id: 'sec-2',
    title: '2. 회원 및 인증',
    page: 4,
    requirementCount: 2,
    children: [
      { id: 'sec-2-1', title: '2.1 소셜 로그인 (LOGIN-002)', page: 4, requirementCount: 1 },
      { id: 'sec-2-2', title: '2.2 이메일 회원가입 (LOGIN-003)', page: 5, requirementCount: 1 },
    ],
  },
  {
    id: 'sec-3',
    title: '3. 공지사항 관리',
    page: 6,
    requirementCount: 3,
    children: [
      { id: 'sec-3-1', title: '3.1 공지사항 목록 조회 (NOTICE-001)', page: 6, requirementCount: 1 },
      { id: 'sec-3-2', title: '3.2 공지사항 신규 작성 (NOTICE-002)', page: 7, requirementCount: 1 },
      { id: 'sec-3-3', title: '3.3 공지사항 수정 및 삭제 (NOTICE-003)', page: 8, requirementCount: 1 },
    ],
  },
  {
    id: 'sec-4',
    title: '4. 사용자 설정',
    page: 10,
    requirementCount: 1,
    children: [
      { id: 'sec-4-1', title: '4.1 프로필 정보 변경 (USER-001)', page: 10, requirementCount: 1 },
    ],
  },
];

// 검증 결과
export const mockVerificationResults: VerificationResultItem[] = [
  {
    id: 'VR-001',
    requirementId: 'NOTICE-001',
    functionName: '공지사항 목록 조회',
    status: '구현',
    connectedCode: 'NoticeQueryService.java : 22',
    summary: '조회 조건과 응답 페이징 구조가 명세와 일치합니다.',
    matchedCriteriaCount: 6,
    totalCriteriaCount: 6,
    callChain: ['NoticeController', 'NoticeQueryService', 'NoticeRepository'],
    evidenceList: [
      {
        id: 'EV-01',
        filePath: 'NoticeQueryService.java',
        lineNumber: 'L22-29',
        status: '일치',
        title: '페이징 및 최신순 정렬 로직 일치',
        issueCode: '22  Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());\n23  return noticeRepository.findAllByIsDeletedFalse(pageable);',
        description: '삭제 공지 필터링과 정렬 기준이 정확하게 구현되어 있습니다.',
      },
    ],
  },
  {
    id: 'VR-002',
    requirementId: 'NOTICE-002',
    functionName: '공지사항 작성',
    status: '불일치',
    connectedCode: 'NoticeService.java : 34',
    summary: '명세 300MB · 서버 제한 50MB (용량 상충)',
    matchedCriteriaCount: 12,
    totalCriteriaCount: 15,
    callChain: ['NoticeController', 'NoticeService · 불일치 2곳', 'NoticeRepository'],
    evidenceList: [
      {
        id: 'EV-02',
        filePath: 'NoticeService.java',
        lineNumber: 'L34',
        status: '불일치',
        title: '용량 제한이 명세보다 작음 · 비즈니스 로직',
        issueCode: '34  long maxSize = 50L * 1024 * 1024;',
        description: '명세는 300MB까지 허용하지만 코드가 50MB를 초과하면 거절합니다.',
        suggestedFix: '34  long maxSize = 300L * 1024 * 1024;',
      },
      {
        id: 'EV-03',
        filePath: 'NoticeService.java',
        lineNumber: 'L36-38',
        status: '불일치',
        title: '오류 안내에도 50MB 기준 사용 · 오류 메시지',
        issueCode: '36  throw new IllegalArgumentException(\n37      "첨부파일은 50MB 이하입니다.");',
        description: '서버 에러 메시지에 50MB 제한 문구가 하드코딩되어 있습니다.',
        suggestedFix: '36  throw new IllegalArgumentException(\n37      "첨부파일은 300MB 이하입니다.");',
      },
      {
        id: 'EV-04',
        filePath: 'NoticeController.java',
        lineNumber: 'L22',
        status: '호출 근거',
        title: '첨부파일을 서비스로 전달 · 호출 근거',
        issueCode: '22  noticeService.createNotice(dto, attachmentFile);',
        description: '컨트롤러에서 서비스 계층으로 첨부파일 객체를 그대로 위임합니다.',
      },
    ],
  },
  {
    id: 'VR-003',
    requirementId: 'NOTICE-003',
    functionName: '공지사항 수정',
    status: '부분구현',
    connectedCode: 'NoticeService.java : 76',
    summary: '첨부파일 교체 시 이전 파일 정리 누락',
    matchedCriteriaCount: 7,
    totalCriteriaCount: 9,
    callChain: ['NoticeController', 'NoticeService', 'FileStorageService'],
    evidenceList: [
      {
        id: 'EV-05',
        filePath: 'NoticeService.java',
        lineNumber: 'L76-80',
        status: '불일치',
        title: '기존 스토리지 파일 삭제 메서드 호출 부재',
        issueCode: '76  if (newFile != null) {\n77      String newUrl = fileStorageService.upload(newFile);\n78      notice.updateFileUrl(newUrl);\n79  }',
        description: '새 파일 업로드는 수행하지만 기존 S3/로컬 파일 삭제 로직이 누락되어 스토리지 낭비가 발생합니다.',
        suggestedFix: '76  if (newFile != null) {\n77      fileStorageService.delete(notice.getFileUrl());\n78      String newUrl = fileStorageService.upload(newFile);\n79      notice.updateFileUrl(newUrl);\n80  }',
      },
    ],
  },
  {
    id: 'VR-004',
    requirementId: 'LOGIN-002',
    functionName: '소셜 로그인',
    status: '확인 필요',
    connectedCode: 'OAuthService.java : 18',
    summary: '외부 인증 응답체에 대한 근거 확인 필요',
    matchedCriteriaCount: 7,
    totalCriteriaCount: 9,
    callChain: ['OAuthController', 'OAuthService'],
    evidenceList: [
      {
        id: 'EV-06',
        filePath: 'OAuthService.java',
        lineNumber: 'L18-24',
        status: '호출 근거',
        title: 'OAuth 클라이언트 공급자 응답 매핑 로직',
        issueCode: '18  OAuthUserInfo userInfo = oAuthClient.getUserInfo(accessToken);\n19  return registerOrLoginUser(userInfo);',
        description: '깃허브 및 구글 OAuth 제공사별 반환 이메일 동의 여부 필드(is_verified) 처리 근거 확인이 필요합니다.',
      },
    ],
  },
  {
    id: 'VR-005',
    requirementId: 'LOGIN-003',
    functionName: '회원가입',
    status: '불일치',
    connectedCode: 'AuthService.java : 42',
    summary: '중복 이메일에 대한 오류 메시지 전달 누락',
    matchedCriteriaCount: 14,
    totalCriteriaCount: 15,
    callChain: ['AuthController', 'AuthService · 불일치 1곳', 'UserRepository'],
    evidenceList: [
      {
        id: 'EV-07',
        filePath: 'AuthService.java',
        lineNumber: 'L42-45',
        status: '불일치',
        title: '중복 이메일 예외에 사용자 안내 문구 없음 · 오류 메시지',
        issueCode: '42  if (users.existsByEmail(email)) {\n43      throw new IllegalStateException();\n44  }',
        description: '중복 검사는 통과하지 못하게 막고 있으나 예외 메시지가 비어 있어 클라이언트에 원인이 전달되지 않습니다.',
        suggestedFix: '42  if (users.existsByEmail(email)) {\n43      throw new IllegalStateException(\n44          "이미 가입된 이메일입니다.");\n45  }',
      },
    ],
  },
  {
    id: 'VR-006',
    requirementId: 'USER-001',
    functionName: '프로필 변경',
    status: '미구현 후보',
    connectedCode: '연결된 코드 없음',
    summary: '분석 범위 안에서 관련 컨트롤러 및 서비스를 찾지 못함',
    matchedCriteriaCount: 0,
    totalCriteriaCount: 6,
    callChain: [],
    evidenceList: [],
  },
];

// 테스트 사양서
export const mockTestSpecifications: Record<string, TestSpecificationGroup> = {
  'NOTICE-002': {
    requirementId: 'NOTICE-002',
    groupTitle: '공지사항 신규 등록',
    precondition: '관리자 로그인 (ROLE_ADMIN) · 공지사항 작성 화면 진입',
    totalTests: 6,
    testCases: [
      {
        id: 'TC-001',
        procedure: '소용량 파일 첨부 후 공지 등록',
        inputValue: '첨부파일: 25MB (sample.pdf)',
        expected: 'HTTP 200 / 등록 완료 후 공지사항 목록 이동',
        codeBasedPrediction: '정상 예상',
        actualStatus: '미실행',
      },
      {
        id: 'TC-002',
        procedure: '중간 용량 파일 첨부 후 등록',
        inputValue: '첨부파일: 250MB (archive.zip)',
        expected: 'HTTP 200 / 등록 완료 후 공지사항 목록 이동',
        codeBasedPrediction: '실패 예상',
        actualStatus: '미실행',
      },
      {
        id: 'TC-003',
        procedure: '명세상 허용 한계 용량으로 등록',
        inputValue: '첨부파일: 300MB (full_backup.zip)',
        expected: 'HTTP 200 / 등록 완료 후 공지사항 목록 이동',
        codeBasedPrediction: '실패 예상',
        actualStatus: '미실행',
      },
      {
        id: 'TC-004',
        procedure: '용량 초과 파일 업로드 시도',
        inputValue: '첨부파일: 301MB',
        expected: 'HTTP 400 / "300MB 이하 파일만 업로드 가능합니다" 에러',
        codeBasedPrediction: '실패 예상',
        actualStatus: '미실행',
      },
      {
        id: 'TC-005',
        procedure: '제목 누락 상태로 등록 시도',
        inputValue: '제목: "" (공백)',
        expected: 'HTTP 400 / "제목은 필수입니다" 메시지 반환',
        codeBasedPrediction: '정상 예상',
        actualStatus: '미실행',
      },
      {
        id: 'TC-006',
        procedure: '비인가 사용자의 공지사항 등록 시도',
        inputValue: 'ROLE_USER 계정으로 API 직접 호출',
        expected: 'HTTP 403 Forbidden 반환',
        codeBasedPrediction: '정상 예상',
        actualStatus: '미실행',
      },
    ],
  },
  'LOGIN-003': {
    requirementId: 'LOGIN-003',
    groupTitle: '회원가입',
    precondition: '비회원 상태 · 회원가입 화면 진입 · 이미 DB에 등록된 test@example.com 존재',
    totalTests: 3,
    testCases: [
      {
        id: 'SIGNUP-001',
        procedure: '신규 고유 이메일로 회원가입',
        inputValue: 'newuser2026@test.com / Pass1234!@',
        expected: '계정 생성 완료 후 로그인 화면(/login) 이동',
        codeBasedPrediction: '정상 예상',
        actualStatus: '미실행',
      },
      {
        id: 'SIGNUP-002',
        procedure: '기존 가입 이메일로 중복 가입 시도',
        inputValue: 'test@example.com / Pass1234!@',
        expected: '가입 거절 및 "이미 가입된 이메일입니다" 안내 메시지 노출',
        codeBasedPrediction: '실패 예상',
        actualStatus: '미실행',
      },
      {
        id: 'SIGNUP-003',
        procedure: '잘못된 이메일 형식 입력',
        inputValue: 'not-an-email-string / Pass1234!@',
        expected: '유효성 검증 실패 안내 및 DB 저장 차단',
        codeBasedPrediction: '정상 예상',
        actualStatus: '미실행',
      },
    ],
  },
};