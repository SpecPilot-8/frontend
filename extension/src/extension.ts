import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { jumpToCodeLocation } from "./jump";
import { restoreSnapshotCommand } from "./restoreCommand";

export function activate(context: vscode.ExtensionContext) {
  const openDashboardCmd = vscode.commands.registerCommand(
    "specpilot.openDashboard",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "specpilotDashboard",
        "SpecPilot Dashboard",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(
              path.join(context.extensionPath, "..", "web", "dist"),
            ),
          ],
        },
      );

      const isDev = true;

      if (isDev) {
        panel.webview.html = `
          <!DOCTYPE html>
          <html lang="ko">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                  body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #1e1e1e; }
                  iframe { width: 100%; height: 100%; border: none; }
              </style>
          </head>
          <body>
              <iframe id="specpilot-frame" src="http://localhost:5173/?host=vscode"></iframe>
              <script>
                  const vscode = acquireVsCodeApi();
                  // 웹뷰 iframe에서 오는 메시지를 VS Code extension으로 중계
                  window.addEventListener("message", (event) => {
                      if (event.data && typeof event.data === "object") {
                          vscode.postMessage(event.data);
                      }
                  });
                  // 반대로 extension에서 오는 메시지를 iframe으로 전달 (양방향 대비)
                  window.addEventListener("message-from-extension", (event) => {
                      const frame = document.getElementById("specpilot-frame");
                      if (frame && frame.contentWindow) {
                          frame.contentWindow.postMessage(event.detail, "*");
                      }
                  });
              </script>
          </body>
          </html>
        `;
      } else {
        panel.webview.html = getWebviewContent(context, panel.webview);
      }

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === "jumpToLine") {
            try {
              await jumpToCodeLocation(message.payload);
            } catch (error) {
              vscode.window.showErrorMessage(
                `SpecPilot 코드 이동 실패: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        },
        undefined,
        context.subscriptions,
      );
    },
  );

  // 수동 테스트용 점프 커맨드 (Ctrl+Shift+P 로 임의 위치 점프 테스트 가능)
  const jumpTestCmd = vscode.commands.registerCommand(
    "specpilot.testJumpToLocation",
    async () => {
      const projectName = await vscode.window.showInputBox({
        prompt: "프로젝트명을 입력하세요 (예: Test1)",
        value: "Test1",
      });
      if (!projectName) {
        return;
      }

      const filePath = await vscode.window.showInputBox({
        prompt: "상대 파일 경로를 입력하세요 (예: NoticeController.java 또는 src/main/...)",
        value: "NoticeController.java",
      });
      if (!filePath) {
        return;
      }

      const lineStr = await vscode.window.showInputBox({
        prompt: "이동할 시작 줄 번호(startLine)를 입력하세요",
        value: "1",
      });
      if (!lineStr) {
        return;
      }

      try {
        await jumpToCodeLocation({
          projectId: "",
          projectName,
          snapshotId: "",
          filePath,
          startLine: parseInt(lineStr, 10) || 1,
          endLine: (parseInt(lineStr, 10) || 1) + 2,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `점프 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  context.subscriptions.push(
    openDashboardCmd,
    vscode.commands.registerCommand("specpilot.restoreSnapshot", restoreSnapshotCommand),
    jumpTestCmd,
  );
}

function getWebviewContent(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
): string {
  const distPath = path.join(context.extensionPath, "..", "web", "dist");
  const indexPath = path.join(distPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return `<!DOCTYPE html>
      <html>
        <body style="padding: 24px; font-family: sans-serif; color: #ccc; background: #1e1e1e;">
          <h3>SpecPilot UI 빌드 파일이 없습니다.</h3>
          <p>web 폴더에서 <code>npm run build</code> 명령어를 먼저 실행하세요.</p>
        </body>
      </html>`;
  }

  let html = fs.readFileSync(indexPath, "utf-8");

  html = html.replace(/(href|src)="\/(.*?)"/g, (_, attr, relPath) => {
    const resourceUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(distPath, relPath)),
    );
    return `${attr}="${resourceUri}"`;
  });

  return html;
}

export function deactivate() {}
