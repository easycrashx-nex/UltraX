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
  ShortcutAction,
  TabReorderPlacement,
  RuntimeInfo,
  UpdateStatusSnapshot,
  ViewInsets,
} from "./types";
import type {
  PasswordBackupResult,
  PasswordFillRequest,
  PasswordFillResult,
  PasswordGeneratorSettings,
  PasswordHealthSummary,
  PasswordImportSummary,
  PasswordManagerStatus,
  PasswordVaultItemDisplay,
  PasswordVaultItemInput,
  PasswordVaultItemUpdate,
} from "./password-manager";

export type Unsubscribe = () => void;

export type UltraXApi = {
  getState: () => Promise<BrowserState>;
  setViewInsets: (insets: ViewInsets) => Promise<void>;

  createTab: () => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  duplicateTab: (tabId: string) => Promise<void>;
  pinTab: (tabId: string, pinned: boolean) => Promise<void>;
  reorderTab: (
    tabId: string,
    targetTabId: string,
    placement?: TabReorderPlacement,
  ) => Promise<void>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeTabsToRight: (tabId: string) => Promise<void>;
  moveTabToNewWindow: (tabId: string) => Promise<void>;
  toggleTabMuted: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => Promise<void>;
  navigate: (input: string) => Promise<void>;
  goHome: () => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  stopLoading: () => Promise<void>;
  hardReload: () => Promise<void>;
  nextTab: () => Promise<void>;
  previousTab: () => Promise<void>;
  reopenClosedTab: () => Promise<void>;
  findInPage: (text: string, options?: FindInPageOptions) => Promise<number | null>;
  stopFindInPage: (action?: "clearSelection" | "keepSelection" | "activateSelection") => Promise<void>;

  toggleBookmark: () => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  openBookmark: (bookmarkId: string) => Promise<void>;

  clearHistory: () => Promise<void>;
  openHistoryEntry: (entryId: string) => Promise<void>;

  updateSettings: (partial: Partial<BrowserSettings>) => Promise<void>;
  clearBrowserData: () => Promise<void>;
  clearNetworkCache: () => Promise<void>;
  resetSettings: () => Promise<void>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  openShellDevTools: () => Promise<void>;
  relaunchApp: () => Promise<void>;

  getUpdateStatus: () => Promise<UpdateStatusSnapshot>;
  checkForUpdates: () => Promise<UpdateStatusSnapshot>;
  downloadUpdate: () => Promise<UpdateStatusSnapshot>;
  installUpdate: () => Promise<UpdateStatusSnapshot>;
  openReleasesPage: () => Promise<void>;
  updates: {
    getCurrentVersion: () => Promise<string>;
    getStatus: () => Promise<UpdateStatusSnapshot>;
    checkForUpdates: () => Promise<UpdateStatusSnapshot>;
    downloadUpdate: () => Promise<UpdateStatusSnapshot>;
    installAndRestart: () => Promise<UpdateStatusSnapshot>;
    getReleaseNotes: () => Promise<string | undefined>;
    openReleasesPage: () => Promise<void>;
  };

  openDownload: (downloadId: string) => Promise<void>;
  revealDownload: (downloadId: string) => Promise<void>;
  chooseDownloadFolder: () => Promise<string | null>;
  openDownloadsFolder: () => Promise<void>;
  clearDownloads: () => Promise<void>;

  chooseNewTabCustomImage: () => Promise<string | null>;
  removeNewTabCustomImage: () => Promise<void>;

  clearBookmarks: () => Promise<void>;
  importBookmarks: (duplicatePolicy?: BookmarkDuplicatePolicy) => Promise<BookmarkImportSummary | null>;
  exportBookmarks: () => Promise<string | null>;

  ensureExtensionsWorkspace: () => Promise<ExtensionsWorkspaceInfo>;
  loadUnpackedExtension: () => Promise<InstalledExtension | null>;
  validateUnpackedExtension: () => Promise<ExtensionValidationResult | null>;
  setExtensionEnabled: (extensionId: string, enabled: boolean) => Promise<void>;
  removeExtension: (extensionId: string) => Promise<void>;
  reloadExtensions: () => Promise<void>;
  openExtensionsFolder: () => Promise<void>;
  listExtensionStore: () => Promise<ExtensionStoreItem[]>;
  installStoreExtension: (extensionId: string) => Promise<InstalledExtension>;
  openExtensionPanel: (extensionId: string) => Promise<ExtensionPanelDescriptor>;
  invokeExtensionApi: (
    extensionId: string,
    request: ExtensionApiRequest,
  ) => Promise<ExtensionApiResponse>;
  logExtensionRuntimeMessage: (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => Promise<void>;
  clearExtensionErrors: (extensionId?: string) => Promise<void>;

  passwordManager: {
    getStatus: () => Promise<PasswordManagerStatus>;
    setup: (masterPassword: string, enableQuickUnlock: boolean) => Promise<PasswordManagerStatus>;
    unlock: (masterPassword: string) => Promise<PasswordManagerStatus>;
    unlockWithOs: () => Promise<PasswordManagerStatus>;
    lock: () => Promise<PasswordManagerStatus>;
    list: (query?: string) => Promise<PasswordVaultItemDisplay[]>;
    create: (input: PasswordVaultItemInput) => Promise<PasswordVaultItemDisplay>;
    update: (itemId: string, input: PasswordVaultItemUpdate) => Promise<PasswordVaultItemDisplay>;
    delete: (itemId: string) => Promise<void>;
    duplicate: (itemId: string) => Promise<PasswordVaultItemDisplay>;
    generate: (options: PasswordGeneratorSettings) => Promise<string>;
    copyField: (itemId: string, field: "username" | "password") => Promise<void>;
    fill: (request: PasswordFillRequest) => Promise<PasswordFillResult>;
    health: () => Promise<PasswordHealthSummary>;
    importCsv: () => Promise<PasswordImportSummary | null>;
    exportBackup: (backupPassword: string) => Promise<PasswordBackupResult | null>;
    importBackup: (backupPassword: string) => Promise<PasswordImportSummary | null>;
    changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<void>;
    deleteVault: (masterPassword: string) => Promise<void>;
    onStatusChanged: (callback: (status: PasswordManagerStatus) => void) => Unsubscribe;
  };

  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  closeWindowWithBehavior: (discardSession: boolean) => Promise<void>;

  onStateChanged: (callback: (state: BrowserState) => void) => Unsubscribe;
  onFocusAddressBar: (callback: () => void) => Unsubscribe;
  onShortcutInvoked: (callback: (action: ShortcutAction) => void) => Unsubscribe;
  onFindInPageResult: (callback: (result: FindInPageResult) => void) => Unsubscribe;
  onCloseRequested: (callback: () => void) => Unsubscribe;
  onUpdateStatusChanged: (callback: (status: UpdateStatusSnapshot) => void) => Unsubscribe;
};
