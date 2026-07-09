import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type {
  AccentColor,
  BrowserSettings,
  BrowserState,
  DownloadRetention,
  HistoryRetention,
  HomeBehavior,
  PerformanceMode,
  PermissionPolicy,
  SearchEngine,
  SearchSuggestionProvider,
  ShaderFpsCap,
  ShaderPerformance,
  SitePermissionKey,
  StartupBehavior,
  TabSuspendDelay,
  ThemeMode,
  ToolbarDensity,
  UpdateChannel,
} from "../shared/types";
import { ensureBuiltInExtensions } from "./extensions";

const STORAGE_VERSION = 5;

type StoredPayload = {
  version: number;
  state: BrowserState;
};

const SITE_PERMISSION_KEYS: SitePermissionKey[] = [
  "camera",
  "microphone",
  "location",
  "notifications",
  "popups",
  "downloads",
  "clipboard",
];

const DEFAULT_PERMISSION_POLICY: Record<SitePermissionKey, PermissionPolicy> = {
  camera: "block",
  microphone: "block",
  location: "block",
  notifications: "block",
  popups: "block",
  downloads: "ask",
  clipboard: "block",
};

const DEFAULT_UPDATE_SETTINGS: BrowserSettings["updates"] = {
  autoCheck: true,
  autoDownload: false,
  notifyWhenAvailable: true,
  channel: "stable",
};

const DEFAULT_SEARCH_SUGGESTION_SETTINGS: BrowserSettings["searchSuggestionSettings"] = {
  localSuggestions: true,
  historySuggestions: true,
  bookmarkSuggestions: true,
  openTabSuggestions: true,
  onlineSuggestions: false,
  suggestionProvider: "current-search-engine",
};

export const DEFAULT_SETTINGS: BrowserSettings = {
  browserName: "UltraX",
  searchEngine: "duckduckgo",
  customSearchUrl: "https://duckduckgo.com/?q={query}",
  searchSuggestions: true,
  searchSuggestionSettings: DEFAULT_SEARCH_SUGGESTION_SETTINGS,
  addressBarSearch: true,
  startupBehavior: "restore-session",
  startupPages: [],
  homeBehavior: "new-tab",
  homeUrl: "https://duckduckgo.com/",
  theme: "dark",
  glassMode: true,
  accentColor: "blue",
  toolbarDensity: "comfortable",
  showBookmarksBar: true,
  showHomeButton: true,
  shaderEnabled: true,
  reducedMotion: false,
  restoreTabsOnLaunch: true,
  openTabsNextToCurrent: false,
  confirmBeforeClosingMultipleTabs: true,
  askWhereToSaveDownloads: false,
  downloadPath: "",
  downloadRetention: "forever",
  historyRetention: "forever",
  doNotTrack: false,
  blockThirdPartyCookies: false,
  permissionPolicy: DEFAULT_PERMISSION_POLICY,
  hardwareAcceleration: true,
  performanceMode: "balanced",
  backgroundShaderPerformance: "balanced",
  shaderFpsCap: "60",
  pauseShaderWhenUnfocused: true,
  pauseShaderOnBatterySaver: true,
  disableShaderOnEfficiencyMode: true,
  reducedVisualEffects: false,
  preloadNewTab: true,
  keepNewTabWarm: false,
  lazyLoadQuickLinks: true,
  reduceNewTabAnimations: false,
  memorySaver: false,
  suspendInactiveTabs: false,
  suspendTabsAfter: "30-minutes",
  keepPinnedTabsActive: true,
  keepAudioVideoTabsActive: true,
  keepDownloadsTabsActive: true,
  neverSuspendSites: [],
  lazyRestoreSession: true,
  loadTabsOnDemand: true,
  restoreActiveTabOnly: true,
  keepRunningInBackground: false,
  continueDownloadsInBackground: false,
  reduceActivityWhenMinimized: true,
  backgroundUpdateChecks: true,
  preconnectFrequentSites: true,
  dnsPrefetching: true,
  pagePreloading: false,
  predictiveNavigation: false,
  reduceDataUsage: false,
  extensionDeveloperMode: false,
  extensionStore: {
    provider: "local",
  },
  updates: DEFAULT_UPDATE_SETTINGS,
  increaseContrast: false,
  textScale: "normal",
  pageZoom: 1,
};

