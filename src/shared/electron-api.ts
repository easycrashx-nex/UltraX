import type {
  BrowserSettings,
  BrowserState,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  ExtensionValidationResult,
  InstalledExtension,
  RuntimeInfo,
  UpdateStatusSnapshot,
  ViewInsets,
} from "./types";

export type Unsubscribe = () => void;

export type UltraXApi = {
  getState: () => Promise<BrowserState>;
  setViewInsets: (insets: ViewInsets) => Promise<void>;

  createTab: () => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  duplicateTab: (tabId: string) => Promise<void>;
  pinTab: (tabId: string, pinned: boolean) => Promise<void>;
  reorderTab: (tabId: string, targetTabId: string) => Promise<void>;
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

  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  closeWindowWithBehavior: (discardSession: boolean) => Promise<void>;

  onStateChanged: (callback: (state: BrowserState) => void) => Unsubscribe;
  onFocusAddressBar: (callback: () => void) => Unsubscribe;
  onCloseRequested: (callback: () => void) => Unsubscribe;
  onUpdateStatusChanged: (callback: (status: UpdateStatusSnapshot) => void) => Unsubscribe;
};
