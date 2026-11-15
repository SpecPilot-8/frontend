/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 로컬 소스 폴더를 확인하고 지정된 파일의 해당 줄 위치로 VS Code 에디터를 여는 파일
 * - 주요 기능:
 *   1) 로컬 폴더 내 스냅샷 복원 여부 확인 및 자동 복원 안내
 *   2) 대상 파일 경로 탐색 및 분할 뷰 에디터 열기
 *   3) 지정된 시작 줄과 끝 줄 범위 선택 및 화면 중앙 스크롤 이동
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { fetchSnapshotFiles } from "./backend";
import { resolveTargetFilePath } from "./pathResolver";
import { applyRestore, planRestore, readManifest, sanitizeFolderName } from "./restore";
import { readSettings } from "./restoreCommand";

export interface JumpPayload {
  projectId: string;
  projectName: string;
  snapshotId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  apiBaseUrl?: string;
}

// 프로젝트 폴더를 준비하고 지정한 파일의 줄 위치로 에디터를 여는 로직
export async function jumpToCodeLocation(payload: JumpPayload): Promise<void> {
  const settings = readSettings();
  const apiBaseUrl = payload.apiBaseUrl || settings.apiBaseUrl;
  const workspaceRoot = settings.workspaceRoot;

  const baseFolder = path.join(workspaceRoot, sanitizeFolderName(payload.projectName));

  // 로컬 폴더 복원 필요 여부를 확인하고 복원하는 로직
  let targetFolder = baseFolder;
  const manifest = fs.existsSync(baseFolder) ? readManifest(baseFolder) : null;
  const needRestore = !manifest || (Boolean(payload.snapshotId) && manifest.snapshotId !== payload.snapshotId);

  if (needRestore) {
    if (!payload.projectId || !payload.snapshotId) {
      throw new Error(`소스 코드가 아직 복원되지 않았습니다 (${baseFolder}). 먼저 스냅샷을 복원해주세요.`);
    }

    const snapshot = await fetchSnapshotFiles(apiBaseUrl, payload.projectId, payload.snapshotId);
    const plan = planRestore(workspaceRoot, payload.projectName, payload.projectId, snapshot);

    if (plan.action !== "reuse") {
      const answer = await vscode.window.showInformationMessage(
        `코드 위치를 확인하기 위해 [${plan.folder}]에 소스(${plan.fileCount}개)를 복원합니다.`,
        { modal: true },
        "복원 후 이동",
      );
      if (answer !== "복원 후 이동") {
        return;
      }
    }

    applyRestore(plan, payload.projectId, snapshot);
    targetFolder = plan.folder;
  }

  // 대상 파일을 찾아 에디터에서 열고 줄 범위를 선택하는 로직
  const targetFile = resolveTargetFilePath(targetFolder, payload.filePath);
  if (!targetFile) {
    throw new Error(`복원된 소스 폴더에서 해당 파일을 찾을 수 없습니다: ${payload.filePath} (폴더: ${targetFolder})`);
  }

  const document = await vscode.workspace.openTextDocument(targetFile);

  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
  });

  const startLineIdx = Math.max(0, (payload.startLine || 1) - 1);
  const endLineIdx = Math.max(startLineIdx, (payload.endLine || payload.startLine || 1) - 1);

  const safeEndLine = Math.min(endLineIdx, Math.max(0, document.lineCount - 1));
  const lineLength = document.lineCount > 0 ? document.lineAt(safeEndLine).text.length : 0;

  const startPos = new vscode.Position(startLineIdx, 0);
  const endPos = new vscode.Position(safeEndLine, lineLength);
  const selection = new vscode.Selection(startPos, endPos);

  editor.selection = selection;
  editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
}
