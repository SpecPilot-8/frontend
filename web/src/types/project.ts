// 명세 파일 정보
export interface SpecFileInfo {
  fileName: string;
  pageCount?: number;
  version?: string;
  uploaded?: boolean;
  [key: string]: unknown;
}

// 소스코드 소스 정보
export interface CodeSourceInfo {
  type: string;
  sourceName: string;
  fileCount?: number;
  snapshotId?: string;
  [key: string]: unknown;
}

// 프로젝트 설정 전체 데이터
export interface ProjectSetupData {
  projectName: string;
  specFile: SpecFileInfo | null;
  codeSource: CodeSourceInfo | null;
  techStack: string;
  analysisScope: string;
  aiConfig: {
    modelId: string;
    apiKey: string;
    isConnected: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
