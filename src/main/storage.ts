import { app } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AccentColor,
  BrowserSettings,
  BrowserState,
  BrowserTab,
  BrowserWindowBounds,
  BrowserWindowSession,
  BlurIntensity,
  CloseBehavior,
  CornerRadius,
  DownloadRetention,
  HistoryRetention,
  HomeBehavior,
  InterfaceDensity,
  AnimationLevel,
  NewTabBackground,
  PanelTransparency,
  PerformanceMode,
  PermissionPolicy,
  SearchEngine,
  SearchSuggestionProvider,
  ShaderFpsCap,
  ShaderIntensity,
  ShaderPerformance,
  ShaderPreset,
  ShaderSpeed,
  SitePermissionKey,
  StartupBehavior,
  TabSuspendDelay,
  ThemeMode,
  UpdateChannel,
} from "../shared/types";
import { normalizeShortcutOverrides } from "../shared/shortcuts";
import { ensureBuiltInExtensions } from "./extensions";

const STORAGE_VERSION = 8;

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
  "autoplay",
  "javascript",
  "images",
];

const DEFAULT_PERMISSION_POLICY: Record<SitePermissionKey, PermissionPolicy> = {
  camera: "ask",
  microphone: "ask",
  location: "ask",
  notifications: "ask",
  downloads: "ask",
  clipboard: "ask",
  popups: "block",
  autoplay: "block",
  javascript: "allow",
  images: "allow",
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
  onlineSuggestions: true,
  suggestionProvider: "google",
};

export const DEFAULT_SETTINGS: BrowserSettings = {
  browserName: "UltraX",
  searchEngine: "google",
  customSearchUrl: "",
  searchSuggestions: true,
  searchSuggestionSettings: DEFAULT_SEARCH_SUGGESTION_SETTINGS,
  addressBarSearch: true,
  startupBehavior: "restore-session",
  startupPages: [],
  closeBehavior: "close-and-restore-session",
  homeBehavior: "new-tab",
  homeUrl: "https://google.com",
  theme: "dark",
  glassMode: true,
  accentColor: "blue",
  toolbarDensity: "comfortable",
  cornerRadius: "rounded",
  blurIntensity: "balanced",
  panelTransparency: "balanced",
  animationLevel: "balanced",
  newTabBackground: "ultrax-wave",
  newTabSolidColor: "#050608",
  newTabCustomImagePath: "",
  shaderPreset: "ultrax-wave",
  shaderIntensity: "balanced",
  shaderSpeed: "normal",
  showBookmarksBar: true,
  showHomeButton: true,
  shaderEnabled: true,
  reducedMotion: false,
  restoreTabsOnLaunch: true,
  openTabsNextToCurrent: false,
  confirmBeforeClosingMultipleTabs: false,
  askWhereToSaveDownloads: false,
  downloadPath: "",
  downloadRetention: "forever",
  historyRetention: "forever",
  doNotTrack: false,
  blockThirdPartyCookies: false,
  permissionPolicy: DEFAULT_PERMISSION_POLICY,
  sitePermissionExceptions: [],
  safeBrowsing: true,
  alwaysUseSecureConnections: true,
  blockInsecureContent: true,
  warnDangerousDownloads: true,
  reviewExtensionPermissions: true,
  blockUnsignedRemoteExtensions: true,
  privacyClearTimeRange: "all-time",
  clearHistoryOnClose: false,
  clearCacheOnClose: false,
  clearDownloadsOnClose: false,
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
  reduceTransparency: false,
  focusRingVisibility: "standard",
  textScale: "default",
  alwaysShowFocusIndicators: true,
  tabThroughToolbarControls: true,
  underlineLinks: false,
  readableFontSmoothing: true,
  pageZoom: 1,
  tabHoverPreview: true,
  shortcutOverrides: {},
  passwordManager: {
    offerAutofill: true,
    autofillUsername: true,
    autoLockMinutes: 15,
    lockOnAppClose: true,
    lockOnAllWindowsClosed: true,
    lockOnScreenLock: true,
    lockOnSleep: true,
    clipboardClearSeconds: 30,
    generator: {
      length: 20,
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: true,
      avoidAmbiguous: true,
    },
  },
};

