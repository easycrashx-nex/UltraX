import type { BrowserTab, UltraXExtensionManifest } from "./types";

export type UltraXExtensionCommand = {
  id: string;
  title: string;
};

export type UltraXContextMenuItem = {
  id: string;
  title: string;
  contexts?: Array<"page" | "selection" | "link" | "image">;
};

export type UltraXNotificationRequest = {
  title: string;
  message: string;
};

export type UltraXExtensionApiV1 = {
  extensions: {
    getSelf: () => Promise<UltraXExtensionManifest>;
  };
  storage: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    remove: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  tabs: {
    query: () => Promise<BrowserTab[]>;
    getActive: () => Promise<BrowserTab | null>;
  };
  notifications: {
    show: (request: UltraXNotificationRequest) => Promise<void>;
  };
  sidebar: {
    open: () => Promise<void>;
    close: () => Promise<void>;
  };
};
