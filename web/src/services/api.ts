import type {
  AIModelOption,
  RecentProject,
  ProjectSetupData,
  RequirementItem,
  DocumentOutlineNode,
  VerificationResultItem,
  TestSpecificationGroup,
} from '../types';

// 실제 백엔드(FastAPI) 서버 주소
const BASE_URL = 'http://127.0.0.1:8000/api/v2';

// 시작 페이지 API: 실제 프로젝트 목록 조회
export const fetchRecentProjects = async (): Promise<RecentProject[]> => {
  try {
    const res = await fetch(`${BASE_URL}/projects`);
    if (!res.ok) return [];
    const data = await res.json();
    
    return data.items.map((p: any) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.created_at.split('T')[0],
      techStack: '스택 미지정',
      status: '대기 중',
    }));
  } catch (error) {
    console.error('백엔드 연결 실패:', error);
    return [];
  }
};

// 프로젝트 설정 API: 실제 AI 모델 카탈로그 조회
export const fetchAIModels = async (): Promise<AIModelOption[]> => {
  try {
    const res = await fetch(`${BASE_URL}/model-profiles`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items.map((m: any) => ({
      id: m.id,
      name: m.display_name,
      provider: m.provider,
    }));
  } catch (error) {
    console.error('모델 목록 조회 실패:', error);
    return [];
  }
};

// 특정 프로젝트 설정 정보 조회
export const fetchProjectSetup = async (projectId?: string): Promise<ProjectSetupData | null> => {
  if (!projectId) return null;
  try {
    const res = await fetch(`${BASE_URL}/projects/${projectId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      projectName: data.name,
      techStack: '',
      codeScope: '',
    } as any;
  } catch (error) {
    console.error('프로젝트 정보 조회 실패:', error);
    return null;
  }
};

// 백엔드 스키마에 맞춰 프로젝트 메타데이터 생성
export const saveProjectSetup = async (data: any): Promise<{ success: boolean; data?: any; projectId?: string }> => {
  try {
    const res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.projectName || '새 프로젝트',
      }),
    });

    if (!res.ok) {
      throw new Error(`프로젝트 생성 실패 (${res.status})`);
    }

    const newProject = await res.json();

    return { success: true, data: newProject, projectId: newProject.id };
  } catch (error) {
    console.error('프로젝트 생성 오류:', error);
    return { success: false };
  }
};

// 기획서(PDF) 파일 실제 업로드 API
export const uploadDocument = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${BASE_URL}/projects/${projectId}/documents`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    throw new Error('기획서 파일 업로드 실패');
  }
  return await res.json();
};

// 소스코드(ZIP) 파일 실제 업로드 API
export const uploadSourceCode = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${BASE_URL}/projects/${projectId}/code/sources`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    throw new Error('소스코드 파일 업로드 실패');
  }
  return await res.json();
};

// 명세 분석 API: 실제 요구사항 목록 조회
export const fetchRequirements = async (projectId: string): Promise<RequirementItem[]> => {
  try {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/requirements`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('요구사항 조회 실패:', error);
    return [];
  }
};

export const fetchDocumentOutline = async (): Promise<DocumentOutlineNode[]> => { return []; };

// 검증 결과 API
export const fetchVerificationResults = async (): Promise<VerificationResultItem[]> => {
  return [];
};

// 테스트 사양서 API
export const fetchTestSpecifications = async (_requirementId: string): Promise<TestSpecificationGroup | null> => {
  return null;
};

/**
 * 백엔드 비동기 Job이 완료될 때까지 폴링(Polling)하는 함수
 * @param projectId 프로젝트 ID
 * @param jobId 작업 ID
 * @param onProgress 진행 상황 콜백 (선택)
 * @returns 최종 Job 결과 데이터
 */
export async function pollJobStatus(
  projectId: string, 
  jobId: string, 
  onProgress?: (job: any) => void
): Promise<any> {
  const maxAttempts = 60; // 최대 60번 시도 (약 1분)
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error('작업 상태를 조회하는 중 오류가 발생했습니다.');
      }
      
      const job = await res.json();
      
      if (onProgress) {
        onProgress(job);
      }

      // 완료되었거나 차단/실패한 경우 루프 탈출
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'blocked') {
        return job;
      }
    } catch (error) {
      console.error('Job 폴링 중 에러:', error);
    }

    // 1초 대기 후 재시도
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('작업 시간이 초과되었습니다. (Timeout)');
}