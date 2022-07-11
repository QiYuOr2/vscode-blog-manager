import * as vscode from "vscode";
import { BlogManager } from "./BlogManager";

export function activate(context: vscode.ExtensionContext) {
  new BlogManager(context);
}

export function deactivate() {}
