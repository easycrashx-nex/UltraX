import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type {
  ExtensionStoreItem,
  InstalledExtension,
  UltraXExtensionManifest,
  UltraXExtensionPermission,
} from "../shared/types";
import { createBuiltInExtension } from "./extensions";

type RawStoreItem = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  permissions: UltraXExtensionPermission[];
  source: "builtin";
  installType: "builtin";
};

export interface ExtensionStoreProvider {
  listExtensions(installedExtensions: InstalledExtension[]): Promise<ExtensionStoreItem[]>;
  getExtension(id: string, installedExtensions: InstalledExtension[]): Promise<ExtensionStoreItem | null>;
  installExtension(id: string): Promise<InstalledExtension>;
}

export class LocalExtensionStoreProvider implements ExtensionStoreProvider {
  async listExtensions(installedExtensions: InstalledExtension[]): Promise<ExtensionStoreItem[]> {
    const installedById = new Map(installedExtensions.map((extension) => [extension.id, extension]));

    return this.readStoreItems().map((item) => {
      const installed = installedById.get(item.id);
      return {
        id: item.id,
        name: item.name,
        version: item.version,
        description: item.description,
        author: item.author,
        category: item.category,
        permissions: item.permissions,
        source: item.source,
        installType: item.installType,
        installed: Boolean(installed),
        enabled: Boolean(installed?.enabled),
        updateAvailable: Boolean(installed && installed.manifest.version !== item.version),
      };
    });
  }

  async getExtension(
    id: string,
    installedExtensions: InstalledExtension[],
  ): Promise<ExtensionStoreItem | null> {
    const items = await this.listExtensions(installedExtensions);
    return items.find((item) => item.id === id) ?? null;
  }

  async installExtension(id: string): Promise<InstalledExtension> {
    const storeItem = this.readStoreItems().find((item) => item.id === id);
    if (!storeItem) {
      throw new Error("Extension is not available in the local UltraX Store.");
    }

    const manifest = this.readBundledManifest(storeItem.id);
    const extension = createBuiltInExtension(storeItem.id);
    return {
      ...extension,
      manifest,
      installPath: `builtin://${manifest.id}`,
      enabled: true,
      status: "enabled",
      validationWarnings: [],
    };
  }

  private readStoreItems(): RawStoreItem[] {
    const filePath = resolveStoreFilePath();
    const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!Array.isArray(value)) {
      throw new Error("Local extension store data is invalid.");
    }

    return value.flatMap((item) => normalizeStoreItem(item));
  }

  private readBundledManifest(extensionId: string): UltraXExtensionManifest {
    const manifestPath = path.join(resolveBundledExtensionsPath(), extensionId, "ultrax-extension.json");
    const value = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as UltraXExtensionManifest;
    if (value.id !== extensionId) {
      throw new Error("Bundled extension manifest id does not match the store item.");
    }
    return value;
  }
}

export class RemoteExtensionStoreProvider implements ExtensionStoreProvider {
  async listExtensions(): Promise<ExtensionStoreItem[]> {
    throw new Error("Remote UltraX Extension Store is reserved for a signed future service.");
  }

  async getExtension(): Promise<ExtensionStoreItem | null> {
    throw new Error("Remote UltraX Extension Store is not enabled.");
  }

  async installExtension(): Promise<InstalledExtension> {
    throw new Error("Remote UltraX Extension Store installs require signatures and hashes.");
  }
}

export function resolveBundledExtensionsPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "extensions")
    : path.join(app.getAppPath(), "extensions");
}

function resolveStoreFilePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "extensions-store.json")
    : path.join(app.getAppPath(), "resources", "extensions-store.json");
}

function normalizeStoreItem(value: unknown): RawStoreItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const candidate = value as Partial<RawStoreItem>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.version !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.author !== "string" ||
    typeof candidate.category !== "string" ||
    candidate.source !== "builtin" ||
    candidate.installType !== "builtin" ||
    !Array.isArray(candidate.permissions)
  ) {
    return [];
  }

  return [
    {
      id: candidate.id,
      name: candidate.name,
      version: candidate.version,
      description: candidate.description,
      author: candidate.author,
      category: candidate.category,
      permissions: candidate.permissions,
      source: "builtin",
      installType: "builtin",
    },
  ];
}