export function createDefaultState(): BrowserState {
  return {
    tabs: [],
    activeTabId: null,
    bookmarks: [],
    history: [],
    downloads: [],
    installedExtensions: ensureBuiltInExtensions([]),
    extensionStorage: {
      "ultrax-notes-sidebar": {
        notes: "",
      },
    },
    settings: DEFAULT_SETTINGS,
  };
}

export class StorageService {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "ultrax-state.json");
  }

  load(): BrowserState {
    if (!fs.existsSync(this.filePath)) {
      return createDefaultState();
    }

    try {
      const payload = JSON.parse(
        fs.readFileSync(this.filePath, "utf8"),
      ) as Partial<StoredPayload>;

      return normalizeState(payload.state);
    } catch {
      return createDefaultState();
    }
  }

  save(state: BrowserState): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      state: normalizeState(state),
    };

    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(temporaryPath, this.filePath);
  }
}

function normalizeState(state?: Partial<BrowserState>): BrowserState {
  const defaults = createDefaultState();
  const settings = normalizeSettings(state?.settings);

  return {
    tabs: Array.isArray(state?.tabs) ? state.tabs : defaults.tabs,
    activeTabId:
      typeof state?.activeTabId === "string" ? state.activeTabId : defaults.activeTabId,
    bookmarks: Array.isArray(state?.bookmarks)
      ? state.bookmarks.slice(0, 500)
      : defaults.bookmarks,
    history: Array.isArray(state?.history)
      ? state.history.slice(0, 1000)
      : defaults.history,
    downloads: Array.isArray(state?.downloads)
      ? state.downloads.slice(0, 50)
      : defaults.downloads,
    installedExtensions: ensureBuiltInExtensions(state?.installedExtensions),
    extensionStorage:
      state?.extensionStorage === undefined
        ? defaults.extensionStorage
        : normalizeExtensionStorage(state.extensionStorage),
    settings,
  };
}

