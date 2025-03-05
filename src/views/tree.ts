import * as vscode from "vscode";
import { Resource } from "../resource";
import { Article, GroupBy } from "../types";

class Node extends vscode.TreeItem {
  children?: Node[];
  constructor(label: string, children?: Node[]) {
    super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
    this.children = children;
  }
}

export class TreeDataProvider implements vscode.TreeDataProvider<Node> {
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly resource: Resource, private readonly groupBy: GroupBy) {}

  getTreeItem(element: Node): vscode.TreeItem {
    const isDir = element.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
    return {
      ...element,
      command: isDir
        ? void 0
        : {
            command: "blog-manager.openFile",
            arguments: [element.resourceUri],
            title: vscode.l10n.t("openFile"),
          },
    };
  }

  private toTreeData<T extends Node>(list: T[] | Record<string, T[]>) {
    if (Array.isArray(list)) {
      return list;
    }

    return Object.keys(list).map((key) => new Node(key, list[key]));
  }

  getChildren(element?: Node | undefined): vscode.ProviderResult<Node[]> {
    return element === undefined ? this.toTreeData(this.resource.toList(this.groupBy)) : element.children;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<undefined | null | void> = new vscode.EventEmitter<undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
