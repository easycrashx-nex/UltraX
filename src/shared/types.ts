import type { PasswordManagerSettings } from "./password-manager";

export type ThemeMode = "dark" | "light" | "system";

export type SearchEngine = "duckduckgo" | "google" | "bing" | "brave" | "custom";

export type SearchSuggestionProvider =
  | "current-search-engine"
  | "google"
  | "duckduckgo"
  | "none";

export type SearchSuggestionSettings = {
  localSuggestions: boolean;
  historySuggestions: boolean;
  bookmarkSuggestions: boolean;
  openTabSuggestions: boolean;
  onlineSuggestions: boolean;
  suggestionProvider: SearchSuggestionProvider;
};

export type StartupBehavior = "new-tab" | "restore-session" | "specific-pages";

export type CloseBehavior =
  | "ask-before-closing-multiple-tabs"
  | "close-and-restore-session"
  | "close-and-discard-session";

export type HomeBehavior = "new-tab" | "custom-url";

export type InterfaceDensity = "compact" | "comfortable" | "spacious";

export type ToolbarDensity = InterfaceDensity;

export type AccentColor = "blue" | "purple" | "cyan" | "green" | "rose" | "orange";

export type CornerRadius = "subtle" | "rounded" | "ultra-rounded";

export type BlurIntensity = "low" | "balanced" | "high";

export type PanelTransparency = "low" | "balanced" | "high";

export type AnimationLevel = "minimal" | "balanced" | "expressive";

export type NewTabBackground =
  | "ultrax-wave"
  | "aurora"
  | "gradient-mesh"
  | "minimal-dark"
  | "solid-color"
  | "custom-image";

export type ShaderPreset =
  | "ultrax-wave"
  | "blue-nebula"
  | "purple-flow"
  | "aurora-lines"
  | "calm-grid";

export type ShaderIntensity = "low" | "balanced" | "high";

export type ShaderSpeed = "slow" | "normal" | "fast";

export type HistoryRetention = "forever" | "30-days" | "7-days";

export type DownloadRetention = "forever" | "30-days" | "session";

export type PermissionPolicy = "block" | "ask" | "allow";

export type PermissionException = {
  id: string;
  origin: string;
  permission: SitePermissionKey;
  policy: PermissionPolicy;
  updatedAt: number;
};

export type PerformanceMode = "efficiency" | "balanced" | "performance" | "ultra";

export type ShaderPerformance = "low" | "balanced" | "high" | "ultra";

export type ShaderFpsCap = "30" | "60" | "unlimited";

export type TabSuspendDelay = "5-minutes" | "15-minutes" | "30-minutes" | "1-hour" | "never";

export type TabReorderPlacement = "before" | "after";

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
  releaseUrl?: string;
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

export type ExtensionsWorkspaceInfo = {
  root: string;
  installed: string;
  unpacked: string;
  samples: string;
  storage: string;
  logs: string;
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
  | "clipboard"
  | "autoplay"
  | "javascript"
  | "images";

export type FocusRingVisibility = "subtle" | "standard" | "high";

export type TextScale = "small" | "default" | "large" | "extra-large";

export type ShortcutAction =
  | "focusAddressBar"
  | "newTab"
  | "closeTab"
  | "reopenClosedTab"
  | "nextTab"
  | "previousTab"
  | "reload"
  | "hardReload"
  | "back"
  | "forward"
  | "toggleBookmark"
  | "toggleBookmarksBar"
  | "openHistory"
  | "openDownloads"
  | "findInPage"
  | "openSettings"
  | "clearBrowsingData";

export type ShortcutOverrides = Partial<Record<ShortcutAction, string[]>>;

export type FindInPageOptions = {
  forward?: boolean;
  findNext?: boolean;
  matchCase?: boolean;
};

export type FindInPageResult = {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
};

export type BookmarkDuplicatePolicy = "skip" | "keep";

export type BookmarkImportSummary = {
  imported: number;
  skippedDuplicates: number;
  failed: number;
};

export type PrivacyClearTimeRange = "last-hour" | "last-24-hours" | "last-7-days" | "all-time";

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
  isPinned?: boolean;
  isMuted?: boolean;
  isAudible?: boolean;
  error?: string;
};

export type BrowserWindowBounds = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type BrowserWindowSession = {
  id: string;
  tabs: BrowserTab[];
  activeTabId: string | null;
  bounds?: BrowserWindowBounds;
};

export type Bookmark = {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  folderPath?: string[];
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
  searchSuggestionSettings: SearchSuggestionSettings;
  addressBarSearch: boolean;
  startupBehavior: StartupBehavior;
  startupPages: string[];
  closeBehavior: CloseBehavior;
  homeBehavior: HomeBehavior;
  homeUrl: string;
  theme: ThemeMode;
  glassMode: boolean;
  accentColor: AccentColor;
  toolbarDensity: ToolbarDensity;
  cornerRadius: CornerRadius;
  blurIntensity: BlurIntensity;
  panelTransparency: PanelTransparency;
  animationLevel: AnimationLevel;
  newTabBackground: NewTabBackground;
  newTabSolidColor: string;
  newTabCustomImagePath: string;
  shaderPreset: ShaderPreset;
  shaderIntensity: ShaderIntensity;
  shaderSpeed: ShaderSpeed;
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
  sitePermissionExceptions: PermissionException[];
  safeBrowsing: boolean;
  alwaysUseSecureConnections: boolean;
  blockInsecureContent: boolean;
  warnDangerousDownloads: boolean;
  reviewExtensionPermissions: boolean;
  blockUnsignedRemoteExtensions: boolean;
  privacyClearTimeRange: PrivacyClearTimeRange;
  clearHistoryOnClose: boolean;
  clearCacheOnClose: boolean;
  clearDownloadsOnClose: boolean;
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
  reduceTransparency: boolean;
  focusRingVisibility: FocusRingVisibility;
  textScale: TextScale;
  alwaysShowFocusIndicators: boolean;
  tabThroughToolbarControls: boolean;
  underlineLinks: boolean;
  readableFontSmoothing: boolean;
  pageZoom: number;
  tabHoverPreview: boolean;
  shortcutOverrides: ShortcutOverrides;
  passwordManager: PasswordManagerSettings;
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
  windowId: string;
  tabs: BrowserTab[];
  activeTabId: string | null;
  windows: BrowserWindowSession[];
  lastActiveWindowId?: string;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: DownloadItem[];
  installedExtensions: InstalledExtension[];
  extensionStorage: Record<string, Record<string, unknown>>;
  settings: BrowserSettings;
};

export type ViewInsets = {
  top: number;
  right: number;
  bottom: number;
};