function normalizeSettings(settings?: Partial<BrowserSettings>): BrowserSettings {
  const legacySettings = settings as
    | { homeBehavior?: HomeBehavior | "last-session" }
    | undefined;
  const legacyHomeBehavior = legacySettings?.homeBehavior;

  const startupBehavior =
    legacyHomeBehavior === "last-session"
      ? "restore-session"
      : enumValue<StartupBehavior>(settings?.startupBehavior, [
          "new-tab",
          "restore-session",
          "specific-pages",
        ]) ?? DEFAULT_SETTINGS.startupBehavior;

  const permissionPolicy = { ...DEFAULT_PERMISSION_POLICY };
  for (const key of SITE_PERMISSION_KEYS) {
    const value = settings?.permissionPolicy?.[key];
    if (value === "ask" || value === "block") {
      permissionPolicy[key] = value;
    }
  }

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    browserName: "UltraX",
    searchEngine:
      enumValue<SearchEngine>(settings?.searchEngine, [
        "duckduckgo",
        "google",
        "bing",
        "brave",
        "custom",
      ]) ?? DEFAULT_SETTINGS.searchEngine,
    customSearchUrl: safeString(settings?.customSearchUrl, 512, DEFAULT_SETTINGS.customSearchUrl),
    searchSuggestions: boolValue(settings?.searchSuggestions, DEFAULT_SETTINGS.searchSuggestions),
    searchSuggestionSettings: normalizeSearchSuggestionSettings(
      settings?.searchSuggestionSettings,
    ),
    addressBarSearch: boolValue(settings?.addressBarSearch, DEFAULT_SETTINGS.addressBarSearch),
    startupBehavior,
    startupPages: Array.isArray(settings?.startupPages)
      ? settings.startupPages.filter((item) => typeof item === "string").slice(0, 12)
      : DEFAULT_SETTINGS.startupPages,
    homeBehavior:
      enumValue<HomeBehavior>(legacyHomeBehavior, ["new-tab", "custom-url"]) ??
      DEFAULT_SETTINGS.homeBehavior,
    homeUrl: safeString(settings?.homeUrl, 512, DEFAULT_SETTINGS.homeUrl),
    theme:
      enumValue<ThemeMode>(settings?.theme, ["dark", "light", "system"]) ??
      DEFAULT_SETTINGS.theme,
    glassMode: boolValue(settings?.glassMode, DEFAULT_SETTINGS.glassMode),
    accentColor:
      enumValue<AccentColor>(settings?.accentColor, [
        "blue",
        "purple",
        "cyan",
        "green",
        "rose",
        "orange",
      ]) ?? DEFAULT_SETTINGS.accentColor,
    toolbarDensity:
      enumValue<ToolbarDensity>(settings?.toolbarDensity, ["compact", "comfortable"]) ??
      DEFAULT_SETTINGS.toolbarDensity,
    showBookmarksBar: boolValue(settings?.showBookmarksBar, DEFAULT_SETTINGS.showBookmarksBar),
    showHomeButton: boolValue(settings?.showHomeButton, DEFAULT_SETTINGS.showHomeButton),
    shaderEnabled: boolValue(settings?.shaderEnabled, DEFAULT_SETTINGS.shaderEnabled),
    reducedMotion: boolValue(settings?.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    restoreTabsOnLaunch: boolValue(
      settings?.restoreTabsOnLaunch,
      DEFAULT_SETTINGS.restoreTabsOnLaunch,
    ),
    openTabsNextToCurrent: boolValue(
      settings?.openTabsNextToCurrent,
      DEFAULT_SETTINGS.openTabsNextToCurrent,
    ),
    confirmBeforeClosingMultipleTabs: boolValue(
      settings?.confirmBeforeClosingMultipleTabs,
      DEFAULT_SETTINGS.confirmBeforeClosingMultipleTabs,
    ),
    askWhereToSaveDownloads: boolValue(
      settings?.askWhereToSaveDownloads,
      DEFAULT_SETTINGS.askWhereToSaveDownloads,
    ),
    downloadPath: safeString(settings?.downloadPath, 1024, DEFAULT_SETTINGS.downloadPath),
    downloadRetention:
      enumValue<DownloadRetention>(settings?.downloadRetention, [
        "forever",
        "30-days",
        "session",
      ]) ?? DEFAULT_SETTINGS.downloadRetention,
    historyRetention:
      enumValue<HistoryRetention>(settings?.historyRetention, [
        "forever",
        "30-days",
        "7-days",
      ]) ?? DEFAULT_SETTINGS.historyRetention,
    doNotTrack: boolValue(settings?.doNotTrack, DEFAULT_SETTINGS.doNotTrack),
    blockThirdPartyCookies: boolValue(
      settings?.blockThirdPartyCookies,
      DEFAULT_SETTINGS.blockThirdPartyCookies,
    ),
    permissionPolicy,
    hardwareAcceleration: boolValue(
      settings?.hardwareAcceleration,
      DEFAULT_SETTINGS.hardwareAcceleration,
    ),
    performanceMode:
      enumValue<PerformanceMode>(settings?.performanceMode, [
        "efficiency",
        "balanced",
        "performance",
        "ultra",
      ]) ?? DEFAULT_SETTINGS.performanceMode,
    backgroundShaderPerformance: normalizeShaderPerformance(
      settings?.backgroundShaderPerformance,
    ),
    shaderFpsCap:
      enumValue<ShaderFpsCap>(settings?.shaderFpsCap, ["30", "60", "unlimited"]) ??
      DEFAULT_SETTINGS.shaderFpsCap,
    pauseShaderWhenUnfocused: boolValue(
      settings?.pauseShaderWhenUnfocused,
      DEFAULT_SETTINGS.pauseShaderWhenUnfocused,
    ),
    pauseShaderOnBatterySaver: boolValue(
      settings?.pauseShaderOnBatterySaver,
      DEFAULT_SETTINGS.pauseShaderOnBatterySaver,
    ),
    disableShaderOnEfficiencyMode: boolValue(
      settings?.disableShaderOnEfficiencyMode,
      DEFAULT_SETTINGS.disableShaderOnEfficiencyMode,
    ),
    reducedVisualEffects: boolValue(
      settings?.reducedVisualEffects,
      DEFAULT_SETTINGS.reducedVisualEffects,
    ),
    preloadNewTab: boolValue(settings?.preloadNewTab, DEFAULT_SETTINGS.preloadNewTab),
    keepNewTabWarm: boolValue(settings?.keepNewTabWarm, DEFAULT_SETTINGS.keepNewTabWarm),
    lazyLoadQuickLinks: boolValue(settings?.lazyLoadQuickLinks, DEFAULT_SETTINGS.lazyLoadQuickLinks),
    reduceNewTabAnimations: boolValue(
      settings?.reduceNewTabAnimations,
      DEFAULT_SETTINGS.reduceNewTabAnimations,
    ),
    memorySaver: boolValue(settings?.memorySaver, DEFAULT_SETTINGS.memorySaver),
    suspendInactiveTabs: boolValue(
      settings?.suspendInactiveTabs,
      DEFAULT_SETTINGS.suspendInactiveTabs,
    ),
    suspendTabsAfter:
      enumValue<TabSuspendDelay>(settings?.suspendTabsAfter, [
        "5-minutes",
        "15-minutes",
        "30-minutes",
        "1-hour",
        "never",
      ]) ?? DEFAULT_SETTINGS.suspendTabsAfter,
    keepPinnedTabsActive: boolValue(
      settings?.keepPinnedTabsActive,
      DEFAULT_SETTINGS.keepPinnedTabsActive,
    ),
    keepAudioVideoTabsActive: boolValue(
      settings?.keepAudioVideoTabsActive,
      DEFAULT_SETTINGS.keepAudioVideoTabsActive,
    ),
    keepDownloadsTabsActive: boolValue(
      settings?.keepDownloadsTabsActive,
      DEFAULT_SETTINGS.keepDownloadsTabsActive,
    ),
    neverSuspendSites: Array.isArray(settings?.neverSuspendSites)
      ? settings.neverSuspendSites
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 24)
      : DEFAULT_SETTINGS.neverSuspendSites,
    lazyRestoreSession: boolValue(
      settings?.lazyRestoreSession,
      DEFAULT_SETTINGS.lazyRestoreSession,
    ),
    loadTabsOnDemand: boolValue(settings?.loadTabsOnDemand, DEFAULT_SETTINGS.loadTabsOnDemand),
    restoreActiveTabOnly: boolValue(
      settings?.restoreActiveTabOnly,
      DEFAULT_SETTINGS.restoreActiveTabOnly,
    ),
    keepRunningInBackground: boolValue(
      settings?.keepRunningInBackground,
      DEFAULT_SETTINGS.keepRunningInBackground,
    ),
    continueDownloadsInBackground: boolValue(
      settings?.continueDownloadsInBackground,
      DEFAULT_SETTINGS.continueDownloadsInBackground,
    ),
    reduceActivityWhenMinimized: boolValue(
      settings?.reduceActivityWhenMinimized,
      DEFAULT_SETTINGS.reduceActivityWhenMinimized,
    ),
    backgroundUpdateChecks: boolValue(
      settings?.backgroundUpdateChecks,
      DEFAULT_SETTINGS.backgroundUpdateChecks,
    ),
    preconnectFrequentSites: boolValue(
      settings?.preconnectFrequentSites,
      DEFAULT_SETTINGS.preconnectFrequentSites,
    ),
    dnsPrefetching: boolValue(settings?.dnsPrefetching, DEFAULT_SETTINGS.dnsPrefetching),
    pagePreloading: boolValue(settings?.pagePreloading, DEFAULT_SETTINGS.pagePreloading),
    predictiveNavigation: boolValue(
      settings?.predictiveNavigation,
      DEFAULT_SETTINGS.predictiveNavigation,
    ),
    reduceDataUsage: boolValue(settings?.reduceDataUsage, DEFAULT_SETTINGS.reduceDataUsage),
    extensionDeveloperMode: boolValue(
      settings?.extensionDeveloperMode,
      DEFAULT_SETTINGS.extensionDeveloperMode,
    ),
    extensionStore: normalizeExtensionStoreConfig(settings?.extensionStore),
    updates: normalizeUpdateSettings(settings?.updates),
    increaseContrast: boolValue(settings?.increaseContrast, DEFAULT_SETTINGS.increaseContrast),
    textScale: enumValue(settings?.textScale, ["normal", "large"]) ?? DEFAULT_SETTINGS.textScale,
    pageZoom:
      Number.isFinite(settings?.pageZoom) && settings?.pageZoom
        ? Math.max(0.67, Math.min(1.5, Number(settings.pageZoom)))
        : DEFAULT_SETTINGS.pageZoom,
  };
}

