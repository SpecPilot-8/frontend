import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
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
              <iframe src="http://localhost:5173/"></iframe>
          </body>
          </html>
        `;
      } else {
        panel.webview.html = getWebviewContent(context, panel.webview);
      }

      panel.webview.onDidReceiveMessage(
        (message) => {
          if (message.command === "jumpToLine") {
            vscode.window.showInformationMessage(
              `코드 점프 요청: ${message.filePath}:${message.line}`,
            );
          }
        },
        undefined,
        context.subscriptions,
      );
    },
  );

  context.subscriptions.push(disposable);
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
