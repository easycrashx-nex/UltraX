export type ThemeMode = "dark" | "light" | "system";

export type SearchEngine = "duckduckgo" | "google" | "bing" | "brave" | "custom";

export type StartupBehavior = "new-tab" | "restore-session" | "specific-pages";

export type HomeBehavior = "new-tab" | "custom-url";

export type ToolbarDensity = "compact" | "comfortable";

export type AccentColor = "blue" | "purple" | "cyan" | "green" | "rose" | "orange";

export type HistoryRetention = "forever" | "30-days" | "7-days";

export type DownloadRetention = "forever" | "30-days" | "session";

export type PermissionPolicy = "block" | "ask";

export type PerformanceMode = "efficiency" | "balanced" | "performance" | "ultra";

export type ShaderPerformance = "low" | "balanced" | "high" | "ultra";

export type ShaderFpsCap = "30" | "60" | "unlimited";

export type TabSuspendDelay = "5-minutes" | "15-minutes" | "30-minutes" | "1-hour" | "never";

export type UpdateChannel = "stable" | "beta" | "nightly";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export type UpdateSettings = {
  autoCheck: boolean;
  autoDownload: boolean;
  notifyWhenAvailable: boolean;
  channel: UpdateChannel;
  lastCheckedAt?: number;
};

export type UpdateDownloadProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type UpdateStatusSnapshot = {
  status: UpdateStatus;
  currentVersion: string;
  channel: UpdateChannel;
  updateAvailable: boolean;
  latestVersion?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  lastCheckedAt?: number;
  progress?: UpdateDownloadProgress;
  error?: string;
  source: "github-releases";
  releasesUrl: string;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
};

export type UltraXExtensionPermission =
  | "tabs"
  | "activeTab"
  | "storage"
  | "sidebar"
  | "notifications"
  | "downloads"
  | "bookmarks"
  | "history"
  | "settings"
  | "webNavigation"
  | "clipboard"
  | "contextMenus";

export type UltraXExtensionStatus = "enabled" | "disabled" | "error";

export type UltraXExtensionSource = "builtin" | "local";

export type ExtensionStoreProviderKind = "local" | "remote";

export type ExtensionInstallType = "builtin" | "local" | "remote";

export type UltraXExtensionManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  main?: string;
  background?: string;
  panel?: string;
  settings?: string;
  permissions: UltraXExtensionPermission[];
};

export type ExtensionRuntimeLogLevel = "info" | "warn" | "error";

export type ExtensionRuntimeLog = {
  id: string;
  extensionId: string;
  level: ExtensionRuntimeLogLevel;
  message: string;
  timestamp: number;
};

export type InstalledExtension = {
  id: string;
  manifest: UltraXExtensionManifest;
  source: UltraXExtensionSource;
  installPath?: string;
  enabled: boolean;
  developerMode: boolean;
  installedAt: number;
  updatedAt: number;
  status: UltraXExtensionStatus;
  errors: string[];
  validationWarnings: string[];
  runtimeLogs: ExtensionRuntimeLog[];
};

export type ExtensionStoreConfig = {
  provider: ExtensionStoreProviderKind;
  remoteUrl?: string;
};

export type ExtensionStoreItem = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  permissions: UltraXExtensionPermission[];
  source: UltraXExtensionSource;
  installType: ExtensionInstallType;
  installed: boolean;
  enabled: boolean;
  updateAvailable: boolean;
};

export type ExtensionValidationResult = {
  ok: boolean;
  manifest?: UltraXExtensionManifest;
  errors: string[];
  warnings: string[];
};

export type ExtensionPanelDescriptor = {
  extensionId: string;
  title: string;
  html: string;
  canReload: boolean;
};

export type ExtensionApiRequest = {
  requestId: string;
  method: string;
  args: unknown[];
};

export type ExtensionApiResponse = {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type SitePermissionKey =
  | "camera"
  | "microphone"
  | "location"
  | "notifications"
  | "popups"
  | "downloads"
  | "clipboard";

export type DownloadState =
  | "progressing"
  | "completed"
  | "cancelled"
  | "interrupted";

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isNewTab: boolean;
  error?: string;
};

