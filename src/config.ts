import * as vscode from "vscode";
import { ConfigKey } from "./utils/constants";

export const globalConfig = {
  fileMatchGlob: () => vscode.workspace.getConfiguration(ConfigKey.PARTS__RESOURCE).get<string>(ConfigKey.ITEM__FILE_MATCH_GLOB) ?? "!(node_modules)/**/*.md",
  dateField: () => {
    const configured = vscode.workspace.getConfiguration(ConfigKey.PARTS__GROUP).get<string>(ConfigKey.ITEM__DATE_FIELD);
    if (typeof configured !== "string") {
      return "date";
    }
    const field = configured.trim();
    return field.length > 0 ? field : "date";
  },
};
