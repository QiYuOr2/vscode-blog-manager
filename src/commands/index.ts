import * as vscode from "vscode";
import { BLOG_PATH } from "../utils/constants";
import { TreeDataProvider } from "../views/tree";

export function registerInitCommands(context: vscode.ExtensionContext) {
  const openFile = vscode.commands.registerCommand("blog-manager.openFile", (uri) => {
    vscode.window.showTextDocument(uri);
  });
  const resetPath = vscode.commands.registerCommand("blog-manager.resetPath", () => {
    context.globalState.update(BLOG_PATH, "");
    vscode.commands.executeCommand("workbench.action.files.openFileFolder");
  });

  context.subscriptions.push(openFile, resetPath);
}

export function registerRefreshCommand(context: vscode.ExtensionContext, action: () => void) {
  const refresh = vscode.commands.registerCommand("blog-manager.refresh", action);

  context.subscriptions.push(refresh);
}
