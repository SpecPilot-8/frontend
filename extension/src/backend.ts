/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: VS Code 확장 프로그램에서 백엔드 서버로 프로젝트와 스냅샷 정보를 요청하는 API 호출 파일
 * - 주요 기능:
 *   1) 백엔드 GET 요청 공통 처리 및 예외 메시지 변환
 *   2) 프로젝트 목록과 스냅샷 목록 및 스냅샷 원본 파일 조회
 */

import type { SnapshotPayload } from "./restore";

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface SnapshotSummary {
  id: string;
  file_count?: number;
  chunk_count?: number;
  created_at?: string;
}

// 백엔드 서버로 GET 요청을 보내고 JSON 응답을 반환하는 로직
async function getJson<T>(baseUrl: string, route: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${route}`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error(`백엔드에 연결하지 못했습니다. 서버가 실행 중인지 확인하세요: ${url}`);
  }
  if (!response.ok) {
    let message = `백엔드 요청이 실패했습니다 (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        message = `${body.error.message} (${response.status})`;
      }
    } catch {
      // 오류 응답 파싱 실패 예외 무시
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function fetchProjects(baseUrl: string): Promise<ProjectSummary[]> {
  return (await getJson<{ items: ProjectSummary[] }>(baseUrl, "/projects?limit=200")).items;
}

export async function fetchSnapshots(baseUrl: string, projectId: string): Promise<SnapshotSummary[]> {
  const route = `/projects/${encodeURIComponent(projectId)}/code/snapshots?limit=200`;
  return (await getJson<{ items: SnapshotSummary[] }>(baseUrl, route)).items;
}

export async function fetchSnapshotFiles(baseUrl: string, projectId: string, snapshotId: string): Promise<SnapshotPayload> {
  const route = `/projects/${encodeURIComponent(projectId)}/code/snapshots/${encodeURIComponent(snapshotId)}/files`;
  return getJson<SnapshotPayload>(baseUrl, route);
}

