import * as vscode from "vscode";
import { fetchProjects, fetchSnapshotFiles, fetchSnapshots } from "./backend";
import { applyRestore, planRestore } from "./restore";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v2";

export function readSettings(): { apiBaseUrl: string; workspaceRoot: string } {
  const config = vscode.workspace.getConfiguration("specpilot");
  return {
    apiBaseUrl: config.get<string>("apiBaseUrl", DEFAULT_API_BASE_URL),
    workspaceRoot: config.get<string>("workspaceRoot", "C:\\"),
  };
}

/** 프로젝트·스냅샷을 골라 `<workspaceRoot>\<프로젝트명>`에 소스를 복원한다. */
export async function restoreSnapshotCommand(): Promise<void> {
  const { apiBaseUrl, workspaceRoot } = readSettings();
  try {
    const projects = await fetchProjects(apiBaseUrl);
    if (!projects.length) {
      vscode.window.showWarningMessage("SpecPilot: 등록된 프로젝트가 없습니다.");
      return;
    }
    const project = await vscode.window.showQuickPick(
      projects.map((p) => ({ label: p.name, description: p.id, value: p })),
      { placeHolder: "소스를 복원할 프로젝트를 선택하세요" },
    );
    if (!project) {
      return;
    }
    const snapshots = await fetchSnapshots(apiBaseUrl, project.value.id);
    if (!snapshots.length) {
      vscode.window.showWarningMessage("SpecPilot: 이 프로젝트에는 인덱싱된 코드 스냅샷이 없습니다.");
      return;
    }
    const snapshot = await vscode.window.showQuickPick(
      snapshots.map((s) => ({
        label: s.id.slice(0, 8),
        description: `${s.file_count ?? "?"}개 파일 · ${s.chunk_count ?? "?"}개 청크`,
        detail: s.created_at,
        value: s,
      })),
      { placeHolder: "복원할 코드 스냅샷을 선택하세요" },
    );
    if (!snapshot) {
      return;
    }

    const payload = await fetchSnapshotFiles(apiBaseUrl, project.value.id, snapshot.value.id);
    const plan = planRestore(workspaceRoot, project.value.name, project.value.id, payload);
    if (plan.action !== "reuse") {
      const note = plan.alternate ? "\n(같은 이름의 폴더에 이미 다른 내용이 있어 새 폴더를 사용합니다.)" : "";
      const answer = await vscode.window.showInformationMessage(
        `${plan.folder} 에 소스 ${plan.fileCount}개를 복원합니다.${note}`,
        { modal: true },
        "복원",
      );
      if (answer !== "복원") {
        return;
      }
    }
    applyRestore(plan, project.value.id, payload);

    const done = { create: "복원했습니다", update: "새 스냅샷으로 갱신했습니다", reuse: "이미 복원된 폴더를 사용합니다" }[plan.action];
    const open = await vscode.window.showInformationMessage(`SpecPilot: ${done} → ${plan.folder}`, "탐색기에서 보기");
    if (open) {
      await vscode.env.openExternal(vscode.Uri.file(plan.folder));
    }
  } catch (error) {
    vscode.window.showErrorMessage(`SpecPilot: ${error instanceof Error ? error.message : String(error)}`);
  }
}

