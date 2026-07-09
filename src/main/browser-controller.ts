import {
  app,
  BrowserWindow,
  dialog,
  type Event as ElectronEvent,
  Notification,
  WebContentsView,
  session,
  shell,
  type DownloadItem as ElectronDownloadItem,
  type Session,
  type WebContents,
} from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { IPC } from "../shared/ipc";
import type {
  Bookmark,
  BrowserSettings,
  BrowserState,
  BrowserTab,
  DownloadItem,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  ExtensionValidationResult,
  HistoryEntry,
  InstalledExtension,
  UltraXExtensionPermission,
  ViewInsets,
} from "../shared/types";
import {
  getHostnameLabel,
  INTERNAL_NEW_TAB_URL,
  isSafeWebUrl,
  normalizeNavigationInput,
  WEB_PARTITION,
} from "./navigation";
import { createExtensionPanelDescriptor } from "./extension-runtime";
import { LocalExtensionStoreProvider } from "./extension-store";
import { pushExtensionError, readLocalExtension, validateExtensionManifest } from "./extensions";
import { DEFAULT_SETTINGS, StorageService } from "./storage";

const CHROME_HEIGHT = 108;
const MAX_HISTORY_ENTRIES = 1000;
const MAX_DOWNLOADS = 50;

export class BrowserController {
  private readonly views = new Map<string, WebContentsView>();
  private readonly browserSession: Session;
  private readonly extensionStore = new LocalExtensionStoreProvider();
  private state: BrowserState;
  private attachedView: WebContentsView | null = null;
  private insets: ViewInsets = { right: 0, bottom: 0 };
  private readonly onWindowBoundsChanged = () => this.layoutActiveView();

  constructor(
    private readonly window: BrowserWindow,
    private readonly storage: StorageService,
  ) {
    this.browserSession = session.fromPartition(WEB_PARTITION);
    this.state = this.storage.load();
  }

  init(): void {
    this.configureDownloadHandling();
    this.configureRequestHeaders();
    this.applySettingsToViews();
    this.restoreTabs();
    this.window.on("resize", this.onWindowBoundsChanged);
    this.window.on("maximize", this.onWindowBoundsChanged);
    this.window.on("unmaximize", this.onWindowBoundsChanged);
    this.emitState();
  }

  dispose(): void {
    this.window.off("resize", this.onWindowBoundsChanged);
    this.window.off("maximize", this.onWindowBoundsChanged);
    this.window.off("unmaximize", this.onWindowBoundsChanged);
    this.browserSession.off("will-download", this.onDownloadStarted);
  }

  getState(): BrowserState {
    return structuredClone(this.state);
  }

  setViewInsets(insets: ViewInsets): void {
    this.insets = {
      right: Math.max(0, Math.min(1100, Math.round(insets.right))),
      bottom: Math.max(0, Math.min(140, Math.round(insets.bottom))),
    };
    this.layoutActiveView();
  }

  createTab(url?: string, activate = true): BrowserTab {
    const tab = this.createTabRecord(url);
    const activeIndex = this.state.tabs.findIndex(
      (item) => item.id === this.state.activeTabId,
    );
    const insertIndex =
      this.state.settings.openTabsNextToCurrent && activeIndex >= 0
        ? activeIndex + 1
        : this.state.tabs.length;
    this.state.tabs.splice(insertIndex, 0, tab);

    if (!tab.isNewTab) {
      const view = this.createWebView(tab.id);
      this.views.set(tab.id, view);
      void this.safeLoad(tab.id, tab.url);
    }

    if (activate || !this.state.activeTabId) {
      this.state.activeTabId = tab.id;
      this.attachActiveView();
    }

    this.persistAndEmit();
    return tab;
  }

  closeTab(tabId: string): void {
    const index = this.state.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) {
      return;
    }

    const [tab] = this.state.tabs.splice(index, 1);
    const view = this.views.get(tab.id);
    if (view) {
      this.detachView(view);
      view.webContents.close({ waitForBeforeUnload: false });
      this.views.delete(tab.id);
    }

    if (this.state.tabs.length === 0) {
      this.createTab(undefined, true);
      return;
    }

    if (this.state.activeTabId === tabId) {
      const nextTab = this.state.tabs[Math.max(0, index - 1)];
      this.state.activeTabId = nextTab.id;
      this.attachActiveView();
    }

