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

/**
 * 현재 웹앱이 VS Code Extension 내부(iframe 또는 webview)에서 실행 중인지 확인한다.
 */
export function isVsCodeEnvironment(): boolean {
  // 1. URL 쿼리 파라미터 확인 (?host=vscode)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("host") === "vscode") {
      return true;
    }
    // 2. iframe 내부에서 실행 중인 경우
    if (window.parent && window.parent !== window) {
      return true;
    }
    // 3. 직접 웹뷰에 로드된 경우
    if (typeof (window as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi === "function") {
      return true;
    }
  }
  return false;
}

/**
 * VS Code에 파일 특정 라인 위치로 점프하도록 메시지를 전달한다.
 * VS Code 환경이 아니면 false를 반환한다.
 */
export function requestJumpToLine(payload: JumpToLinePayload): boolean {
  if (!isVsCodeEnvironment()) {
    return false;
  }

  try {
    // 1. iframe 환경 (개발 모드): 부모 창의 중계 스크립트로 전달
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ command: "jumpToLine", payload }, "*");
      return true;
    }

    // 2. 직접 웹뷰 환경 (빌드 모드): VS Code API로 직접 전달
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

