import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  session,
  type IpcMainInvokeEvent,
} from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { IPC } from "../shared/ipc";
import type {
  BrowserSettings,
  BrowserWindowBounds,
  BrowserWindowSession,
  ExtensionApiRequest,
  ExtensionRuntimeLogLevel,
  PermissionPolicy,
  RuntimeInfo,
  SitePermissionKey,
  UpdateSettings,
  ViewInsets,
} from "../shared/types";
import { BrowserController } from "./browser-controller";
import { WEB_PARTITION } from "./navigation";
import { StorageService } from "./storage";
import { UpdateManager } from "./updates/update-manager";

type WindowRecord = {
  id: string;
  window: BrowserWindow;
  controller: BrowserController;
  updateManager: UpdateManager;
  allowWindowClose: boolean;
};

type CreateWindowOptions = {
  session?: BrowserWindowSession;
  focus?: boolean;
};

const windowRecords = new Map<number, WindowRecord>();
let storage = undefined as unknown as StorageService;
let ipcHandlersRegistered = false;

const shouldUseDevServer = !app.isPackaged && process.env.ULTRAX_DEV_SERVER === "1";
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

app.setName("UltraX");
app.setAppUserModelId("com.ultrax.browser");
if (process.env.ULTRAX_E2E_USER_DATA) {
  app.setPath("userData", process.env.ULTRAX_E2E_USER_DATA);
}
storage = new StorageService();
applyStartupHardwareAccelerationPreference();

function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const initialBounds = getInitialWindowBounds(options.session?.bounds, workArea);

  const window = new BrowserWindow({
    ...initialBounds,
    minWidth: 940,
    minHeight: 620,
    frame: false,
    show: false,
    backgroundColor: "#050608",
    icon: getWindowIconPath(),
    title: "UltraX",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const windowId = options.session?.id ?? randomUUID();
  const controller = new BrowserController(window, storage, {
    windowId,
    initialSession: options.session,
    onCreateWindowFromTab: (tab) => {
      const newWindow = createWindow({
        session: {
          id: randomUUID(),
          tabs: [tab],
          activeTabId: tab.id,
          bounds: offsetBounds(window.getBounds()),
        },
        focus: true,
      });
      newWindow.focus();
    },
  });
  const updateManager = new UpdateManager(
    window,
    () => controller.getState().settings.updates ?? {
      autoCheck: false,
      autoDownload: false,
      notifyWhenAvailable: true,
      channel: "stable",
    },
    (patch) => {
      const current = controller.getState().settings.updates;
      if (!current) {
        return;
      }

      controller.updateSettings({
        updates: {
          ...current,
          ...patch,
        },
      });
    },
  );

  const record: WindowRecord = {
    id: windowId,
    window,
    controller,
    updateManager,
    allowWindowClose: false,
  };
  const webContentsId = window.webContents.id;
  windowRecords.set(webContentsId, record);

  window.on("close", (event) => {
    if (record.allowWindowClose) {
      return;
    }

    if (record.controller.shouldAskBeforeWindowClose()) {
      event.preventDefault();
      window.webContents.send(IPC.requestCloseConfirmation);
      return;
    }

    const discardSession =
      record.controller.getState().settings.closeBehavior === "close-and-discard-session";
    record.controller.prepareForWindowClose(discardSession);
    record.allowWindowClose = true;
  });

  window.once("ready-to-show", () => {
    window.show();
    if (options.focus !== false) {
      window.focus();
    }
    record.controller.init();
    record.updateManager.init();
  });

  if (shouldUseDevServer) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  window.on("closed", () => {
    record.controller.dispose();
    windowRecords.delete(webContentsId);
  });

  return window;
}

function getWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(app.getAppPath(), "build", "icon.ico");
}

function configureSecurity(): void {
  const browserSession = session.fromPartition(WEB_PARTITION);

  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  browserSession.setPermissionCheckHandler(() => false);

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}

function createInitialWindows(): void {
  const state = storage.load();
  const shouldRestoreSession =
    state.settings.startupBehavior === "restore-session" && state.windows.length > 0;

  if (!shouldRestoreSession) {
    createWindow();
    return;
  }

  const lastActiveWindowId = state.lastActiveWindowId ?? state.windows[0]?.id;
  for (const session of state.windows) {
    createWindow({
      session,
      focus: session.id === lastActiveWindowId,
    });
  }
}

