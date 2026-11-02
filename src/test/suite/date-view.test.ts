import * as assert from "assert";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import fm from "front-matter";
import * as vscode from "vscode";
import { globalConfig } from "../../config";
import { Resource } from "../../resource";
import { GroupBy } from "../../types";
import { TreeDataProvider } from "../../views/tree";

type NodeLike = {
  label?: string | vscode.TreeItemLabel;
  children?: NodeLike[];
  collapsibleState?: vscode.TreeItemCollapsibleState;
  resourceUri?: vscode.Uri;
};

suite("Date group view", () => {
  const previousTz = process.env.TZ;

  teardown(() => {
    if (previousTz === undefined) {
      delete process.env.TZ;
      return;
    }
    process.env.TZ = previousTz;
  });

  test("extension contributes the date view and activates", async () => {
    const extension = vscode.extensions.getExtension("qiyuor2.blog-manager");
    assert.ok(extension, "extension qiyuor2.blog-manager should be loaded");
    await extension.activate();
    assert.strictEqual(extension.isActive, true);

    const views = extension.packageJSON.contributes.views["blog-manager"] as Array<{ id: string; name: string }>;
    assert.ok(views.some((view) => view.id === "date" && view.name === "按日期"));

    const welcome = extension.packageJSON.contributes.viewsWelcome as Array<{ view: string; when?: string; contents?: string }>;
    const dateWelcome = welcome.find((item) => item.view === "date");
    const tagWelcome = welcome.find((item) => item.view === "tag");
    assert.ok(dateWelcome);
    assert.strictEqual(dateWelcome.when, tagWelcome?.when);
    assert.strictEqual(dateWelcome.contents, tagWelcome?.contents);

    const dateField = extension.packageJSON.contributes.configuration.properties["bmConfig.group.dateField"] as { default?: string };
    assert.strictEqual(dateField.default, "date");
    assert.strictEqual(globalConfig.dateField(), "date");
  });

  test("groups sample front matter by year and month without touching files", async () => {
    process.env.TZ = "America/New_York";
    const dir = mkdtempSync(join(tmpdir(), "blog-manager-date-"));
    const posts = join(dir, "posts");
    mkdirSync(posts);

    const files: Record<string, string> = {
      "new-year.md": "---\ntitle: New Year\ndate: 2024-01-01\n---\n",
      "zulu.md": "---\ntitle: Zulu\ndate: 2024-01-31T23:00:00.000Z\n---\n",
      "quoted-cross.md": '---\ntitle: Quoted Cross\ndate: "2024-01-31T23:30:00-05:00"\n---\n',
      "shifted.md": "---\ntitle: Shifted\ndate: 2024-01-31T23:30:00-05:00\n---\n",
      "quoted-march.md": '---\ntitle: Quoted March\ndate: "2024-03-01 09:30:00"\n---\n',
      "offset-march.md": '---\ntitle: Offset March\ndate: "2024-03-02T23:30:00-05:00"\n---\n',
      "december.md": "---\ntitle: December\ndate: 2024-12-15 18:00:00\n---\n",
      "year-2023.md": "---\ntitle: Year 2023\ndate: 2023-11-05\n---\n",
      "undated.md": "---\ntitle: Undated\n---\n",
      "bad-date.md": "---\ntitle: Bad Date\ndate: not-a-date\n---\n",
      "empty-date.md": '---\ntitle: Empty Date\ndate: ""\n---\n',
      "custom-field.md": '---\ntitle: Custom Field\npublishDate: "2022-04-03"\n---\n',
    };

    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(posts, name), content);
    }

    const before = snapshot(dir);
    const parsedNewYear = fm<{ date?: unknown }>(readFileSync(join(posts, "new-year.md"), "utf8"));
    assert.ok(parsedNewYear.attributes.date instanceof Date);
    assert.strictEqual(parsedNewYear.attributes.date.getFullYear(), 2023);
    assert.strictEqual(parsedNewYear.attributes.date.getUTCFullYear(), 2024);

    try {
      const resource = new Resource({} as vscode.ExtensionContext);
      resource.load(dir);
      const provider = new TreeDataProvider(resource, GroupBy.DATE);
      const roots = mustNodes(provider.getChildren());

      assert.deepStrictEqual(roots.map(nodeLabel), ["2024", "2023", vscode.l10n.t("noDate")]);
      assert.strictEqual(roots[0].collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.strictEqual(provider.getTreeItem(roots[0] as never).command, undefined);

      const months = mustNodes(provider.getChildren(roots[0] as never));
      assert.deepStrictEqual(months.map(nodeLabel), ["12", "03", "02", "01"]);
      assert.deepStrictEqual(articleLabels(provider, months[0]), ["December"]);
      assert.deepStrictEqual(articleLabels(provider, months[1]), ["Offset March", "Quoted March"]);
      assert.deepStrictEqual(articleLabels(provider, months[2]), ["Shifted"]);
      assert.deepStrictEqual(articleLabels(provider, months[3]), ["Quoted Cross", "Zulu", "New Year"]);

      const year2023 = mustNodes(provider.getChildren(roots[1] as never));
      assert.deepStrictEqual(year2023.map(nodeLabel), ["11"]);
      assert.deepStrictEqual(articleLabels(provider, year2023[0]), ["Year 2023"]);

      const undated = mustNodes(provider.getChildren(roots[2] as never));
      const datedTitles = new Set(["New Year", "Zulu", "Quoted Cross", "Shifted", "Quoted March", "Offset March", "December", "Year 2023"]);
      assert.deepStrictEqual(
        undated.map(nodeLabel),
        resource.articles.filter((article) => !datedTitles.has(article.label)).map((article) => article.label),
      );
      assert.deepStrictEqual(new Set(undated.map(nodeLabel)), new Set(["Undated", "Bad Date", "Empty Date", "Custom Field"]));

      const opened = provider.getTreeItem(mustNodes(provider.getChildren(months[3] as never))[0] as never);
      const target = mustNodes(provider.getChildren(months[3] as never))[0].resourceUri;
      assert.ok(target);
      assert.strictEqual(opened.command?.command, "blog-manager.openFile");
      assert.deepStrictEqual(opened.command?.arguments, [target]);
      assert.ok(target.fsPath.startsWith(dir));

      assert.deepStrictEqual(snapshot(dir), before);

      const config = vscode.workspace.getConfiguration("bmConfig.group");
      const previous = config.inspect<string>("dateField")?.globalValue;
      await config.update("dateField", "publishDate", vscode.ConfigurationTarget.Global);
      try {
        assert.strictEqual(globalConfig.dateField(), "publishDate");
        const regrouped = mustNodes(provider.getChildren());
        assert.deepStrictEqual(regrouped.map(nodeLabel), ["2022", vscode.l10n.t("noDate")]);
        const customMonths = mustNodes(provider.getChildren(regrouped[0] as never));
        assert.deepStrictEqual(customMonths.map(nodeLabel), ["04"]);
        assert.deepStrictEqual(articleLabels(provider, customMonths[0]), ["Custom Field"]);
        assert.deepStrictEqual(snapshot(dir), before);
      } finally {
        await config.update("dateField", previous, vscode.ConfigurationTarget.Global);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function nodeLabel(node: NodeLike): string {
  return typeof node.label === "string" ? node.label : (node.label?.label ?? "");
}

function mustNodes(value: vscode.ProviderResult<NodeLike[]>): NodeLike[] {
  assert.ok(Array.isArray(value), "tree children should be a synchronous array");
  return value;
}

function articleLabels(provider: TreeDataProvider, node: NodeLike): string[] {
  return mustNodes(provider.getChildren(node as never)).map(nodeLabel);
}

function snapshot(dir: string): Array<{ file: string; mtimeMs: number; content: string }> {
  return listFiles(dir)
    .sort()
    .map((file) => ({
      file: relative(dir, file),
      mtimeMs: statSync(file).mtimeMs,
      content: readFileSync(file, "utf8"),
    }));
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}
