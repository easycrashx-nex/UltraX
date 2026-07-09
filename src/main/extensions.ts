import fs from "node:fs";
import path from "node:path";
import type {
  InstalledExtension,
  UltraXExtensionManifest,
  UltraXExtensionPermission,
} from "../shared/types";

const MAX_EXTENSION_ERRORS = 12;
const EXTENSION_MANIFEST_FILE = "ultrax-extension.json";

export const ULTRAX_EXTENSION_PERMISSIONS: readonly UltraXExtensionPermission[] = [
  "tabs",
  "activeTab",
  "storage",
  "sidebar",
  "notifications",
  "downloads",
  "bookmarks",
  "history",
  "settings",
  "webNavigation",
  "clipboard",
  "contextMenus",
];

export const SENSITIVE_EXTENSION_PERMISSIONS = new Set<UltraXExtensionPermission>([
  "history",
  "downloads",
  "bookmarks",
  "settings",
  "clipboard",
]);

export const BUILT_IN_EXTENSION_MANIFESTS: Record<string, UltraXExtensionManifest> = {
  "ultrax-notes-sidebar": {
    id: "ultrax-notes-sidebar",
    name: "UltraX Notes",
    version: "1.0.0",
    description: "Save small notes in an UltraX sidebar panel.",
    author: "UltraX",
    icon: "icon.png",
    main: "index.js",
    panel: "panel.html",
    permissions: ["storage", "sidebar"],
  },
  "ultrax-page-info": {
    id: "ultrax-page-info",
    name: "UltraX Page Info",
    version: "1.0.0",
    description: "Shows basic information about the active tab in a sidebar panel.",
    author: "UltraX",
    icon: "icon.png",
    main: "index.js",
    panel: "panel.html",
    permissions: ["tabs", "activeTab", "sidebar"],
  },
};

export const DEFAULT_BUILT_IN_EXTENSION_IDS = ["ultrax-notes-sidebar"] as const;

export const BUILT_IN_NOTES_EXTENSION: InstalledExtension = createBuiltInExtension(
  "ultrax-notes-sidebar",
);

export function createBuiltInExtension(extensionId: string): InstalledExtension {
  const manifest = BUILT_IN_EXTENSION_MANIFESTS[extensionId];
  if (!manifest) {
    throw new Error("Built-in extension not found.");
  }

  const now = Date.now();
  return {
    id: manifest.id,
    manifest,
    source: "builtin",
    installPath: `builtin://${manifest.id}`,
    enabled: true,
    developerMode: false,
    installedAt: now,
    updatedAt: now,
    status: "enabled",
    errors: [],
    validationWarnings: [],
    runtimeLogs: [],
  };
}

export function ensureBuiltInExtensions(
  extensions: InstalledExtension[] | undefined,
): InstalledExtension[] {
  const normalized = Array.isArray(extensions)
    ? extensions.map(normalizeInstalledExtension).filter((item) => item !== null)
    : [];
  const existingBuiltIn = normalized.find((extension) => extension.id === BUILT_IN_NOTES_EXTENSION.id);
  const builtIn = {
    ...BUILT_IN_NOTES_EXTENSION,
    enabled: existingBuiltIn?.enabled ?? BUILT_IN_NOTES_EXTENSION.enabled,
    status:
      existingBuiltIn?.enabled === false
        ? "disabled"
        : BUILT_IN_NOTES_EXTENSION.status,
    errors: existingBuiltIn?.errors ?? BUILT_IN_NOTES_EXTENSION.errors,
    runtimeLogs: existingBuiltIn?.runtimeLogs ?? BUILT_IN_NOTES_EXTENSION.runtimeLogs,
  } satisfies InstalledExtension;

  return [
    builtIn,
    ...normalized.filter((extension) => extension.id !== BUILT_IN_NOTES_EXTENSION.id),
  ];
}

