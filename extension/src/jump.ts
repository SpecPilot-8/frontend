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

/**
 * 프로젝트 폴더를 준비하고(필요시 자동 복원), 지정한 파일의 라인 번호 위치로 에디터를 열고 포커스한다.
 */
export async function jumpToCodeLocation(payload: JumpPayload): Promise<void> {
  const settings = readSettings();
  const apiBaseUrl = payload.apiBaseUrl || settings.apiBaseUrl;
  const workspaceRoot = settings.workspaceRoot;

  const baseFolder = path.join(workspaceRoot, sanitizeFolderName(payload.projectName));

  // 폴더가 없거나(manifest 없음), 요청된 snapshotId가 명시되었는데 manifest의 snapshotId와 다른 경우 복원 진행
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

  // 대상 파일 찾기
  const targetFile = resolveTargetFilePath(targetFolder, payload.filePath);
  if (!targetFile) {
    throw new Error(`복원된 소스 폴더에서 해당 파일을 찾을 수 없습니다: ${payload.filePath} (폴더: ${targetFolder})`);
  }

  // VS Code 에디터에서 열기
  const document = await vscode.workspace.openTextDocument(targetFile);

  // 대시보드 웹뷰(ViewColumn.One)가 열려 있다면 그 옆(Beside)으로 열어 나란히 볼 수 있게 함
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
