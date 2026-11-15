/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 웹 화면과 VS Code 확장 프로그램 간의 메시지 전달을 담당하는 파일
 * - 주요 기능:
 *   1) 현재 실행 환경이 VS Code 웹뷰인지 판별
 *   2) 특정 소스 코드 파일과 줄 번호로 이동하도록 메시지 전송
 */

export interface JumpToLinePayload {
  projectId: string;
  projectName: string;
  snapshotId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
}

let vscodeApiInstance: { postMessage: (msg: unknown) => void } | null = null;

function getVsCodeApi(): { postMessage: (msg: unknown) => void } | null {
  if (vscodeApiInstance) return vscodeApiInstance;
  const anyWin = window as unknown as { acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void } };
  if (typeof anyWin.acquireVsCodeApi === "function") {
    try {
      vscodeApiInstance = anyWin.acquireVsCodeApi();
      return vscodeApiInstance;
    } catch {
      // 이미 획득된 경우 등의 예외 방어
    }
  }
  return null;
}

// 현재 실행 환경이 VS Code 내부인지 확인하는 로직
export function isVsCodeEnvironment(): boolean {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("host") === "vscode") {
      return true;
    }
    if (window.parent && window.parent !== window) {
      return true;
    }
    if (typeof (window as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi === "function") {
      return true;
    }
  }
  return false;
}

// 에디터의 특정 파일 줄 위치로 이동을 요청하는 로직
export function requestJumpToLine(payload: JumpToLinePayload): boolean {
  if (!isVsCodeEnvironment()) {
    return false;
  }

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ command: "jumpToLine", payload }, "*");
      return true;
    }

    const api = getVsCodeApi();
    if (api) {
      api.postMessage({ command: "jumpToLine", payload });
      return true;
    }
  } catch (error) {
    console.warn("VS Code 점프 메시지 전달 실패:", error);
  }

  return false;
}

