import { contextBridge, ipcRenderer } from "electron";
import type { UltraXApi } from "../shared/electron-api";
import type {
  BrowserSettings,
  BrowserState,
  BookmarkDuplicatePolicy,
  BookmarkImportSummary,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  ExtensionValidationResult,
  ExtensionsWorkspaceInfo,
  InstalledExtension,
  FindInPageOptions,
  FindInPageResult,
  RuntimeInfo,
  ShortcutAction,
  TabReorderPlacement,
  UpdateStatusSnapshot,
  ViewInsets,
} from "../shared/types";
import type {
  PasswordBackupResult,
  PasswordFillRequest,
  PasswordFillResult,
  PasswordGeneratorSettings,
  PasswordHealthSummary,
  PasswordImportSummary,
  PasswordManagerStatus,
  PasswordAutofillSnapshot,
  PasswordPromptAction,
  PasswordPromptSnapshot,
  PasswordVaultItemDisplay,
  PasswordVaultItemInput,
  PasswordVaultItemUpdate,
} from "../shared/password-manager";

const IPC = {
  browserState: "browser:state",
  focusAddressBar: "browser:focus-address-bar",
  shortcutInvoked: "browser:shortcut-invoked",
  findInPageResult: "browser:find-in-page-result",
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
  reopenClosedTab: "tabs:reopen-closed",
  findInPage: "tabs:find-in-page",
  stopFindInPage: "tabs:stop-find-in-page",
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
  importBookmarks: "bookmarks:import",
  exportBookmarks: "bookmarks:export",
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
  passwordManagerStatusChanged: "password-manager:status-changed",
  passwordManagerGetStatus: "password-manager:get-status",
  passwordManagerSetup: "password-manager:setup",
  passwordManagerUnlock: "password-manager:unlock",
  passwordManagerUnlockWithOs: "password-manager:unlock-with-os",
  passwordManagerLock: "password-manager:lock",
  passwordManagerList: "password-manager:list",
  passwordManagerCreate: "password-manager:create",
  passwordManagerUpdate: "password-manager:update",
  passwordManagerDelete: "password-manager:delete",
  passwordManagerDuplicate: "password-manager:duplicate",
  passwordManagerGenerate: "password-manager:generate",
  passwordManagerCopyField: "password-manager:copy-field",
  passwordManagerFill: "password-manager:fill",
  passwordManagerHealth: "password-manager:health",
  passwordManagerImportCsv: "password-manager:import-csv",
  passwordManagerExportBackup: "password-manager:export-backup",
  passwordManagerImportBackup: "password-manager:import-backup",
  passwordManagerChangeMaster: "password-manager:change-master",
  passwordManagerDeleteVault: "password-manager:delete-vault",
  passwordManagerPromptAction: "password-manager:prompt-action",
  passwordManagerPromptChanged: "password-manager:prompt-changed",
  passwordManagerAutofillChanged: "password-manager:autofill-changed",
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
  reopenClosedTab: () => invoke<void>(IPC.reopenClosedTab),
  findInPage: (text: string, options?: FindInPageOptions) =>
    invoke<number | null>(IPC.findInPage, text, options),
  stopFindInPage: (action = "clearSelection") => invoke<void>(IPC.stopFindInPage, action),

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
  importBookmarks: (duplicatePolicy: BookmarkDuplicatePolicy = "skip") =>
    invoke<BookmarkImportSummary | null>(IPC.importBookmarks, duplicatePolicy),
  exportBookmarks: () => invoke<string | null>(IPC.exportBookmarks),

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

  passwordManager: {
    getStatus: () => invoke<PasswordManagerStatus>(IPC.passwordManagerGetStatus),
    setup: (masterPassword: string, enableQuickUnlock: boolean) =>
      invoke<PasswordManagerStatus>(IPC.passwordManagerSetup, masterPassword, enableQuickUnlock),
    unlock: (masterPassword: string) =>
      invoke<PasswordManagerStatus>(IPC.passwordManagerUnlock, masterPassword),
    unlockWithOs: () => invoke<PasswordManagerStatus>(IPC.passwordManagerUnlockWithOs),
    lock: () => invoke<PasswordManagerStatus>(IPC.passwordManagerLock),
    list: (query = "") => invoke<PasswordVaultItemDisplay[]>(IPC.passwordManagerList, query),
    create: (input: PasswordVaultItemInput) =>
      invoke<PasswordVaultItemDisplay>(IPC.passwordManagerCreate, input),
    update: (itemId: string, input: PasswordVaultItemUpdate) =>
      invoke<PasswordVaultItemDisplay>(IPC.passwordManagerUpdate, itemId, input),
    delete: (itemId: string) => invoke<void>(IPC.passwordManagerDelete, itemId),
    duplicate: (itemId: string) =>
      invoke<PasswordVaultItemDisplay>(IPC.passwordManagerDuplicate, itemId),
    generate: (options: PasswordGeneratorSettings) =>
      invoke<string>(IPC.passwordManagerGenerate, options),
    copyField: (itemId: string, field: "username" | "password") =>
      invoke<void>(IPC.passwordManagerCopyField, itemId, field),
    fill: (request: PasswordFillRequest) =>
      invoke<PasswordFillResult>(IPC.passwordManagerFill, request),
    health: () => invoke<PasswordHealthSummary>(IPC.passwordManagerHealth),
    importCsv: () => invoke<PasswordImportSummary | null>(IPC.passwordManagerImportCsv),
    exportBackup: (backupPassword: string) =>
      invoke<PasswordBackupResult | null>(IPC.passwordManagerExportBackup, backupPassword),
    importBackup: (backupPassword: string) =>
      invoke<PasswordImportSummary | null>(IPC.passwordManagerImportBackup, backupPassword),
    changeMasterPassword: (currentPassword: string, newPassword: string) =>
      invoke<void>(IPC.passwordManagerChangeMaster, currentPassword, newPassword),
    deleteVault: (masterPassword: string) =>
      invoke<void>(IPC.passwordManagerDeleteVault, masterPassword),
    promptAction: (promptId: string, action: PasswordPromptAction) =>
      invoke<"completed" | "vault-locked">(IPC.passwordManagerPromptAction, promptId, action),
    onStatusChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, status: PasswordManagerStatus) => callback(status);
      ipcRenderer.on(IPC.passwordManagerStatusChanged, listener);
      return () => ipcRenderer.removeListener(IPC.passwordManagerStatusChanged, listener);
    },
  },

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

  onShortcutInvoked: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: ShortcutAction) => callback(action);
    ipcRenderer.on(IPC.shortcutInvoked, listener);
    return () => ipcRenderer.removeListener(IPC.shortcutInvoked, listener);
  },

  onFindInPageResult: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: FindInPageResult) => callback(result);
    ipcRenderer.on(IPC.findInPageResult, listener);
    return () => ipcRenderer.removeListener(IPC.findInPageResult, listener);
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

  onPasswordPromptChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, prompt: PasswordPromptSnapshot | null) => callback(prompt);
    ipcRenderer.on(IPC.passwordManagerPromptChanged, listener);
    return () => ipcRenderer.removeListener(IPC.passwordManagerPromptChanged, listener);
  },

  onPasswordAutofillChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: PasswordAutofillSnapshot | null) => callback(snapshot);
    ipcRenderer.on(IPC.passwordManagerAutofillChanged, listener);
    return () => ipcRenderer.removeListener(IPC.passwordManagerAutofillChanged, listener);
  },
};

contextBridge.exposeInMainWorld("ultraX", api);