export type Bookmark = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
};

export type HistoryEntry = {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
};

export type DownloadItem = {
  id: string;
  url: string;
  filename: string;
  savePath?: string;
  receivedBytes: number;
  totalBytes: number;
  state: DownloadState;
  startedAt: number;
  completedAt?: number;
};

export type BrowserSettings = {
  browserName: "UltraX";
  searchEngine: SearchEngine;
  customSearchUrl: string;
  searchSuggestions: boolean;
  addressBarSearch: boolean;
  startupBehavior: StartupBehavior;
  startupPages: string[];
  homeBehavior: HomeBehavior;
  homeUrl: string;
  theme: ThemeMode;
  glassMode: boolean;
  accentColor: AccentColor;
  toolbarDensity: ToolbarDensity;
  showBookmarksBar: boolean;
  showHomeButton: boolean;
  shaderEnabled: boolean;
  reducedMotion: boolean;
  restoreTabsOnLaunch: boolean;
  openTabsNextToCurrent: boolean;
  confirmBeforeClosingMultipleTabs: boolean;
  askWhereToSaveDownloads: boolean;
  downloadPath: string;
  downloadRetention: DownloadRetention;
  historyRetention: HistoryRetention;
  doNotTrack: boolean;
  blockThirdPartyCookies: boolean;
  permissionPolicy: Record<SitePermissionKey, PermissionPolicy>;
  hardwareAcceleration: boolean;
  performanceMode: PerformanceMode;
  backgroundShaderPerformance: ShaderPerformance;
  shaderFpsCap: ShaderFpsCap;
  pauseShaderWhenUnfocused: boolean;
  pauseShaderOnBatterySaver: boolean;
  disableShaderOnEfficiencyMode: boolean;
  reducedVisualEffects: boolean;
  preloadNewTab: boolean;
  keepNewTabWarm: boolean;
  lazyLoadQuickLinks: boolean;
  reduceNewTabAnimations: boolean;
  memorySaver: boolean;
  suspendInactiveTabs: boolean;
  suspendTabsAfter: TabSuspendDelay;
  keepPinnedTabsActive: boolean;
  keepAudioVideoTabsActive: boolean;
  keepDownloadsTabsActive: boolean;
  neverSuspendSites: string[];
  lazyRestoreSession: boolean;
  loadTabsOnDemand: boolean;
  restoreActiveTabOnly: boolean;
  keepRunningInBackground: boolean;
  continueDownloadsInBackground: boolean;
  reduceActivityWhenMinimized: boolean;
  backgroundUpdateChecks: boolean;
  preconnectFrequentSites: boolean;
  dnsPrefetching: boolean;
  pagePreloading: boolean;
  predictiveNavigation: boolean;
  reduceDataUsage: boolean;
  extensionDeveloperMode: boolean;
  extensionStore: ExtensionStoreConfig;
  updates: UpdateSettings;
  increaseContrast: boolean;
  textScale: "normal" | "large";
  pageZoom: number;
};

export type RuntimeMemoryInfo = {
  rssMB: number;
  heapTotalMB: number;
  heapUsedMB: number;
  externalMB: number;
};

export type RuntimeProcessInfo = {
  processCount: number;
  rendererProcessCount: number;
};

export type RuntimeInfo = {
  appName: string;
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  buildType: "development" | "packaged";
  userDataPath: string;
  memoryUsage: RuntimeMemoryInfo;
  processInfo: RuntimeProcessInfo;
  hardwareAccelerationEnabled: boolean;
  gpuFeatureStatus: Record<string, string>;
};

export type BrowserState = {
  tabs: BrowserTab[];
  activeTabId: string | null;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: DownloadItem[];
  installedExtensions: InstalledExtension[];
  extensionStorage: Record<string, Record<string, unknown>>;
  settings: BrowserSettings;
};

export type ViewInsets = {
  right: number;
  bottom: number;
};