function registerIpcHandlers(): void {
  if (ipcHandlersRegistered) {
    return;
  }
  ipcHandlersRegistered = true;

  const handle = (
    channel: string,
    listener: (record: WindowRecord, event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, ...args) => {
      return listener(getRecordForEvent(event), event, ...args);
    });
  };

  handle(IPC.getState, (record) => record.controller.getState());
  handle(IPC.setViewInsets, (record, _event, insets) => record.controller.setViewInsets(readInsets(insets)));
  handle(IPC.createTab, (record) => record.controller.createTab(undefined, true));
  handle(IPC.closeTab, (record, _event, tabId) =>
    record.controller.closeTab(readString(tabId, "tabId", 128)),
  );
  handle(IPC.duplicateTab, (record, _event, tabId) =>
    record.controller.duplicateTab(readString(tabId, "tabId", 128)),
  );
  handle(IPC.pinTab, (record, _event, tabId, pinned) =>
    record.controller.setTabPinned(
      readString(tabId, "tabId", 128),
      readBoolean(pinned, "pinned tab state"),
    ),
  );
  handle(IPC.reorderTab, (record, _event, tabId, targetTabId) =>
    record.controller.reorderTab(
      readString(tabId, "tabId", 128),
      readString(targetTabId, "target tabId", 128),
    ),
  );
  handle(IPC.closeOtherTabs, (record, _event, tabId) =>
    record.controller.closeOtherTabs(readString(tabId, "tabId", 128)),
  );
  handle(IPC.closeTabsToRight, (record, _event, tabId) =>
    record.controller.closeTabsToRight(readString(tabId, "tabId", 128)),
  );
  handle(IPC.moveTabToNewWindow, (record, _event, tabId) =>
    record.controller.moveTabToNewWindow(readString(tabId, "tabId", 128)),
  );
  handle(IPC.toggleTabMuted, (record, _event, tabId) =>
    record.controller.toggleTabMuted(readString(tabId, "tabId", 128)),
  );
  handle(IPC.switchTab, (record, _event, tabId) =>
    record.controller.switchTab(readString(tabId, "tabId", 128)),
  );
  handle(IPC.navigate, (record, _event, input) =>
    record.controller.navigateActive(readString(input, "navigation input", 4096)),
  );
  handle(IPC.goHome, (record) => record.controller.goHome());
  handle(IPC.goBack, (record) => record.controller.goBack());
  handle(IPC.goForward, (record) => record.controller.goForward());
  handle(IPC.reload, (record) => record.controller.reload(false));
  handle(IPC.stopLoading, (record) => record.controller.stopLoading());
  handle(IPC.hardReload, (record) => record.controller.reload(true));
  handle(IPC.nextTab, (record) => record.controller.nextTab());
  handle(IPC.previousTab, (record) => record.controller.previousTab());
  handle(IPC.toggleBookmark, (record) => record.controller.toggleCurrentBookmark());
  handle(IPC.removeBookmark, (record, _event, bookmarkId) =>
    record.controller.removeBookmark(readString(bookmarkId, "bookmarkId", 128)),
  );
  handle(IPC.openBookmark, (record, _event, bookmarkId) =>
    record.controller.openBookmark(readString(bookmarkId, "bookmarkId", 128)),
  );
  handle(IPC.clearHistory, (record) => record.controller.clearHistory());
  handle(IPC.openHistoryEntry, (record, _event, entryId) =>
    record.controller.openHistoryEntry(readString(entryId, "entryId", 128)),
  );
  handle(IPC.updateSettings, (record, _event, partial) => {
    const patch = readSettingsPatch(partial);
    record.controller.updateSettings(patch);
    syncSettingsToOtherWindows(record);
  });
  handle(IPC.clearBrowserData, async (record) => {
    await record.controller.clearBrowserData();
  });
  handle(IPC.clearNetworkCache, async (record) => {
    await record.controller.clearNetworkCache();
  });
  handle(IPC.resetSettings, (record) => {
    record.controller.resetSettings();
    syncSettingsToOtherWindows(record);
  });
  handle(IPC.getRuntimeInfo, () => getRuntimeInfo());
  handle(IPC.openShellDevTools, (record) => record.window.webContents.openDevTools({ mode: "detach" }));
  handle(IPC.relaunchApp, () => {
    app.relaunch();
    app.exit(0);
  });
  handle(IPC.getUpdateStatus, (record) => record.updateManager.getStatus());
  handle(IPC.checkForUpdates, async (record) => record.updateManager.checkForUpdates());
  handle(IPC.downloadUpdate, async (record) => record.updateManager.downloadUpdate());
  handle(IPC.installUpdate, (record) => record.updateManager.installUpdate());
  handle(IPC.openReleasesPage, async (record) => {
    await record.updateManager.openReleasesPage();
  });
  handle(IPC.openDownload, async (record, _event, downloadId) => {
    await record.controller.openDownload(readString(downloadId, "downloadId", 128));
  });
  handle(IPC.revealDownload, (record, _event, downloadId) =>
    record.controller.revealDownload(readString(downloadId, "downloadId", 128)),
  );
  handle(IPC.chooseDownloadFolder, async (record) => {
    const result = await record.controller.chooseDownloadFolder();
    syncSettingsToOtherWindows(record);
    return result;
  });
  handle(IPC.openDownloadsFolder, async (record) => {
    await record.controller.openDownloadsFolder();
  });
  handle(IPC.clearDownloads, (record) => record.controller.clearDownloads());
  handle(IPC.chooseNewTabCustomImage, async (record) => {
    const result = await record.controller.chooseNewTabCustomImage();
    syncSettingsToOtherWindows(record);
    return result;
  });
  handle(IPC.removeNewTabCustomImage, (record) => {
    record.controller.removeNewTabCustomImage();
    syncSettingsToOtherWindows(record);
  });
  handle(IPC.clearBookmarks, (record) => record.controller.clearBookmarks());
  handle(IPC.loadUnpackedExtension, async (record) => record.controller.loadUnpackedExtension());
  handle(IPC.validateUnpackedExtension, async (record) => record.controller.validateUnpackedExtension());
  handle(IPC.setExtensionEnabled, (record, _event, extensionId, enabled) =>
    record.controller.setExtensionEnabled(
      readString(extensionId, "extension id", 128),
      readBoolean(enabled, "extension enabled state"),
    ),
  );
  handle(IPC.removeExtension, (record, _event, extensionId) =>
    record.controller.removeExtension(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.reloadExtensions, (record) => record.controller.reloadExtensions());
  handle(IPC.openExtensionsFolder, async (record) => {
    await record.controller.openExtensionsFolder();
  });
  handle(IPC.listExtensionStore, async (record) => record.controller.listExtensionStore());
  handle(IPC.installStoreExtension, async (record, _event, extensionId) =>
    record.controller.installStoreExtension(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.openExtensionPanel, (record, _event, extensionId) =>
    record.controller.openExtensionPanel(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.invokeExtensionApi, (record, _event, extensionId, request) =>
    record.controller.invokeExtensionApi(
      readString(extensionId, "extension id", 128),
      readExtensionApiRequest(request),
    ),
  );
  handle(IPC.logExtensionRuntimeMessage, (record, _event, extensionId, level, message) =>
    record.controller.logExtensionRuntimeMessage(
      readString(extensionId, "extension id", 128),
      readExtensionLogLevel(level),
      readString(message, "extension runtime message", 300),
    ),
  );
  handle(IPC.clearExtensionErrors, (record, _event, extensionId) =>
    record.controller.clearExtensionErrors(
      extensionId === undefined ? undefined : readString(extensionId, "extension id", 128),
    ),
  );
  handle(IPC.minimizeWindow, (record) => record.window.minimize());
  handle(IPC.toggleMaximizeWindow, (record) => {
    if (record.window.isMaximized()) {
      record.window.unmaximize();
    } else {
      record.window.maximize();
    }
  });
  handle(IPC.closeWindow, (record) => record.window.close());
  handle(IPC.closeWindowWithBehavior, (record, _event, discardSession) => {
    record.controller.prepareForWindowClose(readBoolean(discardSession, "discard session close state"));
    record.allowWindowClose = true;
    record.window.close();
  });
}

function getRecordForEvent(event: IpcMainInvokeEvent): WindowRecord {
  const record = windowRecords.get(event.sender.id);
  if (!record) {
    throw new Error("Rejected IPC call from untrusted sender.");
  }

  return record;
}

function syncSettingsToOtherWindows(source: WindowRecord): void {
  const settings = source.controller.getState().settings;
  for (const record of windowRecords.values()) {
    if (record.id !== source.id) {
      record.controller.syncSettings(settings);
    }
  }
}

function getInitialWindowBounds(
  storedBounds: BrowserWindowBounds | undefined,
  workArea: { width: number; height: number },
): BrowserWindowBounds {
  const fallbackWidth = Math.min(1320, Math.max(940, Math.floor(workArea.width * 0.9)));
  const fallbackHeight = Math.min(860, Math.max(620, Math.floor(workArea.height * 0.9)));

  if (!storedBounds) {
    return {
      width: fallbackWidth,
      height: fallbackHeight,
    };
  }

  return {
    ...storedBounds,
    width: Math.min(workArea.width, Math.max(940, storedBounds.width)),
    height: Math.min(workArea.height, Math.max(620, storedBounds.height)),
  };
}

function offsetBounds(bounds: BrowserWindowBounds): BrowserWindowBounds {
  return {
    x: typeof bounds.x === "number" ? bounds.x + 28 : undefined,
    y: typeof bounds.y === "number" ? bounds.y + 28 : undefined,
    width: bounds.width,
    height: bounds.height,
  };
}

function readString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readHexColor(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readInsets(value: unknown): ViewInsets {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid view insets.");
  }

  const candidate = value as Partial<ViewInsets>;
  if (!Number.isFinite(candidate.right) || !Number.isFinite(candidate.bottom)) {
    throw new Error("Invalid view insets.");
  }

  return {
    right: Number(candidate.right),
    bottom: Number(candidate.bottom),
  };
}

function readExtensionApiRequest(value: unknown): ExtensionApiRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid extension API request.");
  }

  const candidate = value as Partial<ExtensionApiRequest>;
  return {
    requestId: readString(candidate.requestId, "extension request id", 80),
    method: readString(candidate.method, "extension API method", 80),
    args: Array.isArray(candidate.args) ? candidate.args.slice(0, 4) : [],
  };
}

