import type {
  AIModelOption,
  RecentProject,
  ProjectSetupData,
  RequirementItem,
  DocumentOutlineNode,
} from "../types";

// 환경 변수가 없으면 로컬 기본값을 사용합니다
export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v2";

// 공통 에러 처리 헬퍼 함수
const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `서버 통신 에러가 발생했습니다. (${res.status})`,
    );
  }
  return res.json();
};

export const fetchRecentProjects = async (): Promise<RecentProject[]> => {
  try {
    const res = await fetch(`${BASE_URL}/projects`);
    const data = await handleResponse(res);
    return data.items.map(
      (p: { id: string; name: string; created_at: string }) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.created_at.split("T")[0],
        techStack: "스택 미지정",
        status: "대기 중",
      }),
    );
  } catch (error) {
    console.error("프로젝트 목록 조회 실패:", error);
    // 목록 조회 실패는 심각한 오류가 아니므로 빈 배열 반환 (화면에서 프로젝트 없음으로 표시)
    return [];
  }
};

export const fetchAIModels = async (): Promise<AIModelOption[]> => {
  try {
    const res = await fetch(`${BASE_URL}/model-profiles`);
    const data = await handleResponse(res);
    return data.items.map(
      (m: { id: string; display_name: string; provider: string }) => ({
        id: m.id,
        name: m.display_name,
        provider: m.provider,
      }),
    );
  } catch (error) {
    console.error("모델 목록 조회 실패:", error);
    // 모델 목록 조회 실패 시 하드코딩 기본값을 쓰도록 빈 배열 반환
    return [];
  }
};

export const fetchProjectSetup = async (
  projectId?: string,
): Promise<ProjectSetupData | null> => {
  if (!projectId) return null;
  try {
    const res = await fetch(`${BASE_URL}/projects/${projectId}`);
    const data = await handleResponse(res);
    return {
      projectName: data.name,
      version: data.version,
      techStack: "",
      codeScope: "",
    } as unknown as ProjectSetupData;
  } catch (error) {
    console.error("프로젝트 정보 조회 실패:", error);
    return null;
  }
};

export const saveProjectSetup = async (
  data: { projectName?: string },
  projectId?: string,
  baseVersion: number = 1,
): Promise<{
  success: boolean;
  data?: unknown;
  projectId?: string;
  error?: string;
}> => {
  try {
    let res;
    if (projectId) {
      // 기존 프로젝트 수정
      res = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.projectName || "새 프로젝트",
          base_version: baseVersion,
        }),
      });
    } else {
      // 새 프로젝트 생성
      res = await fetch(`${BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.projectName || "새 프로젝트",
        }),
      });
    }

    const projectData = await handleResponse(res);
    return { success: true, data: projectData, projectId: projectData.id };
  } catch (error: unknown) {
    console.error("프로젝트 저장 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
};

export const uploadDocument = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
  return await handleResponse(res);
};

export const uploadSourceCode = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/projects/${projectId}/code/sources`, {
    method: "POST",
    body: formData,
  });
  return await handleResponse(res);
};

export const fetchRequirements = async (
  projectId: string,
): Promise<RequirementItem[]> => {
  const res = await fetch(
    `${BASE_URL}/projects/${projectId}/requirements?limit=200`,
  );
  const data = await handleResponse(res);
  // data.items가 undefined일 경우 정상적인 빈 배열[]을 반환
  // API 응답 자체가 실패하면 handleResponse에서 예외가 발생(throw Error)하여 호출부에서 캐치됨
  return data.items || [];
};

export const fetchDocumentOutline = async (): Promise<
  DocumentOutlineNode[]
> => {
  return [];
};

export const fetchVerificationRuns = async (projectId: string) => {
  const res = await fetch(
    `${BASE_URL}/projects/${projectId}/verification-runs`,
  );
  const data = await handleResponse(res);
  return data.items || [];
};

export const fetchTestSpecifications = async (projectId: string) => {
  const res = await fetch(
    `${BASE_URL}/projects/${projectId}/test-specifications`,
  );
  const data = await handleResponse(res);
  return data.items || [];
};

export async function pollJobStatus(
  projectId: string,
  jobId: string,
  onProgress?: (job: {
    progress?: { stage: string; completed: number; total: number };
  }) => void,
): Promise<unknown> {
  const maxAttempts = 60; // 최대 약 1분
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const res = await fetch(
        `${BASE_URL}/projects/${projectId}/jobs/${jobId}`,
      );
      const job = await handleResponse(res);

      if (onProgress) {
        onProgress(job);
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "blocked" ||
        job.status === "cancelled"
      ) {
        return job;
      }
    } catch (error) {
      console.error("Job 폴링 중 에러:", error);
      // 폴링 중 일시적인 네트워크 끊김일 수 있으므로 여기서 바로 throw하지 않고 재시도
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error("작업 시간이 초과되었습니다. (Timeout)");
}
