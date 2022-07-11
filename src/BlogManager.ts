import * as vscode from "vscode";
import { glob } from "glob";
import { join } from "path";
import { readFileSync } from "fs";
const fm = require("front-matter");

class Node extends vscode.TreeItem {
  children?: Node[];
  constructor(label: string, children?: Node[]) {
    super(
      label,
      children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded
    );
    this.children = children;
  }
}

class FileModel {
  public fileList: Record<string, string | any>[] = [];
  constructor(path: string) {
    const files = glob.sync(join(path, "**/*.md"));
    files.forEach((item) => {
      const frontMatter = fm(readFileSync(item, "utf-8"));

      this.fileList.push({
        ...frontMatter.attributes,
        path: item,
        label: frontMatter.attributes.title,
        resourceUri: vscode.Uri.parse(item),
      });
    });
  }

  list(): vscode.ProviderResult<Node[]> {
    throw new Error("为实现");
  }
}

class SourceFileModel extends FileModel {
  list() {
    return this.fileList.map((file) => ({ label: file.title, resourceUri: file.resourceUri }));
  }
}

class CategoryFileModel extends FileModel {
  list() {
    const formatteredList = this.fileList.reduce((result, current) => {
      if (current.category) {
        result[current.category] ? result[current.category].push(current) : (result[current.category] = [current]);
      } else {
        result["未分类"] ? result["未分类"].push(current) : (result["未分类"] = [current]);
      }

      return result;
    }, {});

    return Object.keys(formatteredList).map((item) => {
      return new Node(item, formatteredList[item]);
    });
  }
}

class TagFileModel extends FileModel {
  list() {
    const formatteredList = this.fileList.reduce((result, current) => {
      if (current.tags) {
        if (Array.isArray(current.tags)) {
          current.tags.map((t) => {
            result[t] ? result[t].push(current) : (result[t] = [current]);
          });
        } else {
          result[current.tags] ? result[current.tags].push(current) : (result[current.tags] = [current]);
        }
      } else {
        result["无标签"] ? result["无标签"].push(current) : (result["无标签"] = [current]);
      }

      return result;
    }, {});

    return Object.keys(formatteredList).map((item) => {
      return new Node(item, formatteredList[item]);
    });
  }
}

class TreeDataProvider implements vscode.TreeDataProvider<Node> {
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly model: FileModel) {}

  getTreeItem(element: Node): vscode.TreeItem {
    const isDir = element.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
    return {
      ...element,
      command: isDir
        ? void 0
        : {
            command: "blog-manager.openFile",
            arguments: [element.resourceUri],
            title: "打开文章",
          },
    };
  }
  getChildren(element?: Node | undefined): vscode.ProviderResult<Node[]> {
    return element === undefined ? this.model.list() : element.children;
  }
}

export class BlogManager {
  output: vscode.OutputChannel;
  constructor(context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel("Blog Manager");
    vscode.commands.registerCommand("blog-manager.openFile", (uri) => {
      vscode.window.showTextDocument(uri);
    });

    let path: string | undefined = context.globalState.get("BLOG_PATH");

    if (!path) {
      path = vscode.workspace.workspaceFolders?.[0].uri.path || "";
      context.globalState.update("BLOG_PATH", path);
    }

    this.output.appendLine(path);

    const sourceTreeDataProvider = new TreeDataProvider(new SourceFileModel(path));
    const categoryTreeDataProvider = new TreeDataProvider(new CategoryFileModel(path));
    const tagTreeDataProvider = new TreeDataProvider(new TagFileModel(path));
    const sourceViews = vscode.window.createTreeView("source", {
      treeDataProvider: sourceTreeDataProvider,
    });
    const categoryViews = vscode.window.createTreeView("category", {
      treeDataProvider: categoryTreeDataProvider,
    });
    const tagViews = vscode.window.createTreeView("tag", {
      treeDataProvider: tagTreeDataProvider,
    });

    context.subscriptions.push(sourceViews);
    context.subscriptions.push(categoryViews);
    context.subscriptions.push(tagViews);
  }
}