function readExtensionLogLevel(value: unknown): ExtensionRuntimeLogLevel {
  if (value !== "info" && value !== "warn" && value !== "error") {
    throw new Error("Invalid extension runtime log level.");
  }

  return value;
}

function readSettingsPatch(value: unknown): Partial<BrowserSettings> {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid settings patch.");
  }

  const candidate = value as Partial<BrowserSettings>;
  const patch: Partial<BrowserSettings> = {};

  if (candidate.searchEngine !== undefined) {
    if (
      !["duckduckgo", "google", "bing", "brave", "custom"].includes(
        candidate.searchEngine,
      )
    ) {
      throw new Error("Invalid search engine.");
    }
    patch.searchEngine = candidate.searchEngine;
  }

  if (candidate.customSearchUrl !== undefined) {
    patch.customSearchUrl = readString(candidate.customSearchUrl, "custom search URL", 512);
  }

  if (candidate.searchSuggestions !== undefined) {
    patch.searchSuggestions = readBoolean(candidate.searchSuggestions, "search suggestions");
  }

  if (candidate.searchSuggestionSettings !== undefined) {
    if (
      !candidate.searchSuggestionSettings ||
      typeof candidate.searchSuggestionSettings !== "object" ||
      Array.isArray(candidate.searchSuggestionSettings)
    ) {
      throw new Error("Invalid search suggestion settings.");
    }

    const suggestions = candidate.searchSuggestionSettings as Partial<
      BrowserSettings["searchSuggestionSettings"]
    >;
    if (
      suggestions.suggestionProvider !== undefined &&
      !["current-search-engine", "google", "duckduckgo", "none"].includes(
        suggestions.suggestionProvider,
      )
    ) {
      throw new Error("Invalid search suggestion provider.");
    }

    patch.searchSuggestionSettings = {
      localSuggestions: readBoolean(
        suggestions.localSuggestions,
        "local suggestion setting",
      ),
      historySuggestions: readBoolean(
        suggestions.historySuggestions,
        "history suggestion setting",
      ),
      bookmarkSuggestions: readBoolean(
        suggestions.bookmarkSuggestions,
        "bookmark suggestion setting",
      ),
      openTabSuggestions: readBoolean(
        suggestions.openTabSuggestions,
        "open tab suggestion setting",
      ),
      onlineSuggestions: readBoolean(
        suggestions.onlineSuggestions,
        "online suggestion setting",
      ),
      suggestionProvider: suggestions.suggestionProvider ?? "current-search-engine",
    };
  }

  if (candidate.addressBarSearch !== undefined) {
    patch.addressBarSearch = readBoolean(candidate.addressBarSearch, "address bar search");
  }

  if (candidate.startupBehavior !== undefined) {
    if (!["new-tab", "restore-session", "specific-pages"].includes(candidate.startupBehavior)) {
      throw new Error("Invalid startup behavior.");
    }
    patch.startupBehavior = candidate.startupBehavior;
  }

  if (candidate.startupPages !== undefined) {
    if (!Array.isArray(candidate.startupPages) || candidate.startupPages.length > 12) {
      throw new Error("Invalid startup pages.");
    }

    patch.startupPages = candidate.startupPages.map((item) =>
      readString(item, "startup page", 512),
    );
  }

  if (candidate.closeBehavior !== undefined) {
    if (
      ![
        "ask-before-closing-multiple-tabs",
        "close-and-restore-session",
        "close-and-discard-session",
      ].includes(candidate.closeBehavior)
    ) {
      throw new Error("Invalid close behavior.");
    }
    patch.closeBehavior = candidate.closeBehavior;
    patch.confirmBeforeClosingMultipleTabs =
      candidate.closeBehavior === "ask-before-closing-multiple-tabs";
  }

  if (candidate.homeBehavior !== undefined) {
    if (!["new-tab", "custom-url"].includes(candidate.homeBehavior)) {
      throw new Error("Invalid home behavior.");
    }
    patch.homeBehavior = candidate.homeBehavior;
  }

  if (candidate.homeUrl !== undefined) {
    patch.homeUrl = readString(candidate.homeUrl, "home URL", 512);
  }

  if (candidate.theme !== undefined) {
    if (!["dark", "light", "system"].includes(candidate.theme)) {
      throw new Error("Invalid theme.");
    }
    patch.theme = candidate.theme;
  }

  if (candidate.glassMode !== undefined) {
    patch.glassMode = readBoolean(candidate.glassMode, "glass mode");
  }

  if (candidate.accentColor !== undefined) {
    if (!["blue", "purple", "cyan", "green", "rose", "orange"].includes(candidate.accentColor)) {
      throw new Error("Invalid accent color.");
    }
    patch.accentColor = candidate.accentColor;
  }

  if (candidate.toolbarDensity !== undefined) {
    if (!["compact", "comfortable", "spacious"].includes(candidate.toolbarDensity)) {
      throw new Error("Invalid toolbar density.");
    }
    patch.toolbarDensity = candidate.toolbarDensity;
  }

  if (candidate.cornerRadius !== undefined) {
    if (!["subtle", "rounded", "ultra-rounded"].includes(candidate.cornerRadius)) {
      throw new Error("Invalid corner radius.");
    }
    patch.cornerRadius = candidate.cornerRadius;
  }

  if (candidate.blurIntensity !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.blurIntensity)) {
      throw new Error("Invalid blur intensity.");
    }
    patch.blurIntensity = candidate.blurIntensity;
  }

  if (candidate.panelTransparency !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.panelTransparency)) {
      throw new Error("Invalid panel transparency.");
    }
    patch.panelTransparency = candidate.panelTransparency;
  }

  if (candidate.animationLevel !== undefined) {
    if (!["minimal", "balanced", "expressive"].includes(candidate.animationLevel)) {
      throw new Error("Invalid animation level.");
    }
    patch.animationLevel = candidate.animationLevel;
  }

  if (candidate.newTabBackground !== undefined) {
    if (
      ![
        "ultrax-wave",
        "aurora",
        "gradient-mesh",
        "minimal-dark",
        "solid-color",
        "custom-image",
      ].includes(candidate.newTabBackground)
    ) {
      throw new Error("Invalid New Tab background.");
    }
    patch.newTabBackground = candidate.newTabBackground;
  }

  if (candidate.newTabSolidColor !== undefined) {
    patch.newTabSolidColor = readHexColor(candidate.newTabSolidColor, "New Tab solid color");
  }

  if (candidate.newTabCustomImagePath !== undefined) {
    if (candidate.newTabCustomImagePath !== "") {
      throw new Error("Custom New Tab image paths must be chosen through UltraX.");
    }
    patch.newTabCustomImagePath = "";
  }

  if (candidate.shaderPreset !== undefined) {
    if (
      ![
        "ultrax-wave",
        "blue-nebula",
        "purple-flow",
        "aurora-lines",
        "calm-grid",
      ].includes(candidate.shaderPreset)
    ) {
      throw new Error("Invalid shader preset.");
    }
    patch.shaderPreset = candidate.shaderPreset;
  }

  if (candidate.shaderIntensity !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.shaderIntensity)) {
      throw new Error("Invalid shader intensity.");
    }
    patch.shaderIntensity = candidate.shaderIntensity;
  }

  if (candidate.shaderSpeed !== undefined) {
    if (!["slow", "normal", "fast"].includes(candidate.shaderSpeed)) {
      throw new Error("Invalid shader speed.");
    }
    patch.shaderSpeed = candidate.shaderSpeed;
  }

  if (candidate.showBookmarksBar !== undefined) {
    patch.showBookmarksBar = readBoolean(candidate.showBookmarksBar, "bookmarks bar");
  }

  if (candidate.showHomeButton !== undefined) {
    patch.showHomeButton = readBoolean(candidate.showHomeButton, "home button");
  }

  if (candidate.shaderEnabled !== undefined) {
    patch.shaderEnabled = readBoolean(candidate.shaderEnabled, "shader setting");
  }

  if (candidate.reducedMotion !== undefined) {
    patch.reducedMotion = readBoolean(candidate.reducedMotion, "motion setting");
  }

  if (candidate.restoreTabsOnLaunch !== undefined) {
    patch.restoreTabsOnLaunch = readBoolean(
      candidate.restoreTabsOnLaunch,
      "restore tabs setting",
    );
  }

  if (candidate.openTabsNextToCurrent !== undefined) {
    patch.openTabsNextToCurrent = readBoolean(
      candidate.openTabsNextToCurrent,
      "tab placement setting",
    );
  }

  if (candidate.confirmBeforeClosingMultipleTabs !== undefined) {
    const confirmBeforeClosingMultipleTabs = readBoolean(
      candidate.confirmBeforeClosingMultipleTabs,
      "close confirmation setting",
    );
    patch.confirmBeforeClosingMultipleTabs = confirmBeforeClosingMultipleTabs;
    patch.closeBehavior = confirmBeforeClosingMultipleTabs
      ? "ask-before-closing-multiple-tabs"
      : "close-and-restore-session";
  }

  if (candidate.askWhereToSaveDownloads !== undefined) {
    patch.askWhereToSaveDownloads = readBoolean(
      candidate.askWhereToSaveDownloads,
      "download prompt setting",
    );
  }

  if (candidate.downloadPath !== undefined) {
    patch.downloadPath = readString(candidate.downloadPath, "download path", 1024);
  }

  if (candidate.downloadRetention !== undefined) {
    if (!["forever", "30-days", "session"].includes(candidate.downloadRetention)) {
      throw new Error("Invalid download retention.");
    }
    patch.downloadRetention = candidate.downloadRetention;
  }

  if (candidate.historyRetention !== undefined) {
    if (!["forever", "30-days", "7-days"].includes(candidate.historyRetention)) {
      throw new Error("Invalid history retention.");
    }
    patch.historyRetention = candidate.historyRetention;
  }

  if (candidate.doNotTrack !== undefined) {
    patch.doNotTrack = readBoolean(candidate.doNotTrack, "Do Not Track setting");
  }

  if (candidate.blockThirdPartyCookies !== undefined) {
    patch.blockThirdPartyCookies = readBoolean(
      candidate.blockThirdPartyCookies,
      "third-party cookies setting",
    );
  }

  if (candidate.permissionPolicy !== undefined) {
    patch.permissionPolicy = readPermissionPolicy(candidate.permissionPolicy);
  }

  if (candidate.hardwareAcceleration !== undefined) {
    patch.hardwareAcceleration = readBoolean(
      candidate.hardwareAcceleration,
      "hardware acceleration setting",
    );
  }

  if (candidate.performanceMode !== undefined) {
    if (!["efficiency", "balanced", "performance", "ultra"].includes(candidate.performanceMode)) {
      throw new Error("Invalid performance mode.");
    }
    patch.performanceMode = candidate.performanceMode;
  }

  if (candidate.backgroundShaderPerformance !== undefined) {
    if (!["low", "balanced", "high", "ultra"].includes(candidate.backgroundShaderPerformance)) {
      throw new Error("Invalid shader performance setting.");
    }
    patch.backgroundShaderPerformance = candidate.backgroundShaderPerformance;
  }

  if (candidate.shaderFpsCap !== undefined) {
    if (!["30", "60", "unlimited"].includes(candidate.shaderFpsCap)) {
      throw new Error("Invalid shader FPS cap.");
    }
    patch.shaderFpsCap = candidate.shaderFpsCap;
  }

  if (candidate.pauseShaderWhenUnfocused !== undefined) {
    patch.pauseShaderWhenUnfocused = readBoolean(
      candidate.pauseShaderWhenUnfocused,
      "pause shader when unfocused setting",
    );
  }

  if (candidate.pauseShaderOnBatterySaver !== undefined) {
    patch.pauseShaderOnBatterySaver = readBoolean(
      candidate.pauseShaderOnBatterySaver,
      "pause shader on battery saver setting",
    );
  }

  if (candidate.disableShaderOnEfficiencyMode !== undefined) {
    patch.disableShaderOnEfficiencyMode = readBoolean(
      candidate.disableShaderOnEfficiencyMode,
      "disable shader on efficiency mode setting",
    );
  }

  if (candidate.reducedVisualEffects !== undefined) {
    patch.reducedVisualEffects = readBoolean(
      candidate.reducedVisualEffects,
      "reduced visual effects setting",
    );
  }

  if (candidate.preloadNewTab !== undefined) {
    patch.preloadNewTab = readBoolean(candidate.preloadNewTab, "preload New Tab setting");
  }

  if (candidate.keepNewTabWarm !== undefined) {
    patch.keepNewTabWarm = readBoolean(candidate.keepNewTabWarm, "keep New Tab warm setting");
  }

  if (candidate.lazyLoadQuickLinks !== undefined) {
    patch.lazyLoadQuickLinks = readBoolean(
      candidate.lazyLoadQuickLinks,
      "lazy load quick links setting",
    );
  }

  if (candidate.reduceNewTabAnimations !== undefined) {
    patch.reduceNewTabAnimations = readBoolean(
      candidate.reduceNewTabAnimations,
      "reduce New Tab animations setting",
    );
  }

  if (candidate.memorySaver !== undefined) {
    patch.memorySaver = readBoolean(candidate.memorySaver, "memory saver setting");
  }

  if (candidate.suspendInactiveTabs !== undefined) {
    patch.suspendInactiveTabs = readBoolean(
      candidate.suspendInactiveTabs,
      "suspend inactive tabs setting",
    );
  }

  if (candidate.suspendTabsAfter !== undefined) {
    if (!["5-minutes", "15-minutes", "30-minutes", "1-hour", "never"].includes(candidate.suspendTabsAfter)) {
      throw new Error("Invalid tab suspend delay.");
    }
    patch.suspendTabsAfter = candidate.suspendTabsAfter;
  }

  if (candidate.keepPinnedTabsActive !== undefined) {
    patch.keepPinnedTabsActive = readBoolean(
      candidate.keepPinnedTabsActive,
      "keep pinned tabs active setting",
    );
  }

  if (candidate.keepAudioVideoTabsActive !== undefined) {
    patch.keepAudioVideoTabsActive = readBoolean(
      candidate.keepAudioVideoTabsActive,
      "keep media tabs active setting",
    );
  }

  if (candidate.keepDownloadsTabsActive !== undefined) {
    patch.keepDownloadsTabsActive = readBoolean(
      candidate.keepDownloadsTabsActive,
      "keep download tabs active setting",
    );
  }

  if (candidate.neverSuspendSites !== undefined) {
    patch.neverSuspendSites = readStringList(candidate.neverSuspendSites, "never suspend sites", 24, 256);
  }

  if (candidate.lazyRestoreSession !== undefined) {
    patch.lazyRestoreSession = readBoolean(
      candidate.lazyRestoreSession,
      "lazy restore session setting",
    );
  }

  if (candidate.loadTabsOnDemand !== undefined) {
    patch.loadTabsOnDemand = readBoolean(
      candidate.loadTabsOnDemand,
      "load tabs on demand setting",
    );
  }

  if (candidate.restoreActiveTabOnly !== undefined) {
    patch.restoreActiveTabOnly = readBoolean(
      candidate.restoreActiveTabOnly,
      "restore active tab only setting",
    );
  }

  if (candidate.keepRunningInBackground !== undefined) {
    patch.keepRunningInBackground = readBoolean(
      candidate.keepRunningInBackground,
      "keep running in background setting",
    );
  }

  if (candidate.continueDownloadsInBackground !== undefined) {
    patch.continueDownloadsInBackground = readBoolean(
      candidate.continueDownloadsInBackground,
      "continue downloads in background setting",
    );
  }

  if (candidate.reduceActivityWhenMinimized !== undefined) {
    patch.reduceActivityWhenMinimized = readBoolean(
      candidate.reduceActivityWhenMinimized,
      "reduce activity when minimized setting",
    );
  }

  if (candidate.backgroundUpdateChecks !== undefined) {
    patch.backgroundUpdateChecks = readBoolean(
      candidate.backgroundUpdateChecks,
      "background update checks setting",
    );
  }

  if (candidate.preconnectFrequentSites !== undefined) {
    patch.preconnectFrequentSites = readBoolean(
      candidate.preconnectFrequentSites,
      "preconnect frequent sites setting",
    );
  }

  if (candidate.dnsPrefetching !== undefined) {
    patch.dnsPrefetching = readBoolean(candidate.dnsPrefetching, "DNS prefetching setting");
  }

  if (candidate.pagePreloading !== undefined) {
    patch.pagePreloading = readBoolean(candidate.pagePreloading, "page preloading setting");
  }

  if (candidate.predictiveNavigation !== undefined) {
    patch.predictiveNavigation = readBoolean(
      candidate.predictiveNavigation,
      "predictive navigation setting",
    );
  }

  if (candidate.reduceDataUsage !== undefined) {
    patch.reduceDataUsage = readBoolean(candidate.reduceDataUsage, "reduce data usage setting");
  }

  if (candidate.extensionDeveloperMode !== undefined) {
    patch.extensionDeveloperMode = readBoolean(
      candidate.extensionDeveloperMode,
      "extension developer mode setting",
    );
  }

  if (candidate.extensionStore !== undefined) {
    if (!candidate.extensionStore || typeof candidate.extensionStore !== "object") {
      throw new Error("Invalid extension store setting.");
    }

    const store = candidate.extensionStore;
    if (store.provider !== "local" && store.provider !== "remote") {
      throw new Error("Invalid extension store provider.");
    }

    patch.extensionStore = {
      provider: store.provider,
      remoteUrl:
        store.remoteUrl === undefined
          ? undefined
          : readString(store.remoteUrl, "extension store remote URL", 512),
    };
  }

  if (candidate.updates !== undefined) {
    if (!candidate.updates || typeof candidate.updates !== "object") {
      throw new Error("Invalid update settings.");
    }

    const updates = candidate.updates as Partial<UpdateSettings>;
    if (
      updates.channel !== undefined &&
      !["stable", "beta", "nightly"].includes(updates.channel)
    ) {
      throw new Error("Invalid update channel.");
    }

    patch.updates = {
      autoCheck: readBoolean(updates.autoCheck, "auto-check update setting"),
      autoDownload: readBoolean(updates.autoDownload, "auto-download update setting"),
      notifyWhenAvailable: readBoolean(
        updates.notifyWhenAvailable,
        "update notification setting",
      ),
      channel: updates.channel ?? "stable",
      lastCheckedAt:
        updates.lastCheckedAt === undefined
          ? undefined
          : readOptionalTimestamp(updates.lastCheckedAt, "last update check time"),
    };
  }

  if (candidate.increaseContrast !== undefined) {
    patch.increaseContrast = readBoolean(candidate.increaseContrast, "contrast setting");
  }

  if (candidate.textScale !== undefined) {
    if (!["normal", "large"].includes(candidate.textScale)) {
      throw new Error("Invalid text scale.");
    }
    patch.textScale = candidate.textScale;
  }

  if (candidate.pageZoom !== undefined) {
    if (!Number.isFinite(candidate.pageZoom)) {
      throw new Error("Invalid page zoom.");
    }

    patch.pageZoom = Math.max(0.67, Math.min(1.5, Number(candidate.pageZoom)));
  }

  return patch;
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readOptionalTimestamp(value: unknown, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return Number(value);
}

