import * as vscode from "vscode";
import { Resource } from "../resource";
import { Article, GroupBy } from "../types";
import { buildDateGroupTree, type DateGroups } from "../utils/date-group";

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
    if (element !== undefined) {
      return element.children;
    }

    if (this.groupBy === GroupBy.DATE) {
      return this.toDateNodes(this.resource.toDateList());
    }

    return this.toTreeData(this.resource.toList(this.groupBy));
  }

  private toDateNodes(groups: DateGroups<Article>): Node[] {
    return buildDateGroupTree(groups, vscode.l10n.t("noDate")).map((node) => {
      if ("months" in node) {
        const months = node.months.map((month) => new Node(month.label, month.articles as unknown as Node[]));
        return new Node(node.label, months);
      }

      return new Node(node.label, node.articles as unknown as Node[]);
    });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<undefined | null | void> = new vscode.EventEmitter<undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