    this.persistAndEmit();
  }

  switchTab(tabId: string): void {
    if (!this.state.tabs.some((tab) => tab.id === tabId)) {
      return;
    }

    this.state.activeTabId = tabId;
    this.attachActiveView();
    this.persistAndEmit();
  }

  nextTab(): void {
    this.stepTab(1);
  }

  previousTab(): void {
    this.stepTab(-1);
  }

  navigateActive(input: string): void {
    const activeTab = this.getActiveTab();
    if (!activeTab) {
      return;
    }

    let target;
    try {
      target = normalizeNavigationInput(input, this.state.settings);
    } catch (error) {
      activeTab.error = error instanceof Error ? error.message : "Navigation blocked.";
      activeTab.isLoading = false;
      this.persistAndEmit();
      return;
    }

    if (target.kind === "internal") {
      this.convertToNewTab(activeTab.id);
      return;
    }

    activeTab.url = target.url;
    activeTab.title = getHostnameLabel(target.url);
    activeTab.isNewTab = false;
    activeTab.error = undefined;
    activeTab.isLoading = true;

    const view = this.ensureWebView(activeTab.id);
    this.attachActiveView();
    void this.safeLoad(activeTab.id, target.url);
    view.webContents.focus();
    this.persistAndEmit();
  }

  goHome(): void {
    if (
      this.state.settings.homeBehavior === "custom-url" &&
      this.state.settings.homeUrl.trim()
    ) {
      this.navigateActive(this.state.settings.homeUrl);
      return;
    }

    this.convertToNewTab(this.state.activeTabId);
  }

  goBack(): void {
    this.getActiveView()?.webContents.navigationHistory.goBack();
  }

  goForward(): void {
    this.getActiveView()?.webContents.navigationHistory.goForward();
  }

  reload(hard = false): void {
    const view = this.getActiveView();
    if (!view) {
      return;
    }

    this.attachActiveView();

    if (hard) {
      view.webContents.reloadIgnoringCache();
    } else {
      view.webContents.reload();
    }
  }

  stopLoading(): void {
    const view = this.getActiveView();
    const tab = this.getActiveTab();
    if (!view || !tab) {
      return;
    }

    view.webContents.stop();
    tab.isLoading = false;
    this.persistAndEmit();
  }

  toggleCurrentBookmark(): void {
    const tab = this.getActiveTab();
    if (!tab || tab.isNewTab || !isSafeWebUrl(tab.url)) {
      return;
    }

    const existing = this.state.bookmarks.find((bookmark) => bookmark.url === tab.url);
    if (existing) {
      this.state.bookmarks = this.state.bookmarks.filter(
        (bookmark) => bookmark.id !== existing.id,
      );
    } else {
      const bookmark: Bookmark = {
        id: randomUUID(),
        title: tab.title || getHostnameLabel(tab.url),
        url: tab.url,
        createdAt: Date.now(),
      };
      this.state.bookmarks = [bookmark, ...this.state.bookmarks].slice(0, 500);
    }

    this.persistAndEmit();
  }

  removeBookmark(bookmarkId: string): void {
    this.state.bookmarks = this.state.bookmarks.filter(
      (bookmark) => bookmark.id !== bookmarkId,
    );
    this.persistAndEmit();
  }

  openBookmark(bookmarkId: string): void {
    const bookmark = this.state.bookmarks.find((item) => item.id === bookmarkId);
    if (bookmark) {
      this.createTab(bookmark.url, true);
    }
  }

  openHistoryEntry(entryId: string): void {
    const entry = this.state.history.find((item) => item.id === entryId);
    if (entry) {
      this.createTab(entry.url, true);
    }
  }

  clearHistory(): void {
    this.state.history = [];
    this.persistAndEmit();
  }

  updateSettings(partial: Partial<BrowserSettings>): void {
    this.state.settings = {
      ...this.state.settings,
      ...partial,
      browserName: "UltraX",
    };
    this.applySettingsToViews();
    this.applyRetentionPolicies();
    this.persistAndEmit();
  }

  resetSettings(): void {
    this.state.settings = { ...DEFAULT_SETTINGS };
    this.applySettingsToViews();
    this.persistAndEmit();
  }

  async clearBrowserData(): Promise<void> {
    this.state.history = [];
    await this.browserSession.clearCache();
    await this.browserSession.clearStorageData({
      storages: ["cookies", "localstorage", "indexdb", "cachestorage"],
    });
    this.persistAndEmit();
  }

  async clearNetworkCache(): Promise<void> {
    await this.browserSession.clearCache();
  }

  async openDownload(downloadId: string): Promise<void> {
    const download = this.state.downloads.find((item) => item.id === downloadId);
    if (download?.savePath) {
      await shell.openPath(download.savePath);
    }
  }

  revealDownload(downloadId: string): void {
    const download = this.state.downloads.find((item) => item.id === downloadId);
    if (download?.savePath) {
      shell.showItemInFolder(download.savePath);
    }
  }

  clearDownloads(): void {
    this.state.downloads = [];
    this.persistAndEmit();
  }

  clearBookmarks(): void {
    this.state.bookmarks = [];
    this.persistAndEmit();
  }

  async loadUnpackedExtension(): Promise<InstalledExtension | null> {
    if (!this.state.settings.extensionDeveloperMode) {
      throw new Error("Enable Developer Mode before loading local UltraX extensions.");
    }

    const result = await dialog.showOpenDialog(this.window, {
      title: "Load unpacked UltraX extension",
      properties: ["openDirectory"],
      defaultPath: this.resolveExtensionsDirectory(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const [folderPath] = result.filePaths;
    const extension = readLocalExtension(folderPath);
    const existingIndex = this.state.installedExtensions.findIndex(
      (item) => item.id === extension.id,
    );

    if (existingIndex >= 0) {
      const existing = this.state.installedExtensions[existingIndex];
      this.state.installedExtensions[existingIndex] = {
        ...extension,
        enabled: existing.enabled,
        installedAt: existing.installedAt,
        status: existing.enabled ? "enabled" : extension.status,
      };
    } else {
      this.state.installedExtensions.push(extension);
    }

    this.state.extensionStorage[extension.id] ??= {};
    this.persistAndEmit();
    return structuredClone(
      this.state.installedExtensions.find((item) => item.id === extension.id) ?? extension,
    );
  }

  async validateUnpackedExtension(): Promise<ExtensionValidationResult | null> {
    if (!this.state.settings.extensionDeveloperMode) {
      throw new Error("Enable Developer Mode before validating local UltraX extensions.");
    }

    const result = await dialog.showOpenDialog(this.window, {
      title: "Validate UltraX extension folder",
      properties: ["openDirectory"],
      defaultPath: this.resolveExtensionsDirectory(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const [folderPath] = result.filePaths;
    const manifestPath = path.join(folderPath, "ultrax-extension.json");
    if (!fs.existsSync(manifestPath)) {
      return {
        ok: false,
        errors: ["Missing ultrax-extension.json."],
        warnings: [],
      };
    }

    try {
      const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as unknown;
      const validation = validateExtensionManifest(rawManifest, folderPath);
      return validation.ok
        ? {
            ok: true,
            manifest: validation.manifest,
            errors: [],
            warnings: validation.warnings,
          }
        : {
            ok: false,
            errors: validation.errors,
            warnings: validation.warnings,
          };
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : "Extension validation failed."],
        warnings: [],
      };
    }
  }

  setExtensionEnabled(extensionId: string, enabled: boolean): void {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      throw new Error("Extension not found.");
    }

    if (extension.status === "error" && enabled) {
      throw new Error("Fix or reload this extension before enabling it.");
    }

    extension.enabled = enabled;
    extension.status = enabled ? "enabled" : "disabled";
    extension.updatedAt = Date.now();
    this.appendExtensionLog(
      extension.id,
      "info",
      enabled ? "Extension enabled." : "Extension disabled.",
    );
    this.persistAndEmit();
  }

  removeExtension(extensionId: string): void {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      throw new Error("Extension not found.");
    }

    if (extension.id === "ultrax-notes-sidebar") {
      throw new Error("Built-in UltraX extensions can be disabled but not removed.");
    }

    this.state.installedExtensions = this.state.installedExtensions.filter(
      (item) => item.id !== extensionId,
    );
    delete this.state.extensionStorage[extensionId];
    this.persistAndEmit();
  }

  reloadExtensions(): void {
    this.state.installedExtensions = this.state.installedExtensions.map((extension) => {
      if (extension.source !== "local" || !extension.installPath) {
        return extension.enabled
          ? { ...extension, status: "enabled", errors: [] }
          : { ...extension, status: "disabled", errors: [] };
      }

      try {
        const refreshed = readLocalExtension(extension.installPath);
        return {
          ...refreshed,
          enabled: extension.enabled,
          installedAt: extension.installedAt,
          status: extension.enabled ? "enabled" : "disabled",
        };
      } catch (error) {
        return pushExtensionError(
          extension,
          error instanceof Error ? error.message : "Extension reload failed.",
        );
      }
    });
    this.persistAndEmit();
  }

  async openExtensionsFolder(): Promise<void> {
    const directory = this.resolveExtensionsDirectory();
    fs.mkdirSync(directory, { recursive: true });
    await shell.openPath(directory);
  }

  async listExtensionStore(): Promise<ExtensionStoreItem[]> {
    return this.extensionStore.listExtensions(this.state.installedExtensions);
  }

  async installStoreExtension(extensionId: string): Promise<InstalledExtension> {
    const extension = await this.extensionStore.installExtension(extensionId);
    const existingIndex = this.state.installedExtensions.findIndex(
      (item) => item.id === extension.id,
    );

    if (existingIndex >= 0) {
      const existing = this.state.installedExtensions[existingIndex];
      this.state.installedExtensions[existingIndex] = {
        ...extension,
        installedAt: existing.installedAt,
        runtimeLogs: existing.runtimeLogs,
      };
    } else {
      this.state.installedExtensions.push(extension);
    }

    this.state.extensionStorage[extension.id] ??= {};
    this.appendExtensionLog(extension.id, "info", "Installed from the local UltraX Store.");
    this.persistAndEmit();
    return structuredClone(
      this.state.installedExtensions.find((item) => item.id === extension.id) ?? extension,
    );
  }

  openExtensionPanel(extensionId: string): ExtensionPanelDescriptor {
    const extension = this.requireRunnableExtension(extensionId);
    const descriptor = createExtensionPanelDescriptor(extension);
    this.appendExtensionLog(extension.id, "info", "Sidebar panel opened.");
    this.persistAndEmit();
    return descriptor;
  }

  invokeExtensionApi(
    extensionId: string,
    request: ExtensionApiRequest,
  ): ExtensionApiResponse {
    try {
      const result = this.handleExtensionApi(extensionId, request.method, request.args);
      this.appendExtensionLog(extensionId, "info", `API ${request.method} completed.`);
      this.persistAndEmit();
      return {
        requestId: request.requestId,
        ok: true,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extension API call failed.";
      this.appendExtensionLog(extensionId, "warn", `${request.method}: ${message}`);
      this.persistAndEmit();
      return {
        requestId: request.requestId,
        ok: false,
        error: message,
      };
    }
  }

  logExtensionRuntimeMessage(
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ): void {
    this.appendExtensionLog(extensionId, level, message);
    if (level === "error") {
      this.markExtensionError(extensionId, message);
    }
    this.persistAndEmit();
  }

  clearExtensionErrors(extensionId?: string): void {
    for (const extension of this.state.installedExtensions) {
      if (extensionId && extension.id !== extensionId) {
        continue;
      }

      extension.errors = [];
      if (extension.status === "error") {
        extension.status = extension.enabled ? "enabled" : "disabled";
      }
      extension.runtimeLogs = extension.runtimeLogs.filter((log) => log.level !== "error");
      extension.updatedAt = Date.now();
    }

    this.persistAndEmit();
  }

  async chooseDownloadFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.window, {
      title: "Choose UltraX download folder",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: this.resolveDownloadDirectory(),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const [downloadPath] = result.filePaths;
    this.updateSettings({ downloadPath });
    return downloadPath;
  }

  async openDownloadsFolder(): Promise<void> {
    await shell.openPath(this.resolveDownloadDirectory());
  }

  focusAddressBar(): void {
    this.window.webContents.focus();
    this.window.webContents.send(IPC.focusAddressBar);
  }

  private restoreTabs(): void {
    this.applyRetentionPolicies();

    const persistedTabs = this.state.tabs;
    const persistedActiveTabId = this.state.activeTabId;

    this.state.tabs = [];
    this.state.activeTabId = null;

    const shouldRestoreSession =
      this.state.settings.startupBehavior === "restore-session";

    if (shouldRestoreSession && persistedTabs.length > 0) {
      // TODO: Apply lazyRestoreSession/loadTabsOnDemand/restoreActiveTabOnly
      // when restored tabs can exist as unloaded WebContents records.
      for (const persistedTab of persistedTabs) {
        const tab = this.createTabRecord(
          persistedTab.isNewTab || !isSafeWebUrl(persistedTab.url)
            ? undefined
            : persistedTab.url,
          persistedTab.title,
        );
        tab.favicon = persistedTab.favicon;
        this.state.tabs.push(tab);

        if (!tab.isNewTab) {
          const view = this.createWebView(tab.id);
          this.views.set(tab.id, view);
          void this.safeLoad(tab.id, tab.url);
        }
      }

      this.state.activeTabId =
        this.state.tabs.find((tab) => tab.id === persistedActiveTabId)?.id ??
        this.state.tabs[0]?.id ??
        null;
    }

    if (
      this.state.tabs.length === 0 &&
      this.state.settings.startupBehavior === "specific-pages"
    ) {
      for (const page of this.state.settings.startupPages) {
        const target = page.trim();
        if (!isSafeWebUrl(target)) {
          continue;
        }

        const tab = this.createTabRecord(target);
        this.state.tabs.push(tab);
        const view = this.createWebView(tab.id);
        this.views.set(tab.id, view);
        void this.safeLoad(tab.id, tab.url);
      }

      this.state.activeTabId = this.state.tabs[0]?.id ?? null;
    }

    if (this.state.tabs.length === 0) {
      const tab = this.createTabRecord();
      this.state.tabs.push(tab);
      this.state.activeTabId = tab.id;
    }

    this.attachActiveView();
  }

  private createTabRecord(url?: string, title?: string): BrowserTab {
    const isNewTab = !url || url === INTERNAL_NEW_TAB_URL || !isSafeWebUrl(url);

    return {
      id: randomUUID(),
      url: isNewTab ? INTERNAL_NEW_TAB_URL : url,
      title: title || (isNewTab ? "New Tab" : getHostnameLabel(url)),
      isLoading: !isNewTab,
      canGoBack: false,
      canGoForward: false,
      isNewTab,
    };
  }

  private ensureWebView(tabId: string): WebContentsView {
    const existing = this.views.get(tabId);
    if (existing) {
      return existing;
    }

    const view = this.createWebView(tabId);
    this.views.set(tabId, view);
    return view;
  }

  private createWebView(tabId: string): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        partition: WEB_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    view.webContents.setZoomFactor(this.state.settings.pageZoom);

    view.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeWebUrl(url)) {
        this.createTab(url, true);
      }
      return { action: "deny" };
    });

    view.webContents.on("will-navigate", (event, url) => {
      if (!isSafeWebUrl(url)) {
        event.preventDefault();
        this.markTabError(tabId, `Blocked unsupported navigation target: ${url}`);
      }
    });

    view.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") {
        return;
      }

      const key = input.key.toLowerCase();
      const hasPrimaryModifier = input.control || input.meta;

      if (hasPrimaryModifier && key === "l") {
        event.preventDefault();
        this.focusAddressBar();
        return;
      }

      if (hasPrimaryModifier && key === "t") {
        event.preventDefault();
        this.createTab(undefined, true);
        return;
      }

      if (hasPrimaryModifier && key === "w") {
        event.preventDefault();
        const activeTab = this.getActiveTab();
        if (activeTab) {
          this.closeTab(activeTab.id);
        }
        return;
      }

      if (hasPrimaryModifier && key === "r") {
        event.preventDefault();
        this.reload(input.shift);
        return;
      }

      if (hasPrimaryModifier && key === "d") {
        event.preventDefault();
        this.toggleCurrentBookmark();
        return;
      }

      if (hasPrimaryModifier && key === "tab") {
        event.preventDefault();
        if (input.shift) {
          this.previousTab();
        } else {
          this.nextTab();
        }
        return;
      }

      if (input.alt && key === "arrowleft") {
        event.preventDefault();
        this.goBack();
        return;
      }

      if (input.alt && key === "arrowright") {
        event.preventDefault();
        this.goForward();
      }
    });

    view.webContents.on("did-start-loading", () => {
      this.patchTabFromContents(tabId, view.webContents, { isLoading: true, error: undefined });
    });

    view.webContents.on("did-stop-loading", () => {
      this.patchTabFromContents(tabId, view.webContents, { isLoading: false });
    });

    view.webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      const resolvedTitle = title || "Untitled";
      this.patchTabFromContents(tabId, view.webContents, { title: resolvedTitle });
      this.updateHistoryTitle(view.webContents.getURL(), resolvedTitle);
    });

    view.webContents.on("page-favicon-updated", (_event, favicons) => {
      this.patchTab(tabId, { favicon: favicons[0] });
    });

    view.webContents.on("did-navigate", (_event, url) => {
      this.handleCommittedNavigation(tabId, view.webContents, url);
    });

    view.webContents.on("did-navigate-in-page", (_event, url) => {
      this.handleCommittedNavigation(tabId, view.webContents, url);
    });

    view.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) {
          return;
        }

        this.markTabError(
          tabId,
          `${errorDescription || "Page failed to load"} (${validatedURL || "unknown URL"})`,
        );
      },
    );

    view.webContents.on("render-process-gone", (_event, details) => {
      this.markTabError(tabId, `Page process ended: ${details.reason}`);
    });

    return view;
  }

  private async safeLoad(tabId: string, url: string): Promise<void> {
    const view = this.ensureWebView(tabId);

    if (!isSafeWebUrl(url)) {
      this.markTabError(tabId, `Blocked unsupported navigation target: ${url}`);
      return;
    }

    try {
      await view.webContents.loadURL(url);
    } catch (error) {
      this.markTabError(
        tabId,
        error instanceof Error ? error.message : "Page failed to load.",
      );
    }
  }

  private handleCommittedNavigation(
    tabId: string,
    contents: WebContents,
    url: string,
  ): void {
    if (!isSafeWebUrl(url)) {
      return;
    }

    const title = contents.getTitle() || getHostnameLabel(url);
    this.patchTabFromContents(tabId, contents, { url, title, isNewTab: false });
    this.recordHistory(url, title);
  }

  private recordHistory(url: string, title: string): void {
    if (!isSafeWebUrl(url)) {
      return;
    }

    const now = Date.now();
    const existing = this.state.history.find((entry) => entry.url === url);

    if (existing) {
      existing.title = title || existing.title;
      existing.visitedAt = now;
      this.state.history = [
        existing,
        ...this.state.history.filter((entry) => entry.id !== existing.id),
      ];
    } else {
      const entry: HistoryEntry = {
        id: randomUUID(),
        title: title || getHostnameLabel(url),
        url,
        visitedAt: now,
      };
      this.state.history = [entry, ...this.state.history];
    }

    this.state.history = this.state.history.slice(0, MAX_HISTORY_ENTRIES);
    this.persistAndEmit();
  }

  private updateHistoryTitle(url: string, title: string): void {
    if (!isSafeWebUrl(url)) {
      return;
    }

    const entry = this.state.history.find((item) => item.url === url);
    if (!entry || entry.title === title) {
      return;
    }

    entry.title = title;
    this.persistAndEmit();
  }

  private convertToNewTab(tabId: string | null): void {
    if (!tabId) {
      return;
    }

    const tab = this.state.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    const view = this.views.get(tab.id);
    if (view) {
      this.detachView(view);
      view.webContents.close({ waitForBeforeUnload: false });
      this.views.delete(tab.id);
    }

    Object.assign(tab, {
      url: INTERNAL_NEW_TAB_URL,
      title: "New Tab",
      favicon: undefined,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isNewTab: true,
      error: undefined,
    });

    this.attachActiveView();
    this.persistAndEmit();
  }

  private stepTab(direction: 1 | -1): void {
    if (this.state.tabs.length < 2 || !this.state.activeTabId) {
      return;
    }

    const currentIndex = this.state.tabs.findIndex(
      (tab) => tab.id === this.state.activeTabId,
    );
    const nextIndex =
      (currentIndex + direction + this.state.tabs.length) % this.state.tabs.length;
    this.switchTab(this.state.tabs[nextIndex].id);
  }

  private getActiveTab(): BrowserTab | undefined {
    return this.state.tabs.find((tab) => tab.id === this.state.activeTabId);
  }

  private getActiveView(): WebContentsView | undefined {
    const activeTab = this.getActiveTab();
    return activeTab ? this.views.get(activeTab.id) : undefined;
  }

  private attachActiveView(): void {
    const activeTab = this.getActiveTab();
    const activeView = activeTab?.error ? null : this.getActiveView() ?? null;

    if (this.attachedView && this.attachedView !== activeView) {
      this.detachView(this.attachedView);
      this.attachedView = null;
    }

    if (activeView && this.attachedView !== activeView) {
      this.window.contentView.addChildView(activeView);
      this.attachedView = activeView;
    }

    this.layoutActiveView();
  }

  private detachView(view: WebContentsView): void {
    try {
      this.window.contentView.removeChildView(view);
    } catch {
      // The view may already be detached during tab close or window teardown.
    }
  }

  private layoutActiveView(): void {
    const activeTab = this.getActiveTab();
    const view = activeTab?.error ? undefined : this.getActiveView();
    if (!view) {
      return;
    }

    const bounds = this.window.getContentBounds();
    view.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width: Math.max(0, bounds.width - this.insets.right),
      height: Math.max(0, bounds.height - CHROME_HEIGHT - this.insets.bottom),
    });
  }

  private patchTabFromContents(
    tabId: string,
    contents: WebContents,
    patch: Partial<BrowserTab>,
  ): void {
    this.patchTab(tabId, {
      url: isSafeWebUrl(contents.getURL()) ? contents.getURL() : patch.url,
      title: patch.title,
      isLoading: patch.isLoading,
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      error: patch.error,
      isNewTab: false,
    });
  }

  private patchTab(tabId: string, patch: Partial<BrowserTab>): void {
    const tab = this.state.tabs.find((item) => item.id === tabId);
    if (!tab) {
      return;
    }

    Object.assign(
      tab,
      Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ),
    );
    this.persistAndEmit();
  }

  private markTabError(tabId: string, error: string): void {
    this.patchTab(tabId, {
      title: "Load failed",
      isLoading: false,
      error,
    });

    if (this.state.activeTabId === tabId) {
      this.attachActiveView();
    }
  }

  private configureDownloadHandling(): void {
    this.browserSession.off("will-download", this.onDownloadStarted);
    this.browserSession.on("will-download", this.onDownloadStarted);
  }

  private configureRequestHeaders(): void {
    this.browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      if (this.state.settings.doNotTrack) {
        requestHeaders.DNT = "1";
      } else {
        delete requestHeaders.DNT;
      }

      callback({ requestHeaders });
    });
  }

  private applySettingsToViews(): void {
    this.browserSession.setDownloadPath(this.resolveDownloadDirectory());

    for (const view of this.views.values()) {
      view.webContents.setZoomFactor(this.state.settings.pageZoom);
    }

    // TODO: Wire memorySaver/suspendInactiveTabs to a WebContents lifecycle
    // engine, and connect DNS/page preload preferences to safe network prediction.
  }

  private applyRetentionPolicies(): void {
    const now = Date.now();
    const historyMaxAge =
      this.state.settings.historyRetention === "7-days"
        ? 7 * 24 * 60 * 60 * 1000
        : this.state.settings.historyRetention === "30-days"
          ? 30 * 24 * 60 * 60 * 1000
          : null;

    if (historyMaxAge) {
      this.state.history = this.state.history.filter(
        (entry) => now - entry.visitedAt <= historyMaxAge,
      );
    }

    if (this.state.settings.downloadRetention === "session") {
      this.state.downloads = [];
      return;
    }

    if (this.state.settings.downloadRetention === "30-days") {
      this.state.downloads = this.state.downloads.filter(
        (download) => now - download.startedAt <= 30 * 24 * 60 * 60 * 1000,
      );
    }
  }

  private resolveDownloadDirectory(): string {
    return this.state.settings.downloadPath || app.getPath("downloads");
  }

  private resolveExtensionsDirectory(): string {
    return path.join(app.getPath("userData"), "extensions");
  }

  private getInstalledExtension(extensionId: string): InstalledExtension | undefined {
    return this.state.installedExtensions.find((extension) => extension.id === extensionId);
  }

  private requireRunnableExtension(extensionId: string): InstalledExtension {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      throw new Error("Extension not found.");
    }

    if (!extension.enabled || extension.status === "disabled") {
      throw new Error("Extension is disabled.");
    }

    if (extension.status === "error") {
      throw new Error("Extension is in an error state.");
    }

    return extension;
  }

  private handleExtensionApi(
    extensionId: string,
    method: string,
    args: unknown[],
  ): unknown {
    if (!Array.isArray(args) || args.length > 4) {
      throw new Error("Invalid extension API arguments.");
    }

    const extension = this.requireRunnableExtension(extensionId);

    switch (method) {
      case "extensions.getSelf":
        return structuredClone(extension.manifest);

      case "storage.get": {
        this.requireExtensionPermission(extension, "storage");
        const key = this.readExtensionStorageKey(args[0]);
        return structuredClone(this.state.extensionStorage[extension.id]?.[key] ?? null);
      }

      case "storage.set": {
        this.requireExtensionPermission(extension, "storage");
        const key = this.readExtensionStorageKey(args[0]);
        const value = this.readJsonSerializableValue(args[1]);
        this.state.extensionStorage[extension.id] ??= {};
        this.state.extensionStorage[extension.id][key] = value;
        return null;
      }

      case "storage.remove": {
        this.requireExtensionPermission(extension, "storage");
        const key = this.readExtensionStorageKey(args[0]);
        delete this.state.extensionStorage[extension.id]?.[key];
        return null;
      }

      case "storage.clear": {
        this.requireExtensionPermission(extension, "storage");
        this.state.extensionStorage[extension.id] = {};
        return null;
      }

      case "tabs.getActive":
        this.requireExtensionPermission(extension, "activeTab");
        return this.getActiveTabForExtension();

      case "tabs.query":
        this.requireExtensionPermission(extension, "tabs");
        return this.state.tabs.map((tab) => this.sanitizeTabForExtension(tab));

      case "notifications.show": {
        this.requireExtensionPermission(extension, "notifications");
        const request = this.readNotificationRequest(args[0]);
        if (Notification.isSupported()) {
          new Notification({
            title: request.title,
            body: request.message,
          }).show();
        }
        return null;
      }

      case "sidebar.open":
        this.requireExtensionPermission(extension, "sidebar");
        return { action: "open-sidebar", extensionId: extension.id };

      case "sidebar.close":
        this.requireExtensionPermission(extension, "sidebar");
        return { action: "close-sidebar", extensionId: extension.id };

      default:
        throw new Error("Unsupported UltraX extension API method.");
    }
  }

  private requireExtensionPermission(
    extension: InstalledExtension,
    permission: UltraXExtensionPermission,
  ): void {
    if (!extension.manifest.permissions.includes(permission)) {
      throw new Error(`Missing ${permission} permission.`);
    }
  }

  private readExtensionStorageKey(value: unknown): string {
    if (typeof value !== "string") {
      throw new Error("Extension storage key must be a string.");
    }

    const key = value.trim();
    if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(key)) {
      throw new Error("Extension storage key contains unsupported characters.");
    }

    return key;
  }

  private readJsonSerializableValue(value: unknown): unknown {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new Error("Extension storage value must be JSON-serializable.");
    }

    if (serialized === undefined || serialized.length > 128 * 1024) {
      throw new Error("Extension storage value is too large or unsupported.");
    }

    return JSON.parse(serialized) as unknown;
  }

  private readNotificationRequest(value: unknown): { title: string; message: string } {
    if (!value || typeof value !== "object") {
      throw new Error("Notification request must be an object.");
    }

    const candidate = value as { title?: unknown; message?: unknown };
    if (
      typeof candidate.title !== "string" ||
      typeof candidate.message !== "string" ||
      candidate.title.trim().length === 0 ||
      candidate.title.length > 80 ||
      candidate.message.length > 240
    ) {
      throw new Error("Notification title or message is invalid.");
    }

    return {
      title: candidate.title.trim(),
      message: candidate.message.trim(),
    };
  }

  private getActiveTabForExtension(): BrowserTab | null {
    const activeTab = this.getActiveTab();
    return activeTab ? this.sanitizeTabForExtension(activeTab) : null;
  }

  private sanitizeTabForExtension(tab: BrowserTab): BrowserTab {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      isLoading: tab.isLoading,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isNewTab: tab.isNewTab,
      error: tab.error,
    };
  }

  private appendExtensionLog(
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ): void {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      return;
    }

    extension.runtimeLogs = [
      {
        id: randomUUID(),
        extensionId,
        level,
        message: message.slice(0, 280),
        timestamp: Date.now(),
      },
      ...extension.runtimeLogs,
    ].slice(0, 40);
    extension.updatedAt = Date.now();
  }

  private markExtensionError(extensionId: string, message: string): void {
    const extension = this.getInstalledExtension(extensionId);
    if (!extension) {
      return;
    }

    const updated = pushExtensionError(extension, message.slice(0, 240));
    Object.assign(extension, updated);
  }

  private readonly onDownloadStarted = (
    _event: ElectronEvent,
    item: ElectronDownloadItem,
  ) => {
    const downloadDirectory = this.resolveDownloadDirectory();
    if (this.state.settings.askWhereToSaveDownloads) {
      item.setSaveDialogOptions({
        defaultPath: path.join(downloadDirectory, item.getFilename() || "download"),
      });
    } else {
      item.setSavePath(path.join(downloadDirectory, item.getFilename() || "download"));
    }

    const download: DownloadItem = {
      id: randomUUID(),
      url: item.getURL(),
      filename: item.getFilename() || path.basename(item.getURL()) || "download",
      savePath: item.getSavePath(),
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: "progressing",
      startedAt: Date.now(),
    };

    this.state.downloads = [download, ...this.state.downloads].slice(0, MAX_DOWNLOADS);
    this.persistAndEmit();

    item.on("updated", (_event, state) => {
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.savePath = item.getSavePath();
      download.state = state === "interrupted" ? "interrupted" : "progressing";
      this.persistAndEmit();
    });

    item.once("done", (_event, state) => {
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.savePath = item.getSavePath();
      download.state = state;
      download.completedAt = Date.now();
      this.persistAndEmit();
    });
  };

  private persistAndEmit(): void {
    this.storage.save(this.state);
    this.emitState();
  }

  private emitState(): void {
    this.window.webContents.send(IPC.browserState, this.getState());
  }
}