export function createDefaultState(): BrowserState {
  const windowId = randomUUID();
  return {
    windowId,
    tabs: [],
    activeTabId: null,
    windows: [],
    lastActiveWindowId: windowId,
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
    this.writeState(state);
  }

  saveWindowState(
    windowId: string,
    state: BrowserState,
    bounds?: BrowserWindowBounds,
  ): void {
    const current = this.load();
    const session: BrowserWindowSession = {
      id: windowId,
      tabs: normalizeTabs(state.tabs),
      activeTabId:
        typeof state.activeTabId === "string" &&
        state.tabs.some((tab) => tab.id === state.activeTabId)
          ? state.activeTabId
          : state.tabs[0]?.id ?? null,
      ...(bounds ? { bounds: normalizeWindowBounds(bounds) } : {}),
    };
    const windows = [
      ...current.windows.filter((windowSession) => windowSession.id !== windowId),
      session,
    ].slice(-12);

    this.writeState({
      ...current,
      bookmarks: state.bookmarks,
      history: state.history,
      downloads: state.downloads,
      installedExtensions: state.installedExtensions,
      extensionStorage: state.extensionStorage,
      settings: state.settings,
      windowId,
      tabs: session.tabs,
      activeTabId: session.activeTabId,
      windows,
      lastActiveWindowId: windowId,
    });
  }

  removeWindowState(windowId: string): void {
    const current = this.load();
    const windows = current.windows.filter((windowSession) => windowSession.id !== windowId);
    const fallback = windows.find((session) => session.id === current.lastActiveWindowId) ?? windows[0];
    this.writeState({
      ...current,
      windowId: fallback?.id ?? current.windowId,
      tabs: fallback?.tabs ?? [],
      activeTabId: fallback?.activeTabId ?? null,
      windows,
      lastActiveWindowId: fallback?.id,
    });
  }

  private writeState(state: BrowserState): void {
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
  const windows = normalizeWindowSessions(state?.windows);
  const fallbackWindow =
    windows.find((windowSession) => windowSession.id === state?.lastActiveWindowId) ??
    windows[0];
  const tabs = normalizeTabs(state?.tabs);
  const activeTabId =
    typeof state?.activeTabId === "string" && tabs.some((tab) => tab.id === state.activeTabId)
      ? state.activeTabId
      : tabs[0]?.id ?? fallbackWindow?.activeTabId ?? defaults.activeTabId;

  return {
    windowId:
      typeof state?.windowId === "string" && state.windowId
        ? state.windowId
        : fallbackWindow?.id ?? defaults.windowId,
    tabs: tabs.length > 0 ? tabs : fallbackWindow?.tabs ?? defaults.tabs,
    activeTabId,
    windows,
    lastActiveWindowId:
      typeof state?.lastActiveWindowId === "string"
        ? state.lastActiveWindowId
        : fallbackWindow?.id ?? defaults.lastActiveWindowId,
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
    | { homeBehavior?: HomeBehavior | "last-session"; textScale?: BrowserSettings["textScale"] | "normal" }
    | undefined;
  const legacyHomeBehavior = legacySettings?.homeBehavior;
  const legacyTextScale = legacySettings?.textScale;

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
    if (value === "ask" || value === "block" || value === "allow") {
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
    closeBehavior:
      enumValue<CloseBehavior>(settings?.closeBehavior, [
        "ask-before-closing-multiple-tabs",
        "close-and-restore-session",
        "close-and-discard-session",
      ]) ?? DEFAULT_SETTINGS.closeBehavior,
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
      enumValue<InterfaceDensity>(settings?.toolbarDensity, [
        "compact",
        "comfortable",
        "spacious",
      ]) ??
      DEFAULT_SETTINGS.toolbarDensity,
    cornerRadius:
      enumValue<CornerRadius>(settings?.cornerRadius, [
        "subtle",
        "rounded",
        "ultra-rounded",
      ]) ?? DEFAULT_SETTINGS.cornerRadius,
    blurIntensity:
      enumValue<BlurIntensity>(settings?.blurIntensity, ["low", "balanced", "high"]) ??
      DEFAULT_SETTINGS.blurIntensity,
    panelTransparency:
      enumValue<PanelTransparency>(settings?.panelTransparency, [
        "low",
        "balanced",
        "high",
      ]) ?? DEFAULT_SETTINGS.panelTransparency,
    animationLevel:
      enumValue<AnimationLevel>(settings?.animationLevel, [
        "minimal",
        "balanced",
        "expressive",
      ]) ?? DEFAULT_SETTINGS.animationLevel,
    newTabBackground:
      enumValue<NewTabBackground>(settings?.newTabBackground, [
        "ultrax-wave",
        "aurora",
        "gradient-mesh",
        "minimal-dark",
        "solid-color",
        "custom-image",
      ]) ?? DEFAULT_SETTINGS.newTabBackground,
    newTabSolidColor: normalizeHexColor(
      settings?.newTabSolidColor,
      DEFAULT_SETTINGS.newTabSolidColor,
    ),
    newTabCustomImagePath: safeString(
      settings?.newTabCustomImagePath,
      1024,
      DEFAULT_SETTINGS.newTabCustomImagePath,
    ),
    shaderPreset:
      enumValue<ShaderPreset>(settings?.shaderPreset, [
        "ultrax-wave",
        "blue-nebula",
        "purple-flow",
        "aurora-lines",
        "calm-grid",
      ]) ?? DEFAULT_SETTINGS.shaderPreset,
    shaderIntensity:
      enumValue<ShaderIntensity>(settings?.shaderIntensity, ["low", "balanced", "high"]) ??
      DEFAULT_SETTINGS.shaderIntensity,
    shaderSpeed:
      enumValue<ShaderSpeed>(settings?.shaderSpeed, ["slow", "normal", "fast"]) ??
      DEFAULT_SETTINGS.shaderSpeed,
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
    sitePermissionExceptions: normalizePermissionExceptions(settings?.sitePermissionExceptions),
    safeBrowsing: boolValue(settings?.safeBrowsing, DEFAULT_SETTINGS.safeBrowsing),
    alwaysUseSecureConnections: boolValue(
      settings?.alwaysUseSecureConnections,
      DEFAULT_SETTINGS.alwaysUseSecureConnections,
    ),
    blockInsecureContent: boolValue(
      settings?.blockInsecureContent,
      DEFAULT_SETTINGS.blockInsecureContent,
    ),
    warnDangerousDownloads: boolValue(
      settings?.warnDangerousDownloads,
      DEFAULT_SETTINGS.warnDangerousDownloads,
    ),
    reviewExtensionPermissions: boolValue(
      settings?.reviewExtensionPermissions,
      DEFAULT_SETTINGS.reviewExtensionPermissions,
    ),
    blockUnsignedRemoteExtensions: boolValue(
      settings?.blockUnsignedRemoteExtensions,
      DEFAULT_SETTINGS.blockUnsignedRemoteExtensions,
    ),
    privacyClearTimeRange:
      enumValue(settings?.privacyClearTimeRange, [
        "last-hour",
        "last-24-hours",
        "last-7-days",
        "all-time",
      ]) ?? DEFAULT_SETTINGS.privacyClearTimeRange,
    clearHistoryOnClose: boolValue(
      settings?.clearHistoryOnClose,
      DEFAULT_SETTINGS.clearHistoryOnClose,
    ),
    clearCacheOnClose: boolValue(
      settings?.clearCacheOnClose,
      DEFAULT_SETTINGS.clearCacheOnClose,
    ),
    clearDownloadsOnClose: boolValue(
      settings?.clearDownloadsOnClose,
      DEFAULT_SETTINGS.clearDownloadsOnClose,
    ),
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
    reduceTransparency: boolValue(
      settings?.reduceTransparency,
      DEFAULT_SETTINGS.reduceTransparency,
    ),
    focusRingVisibility:
      enumValue(settings?.focusRingVisibility, ["subtle", "standard", "high"]) ??
      DEFAULT_SETTINGS.focusRingVisibility,
    textScale:
      enumValue(legacyTextScale, ["small", "default", "large", "extra-large"]) ??
      (legacyTextScale === "normal" ? "default" : DEFAULT_SETTINGS.textScale),
    alwaysShowFocusIndicators: boolValue(
      settings?.alwaysShowFocusIndicators,
      DEFAULT_SETTINGS.alwaysShowFocusIndicators,
    ),
    tabThroughToolbarControls: boolValue(
      settings?.tabThroughToolbarControls,
      DEFAULT_SETTINGS.tabThroughToolbarControls,
    ),
    underlineLinks: boolValue(settings?.underlineLinks, DEFAULT_SETTINGS.underlineLinks),
    readableFontSmoothing: boolValue(
      settings?.readableFontSmoothing,
      DEFAULT_SETTINGS.readableFontSmoothing,
    ),
    pageZoom:
      Number.isFinite(settings?.pageZoom) && settings?.pageZoom
        ? Math.max(0.67, Math.min(1.5, Number(settings.pageZoom)))
        : DEFAULT_SETTINGS.pageZoom,
    tabHoverPreview: boolValue(settings?.tabHoverPreview, DEFAULT_SETTINGS.tabHoverPreview),
    shortcutOverrides: normalizeShortcutOverrides(settings?.shortcutOverrides),
    passwordManager: normalizePasswordManagerSettings(settings?.passwordManager),
  };
}

function normalizePasswordManagerSettings(
  value: BrowserSettings["passwordManager"] | undefined,
): BrowserSettings["passwordManager"] {
  const defaults = DEFAULT_SETTINGS.passwordManager;
  const autoLockMinutes = [0, 1, 5, 15, 30, 60].includes(Number(value?.autoLockMinutes))
    ? value!.autoLockMinutes
    : defaults.autoLockMinutes;
  const clipboardClearSeconds = [0, 15, 30, 60].includes(Number(value?.clipboardClearSeconds))
    ? value!.clipboardClearSeconds
    : defaults.clipboardClearSeconds;
  const length = Number.isFinite(value?.generator?.length)
    ? Math.max(8, Math.min(128, Math.trunc(Number(value?.generator.length))))
    : defaults.generator.length;
  return {
    offerAutofill: boolValue(value?.offerAutofill, defaults.offerAutofill),
    autofillUsername: boolValue(value?.autofillUsername, defaults.autofillUsername),
    autoLockMinutes,
    lockOnAppClose: boolValue(value?.lockOnAppClose, defaults.lockOnAppClose),
    lockOnAllWindowsClosed: boolValue(value?.lockOnAllWindowsClosed, defaults.lockOnAllWindowsClosed),
    lockOnScreenLock: boolValue(value?.lockOnScreenLock, defaults.lockOnScreenLock),
    lockOnSleep: boolValue(value?.lockOnSleep, defaults.lockOnSleep),
    clipboardClearSeconds,
    generator: {
      length,
      uppercase: boolValue(value?.generator?.uppercase, defaults.generator.uppercase),
      lowercase: boolValue(value?.generator?.lowercase, defaults.generator.lowercase),
      digits: boolValue(value?.generator?.digits, defaults.generator.digits),
      symbols: boolValue(value?.generator?.symbols, defaults.generator.symbols),
      avoidAmbiguous: boolValue(value?.generator?.avoidAmbiguous, defaults.generator.avoidAmbiguous),
    },
  };
}

function normalizeTabs(value: unknown): BrowserTab[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<BrowserTab> => Boolean(item) && typeof item === "object")
    .slice(0, 120)
    .map((tab) => ({
      id: typeof tab.id === "string" && tab.id ? tab.id : randomUUID(),
      url: safeString(tab.url, 4096, "ultrax://new-tab"),
      title: safeString(tab.title, 512, "New Tab"),
      favicon:
        typeof tab.favicon === "string" && tab.favicon.length <= 4096
          ? tab.favicon
          : undefined,
      isLoading: boolValue(tab.isLoading, false),
      canGoBack: boolValue(tab.canGoBack, false),
      canGoForward: boolValue(tab.canGoForward, false),
      isNewTab: boolValue(tab.isNewTab, true),
      isPinned: boolValue(tab.isPinned, false),
      isMuted: boolValue(tab.isMuted, false),
      isAudible: boolValue(tab.isAudible, false),
      error:
        typeof tab.error === "string" && tab.error.length <= 512
          ? tab.error
          : undefined,
    }));
}

function normalizeWindowSessions(value: unknown): BrowserWindowSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<BrowserWindowSession> => Boolean(item) && typeof item === "object")
    .slice(0, 12)
    .map((session) => {
      const tabs = normalizeTabs(session.tabs);
      const activeTabId =
        typeof session.activeTabId === "string" &&
        tabs.some((tab) => tab.id === session.activeTabId)
          ? session.activeTabId
          : tabs[0]?.id ?? null;

      return {
        id: typeof session.id === "string" && session.id ? session.id : randomUUID(),
        tabs,
        activeTabId,
        ...(session.bounds ? { bounds: normalizeWindowBounds(session.bounds) } : {}),
      };
    })
    .filter((session) => session.tabs.length > 0);
}

