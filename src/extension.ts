import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import { globalConfig } from "./config";
import { TreeDataProvider } from "./views/tree";
import { Resource } from "./resource";
import { GroupBy } from "./types";
import { registerInitCommands, registerRefreshCommand } from "./commands";
import { BLOG_PATH } from "./utils/constants";

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand("setContext", "blog-manager.showWelcome", true);
  const output = vscode.window.createOutputChannel("Blog Manager");

  registerInitCommands(context);

  let path: string | undefined = context.globalState.get(BLOG_PATH);

  if (!path) {
    path = vscode.workspace.workspaceFolders?.[0].uri.path || "";
    context.globalState.update(BLOG_PATH, path);
  }

  output.appendLine(`缓存目录: ${path}`);
  output.appendLine(`匹配规规则: ${globalConfig.fileMatchGlob()}`);

  if (!path) {
    return;
  }

  const resource = new Resource(context);
  resource.load(path);

  const allArticleTreeDataProvider = new TreeDataProvider(resource, GroupBy.NONE);

  const categoryTreeDataProvider = new TreeDataProvider(resource, GroupBy.CATEGORY);
  const tagTreeDataProvider = new TreeDataProvider(resource, GroupBy.TAG);

  const allArticleView = vscode.window.createTreeView("articles", {
    treeDataProvider: allArticleTreeDataProvider,
  });
  const categoryView = vscode.window.createTreeView("category", {
    treeDataProvider: categoryTreeDataProvider,
  });
  const tagView = vscode.window.createTreeView("tag", {
    treeDataProvider: tagTreeDataProvider,
  });

  context.subscriptions.push(allArticleView, categoryView, tagView);

  registerRefreshCommand(context, () => {
    resource.reload();
    [allArticleTreeDataProvider, categoryTreeDataProvider, tagTreeDataProvider].forEach((provider) => provider.refresh());
  });
}

export function deactivate() {}