export function normalizeInstalledExtension(value: unknown): InstalledExtension | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<InstalledExtension>;
  const manifestResult = validateExtensionManifest(candidate.manifest);
  if (!manifestResult.ok) {
    return null;
  }

  const source = candidate.source === "builtin" ? "builtin" : "local";
  const enabled = typeof candidate.enabled === "boolean" ? candidate.enabled : false;
  const hasErrors = Array.isArray(candidate.errors) && candidate.errors.length > 0;

  return {
    id: manifestResult.manifest.id,
    manifest: manifestResult.manifest,
    source,
    installPath:
      typeof candidate.installPath === "string" && candidate.installPath.length <= 1024
        ? candidate.installPath
        : undefined,
    enabled,
    developerMode:
      typeof candidate.developerMode === "boolean" ? candidate.developerMode : source === "local",
    installedAt:
      Number.isFinite(candidate.installedAt) && candidate.installedAt
        ? Number(candidate.installedAt)
        : Date.now(),
    updatedAt:
      Number.isFinite(candidate.updatedAt) && candidate.updatedAt
        ? Number(candidate.updatedAt)
        : Date.now(),
    status: hasErrors ? "error" : enabled ? "enabled" : "disabled",
    errors: normalizeStringList(candidate.errors, 240, MAX_EXTENSION_ERRORS),
    validationWarnings: [
      ...manifestResult.warnings,
      ...normalizeStringList(candidate.validationWarnings, 240, 12),
    ].slice(0, 12),
    runtimeLogs: normalizeRuntimeLogs(candidate.runtimeLogs, manifestResult.manifest.id),
  };
}

