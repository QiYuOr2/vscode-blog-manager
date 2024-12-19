import * as assert from "assert";
import { glob } from "glob";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Sample test", () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  test("glob test", () => {
    const files = glob.sync("\\c:\\Users\\11762\\@qiyuor2\\blog\\src\\pages\\posts\\!(node_modules)\\**\\*.md");

    assert.notEqual(files.length, 0);
  });
});