function readStringList(
  value: unknown,
  fieldName: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const normalized = readString(item, fieldName, maxLength).trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function readPermissionPolicy(value: unknown): Record<SitePermissionKey, PermissionPolicy> {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid permission policy.");
  }

  const candidate = value as Partial<Record<SitePermissionKey, PermissionPolicy>>;
  const keys: SitePermissionKey[] = [
    "camera",
    "microphone",
    "location",
    "notifications",
    "popups",
    "downloads",
    "clipboard",
  ];
  const policy = {} as Record<SitePermissionKey, PermissionPolicy>;

  for (const key of keys) {
    const permission = candidate[key];
    if (permission !== "block" && permission !== "ask") {
      throw new Error(`Invalid ${key} permission policy.`);
    }
    policy[key] = permission;
  }

  return policy;
}

function getRuntimeInfo(): RuntimeInfo {
  const memory = process.memoryUsage();
  const appMetrics = app.getAppMetrics();

  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    buildType: app.isPackaged ? "packaged" : "development",
    userDataPath: app.getPath("userData"),
    memoryUsage: {
      rssMB: toMegabytes(memory.rss),
      heapTotalMB: toMegabytes(memory.heapTotal),
      heapUsedMB: toMegabytes(memory.heapUsed),
      externalMB: toMegabytes(memory.external),
    },
    processInfo: {
      processCount: appMetrics.length,
      rendererProcessCount: appMetrics.filter((metric) => metric.type === "Tab").length,
    },
    hardwareAccelerationEnabled: app.isHardwareAccelerationEnabled(),
    gpuFeatureStatus: Object.fromEntries(
      Object.entries(app.getGPUFeatureStatus()).map(([key, value]) => [key, String(value)]),
    ),
  };
}

function toMegabytes(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function applyStartupHardwareAccelerationPreference(): void {
  try {
    if (!storage.load().settings.hardwareAcceleration) {
      app.disableHardwareAcceleration();
    }
  } catch {
    // Keep startup resilient if the settings file is temporarily unreadable.
  }
}

app.whenReady().then(() => {
  configureSecurity();
  registerIpcHandlers();
  createInitialWindows();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
