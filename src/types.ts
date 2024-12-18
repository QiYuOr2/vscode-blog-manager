import type * as vscode from "vscode";

export type MarkdownFrontMatter = {
  title: string;
  tags: string[];
  category: string;
};

export type Article = MarkdownFrontMatter & {
  path: string;
  label: string;
  resourceUri: vscode.Uri;
};

export enum GroupBy {
  NONE,
  TAG,
  CATEGORY
}