function normalizeWindowBounds(value: unknown): BrowserWindowBounds | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<BrowserWindowBounds>;
  if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) {
    return undefined;
  }

  const bounds: BrowserWindowBounds = {
    width: Math.max(940, Math.min(3840, Math.round(Number(candidate.width)))),
    height: Math.max(620, Math.min(2160, Math.round(Number(candidate.height)))),
  };

  if (Number.isFinite(candidate.x)) {
    bounds.x = Math.round(Number(candidate.x));
  }

  if (Number.isFinite(candidate.y)) {
    bounds.y = Math.round(Number(candidate.y));
  }

  return bounds;
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

function normalizePermissionExceptions(value: unknown): BrowserSettings["sitePermissionExceptions"] {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.sitePermissionExceptions;
  }

  const seen = new Set<string>();
  const exceptions: BrowserSettings["sitePermissionExceptions"] = [];
  for (const item of value.slice(0, 80)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const candidate = item as Partial<BrowserSettings["sitePermissionExceptions"][number]>;
    const host = normalizePermissionHost(candidate.host);
    const permission = enumValue(candidate.permission, SITE_PERMISSION_KEYS);
    const policy = enumValue<PermissionPolicy>(candidate.policy, ["ask", "allow", "block"]);
    if (!host || !permission || !policy) {
      continue;
    }

    const key = `${host}:${permission}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    exceptions.push({
      id:
        typeof candidate.id === "string" && candidate.id.length <= 80
          ? candidate.id
          : randomUUID(),
      host,
      permission,
      policy,
      updatedAt:
        Number.isFinite(candidate.updatedAt) && candidate.updatedAt
          ? Number(candidate.updatedAt)
          : Date.now(),
    });
  }

  return exceptions;
}

function normalizePermissionHost(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = trimmed.split(/[/?#]/)[0]?.replace(/^www\./, "") ?? "";
  return /^[a-z0-9.-]{1,253}$/.test(host) ? host : "";
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

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
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
