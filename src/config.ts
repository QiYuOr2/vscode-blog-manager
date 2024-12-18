import * as vscode from "vscode";
import { ConfigKey } from "./utils/constants";

export const globalConfig = {
  fileMatchGlob: () => vscode.workspace.getConfiguration(ConfigKey.PARTS__RESOURCE).get<string>(ConfigKey.ITEM__FILE_MATCH_GLOB) ?? "!(node_modules)/**/*.md",
};