function normalizeSearchSuggestionSettings(
  value: unknown,
): BrowserSettings["searchSuggestionSettings"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_SETTINGS.searchSuggestionSettings;
  }

  const candidate = value as Partial<BrowserSettings["searchSuggestionSettings"]>;
  const suggestionProvider =
    enumValue<SearchSuggestionProvider>(candidate.suggestionProvider, [
      "current-search-engine",
      "google",
      "duckduckgo",
      "none",
    ]) ?? DEFAULT_SETTINGS.searchSuggestionSettings.suggestionProvider;

  return {
    localSuggestions: boolValue(
      candidate.localSuggestions,
      DEFAULT_SETTINGS.searchSuggestionSettings.localSuggestions,
    ),
    historySuggestions: boolValue(
      candidate.historySuggestions,
      DEFAULT_SETTINGS.searchSuggestionSettings.historySuggestions,
    ),
    bookmarkSuggestions: boolValue(
      candidate.bookmarkSuggestions,
      DEFAULT_SETTINGS.searchSuggestionSettings.bookmarkSuggestions,
    ),
    openTabSuggestions: boolValue(
      candidate.openTabSuggestions,
      DEFAULT_SETTINGS.searchSuggestionSettings.openTabSuggestions,
    ),
    onlineSuggestions: boolValue(
      candidate.onlineSuggestions,
      DEFAULT_SETTINGS.searchSuggestionSettings.onlineSuggestions,
    ),
    suggestionProvider,
  };
}

