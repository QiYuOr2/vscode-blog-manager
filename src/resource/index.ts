import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import { join } from "node:path";
import fm from "front-matter";
import { readFileSync } from "node:fs";
import { glob } from "glob";
import { Article, GroupBy, MarkdownFrontMatter } from "../types";
import { globalConfig } from "../config";
import { tryPush } from "../utils/array";

export class Resource {
  articles: Article[] = [];

  constructor() {}

  load(path: string) {
    const globPath = join(path, globalConfig.fileMatchGlob())
      //处理 windows 路径
      .replaceAll("\\", "/");
    const files = glob.sync(globPath);

    files.forEach((item) => {
      const frontMatter = fm<MarkdownFrontMatter>(readFileSync(item, "utf-8"));

      if (frontMatter.attributes?.title) {
        this.articles.push({
          ...frontMatter.attributes,
          path: item,
          label: frontMatter.attributes.title,
          resourceUri: vscode.Uri.parse(item),
        });
      }

      if (this.articles.length > 0) {
        vscode.commands.executeCommand("setContext", "blog-manager.showWelcome", false);
      }
    });
  }

  toList(groupBy: GroupBy) {
    return {
      [GroupBy.NONE]: () => this.articles,
      [GroupBy.TAG]: () => this.toTagList(),
      [GroupBy.CATEGORY]: () => this.toCategoryList(),
    }[groupBy]();
  }

  toTagList() {
    return this.articles.reduce<Record<string, Article[]>>((result, current) => {
      // 未设置标签
      if (!current.tags) {
        result[l10n.t("noTag")] = tryPush(result[l10n.t("noTag")], current);
        return result;
      }

      Array.isArray(current.tags)
        ? // 多标签
          current.tags.forEach((t) => {
            result[t] = tryPush(result[t], current);
          })
        : //  单标签
          (result[current.tags] = tryPush(result[current.tags], current));

      return result;
    }, {});
  }

  toCategoryList() {
    return this.articles.reduce<Record<string, Article[]>>((result, current) => {
      current.category
        ? //
          (result[current.category] = tryPush(result[current.category], current))
        : //
          (result[l10n.t("noCategory")] = tryPush(result[l10n.t("noCategory")], current));

      return result;
    }, {});
  }
}