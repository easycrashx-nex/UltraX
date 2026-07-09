import { contextBridge, ipcRenderer } from "electron";
import type { UltraXApi } from "../shared/electron-api";
import type {
  BrowserSettings,
  BrowserState,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  ExtensionValidationResult,
  ExtensionsWorkspaceInfo,
  InstalledExtension,
  RuntimeInfo,
  TabReorderPlacement,
  UpdateStatusSnapshot,
  ViewInsets,
} from "../shared/types";

const IPC = {
  browserState: "browser:state",
  focusAddressBar: "browser:focus-address-bar",
  requestCloseConfirmation: "window:request-close-confirmation",
  getState: "browser:get-state",
  setViewInsets: "browser:set-view-insets",
  createTab: "tabs:create",
  closeTab: "tabs:close",
  duplicateTab: "tabs:duplicate",
  pinTab: "tabs:pin",
  reorderTab: "tabs:reorder",
  closeOtherTabs: "tabs:close-others",
  closeTabsToRight: "tabs:close-to-right",
  moveTabToNewWindow: "tabs:move-to-new-window",
  toggleTabMuted: "tabs:toggle-muted",
  switchTab: "tabs:switch",
  navigate: "tabs:navigate",
  goHome: "tabs:home",
  goBack: "tabs:back",
  goForward: "tabs:forward",
  reload: "tabs:reload",
  stopLoading: "tabs:stop",
  hardReload: "tabs:hard-reload",
  nextTab: "tabs:next",
  previousTab: "tabs:previous",
  toggleBookmark: "bookmarks:toggle-current",
  removeBookmark: "bookmarks:remove",
  openBookmark: "bookmarks:open",
  clearHistory: "history:clear",
  openHistoryEntry: "history:open",
  updateSettings: "settings:update",
  clearBrowserData: "settings:clear-browser-data",
  clearNetworkCache: "settings:clear-network-cache",
  resetSettings: "settings:reset",
  getRuntimeInfo: "settings:get-runtime-info",
  openShellDevTools: "settings:open-shell-devtools",
  relaunchApp: "settings:relaunch-app",
  updateStatusChanged: "updates:status-changed",
  getUpdateStatus: "updates:get-status",
  checkForUpdates: "updates:check",
  downloadUpdate: "updates:download",
  installUpdate: "updates:install",
  openReleasesPage: "updates:open-releases-page",
  openDownload: "downloads:open",
  revealDownload: "downloads:reveal",
  chooseDownloadFolder: "downloads:choose-folder",
  openDownloadsFolder: "downloads:open-folder",
  clearDownloads: "downloads:clear",
  chooseNewTabCustomImage: "appearance:choose-new-tab-custom-image",
  removeNewTabCustomImage: "appearance:remove-new-tab-custom-image",
  clearBookmarks: "bookmarks:clear",
  loadUnpackedExtension: "extensions:load-unpacked",
  validateUnpackedExtension: "extensions:validate-unpacked",
  ensureExtensionsWorkspace: "extensions:ensure-workspace",
  setExtensionEnabled: "extensions:set-enabled",
  removeExtension: "extensions:remove",
  reloadExtensions: "extensions:reload",
  openExtensionsFolder: "extensions:open-folder",
  listExtensionStore: "extensions:store:list",
  installStoreExtension: "extensions:store:install",
  openExtensionPanel: "extensions:panel:open",
  invokeExtensionApi: "extensions:api:invoke",
  logExtensionRuntimeMessage: "extensions:runtime:log",
  clearExtensionErrors: "extensions:errors:clear",
  minimizeWindow: "window:minimize",
  toggleMaximizeWindow: "window:toggle-maximize",
  closeWindow: "window:close",
  closeWindowWithBehavior: "window:close-with-behavior",
} as const;

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: UltraXApi = {
  getState: () => invoke<BrowserState>(IPC.getState),
  setViewInsets: (insets: ViewInsets) => invoke<void>(IPC.setViewInsets, insets),

  createTab: () => invoke<void>(IPC.createTab),
  closeTab: (tabId: string) => invoke<void>(IPC.closeTab, tabId),
  duplicateTab: (tabId: string) => invoke<void>(IPC.duplicateTab, tabId),
  pinTab: (tabId: string, pinned: boolean) => invoke<void>(IPC.pinTab, tabId, pinned),
  reorderTab: (tabId: string, targetTabId: string, placement?: TabReorderPlacement) =>
    invoke<void>(IPC.reorderTab, tabId, targetTabId, placement),
  closeOtherTabs: (tabId: string) => invoke<void>(IPC.closeOtherTabs, tabId),
  closeTabsToRight: (tabId: string) => invoke<void>(IPC.closeTabsToRight, tabId),
  moveTabToNewWindow: (tabId: string) => invoke<void>(IPC.moveTabToNewWindow, tabId),
  toggleTabMuted: (tabId: string) => invoke<void>(IPC.toggleTabMuted, tabId),
  switchTab: (tabId: string) => invoke<void>(IPC.switchTab, tabId),
  navigate: (input: string) => invoke<void>(IPC.navigate, input),
  goHome: () => invoke<void>(IPC.goHome),
  goBack: () => invoke<void>(IPC.goBack),
  goForward: () => invoke<void>(IPC.goForward),
  reload: () => invoke<void>(IPC.reload),
  stopLoading: () => invoke<void>(IPC.stopLoading),
  hardReload: () => invoke<void>(IPC.hardReload),
  nextTab: () => invoke<void>(IPC.nextTab),
  previousTab: () => invoke<void>(IPC.previousTab),

  toggleBookmark: () => invoke<void>(IPC.toggleBookmark),
  removeBookmark: (bookmarkId: string) => invoke<void>(IPC.removeBookmark, bookmarkId),
  openBookmark: (bookmarkId: string) => invoke<void>(IPC.openBookmark, bookmarkId),

  clearHistory: () => invoke<void>(IPC.clearHistory),
  openHistoryEntry: (entryId: string) => invoke<void>(IPC.openHistoryEntry, entryId),

  updateSettings: (partial: Partial<BrowserSettings>) =>
    invoke<void>(IPC.updateSettings, partial),
  clearBrowserData: () => invoke<void>(IPC.clearBrowserData),
  clearNetworkCache: () => invoke<void>(IPC.clearNetworkCache),
  resetSettings: () => invoke<void>(IPC.resetSettings),
  getRuntimeInfo: () => invoke<RuntimeInfo>(IPC.getRuntimeInfo),
  openShellDevTools: () => invoke<void>(IPC.openShellDevTools),
  relaunchApp: () => invoke<void>(IPC.relaunchApp),
  getUpdateStatus: () => invoke<UpdateStatusSnapshot>(IPC.getUpdateStatus),
  checkForUpdates: () => invoke<UpdateStatusSnapshot>(IPC.checkForUpdates),
  downloadUpdate: () => invoke<UpdateStatusSnapshot>(IPC.downloadUpdate),
  installUpdate: () => invoke<UpdateStatusSnapshot>(IPC.installUpdate),
  openReleasesPage: () => invoke<void>(IPC.openReleasesPage),
  updates: {
    getCurrentVersion: async () => {
      const info = await invoke<RuntimeInfo>(IPC.getRuntimeInfo);
      return info.appVersion;
    },
    getStatus: () => invoke<UpdateStatusSnapshot>(IPC.getUpdateStatus),
    checkForUpdates: () => invoke<UpdateStatusSnapshot>(IPC.checkForUpdates),
    downloadUpdate: () => invoke<UpdateStatusSnapshot>(IPC.downloadUpdate),
    installAndRestart: () => invoke<UpdateStatusSnapshot>(IPC.installUpdate),
    getReleaseNotes: async () => {
      const status = await invoke<UpdateStatusSnapshot>(IPC.getUpdateStatus);
      return status.releaseNotes;
    },
    openReleasesPage: () => invoke<void>(IPC.openReleasesPage),
  },

  openDownload: (downloadId: string) => invoke<void>(IPC.openDownload, downloadId),
  revealDownload: (downloadId: string) => invoke<void>(IPC.revealDownload, downloadId),
  chooseDownloadFolder: () => invoke<string | null>(IPC.chooseDownloadFolder),
  openDownloadsFolder: () => invoke<void>(IPC.openDownloadsFolder),
  clearDownloads: () => invoke<void>(IPC.clearDownloads),
  chooseNewTabCustomImage: () => invoke<string | null>(IPC.chooseNewTabCustomImage),
  removeNewTabCustomImage: () => invoke<void>(IPC.removeNewTabCustomImage),

  clearBookmarks: () => invoke<void>(IPC.clearBookmarks),

  ensureExtensionsWorkspace: () =>
    invoke<ExtensionsWorkspaceInfo>(IPC.ensureExtensionsWorkspace),
  loadUnpackedExtension: () => invoke<InstalledExtension | null>(IPC.loadUnpackedExtension),
  validateUnpackedExtension: () =>
    invoke<ExtensionValidationResult | null>(IPC.validateUnpackedExtension),
  setExtensionEnabled: (extensionId: string, enabled: boolean) =>
    invoke<void>(IPC.setExtensionEnabled, extensionId, enabled),
  removeExtension: (extensionId: string) => invoke<void>(IPC.removeExtension, extensionId),
  reloadExtensions: () => invoke<void>(IPC.reloadExtensions),
  openExtensionsFolder: () => invoke<void>(IPC.openExtensionsFolder),
  listExtensionStore: () => invoke<ExtensionStoreItem[]>(IPC.listExtensionStore),
  installStoreExtension: (extensionId: string) =>
    invoke<InstalledExtension>(IPC.installStoreExtension, extensionId),
  openExtensionPanel: (extensionId: string) =>
    invoke<ExtensionPanelDescriptor>(IPC.openExtensionPanel, extensionId),
  invokeExtensionApi: (extensionId: string, request: ExtensionApiRequest) =>
    invoke<ExtensionApiResponse>(IPC.invokeExtensionApi, extensionId, request),
  logExtensionRuntimeMessage: (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => invoke<void>(IPC.logExtensionRuntimeMessage, extensionId, level, message),
  clearExtensionErrors: (extensionId?: string) =>
    invoke<void>(IPC.clearExtensionErrors, extensionId),

  minimizeWindow: () => invoke<void>(IPC.minimizeWindow),
  toggleMaximizeWindow: () => invoke<void>(IPC.toggleMaximizeWindow),
  closeWindow: () => invoke<void>(IPC.closeWindow),
  closeWindowWithBehavior: (discardSession: boolean) =>
    invoke<void>(IPC.closeWindowWithBehavior, discardSession),

  onStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) => {
      callback(state);
    };

    ipcRenderer.on(IPC.browserState, listener);
    return () => ipcRenderer.removeListener(IPC.browserState, listener);
  },

  onFocusAddressBar: (callback) => {
    const listener = () => callback();

    ipcRenderer.on(IPC.focusAddressBar, listener);
    return () => ipcRenderer.removeListener(IPC.focusAddressBar, listener);
  },

  onCloseRequested: (callback) => {
    const listener = () => callback();

    ipcRenderer.on(IPC.requestCloseConfirmation, listener);
    return () => ipcRenderer.removeListener(IPC.requestCloseConfirmation, listener);
  },

  onUpdateStatusChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatusSnapshot) => {
      callback(status);
    };

    ipcRenderer.on(IPC.updateStatusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.updateStatusChanged, listener);
  },
};

contextBridge.exposeInMainWorld("ultraX", api);