export function readLocalExtension(folderPath: string): InstalledExtension {
  const resolvedFolder = path.resolve(folderPath);
  const manifestPath = path.join(resolvedFolder, EXTENSION_MANIFEST_FILE);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${EXTENSION_MANIFEST_FILE}.`);
  }

  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as unknown;
  const result = validateExtensionManifest(rawManifest, resolvedFolder);
  if (!result.ok) {
    throw new Error(result.errors.join(" "));
  }

  const now = Date.now();
  return {
    id: result.manifest.id,
    manifest: result.manifest,
    source: "local",
    installPath: resolvedFolder,
    enabled: false,
    developerMode: true,
    installedAt: now,
    updatedAt: now,
    status: "disabled",
    errors: [],
    validationWarnings: [
      ...result.warnings,
      "Local UltraX extensions run only inside the sandboxed UltraX extension host.",
    ].slice(0, 12),
    runtimeLogs: [],
  };
}

export function validateExtensionManifest(
  value: unknown,
  basePath?: string,
):
  | { ok: true; manifest: UltraXExtensionManifest; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Extension manifest must be an object."], warnings };
  }

  const candidate = value as Partial<UltraXExtensionManifest>;
  const id = readManifestString(candidate.id, "id", 80, errors);
  const name = readManifestString(candidate.name, "name", 80, errors);
  const version = readManifestString(candidate.version, "version", 40, errors);

  if (id && !/^[a-z0-9][a-z0-9-_.]{2,79}$/.test(id)) {
    errors.push("Extension id must use lowercase letters, numbers, dashes, underscores, or dots.");
  }

  const permissions = normalizePermissions(candidate.permissions, errors);
  const manifest: UltraXExtensionManifest = {
    id: id ?? "",
    name: name ?? "",
    version: version ?? "",
    permissions,
  };

  const description = optionalManifestString(candidate.description, "description", 240, errors);
  const author = optionalManifestString(candidate.author, "author", 80, errors);
  const icon = optionalManifestPath(candidate.icon, "icon", basePath, warnings, errors);
  const main = optionalManifestPath(candidate.main, "main", basePath, warnings, errors);
  const background = optionalManifestPath(
    candidate.background,
    "background",
    basePath,
    warnings,
    errors,
  );
  const panel = optionalManifestPath(candidate.panel, "panel", basePath, warnings, errors);
  const settings = optionalManifestPath(candidate.settings, "settings", basePath, warnings, errors);

  if (description) {
    manifest.description = description;
  }
  if (author) {
    manifest.author = author;
  }
  if (icon) {
    manifest.icon = icon;
  }
  if (main) {
    manifest.main = main;
  }
  if (background) {
    manifest.background = background;
    warnings.push("background is validated for future host startup but panel runtime is the supported v1 host.");
  }
  if (panel) {
    manifest.panel = panel;
  }
  if (settings) {
    manifest.settings = settings;
  }

  if (permissions.length === 0) {
    warnings.push("No permissions requested.");
  }

  return errors.length > 0
    ? { ok: false, errors, warnings }
    : { ok: true, manifest, warnings };
}

export function pushExtensionError(extension: InstalledExtension, error: string): InstalledExtension {
  return {
    ...extension,
    status: "error",
    errors: [error, ...extension.errors].slice(0, MAX_EXTENSION_ERRORS),
    updatedAt: Date.now(),
  };
}

function normalizePermissions(
  value: unknown,
  errors: string[],
): UltraXExtensionPermission[] {
  if (!Array.isArray(value)) {
    errors.push("permissions must be an array.");
    return [];
  }

  const allowed = new Set<string>(ULTRAX_EXTENSION_PERMISSIONS);
  const seen = new Set<UltraXExtensionPermission>();
  const permissions: UltraXExtensionPermission[] = [];

  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item)) {
      errors.push(`Unsupported extension permission: ${String(item)}.`);
      continue;
    }

    const permission = item as UltraXExtensionPermission;
    if (!seen.has(permission)) {
      seen.add(permission);
      permissions.push(permission);
    }
  }

  return permissions;
}

function readManifestString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  errors: string[],
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    errors.push(`${fieldName} must be a non-empty string up to ${maxLength} characters.`);
    return undefined;
  }

  return value.trim();
}

function optionalManifestString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  errors: string[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length > maxLength) {
    errors.push(`${fieldName} must be a string up to ${maxLength} characters.`);
    return undefined;
  }

  return value.trim() || undefined;
}

function optionalManifestPath(
  value: unknown,
  fieldName: string,
  basePath: string | undefined,
  warnings: string[],
  errors: string[],
): string | undefined {
  const relativePath = optionalManifestString(value, fieldName, 180, errors);
  if (!relativePath) {
    return undefined;
  }

  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    errors.push(`${fieldName} must be a relative path inside the extension folder.`);
    return undefined;
  }

  if (basePath) {
    const resolved = path.resolve(basePath, relativePath);
    if (!resolved.startsWith(`${path.resolve(basePath)}${path.sep}`)) {
      errors.push(`${fieldName} must stay inside the extension folder.`);
      return undefined;
    }

    if (!fs.existsSync(resolved)) {
      warnings.push(`${fieldName} points to a file that does not exist yet.`);
    }
  }

  return relativePath.replace(/\\/g, "/");
}

function normalizeStringList(value: unknown, maxLength: number, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, maxLength))
    .slice(0, maxItems);
}

function normalizeRuntimeLogs(value: unknown, fallbackExtensionId: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Partial<InstalledExtension["runtimeLogs"][number]>)
    .flatMap((item) => {
      if (
        typeof item.id !== "string" ||
        !["info", "warn", "error"].includes(String(item.level)) ||
        typeof item.message !== "string" ||
        !Number.isFinite(item.timestamp)
      ) {
        return [];
      }

      return [
        {
          id: item.id.slice(0, 80),
          extensionId:
            typeof item.extensionId === "string" ? item.extensionId : fallbackExtensionId,
          level: item.level as InstalledExtension["runtimeLogs"][number]["level"],
          message: item.message.slice(0, 280),
          timestamp: Number(item.timestamp),
        },
      ];
    })
    .slice(0, 40);
}