function normalizeUpdateSettings(value: unknown): BrowserSettings["updates"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_SETTINGS.updates;
  }

  const candidate = value as Partial<BrowserSettings["updates"]>;
  const channel =
    enumValue<UpdateChannel>(candidate.channel, ["stable", "beta", "nightly"]) ??
    DEFAULT_SETTINGS.updates.channel;
  const lastCheckedAt =
    Number.isFinite(candidate.lastCheckedAt) && candidate.lastCheckedAt
      ? Number(candidate.lastCheckedAt)
      : undefined;

  return {
    autoCheck: boolValue(candidate.autoCheck, DEFAULT_SETTINGS.updates.autoCheck),
    autoDownload: boolValue(candidate.autoDownload, DEFAULT_SETTINGS.updates.autoDownload),
    notifyWhenAvailable: boolValue(
      candidate.notifyWhenAvailable,
      DEFAULT_SETTINGS.updates.notifyWhenAvailable,
    ),
    channel,
    ...(lastCheckedAt ? { lastCheckedAt } : {}),
  };
}

function normalizeExtensionStorage(value: unknown): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const [extensionId, storageValue] of Object.entries(value)) {
    if (
      !/^[a-z0-9][a-z0-9-_.]{2,79}$/.test(extensionId) ||
      !storageValue ||
      typeof storageValue !== "object" ||
      Array.isArray(storageValue)
    ) {
      continue;
    }

    result[extensionId] = Object.fromEntries(
      Object.entries(storageValue).filter(([key]) => key.length <= 80).slice(0, 100),
    );
  }

  return result;
}

function normalizeExtensionStoreConfig(value: unknown): BrowserSettings["extensionStore"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_SETTINGS.extensionStore;
  }

  const candidate = value as Partial<BrowserSettings["extensionStore"]>;
  const provider = candidate.provider === "remote" ? "remote" : "local";
  const remoteUrl = safeString(candidate.remoteUrl, 512, "");

  return remoteUrl ? { provider, remoteUrl } : { provider };
}

function normalizeShaderPerformance(value: unknown): ShaderPerformance {
  if (value === "battery") {
    return "low";
  }

  if (value === "quality") {
    return "high";
  }

  return (
    enumValue<ShaderPerformance>(value, ["low", "balanced", "high", "ultra"]) ??
    DEFAULT_SETTINGS.backgroundShaderPerformance
  );
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function safeString(value: unknown, maxLength: number, fallback: string): string {
  return typeof value === "string" && value.length <= maxLength ? value : fallback;
}
