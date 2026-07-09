import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { ExtensionsWorkspaceInfo } from "../shared/types";

const EXTENSIONS_WORKSPACE_ERROR =
  "UltraX could not create the extensions folder. Please check folder permissions and try again.";

const EXTENSIONS_WORKSPACE_SUBDIRECTORIES = [
  "installed",
  "unpacked",
  "samples",
  "storage",
  "logs",
] as const;

export function resolveExtensionsWorkspace(): ExtensionsWorkspaceInfo {
  const root = path.join(app.getPath("userData"), "extensions");

  return {
    root,
    installed: path.join(root, "installed"),
    unpacked: path.join(root, "unpacked"),
    samples: path.join(root, "samples"),
    storage: path.join(root, "storage"),
    logs: path.join(root, "logs"),
  };
}

export function ensureExtensionsWorkspace(): ExtensionsWorkspaceInfo {
  const workspace = resolveExtensionsWorkspace();

  try {
    fs.mkdirSync(workspace.root, { recursive: true });
    for (const directory of EXTENSIONS_WORKSPACE_SUBDIRECTORIES) {
      fs.mkdirSync(workspace[directory], { recursive: true });
    }
  } catch {
    throw new Error(EXTENSIONS_WORKSPACE_ERROR);
  }

  return workspace;
}
