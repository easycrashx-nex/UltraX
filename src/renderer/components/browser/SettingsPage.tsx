import type {
  AccentColor,
  AnimationLevel,
  BlurIntensity,
  BrowserSettings,
  CloseBehavior,
  CornerRadius,
  DownloadRetention,
  ExtensionStoreItem,
  ExtensionValidationResult,
  HistoryRetention,
  InstalledExtension,
  NewTabBackground,
  PanelTransparency,
  RuntimeInfo,
  SearchEngine,
  ShaderIntensity,
  ShaderPreset,
  ShaderSpeed,
  StartupBehavior,
  ThemeMode,
  ToolbarDensity,
  UltraXExtensionPermission,
  UpdateStatusSnapshot,
} from "@shared/types";
import {
  Accessibility,
  Activity,
  BadgeInfo,
  Blocks,
  Bookmark,
  Bot,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Code2,
  Download,
  Gauge,
  Globe2,
  Home,
  Info,
  Keyboard,
  Lock,
  Palette,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PanelId, SettingsCategoryId } from "./types";

type SettingsPageProps = {
  open: boolean;
  activeCategory: SettingsCategoryId;
  settings: BrowserSettings;
  runtimeInfo: RuntimeInfo | null;
  updateStatus: UpdateStatusSnapshot | null;
  tabCount: number;
  installedExtensions: InstalledExtension[];
  extensionStoreItems: ExtensionStoreItem[];
  onClose: () => void;
  onCategoryChange: (category: SettingsCategoryId) => void;
  onOpenPanel: (panel: PanelId) => void;
  onUpdateSettings: (settings: Partial<BrowserSettings>) => void;
  onClearHistory: () => void;
  onClearBrowserData: () => void;
  onClearNetworkCache: () => void;
  onClearDownloads: () => void;
  onClearBookmarks: () => void;
  onChooseDownloadFolder: () => void;
  onOpenDownloadsFolder: () => void;
  onChooseNewTabCustomImage: () => Promise<string | null>;
  onRemoveNewTabCustomImage: () => Promise<void>;
  onResetSettings: () => void;
  onOpenShellDevTools: () => void;
  onRelaunchApp: () => void;
  onCheckForUpdates: () => Promise<UpdateStatusSnapshot>;
  onDownloadUpdate: () => Promise<UpdateStatusSnapshot>;
  onInstallUpdate: () => Promise<UpdateStatusSnapshot>;
  onOpenReleasesPage: () => Promise<void>;
  onLoadUnpackedExtension: () => Promise<InstalledExtension | null>;
  onValidateUnpackedExtension: () => Promise<ExtensionValidationResult | null>;
  onSetExtensionEnabled: (extensionId: string, enabled: boolean) => Promise<void>;
  onRemoveExtension: (extensionId: string) => Promise<void>;
  onReloadExtensions: () => Promise<void>;
  onOpenExtensionsFolder: () => Promise<void>;
  onInstallStoreExtension: (extensionId: string) => Promise<InstalledExtension>;
  onOpenExtensionPanel: (extensionId: string) => void;
  onClearExtensionErrors: (extensionId?: string) => Promise<void>;
};

type Category = {
  id: SettingsCategoryId;
  label: string;
  detail: string;
  icon: ReactNode;
};

type CategoryGroup = {
  label: string;
  items: Category[];
};

type ConfirmState = {
  title: string;
  detail: string;
  actionLabel: string;
  action: () => void;
};

const categoryGroups: CategoryGroup[] = [
  {
    label: "Essentials",
    items: [
      { id: "general", label: "General", detail: "Default browser behavior", icon: <BadgeInfo /> },
      { id: "appearance", label: "Appearance", detail: "Theme and glass controls", icon: <Palette /> },
      { id: "browser", label: "Browser", detail: "Toolbar and address bar", icon: <Globe2 /> },
      { id: "tabs", label: "Tabs", detail: "Session and tab behavior", icon: <SlidersHorizontal /> },
    ],
  },
  {
    label: "Start",
    items: [
      { id: "start", label: "Startup", detail: "Launch behavior", icon: <RefreshCw /> },
      { id: "home", label: "Home Page", detail: "Home and New Tab", icon: <Home /> },
      { id: "search", label: "Search Engine", detail: "Address bar search", icon: <Search /> },
      { id: "downloads", label: "Downloads", detail: "File handling", icon: <Download /> },
    ],
  },
  {
    label: "Privacy",
    items: [
      { id: "privacy", label: "Privacy", detail: "Local data controls", icon: <Shield /> },
      { id: "security", label: "Security", detail: "Isolation and protocols", icon: <Lock /> },
      { id: "permissions", label: "Permissions", detail: "Site access defaults", icon: <Blocks /> },
      { id: "profiles", label: "Profiles", detail: "People and spaces", icon: <UserRound /> },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "ai", label: "AI", detail: "Assistant integrations", icon: <Brain /> },
      { id: "plugins", label: "Plugins", detail: "Native add-ons", icon: <Puzzle /> },
      { id: "extensions", label: "Extensions", detail: "Native browser add-ons", icon: <Blocks /> },
      { id: "performance", label: "Performance", detail: "Rendering and memory", icon: <Gauge /> },
    ],
  },
  {
    label: "System",
    items: [
      { id: "accessibility", label: "Accessibility", detail: "Motion and reading", icon: <Accessibility /> },
      { id: "shortcuts", label: "Keyboard", detail: "Shortcut reference", icon: <Keyboard /> },
      { id: "advanced", label: "Advanced", detail: "Developer tools", icon: <Code2 /> },
      { id: "updates", label: "Updates", detail: "Release channel", icon: <RefreshCw /> },
      { id: "about", label: "About UltraX", detail: "Version and engine", icon: <Info /> },
    ],
  },
];

const allCategories = categoryGroups.flatMap((group) => group.items);

const accentColors: Array<[AccentColor, string, string]> = [
  ["blue", "Blue", "bg-blue-500"],
  ["purple", "Purple", "bg-violet-500"],
  ["cyan", "Cyan", "bg-cyan-400"],
  ["green", "Green", "bg-emerald-400"],
  ["rose", "Rose", "bg-rose-400"],
  ["orange", "Orange", "bg-orange-400"],
];

const extensionPermissionDescriptions: Record<UltraXExtensionPermission, string> = {
  tabs: "Read basic tab metadata and manage tabs through safe UltraX APIs.",
  activeTab: "Access the currently active tab metadata after user interaction.",
  storage: "Store extension-local preferences in UltraX state.",
  sidebar: "Open an UltraX sidebar or panel owned by the extension.",
  notifications: "Show UltraX-controlled notifications.",
  downloads: "Interact with download controls. Sensitive.",
  bookmarks: "Read or manage bookmarks. Sensitive.",
  history: "Read or manage local history. Sensitive.",
  settings: "Read or update browser preferences. Sensitive.",
  webNavigation: "Observe safe navigation lifecycle metadata.",
  clipboard: "Interact with clipboard text. Sensitive.",
  contextMenus: "Register UltraX context menu entries.",
};

const sensitiveExtensionPermissions = new Set<UltraXExtensionPermission>([
  "history",
  "downloads",
  "bookmarks",
  "settings",
  "clipboard",
]);

function formatPermissionList(permissions: UltraXExtensionPermission[]): string {
  return permissions.length > 0 ? permissions.join(", ") : "none";
}

function formatUpdateStatus(update: UpdateStatusSnapshot): string {
  const labels: Record<UpdateStatusSnapshot["status"], string> = {
    idle: "Ready to check",
    checking: "Checking for updates",
    available: `Update available${update.latestVersion ? `: ${update.latestVersion}` : ""}`,
    "not-available": "UltraX is up to date",
    downloading: update.progress ? `Downloading ${Math.round(update.progress.percent)}%` : "Downloading",
    downloaded: "Update downloaded, restart required",
    installing: "Installing update",
    error: "Needs attention",
  };

  return labels[update.status];
}

function formatTimestamp(timestamp: number | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "Not checked yet";
}

const performanceModeDetails: Record<BrowserSettings["performanceMode"], string> = {
  efficiency:
    "Lower shader intensity, calmer motion, and more conservative background work.",
  balanced: "Recommended default with smooth visuals and sensible preload behavior.",
  performance: "Faster New Tab readiness, warmer shell surfaces, and smoother animation targets.",
  ultra: "Maximum visual quality and responsiveness with higher CPU and GPU usage.",
};

const defaultPerformanceSettings: Partial<BrowserSettings> = {
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
};

const defaultAppearanceSettings: Partial<BrowserSettings> = {
  theme: "dark",
  glassMode: true,
  accentColor: "blue",
  toolbarDensity: "comfortable",
  cornerRadius: "rounded",
  blurIntensity: "balanced",
  panelTransparency: "balanced",
  animationLevel: "balanced",
  shaderEnabled: true,
  newTabBackground: "ultrax-wave",
  newTabSolidColor: "#050608",
  newTabCustomImagePath: "",
  shaderPreset: "ultrax-wave",
  shaderIntensity: "balanced",
  shaderSpeed: "normal",
  reducedMotion: false,
};

function performanceModePatch(
  performanceMode: BrowserSettings["performanceMode"],
): Partial<BrowserSettings> {
  if (performanceMode === "efficiency") {
    return {
      performanceMode,
      backgroundShaderPerformance: "low",
      shaderFpsCap: "30",
      reducedVisualEffects: true,
      reduceNewTabAnimations: true,
      memorySaver: true,
      suspendInactiveTabs: true,
      suspendTabsAfter: "15-minutes",
      preloadNewTab: false,
      keepNewTabWarm: false,
      pagePreloading: false,
      predictiveNavigation: false,
      reduceDataUsage: true,
    };
  }

  if (performanceMode === "performance") {
    return {
      performanceMode,
      backgroundShaderPerformance: "high",
      shaderFpsCap: "60",
      reducedVisualEffects: false,
      reduceNewTabAnimations: false,
      preloadNewTab: true,
      keepNewTabWarm: true,
      lazyLoadQuickLinks: true,
      memorySaver: false,
      suspendInactiveTabs: false,
      pagePreloading: true,
      predictiveNavigation: true,
      reduceDataUsage: false,
    };
  }

  if (performanceMode === "ultra") {
    return {
      performanceMode,
      backgroundShaderPerformance: "ultra",
      shaderFpsCap: "unlimited",
      pauseShaderWhenUnfocused: false,
      reducedVisualEffects: false,
      reduceNewTabAnimations: false,
      preloadNewTab: true,
      keepNewTabWarm: true,
      lazyLoadQuickLinks: false,
      memorySaver: false,
      suspendInactiveTabs: false,
      pagePreloading: true,
      predictiveNavigation: true,
      reduceDataUsage: false,
    };
  }

  return {
    performanceMode,
    backgroundShaderPerformance: "balanced",
    shaderFpsCap: "60",
    reducedVisualEffects: false,
    reduceNewTabAnimations: false,
    preloadNewTab: true,
    keepNewTabWarm: false,
    lazyLoadQuickLinks: true,
    memorySaver: false,
    suspendInactiveTabs: false,
    pagePreloading: false,
    predictiveNavigation: false,
    reduceDataUsage: false,
  };
}

function parseSiteExceptions(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }
      seen.add(line);
      return true;
    })
    .slice(0, 24);
}

export function SettingsPage({
  open,
  activeCategory,
  settings,
  runtimeInfo,
  updateStatus,
  tabCount,
  installedExtensions,
  extensionStoreItems,
  onClose,
  onCategoryChange,
  onOpenPanel,
  onUpdateSettings,
  onClearHistory,
  onClearBrowserData,
  onClearNetworkCache,
  onClearDownloads,
  onClearBookmarks,
  onChooseDownloadFolder,
  onOpenDownloadsFolder,
  onChooseNewTabCustomImage,
  onRemoveNewTabCustomImage,
  onResetSettings,
  onOpenShellDevTools,
  onRelaunchApp,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenReleasesPage,
  onLoadUnpackedExtension,
  onValidateUnpackedExtension,
  onSetExtensionEnabled,
  onRemoveExtension,
  onReloadExtensions,
  onOpenExtensionsFolder,
  onInstallStoreExtension,
  onOpenExtensionPanel,
  onClearExtensionErrors,
}: SettingsPageProps) {
  const [query, setQuery] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmState) {
          setConfirmState(null);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmState, onClose, open]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) {
      return categoryGroups;
    }

    return categoryGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.detail.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  const activeCategoryMeta =
    allCategories.find((category) => category.id === activeCategory) ?? allCategories[0];

  const requestConfirm = (
    title: string,
    detail: string,
    actionLabel: string,
    action: () => void,
  ) => {
    setConfirmState({ title, detail, actionLabel, action });
  };

  if (!open) {
    return null;
  }

  return (
    <section
      className="settings-shell browser-content-start fixed bottom-0 right-0 z-40 flex w-[min(980px,calc(100vw-36px))] flex-col overflow-hidden border-l border-border/70 bg-popover/80 text-popover-foreground shadow-2xl shadow-black/50 backdrop-blur-3xl"
      aria-label="UltraX Settings"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/0.16),transparent_22rem),linear-gradient(180deg,hsl(0_0%_100%/0.045),transparent_26rem)]" />

      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/55 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/16 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]">
            <Sparkles aria-hidden="true" className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold">UltraX Settings</h1>
            <p className="truncate text-xs text-muted-foreground">
              v1.0.8 premium desktop controls for browsing, privacy, updates, extensions, and release diagnostics.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="chrome"
          size="icon"
          title="Close Settings"
          aria-label="Close Settings"
          onClick={onClose}
          className="rounded-xl"
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)]">
        <aside className="settings-sidebar settings-scrollbar min-h-0 overflow-y-auto border-r border-border/55 p-4">
          <label className="settings-search relative mb-5 block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search settings"
              className="h-10 w-full rounded-xl border border-border/75 bg-background/62 pl-10 pr-3 text-[13px] text-foreground outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition duration-200 placeholder:text-muted-foreground focus:border-primary/65 focus:bg-background/78 focus:ring-[4px] focus:ring-primary/14"
            />
          </label>

          <nav className="flex flex-col gap-4" aria-label="Settings categories">
            {visibleGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {group.label}
                </p>
                {group.items.map((category) => {
                  const active = category.id === activeCategory;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => onCategoryChange(category.id)}
                      className={cn(
                        "settings-nav-item group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-left outline-none transition duration-200",
                        active
                          ? "bg-primary/95 text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.24)]"
                          : "text-muted-foreground hover:bg-accent/62 hover:text-foreground focus-visible:ring-[4px] focus-visible:ring-ring/24",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg transition duration-200 [&_svg]:size-4",
                          active
                            ? "bg-white/18 text-primary-foreground"
                            : "bg-secondary/55 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground",
                        )}
                      >
                        {category.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {category.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            active ? "text-primary-foreground/74" : "text-muted-foreground/76",
                          )}
                        >
                          {category.detail}
                        </span>
                      </span>
                      {active && <span className="settings-active-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="settings-scrollbar min-h-0 overflow-y-auto px-8 py-7">
          <div key={activeCategory} className="settings-page-content mx-auto flex max-w-[640px] flex-col gap-5">
            <PageTitle
              icon={activeCategoryMeta.icon}
              title={activeCategoryMeta.label}
              detail={activeCategoryMeta.detail}
            />
            <CategoryContent
              category={activeCategory}
              settings={settings}
              runtimeInfo={runtimeInfo}
              updateStatus={updateStatus}
              tabCount={tabCount}
              installedExtensions={installedExtensions}
              extensionStoreItems={extensionStoreItems}
              requestConfirm={requestConfirm}
              onOpenPanel={onOpenPanel}
              onUpdateSettings={onUpdateSettings}
              onClearHistory={onClearHistory}
              onClearBrowserData={onClearBrowserData}
              onClearNetworkCache={onClearNetworkCache}
              onClearDownloads={onClearDownloads}
              onClearBookmarks={onClearBookmarks}
              onChooseDownloadFolder={onChooseDownloadFolder}
              onOpenDownloadsFolder={onOpenDownloadsFolder}
              onChooseNewTabCustomImage={onChooseNewTabCustomImage}
              onRemoveNewTabCustomImage={onRemoveNewTabCustomImage}
              onResetSettings={onResetSettings}
              onOpenShellDevTools={onOpenShellDevTools}
              onRelaunchApp={onRelaunchApp}
              onCheckForUpdates={onCheckForUpdates}
              onDownloadUpdate={onDownloadUpdate}
              onInstallUpdate={onInstallUpdate}
              onOpenReleasesPage={onOpenReleasesPage}
              onLoadUnpackedExtension={onLoadUnpackedExtension}
              onValidateUnpackedExtension={onValidateUnpackedExtension}
              onSetExtensionEnabled={onSetExtensionEnabled}
              onRemoveExtension={onRemoveExtension}
              onReloadExtensions={onReloadExtensions}
              onOpenExtensionsFolder={onOpenExtensionsFolder}
              onInstallStoreExtension={onInstallStoreExtension}
              onOpenExtensionPanel={onOpenExtensionPanel}
              onClearExtensionErrors={onClearExtensionErrors}
            />
          </div>
        </main>
      </div>

      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            confirmState.action();
            setConfirmState(null);
          }}
        />
      )}
    </section>
  );
}

function CategoryContent({
  category,
  settings,
  runtimeInfo,
  updateStatus,
  tabCount,
  installedExtensions,
  extensionStoreItems,
  requestConfirm,
  onOpenPanel,
  onUpdateSettings,
  onClearHistory,
  onClearBrowserData,
  onClearNetworkCache,
  onClearDownloads,
  onClearBookmarks,
  onChooseDownloadFolder,
  onOpenDownloadsFolder,
  onChooseNewTabCustomImage,
  onRemoveNewTabCustomImage,
  onResetSettings,
  onOpenShellDevTools,
  onRelaunchApp,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenReleasesPage,
  onLoadUnpackedExtension,
  onValidateUnpackedExtension,
  onSetExtensionEnabled,
  onRemoveExtension,
  onReloadExtensions,
  onOpenExtensionsFolder,
  onInstallStoreExtension,
  onOpenExtensionPanel,
  onClearExtensionErrors,
}: Omit<SettingsPageProps, "open" | "activeCategory" | "onClose" | "onCategoryChange"> & {
  category: SettingsCategoryId;
  requestConfirm: (
    title: string,
    detail: string,
    actionLabel: string,
    action: () => void,
  ) => void;
}) {
  const [performanceNotice, setPerformanceNotice] = useState<string | null>(null);
  const [extensionNotice, setExtensionNotice] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [extensionTab, setExtensionTab] = useState<"installed" | "store" | "developer">("installed");
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const selectedExtension =
    installedExtensions.find((extension) => extension.id === selectedExtensionId) ?? null;
  const enabledExtensionCount = installedExtensions.filter(
    (extension) => extension.status === "enabled",
  ).length;
  const extensionErrorCount = installedExtensions.filter(
    (extension) => extension.status === "error",
  ).length;
  const hardwareRestartRequired =
    runtimeInfo !== null &&
    runtimeInfo.hardwareAccelerationEnabled !== settings.hardwareAcceleration;
  const gpuFeatureStatus = runtimeInfo?.gpuFeatureStatus ?? {};
  const shaderRuntimeStatus =
    settings.shaderEnabled &&
    !settings.reducedMotion &&
    !settings.reducedVisualEffects &&
    !(settings.performanceMode === "efficiency" && settings.disableShaderOnEfficiencyMode)
      ? "Active on New Tab"
      : "Reduced or paused by current settings";

  const diagnosticsPayload = () => ({
    generatedAt: new Date().toISOString(),
    app: {
      name: runtimeInfo?.appName ?? "UltraX",
      version: runtimeInfo?.appVersion ?? "1.0.8",
      electron: runtimeInfo?.electronVersion ?? "Unknown",
      chromium: runtimeInfo?.chromiumVersion ?? "Unknown",
      node: runtimeInfo?.nodeVersion ?? "Unknown",
      platform: runtimeInfo ? `${runtimeInfo.platform} ${runtimeInfo.arch}` : "Unknown",
      buildType: runtimeInfo?.buildType ?? "development",
    },
    runtime: {
      memoryUsage: runtimeInfo?.memoryUsage ?? null,
      processInfo: runtimeInfo?.processInfo ?? null,
      hardwareAccelerationEnabled: runtimeInfo?.hardwareAccelerationEnabled ?? null,
      gpuFeatureStatus,
    },
    tabs: {
      open: tabCount,
      suspended: 0,
    },
    performance: {
      mode: settings.performanceMode,
      shader: {
        enabled: settings.shaderEnabled,
        quality: settings.backgroundShaderPerformance,
        fpsCap: settings.shaderFpsCap,
        status: shaderRuntimeStatus,
      },
      newTab: {
        preload: settings.preloadNewTab,
        keepWarm: settings.keepNewTabWarm,
        lazyQuickLinks: settings.lazyLoadQuickLinks,
      },
      tabs: {
        memorySaver: settings.memorySaver,
        suspendInactiveTabs: settings.suspendInactiveTabs,
        suspendAfter: settings.suspendTabsAfter,
      },
      network: {
        dnsPrefetching: settings.dnsPrefetching,
        pagePreloading: settings.pagePreloading,
        predictiveNavigation: settings.predictiveNavigation,
        reduceDataUsage: settings.reduceDataUsage,
      },
    },
  });

  const copyDiagnostics = () => {
    if (!navigator.clipboard) {
      setPerformanceNotice("Clipboard access is unavailable in this environment.");
      return;
    }

    void navigator.clipboard
      .writeText(JSON.stringify(diagnosticsPayload(), null, 2))
      .then(() => setPerformanceNotice("Diagnostics copied without private browsing data."))
      .catch(() => setPerformanceNotice("Diagnostics could not be copied."));
  };

  const exportDiagnostics = () => {
    const blob = new Blob([JSON.stringify(diagnosticsPayload(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ultrax-performance-diagnostics.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setPerformanceNotice("Diagnostics JSON exported.");
  };

  const loadUnpackedExtension = () => {
    if (!settings.extensionDeveloperMode) {
      setExtensionNotice("Enable Developer Mode before loading local UltraX extensions.");
      return;
    }

    void onLoadUnpackedExtension()
      .then((extension) => {
        if (extension) {
          setSelectedExtensionId(extension.id);
          setExtensionNotice(`${extension.manifest.name} was registered in Developer Mode.`);
        } else {
          setExtensionNotice("Local extension loading was cancelled.");
        }
      })
      .catch((error) =>
        setExtensionNotice(
          error instanceof Error ? error.message : "Local extension could not be loaded.",
        ),
      );
  };

  const reloadExtensions = () => {
    void onReloadExtensions()
      .then(() => setExtensionNotice("Extensions revalidated."))
      .catch((error) =>
        setExtensionNotice(
          error instanceof Error ? error.message : "Extensions could not be reloaded.",
        ),
      );
  };

  const validateUnpackedExtension = () => {
    if (!settings.extensionDeveloperMode) {
      setExtensionNotice("Enable Developer Mode before validating local UltraX extensions.");
      return;
    }

    void onValidateUnpackedExtension()
      .then((result) => {
        if (!result) {
          setExtensionNotice("Extension validation was cancelled.");
          return;
        }

        if (result.ok) {
          setExtensionNotice(
            `${result.manifest?.name ?? "Extension"} is valid${result.warnings.length > 0 ? ` with ${result.warnings.length} warning(s).` : "."}`,
          );
        } else {
          setExtensionNotice(result.errors.join(" "));
        }
      })
      .catch((error) =>
        setExtensionNotice(
          error instanceof Error ? error.message : "Extension validation failed.",
        ),
      );
  };

  const confirmExtensionEnable = (extension: InstalledExtension, enabled: boolean) => {
    if (!enabled) {
      void onSetExtensionEnabled(extension.id, false).catch((error) =>
        setExtensionNotice(
          error instanceof Error ? error.message : "Extension state could not be changed.",
        ),
      );
      return;
    }

    requestConfirm(
      `Enable ${extension.manifest.name}?`,
      `Requested permissions: ${formatPermissionList(extension.manifest.permissions)}.`,
      "Enable",
      () => {
        void onSetExtensionEnabled(extension.id, true)
          .then(() => setExtensionNotice(`${extension.manifest.name} enabled.`))
          .catch((error) =>
            setExtensionNotice(
              error instanceof Error ? error.message : "Extension state could not be changed.",
            ),
          );
      },
    );
  };

  const installStoreExtension = (item: ExtensionStoreItem) => {
    requestConfirm(
      `Install ${item.name}?`,
      `Requested permissions: ${formatPermissionList(item.permissions)}.`,
      "Install",
      () => {
        void onInstallStoreExtension(item.id)
          .then((extension) => {
            setSelectedExtensionId(extension.id);
            setExtensionTab("installed");
            setExtensionNotice(`${extension.manifest.name} installed from the local Store.`);
          })
          .catch((error) =>
            setExtensionNotice(
              error instanceof Error ? error.message : "Extension could not be installed.",
            ),
          );
      },
    );
  };

  const runUpdateAction = (
    action: () => Promise<UpdateStatusSnapshot>,
    successMessage: string,
  ) => {
    setUpdateNotice(null);
    void action()
      .then((status) => setUpdateNotice(status.error ?? successMessage))
      .catch((error) =>
        setUpdateNotice(error instanceof Error ? error.message : "Update action failed."),
      );
  };

  switch (category) {
    case "general":
      return (
        <>
          <SettingSection title="General" detail="High-level defaults for how UltraX opens and behaves.">
            <SegmentedRow
              label="Theme"
              detail="Choose a calm shell appearance."
              value={settings.theme}
              onChange={(value) => onUpdateSettings({ theme: value as ThemeMode })}
              options={[
                ["dark", "Dark"],
                ["light", "Light"],
                ["system", "System"],
              ]}
            />
            <SegmentedRow
              label="When UltraX starts"
              detail="Restore your previous session or begin cleanly."
              value={settings.startupBehavior}
              onChange={(value) =>
                onUpdateSettings({
                  startupBehavior: value as StartupBehavior,
                  restoreTabsOnLaunch: value === "restore-session",
                })
              }
              options={[
                ["restore-session", "Restore"],
                ["new-tab", "New Tab"],
                ["specific-pages", "Pages"],
              ]}
            />
            <SelectRow
              label="When closing UltraX"
              detail="Choose whether tabs are restored, discarded, or confirmed before close."
              value={settings.closeBehavior}
              onChange={(value) =>
                onUpdateSettings({
                  closeBehavior: value as CloseBehavior,
                  confirmBeforeClosingMultipleTabs:
                    value === "ask-before-closing-multiple-tabs",
                })
              }
              options={[
                ["close-and-restore-session", "Close and restore next time"],
                ["ask-before-closing-multiple-tabs", "Ask before closing multiple tabs"],
                ["close-and-discard-session", "Close and discard session"],
              ]}
            />
            <ActionRow
              label="Open shell developer tools"
              detail="Inspect UltraX chrome and diagnostics."
              actionLabel="Open"
              icon={<Code2 aria-hidden="true" />}
              onAction={onOpenShellDevTools}
            />
          </SettingSection>
          <StatusCard
            title="Release status"
            detail={`UltraX Browser ${runtimeInfo?.appVersion ?? "1.0.8"} is running in ${
              runtimeInfo?.buildType ?? "development"
            } mode.`}
            icon={<Sparkles aria-hidden="true" />}
          />
        </>
      );

    case "appearance":
      return (
        <>
          <AppearancePreview settings={settings} />
          <SettingSection title="Theme" detail="UltraX identity with a calmer macOS-inspired finish.">
            <SegmentedRow
              label="Theme"
              detail="Choose the base shell appearance."
              value={settings.theme}
              onChange={(value) => onUpdateSettings({ theme: value as ThemeMode })}
              options={[
                ["dark", "Dark"],
                ["light", "Light"],
                ["system", "System"],
              ]}
            />
            <ColorRow
              value={settings.accentColor}
              onChange={(accentColor) => onUpdateSettings({ accentColor })}
            />
            <SelectRow
              label="Interface density"
              detail="Adjust chrome, settings, and New Tab spacing."
              value={settings.toolbarDensity}
              onChange={(value) => onUpdateSettings({ toolbarDensity: value as ToolbarDensity })}
              options={[
                ["compact", "Compact"],
                ["comfortable", "Comfortable"],
                ["spacious", "Spacious"],
              ]}
            />
            <SelectRow
              label="Corner radius"
              detail="Tune the shape of major UltraX surfaces."
              value={settings.cornerRadius}
              onChange={(value) => onUpdateSettings({ cornerRadius: value as CornerRadius })}
              options={[
                ["subtle", "Subtle"],
                ["rounded", "Rounded"],
                ["ultra-rounded", "Ultra Rounded"],
              ]}
            />
          </SettingSection>

          <SettingSection title="Glass & Motion" detail="Control material depth, blur, and animation energy.">
            <SwitchRow
              label="Glass effects"
              detail="Use translucent materials, soft blur, and gentle highlights."
              checked={settings.glassMode}
              onChange={(checked) => onUpdateSettings({ glassMode: checked })}
            />
            <SelectRow
              label="Blur intensity"
              detail="Controls backdrop blur on glass panels."
              value={settings.blurIntensity}
              onChange={(value) => onUpdateSettings({ blurIntensity: value as BlurIntensity })}
              options={[
                ["low", "Low"],
                ["balanced", "Balanced"],
                ["high", "High"],
              ]}
            />
            <SelectRow
              label="Panel transparency"
              detail="Controls how much background shows through panels."
              value={settings.panelTransparency}
              onChange={(value) =>
                onUpdateSettings({ panelTransparency: value as PanelTransparency })
              }
              options={[
                ["low", "Low"],
                ["balanced", "Balanced"],
                ["high", "High"],
              ]}
            />
            <SelectRow
              label="Animation level"
              detail="Reduced motion overrides this setting."
              value={settings.animationLevel}
              onChange={(value) => onUpdateSettings({ animationLevel: value as AnimationLevel })}
              options={[
                ["minimal", "Minimal"],
                ["balanced", "Balanced"],
                ["expressive", "Expressive"],
              ]}
            />
            <SwitchRow
              label="Reduce motion"
              detail="Tone down animated transitions across UltraX."
              checked={settings.reducedMotion}
              onChange={(checked) => onUpdateSettings({ reducedMotion: checked })}
            />
          </SettingSection>

          <SettingSection title="New Tab Background" detail="Choose the visual system behind the New Tab page.">
            <SelectRow
              label="Background"
              detail="Applies immediately to New Tab."
              value={settings.newTabBackground}
              onChange={(value) => onUpdateSettings({ newTabBackground: value as NewTabBackground })}
              options={[
                ["ultrax-wave", "UltraX Wave"],
                ["aurora", "Aurora"],
                ["gradient-mesh", "Gradient Mesh"],
                ["minimal-dark", "Minimal Dark"],
                ["solid-color", "Solid Color"],
                ...(settings.newTabCustomImagePath
                  ? ([["custom-image", "Custom Image"]] as Array<[string, string]>)
                  : []),
              ]}
            />
            <ColorInputRow
              label="Solid color"
              detail="Used when New Tab background is Solid Color."
              value={settings.newTabSolidColor}
              onChange={(newTabSolidColor) => onUpdateSettings({ newTabSolidColor })}
            />
            <ActionRow
              label="Custom image"
              detail={
                settings.newTabCustomImagePath
                  ? "Custom image is stored in UltraX user data."
                  : "Choose a local PNG, JPG, WEBP, or GIF."
              }
              actionLabel="Choose"
              icon={<Palette aria-hidden="true" />}
              onAction={() => {
                void onChooseNewTabCustomImage();
              }}
            />
            {settings.newTabCustomImagePath && (
              <ActionRow
                label="Remove custom image"
                detail="Return to the default UltraX Wave background."
                actionLabel="Remove"
                icon={<Trash2 aria-hidden="true" />}
                danger
                onAction={() => {
                  void onRemoveNewTabCustomImage();
                }}
              />
            )}
          </SettingSection>

          <SettingSection title="Shader Presets" detail="Fine tune the animated UltraX backgrounds.">
            <SwitchRow
              label="New Tab shader animation"
              detail="Render animated backgrounds where supported."
              checked={settings.shaderEnabled}
              onChange={(checked) => onUpdateSettings({ shaderEnabled: checked })}
            />
            <SelectRow
              label="Shader preset"
              detail="Changes color direction for shader-backed backgrounds."
              value={settings.shaderPreset}
              onChange={(value) => onUpdateSettings({ shaderPreset: value as ShaderPreset })}
              options={[
                ["ultrax-wave", "UltraX Wave"],
                ["blue-nebula", "Blue Nebula"],
                ["purple-flow", "Purple Flow"],
                ["aurora-lines", "Aurora Lines"],
                ["calm-grid", "Calm Grid"],
              ]}
            />
            <SelectRow
              label="Shader intensity"
              detail="Controls visual strength without changing performance mode."
              value={settings.shaderIntensity}
              onChange={(value) => onUpdateSettings({ shaderIntensity: value as ShaderIntensity })}
              options={[
                ["low", "Low"],
                ["balanced", "Balanced"],
                ["high", "High"],
              ]}
            />
            <SelectRow
              label="Shader speed"
              detail="Reduced motion and performance settings can still limit animation."
              value={settings.shaderSpeed}
              onChange={(value) => onUpdateSettings({ shaderSpeed: value as ShaderSpeed })}
              options={[
                ["slow", "Slow"],
                ["normal", "Normal"],
                ["fast", "Fast"],
              ]}
            />
            <ActionRow
              label="Reset Appearance to Default"
              detail="Restores the UltraX default look without changing privacy or tabs."
              actionLabel="Reset"
              icon={<RotateCcw aria-hidden="true" />}
              onAction={() => onUpdateSettings(defaultAppearanceSettings)}
            />
          </SettingSection>
        </>
      );

    case "browser":
      return (
        <SettingSection title="Browser chrome" detail="Control the visible browser shell.">
          <SwitchRow
            label="Show bookmarks bar"
            detail="Display saved pages below the address controls."
            checked={settings.showBookmarksBar}
            onChange={(checked) => onUpdateSettings({ showBookmarksBar: checked })}
          />
          <SwitchRow
            label="Show Home button"
            detail="Display Home in the toolbar."
            checked={settings.showHomeButton}
            onChange={(checked) => onUpdateSettings({ showHomeButton: checked })}
          />
          <SwitchRow
            label="Address bar search"
            detail="Search non-URL input with your selected engine."
            checked={settings.addressBarSearch}
            onChange={(checked) => onUpdateSettings({ addressBarSearch: checked })}
          />
          <InfoRow
            label="Safe navigation"
            detail="UltraX only loads http and https targets in web tabs."
          />
        </SettingSection>
      );

    case "tabs":
      return (
        <SettingSection title="Tabs" detail="Session and tab placement preferences.">
          <SwitchRow
            label="Restore previous tabs on launch"
            detail="Maps to the Restore startup mode."
            checked={settings.startupBehavior === "restore-session"}
            onChange={(checked) =>
              onUpdateSettings({
                restoreTabsOnLaunch: checked,
                startupBehavior: checked ? "restore-session" : "new-tab",
              })
            }
          />
          <SwitchRow
            label="Open new tabs next to current tab"
            detail="Keep related browsing closer together."
            checked={settings.openTabsNextToCurrent}
            onChange={(checked) => onUpdateSettings({ openTabsNextToCurrent: checked })}
          />
          <SelectRow
            label="When closing UltraX"
            detail="Restore, confirm, or discard the current session."
            value={settings.closeBehavior}
            onChange={(value) =>
              onUpdateSettings({
                closeBehavior: value as CloseBehavior,
                confirmBeforeClosingMultipleTabs:
                  value === "ask-before-closing-multiple-tabs",
              })
            }
            options={[
              ["close-and-restore-session", "Close and restore next time"],
              ["ask-before-closing-multiple-tabs", "Ask before closing multiple tabs"],
              ["close-and-discard-session", "Close and discard session"],
            ]}
          />
          <InfoRow label="Pinned tabs" detail="Pin and unpin tabs from the tab context menu." />
          <InfoRow label="Tab reordering" detail="Drag tabs within their pinned or normal group." />
          <InfoRow label="Tab context menu" detail="Right-click a tab for duplicate, close, pin, and session actions." />
          <ComingSoonRow label="Tab hover preview" detail="Preview cards need compositor-aware capture." />
        </SettingSection>
      );

    case "start":
      return (
        <SettingSection title="Startup" detail="Choose what appears when UltraX opens.">
          <SelectRow
            label="Startup behavior"
            detail="Restore session, open New Tab, or use specific pages."
            value={settings.startupBehavior}
            onChange={(value) =>
              onUpdateSettings({
                startupBehavior: value as StartupBehavior,
                restoreTabsOnLaunch: value === "restore-session",
              })
            }
            options={[
              ["restore-session", "Restore previous session"],
              ["new-tab", "Open New Tab"],
              ["specific-pages", "Open specific pages"],
            ]}
          />
          <TextAreaRow
            label="Startup pages"
            detail="One http/https URL per line."
            value={settings.startupPages.join("\n")}
            onChange={(value) =>
              onUpdateSettings({
                startupPages: value
                  .split(/\r?\n/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 12),
              })
            }
          />
          <SelectRow
            label="When closing UltraX"
            detail="Controls whether the current session is preserved."
            value={settings.closeBehavior}
            onChange={(value) =>
              onUpdateSettings({
                closeBehavior: value as CloseBehavior,
                confirmBeforeClosingMultipleTabs:
                  value === "ask-before-closing-multiple-tabs",
              })
            }
            options={[
              ["close-and-restore-session", "Close and restore next time"],
              ["ask-before-closing-multiple-tabs", "Ask before closing multiple tabs"],
              ["close-and-discard-session", "Close and discard session"],
            ]}
          />
        </SettingSection>
      );

    case "home":
      return (
        <SettingSection title="Home Page" detail="Home button and New Tab defaults.">
          <SegmentedRow
            label="Home behavior"
            detail="Choose New Tab or a custom page."
            value={settings.homeBehavior}
            onChange={(value) =>
              onUpdateSettings({ homeBehavior: value as BrowserSettings["homeBehavior"] })
            }
            options={[
              ["new-tab", "New Tab"],
              ["custom-url", "Custom URL"],
            ]}
          />
          <TextRow
            label="Home URL"
            detail="Used when Home is set to Custom URL."
            value={settings.homeUrl}
            onChange={(homeUrl) => onUpdateSettings({ homeUrl })}
          />
          <ActionRow
            label="Reset New Tab appearance"
            detail="Restore shader, bookmarks bar, and comfortable density."
            actionLabel="Reset"
            icon={<RotateCcw aria-hidden="true" />}
            onAction={() =>
              onUpdateSettings({
                shaderEnabled: true,
                showBookmarksBar: true,
                toolbarDensity: "comfortable",
              })
            }
          />
        </SettingSection>
      );

    case "search":
      return (
        <SettingSection title="Search Engine" detail="Searches are resolved locally into provider URLs.">
          <SelectRow
            label="Default search engine"
            detail="Used when the address input is not a URL."
            value={settings.searchEngine}
            onChange={(value) => onUpdateSettings({ searchEngine: value as SearchEngine })}
            options={[
              ["duckduckgo", "DuckDuckGo"],
              ["google", "Google"],
              ["bing", "Bing"],
              ["brave", "Brave Search"],
              ["custom", "Custom"],
            ]}
          />
          <TextRow
            label="Custom search template"
            detail="Use {query}, for example https://example.com/search?q={query}"
            value={settings.customSearchUrl}
            onChange={(customSearchUrl) => onUpdateSettings({ customSearchUrl })}
          />
          <SwitchRow
            label="Address bar suggestions"
            detail="Shows local suggestions while typing in the address bar."
            checked={settings.searchSuggestions}
            onChange={(checked) => onUpdateSettings({ searchSuggestions: checked })}
          />
          <SwitchRow
            label="Local suggestions"
            detail="Use local browser data without sending keystrokes anywhere."
            checked={settings.searchSuggestionSettings.localSuggestions}
            onChange={(checked) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  localSuggestions: checked,
                },
              })
            }
          />
          <SwitchRow
            label="History suggestions"
            detail="Suggest matching pages from local history."
            checked={settings.searchSuggestionSettings.historySuggestions}
            onChange={(checked) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  historySuggestions: checked,
                },
              })
            }
          />
          <SwitchRow
            label="Bookmark suggestions"
            detail="Suggest saved pages from local bookmarks."
            checked={settings.searchSuggestionSettings.bookmarkSuggestions}
            onChange={(checked) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  bookmarkSuggestions: checked,
                },
              })
            }
          />
          <SwitchRow
            label="Open tab suggestions"
            detail="Suggest switching to matching open tabs."
            checked={settings.searchSuggestionSettings.openTabSuggestions}
            onChange={(checked) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  openTabSuggestions: checked,
                },
              })
            }
          />
          <SwitchRow
            label="Online suggestions"
            detail="Optional. Sends typed text to the selected suggestion provider."
            checked={settings.searchSuggestionSettings.onlineSuggestions}
            onChange={(checked) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  onlineSuggestions: checked,
                },
              })
            }
          />
          <SelectRow
            label="Suggestion provider"
            detail="Current search engine only uses online suggestions for Google or DuckDuckGo."
            value={settings.searchSuggestionSettings.suggestionProvider}
            onChange={(value) =>
              onUpdateSettings({
                searchSuggestionSettings: {
                  ...settings.searchSuggestionSettings,
                  suggestionProvider:
                    value as BrowserSettings["searchSuggestionSettings"]["suggestionProvider"],
                },
              })
            }
            options={[
              ["current-search-engine", "Current search engine"],
              ["duckduckgo", "DuckDuckGo"],
              ["google", "Google"],
              ["none", "None"],
            ]}
          />
        </SettingSection>
      );

    case "downloads":
      return (
        <SettingSection title="Downloads" detail="Control save locations and local download history.">
          <TextRow
            label="Download folder"
            detail="Leave empty to use the system Downloads folder."
            value={settings.downloadPath}
            onChange={(downloadPath) => onUpdateSettings({ downloadPath })}
          />
          <InlineActions>
            <Button type="button" variant="outline" size="sm" onClick={onChooseDownloadFolder}>
              Choose Folder
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onOpenDownloadsFolder}>
              Open Folder
            </Button>
          </InlineActions>
          <SwitchRow
            label="Ask where to save each file"
            detail="Shows Electron's save dialog for each download."
            checked={settings.askWhereToSaveDownloads}
            onChange={(checked) => onUpdateSettings({ askWhereToSaveDownloads: checked })}
          />
          <SelectRow
            label="Download history retention"
            detail="Controls the local downloads list."
            value={settings.downloadRetention}
            onChange={(value) => onUpdateSettings({ downloadRetention: value as DownloadRetention })}
            options={[
              ["forever", "Forever"],
              ["30-days", "30 days"],
              ["session", "This session only"],
            ]}
          />
          <ActionRow
            label="Clear downloads list"
            detail="Downloaded files stay on disk."
            actionLabel="Clear"
            icon={<Trash2 aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Clear downloads list?",
                "UltraX will remove local download records. Files on disk are not deleted.",
                "Clear",
                onClearDownloads,
              )
            }
          />
        </SettingSection>
      );

    case "privacy":
      return (
        <SettingSection title="Privacy" detail="Local browser data controls for this MVP.">
          <ActionRow
            label="Clear browsing history"
            detail="Remove the local history list."
            actionLabel="Clear"
            icon={<Trash2 aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Clear browsing history?",
                "Visited pages will be removed from UltraX history.",
                "Clear",
                onClearHistory,
              )
            }
          />
          <ActionRow
            label="Clear cache, cookies, and site data"
            detail="Clears cache, cookies, local storage, IndexedDB, and cache storage."
            actionLabel="Clear Data"
            icon={<Trash2 aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Clear browser data?",
                "This clears local site data from the UltraX web session.",
                "Clear Data",
                onClearBrowserData,
              )
            }
          />
          <SwitchRow
            label="Do Not Track"
            detail="Adds the DNT request header to web requests."
            checked={settings.doNotTrack}
            onChange={(checked) => onUpdateSettings({ doNotTrack: checked })}
          />
          <InfoRow
            label="Online search suggestions"
            detail="Disabled by default. When Do Not Track is on, UltraX does not request online suggestions."
          />
          <SelectRow
            label="History retention"
            detail="UltraX prunes entries outside the selected window."
            value={settings.historyRetention}
            onChange={(value) => onUpdateSettings({ historyRetention: value as HistoryRetention })}
            options={[
              ["forever", "Forever"],
              ["30-days", "30 days"],
              ["7-days", "7 days"],
            ]}
          />
        </SettingSection>
      );

    case "security":
      return (
        <>
          <SettingSection title="Security" detail="Current hard boundaries for remote pages.">
            <InfoRow label="Renderer isolation" detail="nodeIntegration=false, contextIsolation=true, sandbox=true, webSecurity=true." />
            <InfoRow label="Permission requests" detail="Camera, microphone, location, notifications, and clipboard are denied until a per-site model exists." />
            <InfoRow label="Protocol handling" detail="Unsupported schemes are blocked before navigation reaches WebContentsView." />
            <ComingSoonRow label="Block third-party cookies" detail="Planned after deeper Electron session policy is added." />
          </SettingSection>
          <StatusCard
            title="Security posture"
            detail="UltraX uses a narrow preload API. Remote web content cannot access app internals."
            icon={<Shield aria-hidden="true" />}
          />
        </>
      );

    case "permissions":
      return (
        <SettingSection title="Permissions" detail="Strict defaults until site-level controls are implemented.">
          {[
            ["Camera", "Blocked by default."],
            ["Microphone", "Blocked by default."],
            ["Location", "Blocked by default."],
            ["Notifications", "Blocked by default."],
            ["Popups and redirects", "New windows are opened as UltraX tabs when safe."],
            ["Downloads", "Allowed, tracked, and controlled by Downloads settings."],
            ["Clipboard", "Blocked by default."],
          ].map(([label, detail]) => (
            <ComingSoonRow key={label} label={label} detail={detail} />
          ))}
        </SettingSection>
      );

    case "bookmarks":
      return (
        <SettingSection title="Bookmarks" detail="Manage saved pages and toolbar visibility.">
          <SwitchRow
            label="Show bookmarks bar"
            detail="Display saved pages below the address controls."
            checked={settings.showBookmarksBar}
            onChange={(checked) => onUpdateSettings({ showBookmarksBar: checked })}
          />
          <ActionRow
            label="Manage bookmarks"
            detail="Open the bookmarks side panel."
            actionLabel="Open"
            icon={<Bookmark aria-hidden="true" />}
            onAction={() => onOpenPanel("bookmarks")}
          />
          <ActionRow
            label="Clear bookmarks"
            detail="Remove all local bookmarks."
            actionLabel="Clear"
            icon={<Trash2 aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Clear all bookmarks?",
                "This removes every local bookmark saved in UltraX.",
                "Clear",
                onClearBookmarks,
              )
            }
          />
          <ComingSoonRow label="Import bookmarks" detail="Planned for browser migration workflows." />
          <ComingSoonRow label="Export bookmarks" detail="Planned for portable backup workflows." />
        </SettingSection>
      );

    case "history":
      return (
        <SettingSection title="History" detail="Review and prune local browsing history.">
          <SelectRow
            label="History retention"
            detail="UltraX keeps only entries inside this window."
            value={settings.historyRetention}
            onChange={(value) => onUpdateSettings({ historyRetention: value as HistoryRetention })}
            options={[
              ["forever", "Forever"],
              ["30-days", "30 days"],
              ["7-days", "7 days"],
            ]}
          />
          <ActionRow
            label="Open history"
            detail="Open the history side panel."
            actionLabel="Open"
            icon={<Clock aria-hidden="true" />}
            onAction={() => onOpenPanel("history")}
          />
          <ActionRow
            label="Clear history"
            detail="Remove all local history entries."
            actionLabel="Clear"
            icon={<Trash2 aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Clear browsing history?",
                "Visited pages will be removed from UltraX history.",
                "Clear",
                onClearHistory,
              )
            }
          />
        </SettingSection>
      );

    case "profiles":
      return (
        <>
          <SettingSection title="Profiles" detail="Profile infrastructure is prepared for future releases.">
            <InfoRow label="Current profile" detail="Default local UltraX profile." />
            <InfoRow label="Storage" detail={runtimeInfo?.userDataPath ?? "User data path unavailable."} />
            <ComingSoonRow label="Add profile" detail="Separate profile storage is planned for v1.1." />
            <ComingSoonRow label="Guest mode" detail="Requires a separate temporary session partition." />
          </SettingSection>
          <EmptyFeature title="Profiles are coming next" detail="v1.0.8 keeps the Settings structure ready without adding speculative account logic." icon={<UserRound aria-hidden="true" />} />
        </>
      );

    case "ai":
      return (
        <>
          <SettingSection title="AI" detail="AI capabilities are intentionally off until a provider and privacy model exist.">
            <InfoRow label="Assistant" detail="Not configured." />
            <InfoRow label="Local data sharing" detail="No browsing data is sent to AI services." />
            <ComingSoonRow label="Provider selection" detail="Will require explicit setup and consent." />
            <ComingSoonRow label="Page summaries" detail="Requires clear per-page privacy controls." />
          </SettingSection>
          <EmptyFeature title="No AI provider connected" detail="UltraX will not invent AI behavior before credentials, privacy controls, and user consent are real." icon={<Bot aria-hidden="true" />} />
        </>
      );

    case "plugins":
      return (
        <>
          <SettingSection title="Plugins" detail="Platform modules are separate from browser-level Extensions.">
            <InfoRow label="Installed plugins" detail="None." />
            <InfoRow label="What plugins are" detail="Broader UltraX platform modules, widgets, and tools." />
            <InfoRow label="What extensions are" detail="Browser-level add-ons with scoped permissions for tabs, sidebar, and local browser features." />
            <ComingSoonRow label="Plugin marketplace" detail="Requires signed native module loading and a separate trust boundary." />
          </SettingSection>
          <EmptyFeature title="Plugin system not enabled" detail="UltraX Browser v1.0.8 keeps Plugins separate while browser Extensions and updates mature." icon={<Puzzle aria-hidden="true" />} />
        </>
      );

    case "extensions":
      return (
        <>
          <SettingSection title="Extensions" detail="Native UltraX add-ons with a sandboxed runtime and explicit permissions.">
            <InfoRow
              label="Installed extensions"
              detail={`${installedExtensions.length} installed, ${enabledExtensionCount} enabled, ${extensionErrorCount} with errors.`}
            />
            <InfoRow
              label="Runtime boundary"
              detail="Panels run inside a sandboxed iframe host and talk to UltraX through typed, permission-checked API calls."
            />
            <SegmentedRow
              label="Section"
              detail="Manage installed extensions, browse the local Store, or use Developer Mode."
              value={extensionTab}
              onChange={(value) => setExtensionTab(value as typeof extensionTab)}
              options={[
                ["installed", "Installed"],
                ["store", "Store"],
                ["developer", "Developer"],
              ]}
            />
          </SettingSection>

          {extensionTab === "installed" && (
            <>
              {installedExtensions.length > 0 ? (
                <section className="grid gap-3">
                  {installedExtensions.map((extension) => (
                    <ExtensionCard
                      key={extension.id}
                      extension={extension}
                      developerMode={settings.extensionDeveloperMode}
                      selected={selectedExtension?.id === extension.id}
                      onDetails={() => setSelectedExtensionId(extension.id)}
                      onToggle={(enabled) => confirmExtensionEnable(extension, enabled)}
                      onOpenPanel={() => onOpenExtensionPanel(extension.id)}
                      onSettings={() =>
                        setExtensionNotice(
                          "Extension settings pages are registered for a future settings host. Use Open Panel for runtime UI.",
                        )
                      }
                      onRemove={() =>
                        requestConfirm(
                          `Remove ${extension.manifest.name}?`,
                          "The extension registration and local UltraX storage for it will be removed. Source files are not deleted.",
                          "Remove",
                          () => {
                            void onRemoveExtension(extension.id)
                              .then(() => {
                                if (selectedExtensionId === extension.id) {
                                  setSelectedExtensionId(null);
                                }
                              })
                              .catch((error) =>
                                setExtensionNotice(
                                  error instanceof Error
                                    ? error.message
                                    : "Extension could not be removed.",
                                ),
                              );
                          },
                        )
                      }
                    />
                  ))}
                </section>
              ) : (
                <EmptyFeature
                  title="No extensions installed"
                  detail="Install a sample from the local Store or load a local folder in Developer Mode."
                  icon={<Blocks aria-hidden="true" />}
                />
              )}

              {selectedExtension ? (
                <ExtensionDetailsPanel
                  extension={selectedExtension}
                  developerMode={settings.extensionDeveloperMode}
                  onClose={() => setSelectedExtensionId(null)}
                  onToggle={(enabled) => confirmExtensionEnable(selectedExtension, enabled)}
                  onReload={reloadExtensions}
                  onOpenPanel={() => onOpenExtensionPanel(selectedExtension.id)}
                  onSettings={() =>
                    setExtensionNotice(
                      "Extension settings pages are registered for a future settings host. Use Open Panel for runtime UI.",
                    )
                  }
                  onClearErrors={() => {
                    void onClearExtensionErrors(selectedExtension.id).then(() =>
                      setExtensionNotice(`${selectedExtension.manifest.name} errors cleared.`),
                    );
                  }}
                  onRemove={() =>
                    requestConfirm(
                      `Remove ${selectedExtension.manifest.name}?`,
                      "The extension registration and local UltraX storage for it will be removed. Source files are not deleted.",
                      "Remove",
                      () => {
                        void onRemoveExtension(selectedExtension.id).then(() =>
                          setSelectedExtensionId(null),
                        );
                      },
                    )
                  }
                />
              ) : (
                <StatusCard
                  title="Select an extension"
                  detail="Open Details on an extension card to inspect permissions, runtime logs, validation warnings, and errors."
                  icon={<Info aria-hidden="true" />}
                />
              )}
            </>
          )}

          {extensionTab === "store" && (
            <>
              <SettingSection title="Local Extension Store" detail="Trusted bundled samples. Remote Store support is intentionally disabled until signing exists.">
                <InfoRow label="Provider" detail={settings.extensionStore.provider === "remote" ? "Remote placeholder disabled" : "Local bundled catalog"} />
                <InfoRow label="Store items" detail={`${extensionStoreItems.length} local listings available.`} />
              </SettingSection>
              <section className="grid gap-3">
                {extensionStoreItems.map((item) => (
                  <ExtensionStoreCard
                    key={item.id}
                    item={item}
                    onInstall={() => installStoreExtension(item)}
                    onDetails={() => setExtensionNotice(`${item.name}: ${item.description}`)}
                    onRemove={() =>
                      requestConfirm(
                        `Remove ${item.name}?`,
                        "The extension registration and local UltraX storage for it will be removed. Bundled Store files stay available.",
                        "Remove",
                        () => {
                          void onRemoveExtension(item.id).catch((error) =>
                            setExtensionNotice(
                              error instanceof Error ? error.message : "Extension could not be removed.",
                            ),
                          );
                        },
                      )
                    }
                  />
                ))}
              </section>
            </>
          )}

          {extensionTab === "developer" && (
            <>
              <SettingSection title="Developer" detail="Load and validate unpacked native UltraX extensions locally.">
                <SwitchRow
                  label="Developer Mode"
                  detail="Allows loading unpacked local UltraX extensions from folders."
                  checked={settings.extensionDeveloperMode}
                  onChange={(checked) => onUpdateSettings({ extensionDeveloperMode: checked })}
                />
                {settings.extensionDeveloperMode ? (
                  <>
                    <ActionRow
                      label="Load unpacked UltraX extension"
                      detail="Choose a folder containing ultrax-extension.json."
                      actionLabel="Load"
                      icon={<Download aria-hidden="true" />}
                      onAction={loadUnpackedExtension}
                    />
                    <ActionRow
                      label="Validate extension folder"
                      detail="Check a manifest and paths without installing it."
                      actionLabel="Validate"
                      icon={<Shield aria-hidden="true" />}
                      onAction={validateUnpackedExtension}
                    />
                    <ActionRow
                      label="Reload extensions"
                      detail="Re-read local manifests and refresh validation errors."
                      actionLabel="Reload"
                      icon={<RefreshCw aria-hidden="true" />}
                      onAction={reloadExtensions}
                    />
                    <ActionRow
                      label="Clear extension errors"
                      detail="Clear runtime error state after fixing a local extension."
                      actionLabel="Clear"
                      icon={<RotateCcw aria-hidden="true" />}
                      onAction={() => {
                        void onClearExtensionErrors().then(() =>
                          setExtensionNotice("Extension errors cleared."),
                        );
                      }}
                    />
                    <ActionRow
                      label="Open extensions folder"
                      detail="Open the local UltraX extensions workspace."
                      actionLabel="Open"
                      icon={<Code2 aria-hidden="true" />}
                      onAction={() => {
                        void onOpenExtensionsFolder().catch((error) =>
                          setExtensionNotice(
                            error instanceof Error
                              ? error.message
                              : "Extensions folder could not be opened.",
                          ),
                        );
                      }}
                    />
                  </>
                ) : (
                  <InfoRow
                    label="Local loading"
                    detail="Turn on Developer Mode to load unpacked UltraX extension folders."
                  />
                )}
              </SettingSection>

              <ExtensionRuntimeLogList extensions={installedExtensions} />
            </>
          )}

          <SettingSection title="Permission Guide" detail="UltraX extensions must request only the capabilities they need.">
            {(Object.keys(extensionPermissionDescriptions) as UltraXExtensionPermission[]).map(
              (permission) => (
                <InfoRow
                  key={permission}
                  label={`${permission}${sensitiveExtensionPermissions.has(permission) ? " (Sensitive)" : ""}`}
                  detail={extensionPermissionDescriptions[permission]}
                />
              ),
            )}
          </SettingSection>

          <StatusCard
            title="UltraX Extension API v1"
            detail="Panels can use extensions.getSelf, storage, tabs, notifications, and sidebar APIs. Content scripts, webRequest, cookies, and Chrome Web Store compatibility remain intentionally outside v1."
            icon={<Shield aria-hidden="true" />}
          />

          {extensionNotice && (
            <StatusCard
              title="Extension status"
              detail={extensionNotice}
              icon={<Activity aria-hidden="true" />}
            />
          )}
        </>
      );

    case "performance":
      return (
        <>
          <SettingSection title="Performance Mode" detail="Choose the overall UltraX performance profile.">
            <SegmentedRow
              label="Mode"
              detail={performanceModeDetails[settings.performanceMode]}
              value={settings.performanceMode}
              onChange={(value) =>
                onUpdateSettings(
                  performanceModePatch(value as BrowserSettings["performanceMode"]),
                )
              }
              options={[
                ["efficiency", "Efficiency"],
                ["balanced", "Balanced"],
                ["performance", "Performance"],
                ["ultra", "Ultra"],
              ]}
            />
            <InfoRow
              label="Estimated effect"
              detail={
                settings.performanceMode === "efficiency"
                  ? "Lower GPU pressure and less background work."
                  : settings.performanceMode === "ultra"
                    ? "Best visual quality with higher CPU/GPU usage."
                    : settings.performanceMode === "performance"
                      ? "More responsive shell and faster New Tab readiness."
                      : "Balanced visuals, memory, and preload behavior."
              }
            />
          </SettingSection>

          <SettingSection title="Shader & Visual Performance" detail="Tune the animated UltraX New Tab surface.">
            <SelectRow
              label="Background shader performance"
              detail="Controls New Tab shader intensity."
              value={settings.backgroundShaderPerformance}
              onChange={(value) =>
                onUpdateSettings({
                  backgroundShaderPerformance:
                    value as BrowserSettings["backgroundShaderPerformance"],
                })
              }
              options={[
                ["low", "Low"],
                ["balanced", "Balanced"],
                ["high", "High"],
                ["ultra", "Ultra"],
              ]}
            />
            <SegmentedRow
              label="Shader FPS cap"
              detail="Prepared for the shader frame scheduler."
              value={settings.shaderFpsCap}
              onChange={(value) =>
                onUpdateSettings({ shaderFpsCap: value as BrowserSettings["shaderFpsCap"] })
              }
              options={[
                ["30", "30 FPS"],
                ["60", "60 FPS"],
                ["unlimited", "Unlimited"],
              ]}
            />
            <SwitchRow
              label="Pause shader when window is unfocused"
              detail="Stops the New Tab animation while UltraX is not focused."
              checked={settings.pauseShaderWhenUnfocused}
              onChange={(checked) => onUpdateSettings({ pauseShaderWhenUnfocused: checked })}
            />
            <SwitchRow
              label="Pause shader on battery saver"
              detail="Persisted as a future hook for battery-state detection."
              checked={settings.pauseShaderOnBatterySaver}
              onChange={(checked) => onUpdateSettings({ pauseShaderOnBatterySaver: checked })}
            />
            <SwitchRow
              label="Disable shader on Efficiency"
              detail="Uses the static backdrop when Efficiency mode is active."
              checked={settings.disableShaderOnEfficiencyMode}
              onChange={(checked) => onUpdateSettings({ disableShaderOnEfficiencyMode: checked })}
            />
            <SwitchRow
              label="Reduced visual effects"
              detail="Uses calmer shell visuals without changing the global accessibility toggle."
              checked={settings.reducedVisualEffects}
              onChange={(checked) => onUpdateSettings({ reducedVisualEffects: checked })}
            />
          </SettingSection>

          <SettingSection title="New Tab Performance" detail="Control how quickly the internal New Tab surface becomes ready.">
            <SwitchRow
              label="Preload New Tab"
              detail="Keep the internal New Tab route ready for quick tab creation."
              checked={settings.preloadNewTab}
              onChange={(checked) => onUpdateSettings({ preloadNewTab: checked })}
            />
            <SwitchRow
              label="Keep New Tab warm in memory"
              detail="Persisted for a future warm renderer cache."
              checked={settings.keepNewTabWarm}
              onChange={(checked) => onUpdateSettings({ keepNewTabWarm: checked })}
            />
            <SwitchRow
              label="Lazy load quick links"
              detail="Shows the first quick-link set before loading extra bookmark tiles."
              checked={settings.lazyLoadQuickLinks}
              onChange={(checked) => onUpdateSettings({ lazyLoadQuickLinks: checked })}
            />
            <SwitchRow
              label="Reduce New Tab animations"
              detail="Keeps New Tab calmer even when global Reduce Motion is off."
              checked={settings.reduceNewTabAnimations}
              onChange={(checked) => onUpdateSettings({ reduceNewTabAnimations: checked })}
            />
            <ActionRow
              label="Clear New Tab cache"
              detail="Clears Chromium cache used by browser and internal surfaces."
              actionLabel="Clear"
              icon={<Trash2 aria-hidden="true" />}
              onAction={() => {
                onClearNetworkCache();
                setPerformanceNotice("New Tab and network cache clear requested.");
              }}
            />
            <InfoRow
              label="Estimated effect"
              detail={
                settings.preloadNewTab || settings.keepNewTabWarm
                  ? "Faster New Tab opening with slightly more background memory."
                  : "Lower idle memory with a colder New Tab start."
              }
            />
          </SettingSection>

          <SettingSection title="Tab Performance" detail="Prepare memory and suspension behavior for heavier sessions.">
            <SwitchRow
              label="Memory Saver"
              detail="Persists the preference for the tab lifecycle engine."
              checked={settings.memorySaver}
              onChange={(checked) => onUpdateSettings({ memorySaver: checked })}
            />
            <SwitchRow
              label="Suspend inactive tabs"
              detail="Future hook for unloading inactive WebContents safely."
              checked={settings.suspendInactiveTabs}
              onChange={(checked) => onUpdateSettings({ suspendInactiveTabs: checked })}
            />
            <SelectRow
              label="Suspend tabs after"
              detail="Choose the inactive time before a tab can be suspended."
              value={settings.suspendTabsAfter}
              onChange={(value) =>
                onUpdateSettings({
                  suspendTabsAfter: value as BrowserSettings["suspendTabsAfter"],
                })
              }
              options={[
                ["5-minutes", "5 minutes"],
                ["15-minutes", "15 minutes"],
                ["30-minutes", "30 minutes"],
                ["1-hour", "1 hour"],
                ["never", "Never"],
              ]}
            />
            <SwitchRow
              label="Always keep pinned tabs active"
              detail="Prepared for pinned tab support."
              checked={settings.keepPinnedTabsActive}
              onChange={(checked) => onUpdateSettings({ keepPinnedTabsActive: checked })}
            />
            <SwitchRow
              label="Always keep audio/video tabs active"
              detail="Avoid suspending media playback when suspension ships."
              checked={settings.keepAudioVideoTabsActive}
              onChange={(checked) => onUpdateSettings({ keepAudioVideoTabsActive: checked })}
            />
            <SwitchRow
              label="Always keep active download tabs active"
              detail="Avoid interrupting pages associated with active downloads."
              checked={settings.keepDownloadsTabsActive}
              onChange={(checked) => onUpdateSettings({ keepDownloadsTabsActive: checked })}
            />
            <TextAreaRow
              label="Never suspend these sites"
              detail="One hostname or URL per line. Saved now, enforced by the future tab lifecycle engine."
              value={settings.neverSuspendSites.join("\n")}
              onChange={(value) =>
                onUpdateSettings({ neverSuspendSites: parseSiteExceptions(value) })
              }
            />
            <InfoRow
              label="Suspended tabs"
              detail="0 currently. Suspension UI is persisted; runtime suspension is a future hook."
            />
          </SettingSection>

          <SettingSection title="Startup & Background Performance" detail="Control launch behavior and minimized background activity.">
            <SwitchRow
              label="Restore last session lazily"
              detail="Prepared to restore heavier sessions with less startup pressure."
              checked={settings.lazyRestoreSession}
              onChange={(checked) => onUpdateSettings({ lazyRestoreSession: checked })}
            />
            <SwitchRow
              label="Load tabs on demand after startup"
              detail="Future hook for delaying inactive restored tab loads."
              checked={settings.loadTabsOnDemand}
              onChange={(checked) => onUpdateSettings({ loadTabsOnDemand: checked })}
            />
            <SwitchRow
              label="Restore only active tab immediately"
              detail="Prioritizes the visible tab when lazy restore is implemented."
              checked={settings.restoreActiveTabOnly}
              onChange={(checked) => onUpdateSettings({ restoreActiveTabOnly: checked })}
            />
            <SwitchRow
              label="Keep UltraX running in background"
              detail="Persisted preference for tray/background mode."
              checked={settings.keepRunningInBackground}
              onChange={(checked) => onUpdateSettings({ keepRunningInBackground: checked })}
            />
            <SwitchRow
              label="Continue downloads in background"
              detail="Prepared for background lifecycle once tray mode exists."
              checked={settings.continueDownloadsInBackground}
              onChange={(checked) => onUpdateSettings({ continueDownloadsInBackground: checked })}
            />
            <SwitchRow
              label="Reduce background activity when minimized"
              detail="Future hook for lowering shell timers when the window is minimized."
              checked={settings.reduceActivityWhenMinimized}
              onChange={(checked) => onUpdateSettings({ reduceActivityWhenMinimized: checked })}
            />
            <SwitchRow
              label="Background update checks"
              detail="Saved for future signed update infrastructure."
              checked={settings.backgroundUpdateChecks}
              onChange={(checked) => onUpdateSettings({ backgroundUpdateChecks: checked })}
            />
          </SettingSection>

          <SettingSection title="Network Performance" detail="Network prediction controls for speed and data usage.">
            <SwitchRow
              label="Preconnect to frequently used sites"
              detail="Prepared for safe origin prediction without exposing browsing data."
              checked={settings.preconnectFrequentSites}
              onChange={(checked) => onUpdateSettings({ preconnectFrequentSites: checked })}
            />
            <SwitchRow
              label="DNS prefetching"
              detail="Persisted preference for Chromium network prediction wiring."
              checked={settings.dnsPrefetching}
              onChange={(checked) => onUpdateSettings({ dnsPrefetching: checked })}
            />
            <SwitchRow
              label="Page preloading"
              detail="Allows future page preload decisions when a safe predictor exists."
              checked={settings.pagePreloading}
              onChange={(checked) => onUpdateSettings({ pagePreloading: checked })}
            />
            <SwitchRow
              label="Predictive navigation"
              detail="Prepared for opt-in navigation prediction."
              checked={settings.predictiveNavigation}
              onChange={(checked) => onUpdateSettings({ predictiveNavigation: checked })}
            />
            <SwitchRow
              label="Reduce data usage"
              detail="Disables aggressive preload defaults in Efficiency mode."
              checked={settings.reduceDataUsage}
              onChange={(checked) => onUpdateSettings({ reduceDataUsage: checked })}
            />
            <ActionRow
              label="Clear network cache"
              detail="Clears Chromium HTTP cache without deleting cookies or local storage."
              actionLabel="Clear"
              icon={<Trash2 aria-hidden="true" />}
              onAction={() => {
                onClearNetworkCache();
                setPerformanceNotice("Network cache clear requested.");
              }}
            />
          </SettingSection>

          <SettingSection title="Hardware & Rendering" detail="Local rendering status and restart-required controls.">
            <InfoRow
              label="Hardware acceleration status"
              detail={
                runtimeInfo?.hardwareAccelerationEnabled
                  ? "Enabled in current process"
                  : "Disabled in current process"
              }
            />
            <SwitchRow
              label="Use hardware acceleration"
              detail="Applied at next UltraX launch because Electron requires startup-time toggling."
              checked={settings.hardwareAcceleration}
              onChange={(checked) => onUpdateSettings({ hardwareAcceleration: checked })}
            />
            <InfoRow
              label="GPU acceleration"
              detail={gpuFeatureStatus.gpu_compositing ?? "Status unavailable"}
            />
            <InfoRow label="WebGL" detail={gpuFeatureStatus.webgl ?? "Status unavailable"} />
            <InfoRow label="WebGL 2" detail={gpuFeatureStatus.webgl2 ?? "Status unavailable"} />
            <InfoRow
              label="Renderer processes"
              detail={
                runtimeInfo
                  ? `${runtimeInfo.processInfo.rendererProcessCount} of ${runtimeInfo.processInfo.processCount} app processes`
                  : "Unavailable"
              }
            />
            <ActionRow
              label="Relaunch UltraX"
              detail="Restart now to apply startup-time rendering settings."
              actionLabel="Relaunch"
              icon={<RefreshCw aria-hidden="true" />}
              onAction={() =>
                requestConfirm(
                  "Relaunch UltraX now?",
                  "Open windows will close and UltraX will start again with the saved rendering settings.",
                  "Relaunch",
                  onRelaunchApp,
                )
              }
            />
            <ActionRow
              label="Open internal diagnostics"
              detail="Inspect the privileged UltraX shell, not remote pages."
              actionLabel="Open"
              icon={<Code2 aria-hidden="true" />}
              onAction={onOpenShellDevTools}
            />
          </SettingSection>

          {hardwareRestartRequired && (
            <StatusCard
              title="Relaunch required"
              detail="The saved hardware acceleration preference differs from the running Electron process."
              icon={<RefreshCw aria-hidden="true" />}
            />
          )}

          <SettingSection title="Diagnostics" detail="Local performance information safe to copy or export.">
            <InfoRow label="App version" detail={`UltraX Browser ${runtimeInfo?.appVersion ?? "1.0.8"}`} />
            <InfoRow label="Electron" detail={runtimeInfo?.electronVersion ?? "Unknown"} />
            <InfoRow label="Chromium" detail={runtimeInfo?.chromiumVersion ?? "Unknown"} />
            <InfoRow label="Node" detail={runtimeInfo?.nodeVersion ?? "Unknown"} />
            <InfoRow
              label="Platform"
              detail={
                runtimeInfo
                  ? `${runtimeInfo.platform} ${runtimeInfo.arch} (${runtimeInfo.buildType})`
                  : "Unknown"
              }
            />
            <InfoRow
              label="Memory usage"
              detail={
                runtimeInfo
                  ? `${runtimeInfo.memoryUsage.heapUsedMB} MB heap, ${runtimeInfo.memoryUsage.rssMB} MB RSS`
                  : "Unavailable"
              }
            />
            <InfoRow label="Open tabs" detail={`${tabCount}`} />
            <InfoRow label="Shader status" detail={shaderRuntimeStatus} />
            <ActionRow
              label="Copy diagnostics"
              detail="Copies a private-data-safe JSON snapshot."
              actionLabel="Copy"
              icon={<Code2 aria-hidden="true" />}
              onAction={copyDiagnostics}
            />
            <ActionRow
              label="Export diagnostics JSON"
              detail="Downloads the same private-data-safe diagnostics payload."
              actionLabel="Export"
              icon={<Download aria-hidden="true" />}
              onAction={exportDiagnostics}
            />
            <ActionRow
              label="Reset performance settings"
              detail="Restores only this Performance page to v1.0.8 defaults."
              actionLabel="Reset"
              icon={<RotateCcw aria-hidden="true" />}
              danger
              onAction={() =>
                requestConfirm(
                  "Reset performance settings?",
                  "Only the Performance page settings will return to the v1.0.8 defaults.",
                  "Reset",
                  () => onUpdateSettings(defaultPerformanceSettings),
                )
              }
            />
          </SettingSection>

          {performanceNotice && (
            <StatusCard
              title="Performance status"
              detail={performanceNotice}
              icon={<Activity aria-hidden="true" />}
            />
          )}
        </>
      );

    case "accessibility":
      return (
        <SettingSection title="Accessibility" detail="Readable, keyboard-friendly controls for the shell.">
          <SwitchRow
            label="Reduce motion"
            detail="Pauses motion-heavy shell effects."
            checked={settings.reducedMotion}
            onChange={(checked) => onUpdateSettings({ reducedMotion: checked })}
          />
          <SwitchRow
            label="Increase contrast"
            detail="Strengthens borders and muted text."
            checked={settings.increaseContrast}
            onChange={(checked) => onUpdateSettings({ increaseContrast: checked })}
          />
          <SegmentedRow
            label="Text size"
            detail="Adjusts UltraX shell text."
            value={settings.textScale}
            onChange={(value) =>
              onUpdateSettings({ textScale: value as BrowserSettings["textScale"] })
            }
            options={[
              ["normal", "Normal"],
              ["large", "Large"],
            ]}
          />
          <RangeRow
            label="Default page zoom"
            detail={`${Math.round(settings.pageZoom * 100)}% for web pages.`}
            min={0.8}
            max={1.25}
            step={0.05}
            value={settings.pageZoom}
            onChange={(pageZoom) => onUpdateSettings({ pageZoom })}
          />
        </SettingSection>
      );

    case "shortcuts":
      return (
        <SettingSection title="Keyboard Shortcuts" detail="Active browser shortcuts in shell and web content.">
          {[
            ["Ctrl/Cmd + L", "Focus address bar"],
            ["Ctrl/Cmd + T", "New tab"],
            ["Ctrl/Cmd + W", "Close tab"],
            ["Ctrl/Cmd + R", "Reload"],
            ["Ctrl/Cmd + Shift + R", "Hard reload"],
            ["Ctrl/Cmd + D", "Toggle bookmark"],
            ["Alt + Left", "Back"],
            ["Alt + Right", "Forward"],
            ["Ctrl/Cmd + Tab", "Next tab"],
          ].map(([keys, detail]) => (
            <InfoRow key={keys} label={keys} detail={detail} />
          ))}
        </SettingSection>
      );

    case "advanced":
      return (
        <SettingSection title="Advanced" detail="Diagnostics and recovery controls.">
          <InfoRow label="Proxy" detail="UltraX uses the system proxy configuration." />
          <ActionRow
            label="Open shell developer tools"
            detail="Inspect the privileged React shell, not remote pages."
            actionLabel="Open"
            icon={<Code2 aria-hidden="true" />}
            onAction={onOpenShellDevTools}
          />
          <ActionRow
            label="Reset settings"
            detail="Restore UltraX preferences to defaults."
            actionLabel="Reset"
            icon={<RotateCcw aria-hidden="true" />}
            danger
            onAction={() =>
              requestConfirm(
                "Reset all UltraX settings?",
                "This restores preferences to the v1.0.8 defaults.",
                "Reset",
                onResetSettings,
              )
            }
          />
          <InfoRow label="Experimental features" detail="No experimental flags are enabled." />
        </SettingSection>
      );

    case "updates": {
      const update = updateStatus ?? {
        status: "idle",
        currentVersion: runtimeInfo?.appVersion ?? "1.0.8",
        channel: settings.updates.channel,
        updateAvailable: false,
        lastCheckedAt: settings.updates.lastCheckedAt,
        source: "github-releases",
        releasesUrl: "https://github.com/easycrashx-nex/UltraX/releases",
        canCheck: true,
        canDownload: false,
        canInstall: false,
      } satisfies UpdateStatusSnapshot;

      return (
        <>
          <SettingSection title="Updates" detail="GitHub Releases update status and release channel.">
            <InfoRow label="Current version" detail={`UltraX Browser ${update.currentVersion}`} />
            <SegmentedRow
              label="Release channel"
              detail="Stable is active now. Beta and Nightly are prepared for future release feeds."
              value={settings.updates.channel}
              onChange={(value) =>
                onUpdateSettings({
                  updates: {
                    ...settings.updates,
                    channel: value as BrowserSettings["updates"]["channel"],
                  },
                })
              }
              options={[
                ["stable", "Stable"],
                ["beta", "Beta"],
                ["nightly", "Nightly"],
              ]}
            />
            <SwitchRow
              label="Auto-check on startup"
              detail="Checks GitHub Releases after launch when enabled."
              checked={settings.updates.autoCheck}
              onChange={(checked) =>
                onUpdateSettings({
                  updates: { ...settings.updates, autoCheck: checked },
                })
              }
            />
            <SwitchRow
              label="Auto-download updates"
              detail="Downloads available updates after a check. Installation still requires confirmation."
              checked={settings.updates.autoDownload}
              onChange={(checked) =>
                onUpdateSettings({
                  updates: { ...settings.updates, autoDownload: checked },
                })
              }
            />
            <SwitchRow
              label="Notify when available"
              detail="Keeps update notifications subtle and user-controlled."
              checked={settings.updates.notifyWhenAvailable}
              onChange={(checked) =>
                onUpdateSettings({
                  updates: { ...settings.updates, notifyWhenAvailable: checked },
                })
              }
            />
          </SettingSection>

          <SettingSection title="In-App Update" detail="Manual check, download progress, and restart controls.">
            <InfoRow label="Status" detail={formatUpdateStatus(update)} />
            <InfoRow label="Latest version" detail={update.latestVersion ?? "Not checked yet"} />
            <InfoRow label="Last checked" detail={formatTimestamp(update.lastCheckedAt)} />
            <InfoRow label="Update source" detail={update.releasesUrl} />
            {update.progress && (
              <>
                <InfoRow
                  label="Download progress"
                  detail={`${Math.round(update.progress.percent)}% - ${formatBytes(update.progress.transferred)} of ${formatBytes(update.progress.total)}`}
                />
                <InfoRow label="Download speed" detail={`${formatBytes(update.progress.bytesPerSecond)}/s`} />
                <InfoRow label="Download size" detail={formatBytes(update.progress.total)} />
              </>
            )}
            {update.error && <InfoRow label="Update error" detail={update.error} />}
            <InlineActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!update.canCheck}
                onClick={() => runUpdateAction(onCheckForUpdates, "Update check finished.")}
                className="rounded-xl"
              >
                <RefreshCw aria-hidden="true" />
                Check for Updates
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!update.canDownload}
                onClick={() => runUpdateAction(onDownloadUpdate, "Update download started.")}
                className="rounded-xl"
              >
                <Download aria-hidden="true" />
                Download Update
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!update.canInstall}
                onClick={() => runUpdateAction(onInstallUpdate, "UltraX is restarting to update.")}
                className="rounded-xl"
              >
                <RefreshCw aria-hidden="true" />
                Install and Restart
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  void onOpenReleasesPage().catch((error) =>
                    setUpdateNotice(
                      error instanceof Error ? error.message : "Release page could not be opened.",
                    ),
                  )
                }
                className="rounded-xl"
              >
                <Globe2 aria-hidden="true" />
                Releases
              </Button>
            </InlineActions>
          </SettingSection>

          {update.releaseNotes && (
            <SettingSection title="Release Notes" detail={update.releaseName ?? "Latest update notes from the release feed."}>
              <div className="whitespace-pre-wrap px-5 py-4 text-xs leading-5 text-muted-foreground">
                {update.releaseNotes}
              </div>
            </SettingSection>
          )}

          {updateNotice && (
            <StatusCard title="Update status" detail={updateNotice} icon={<RefreshCw aria-hidden="true" />} />
          )}

          <StatusCard
            title="Manual installer updates still work"
            detail="You can always download the latest Setup EXE from GitHub Releases and run it manually. In-app updates use the same trusted release feed."
            icon={<Download aria-hidden="true" />}
          />

          <SettingSection title="Release Security" detail="What is prepared now and what still needs production setup.">
            <InfoRow label="Provider" detail="GitHub Releases via electron-updater." />
            <InfoRow label="Install behavior" detail="Never installs silently; restart requires user action." />
            <InfoRow label="Code signing" detail="Not configured yet. Unsigned builds may trigger Windows SmartScreen." />
          </SettingSection>
        </>
      );
    }

    case "about":
      return (
        <>
          <SettingSection title="About UltraX" detail="Build and engine information.">
            <InfoRow label="App" detail={`UltraX Browser ${runtimeInfo?.appVersion ?? "1.0.8"}`} />
            <InfoRow label="Electron" detail={runtimeInfo?.electronVersion ?? "Unknown"} />
            <InfoRow label="Chromium" detail={runtimeInfo?.chromiumVersion ?? "Unknown"} />
            <InfoRow label="Node" detail={runtimeInfo?.nodeVersion ?? "Unknown"} />
            <InfoRow
              label="Platform"
              detail={
                runtimeInfo
                  ? `${runtimeInfo.platform} ${runtimeInfo.arch} (${runtimeInfo.buildType})`
                  : "Unknown"
              }
            />
            <InfoRow label="License" detail="Project-local MVP placeholder." />
          </SettingSection>
          <StatusCard
            title="UltraX Browser v1.0.8"
            detail="Search suggestions, release trust hygiene, GitHub Releases updates, native Extensions, and preserved Chromium browser security."
            icon={<Sparkles aria-hidden="true" />}
          />
        </>
      );
  }
}

function PageTitle({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/16 text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08),0_14px_34px_hsl(var(--primary)/0.14)] [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </span>
    </div>
  );
}

function SettingSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-card overflow-hidden rounded-3xl border border-border/62 bg-card/62 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_54px_hsl(225_40%_2%/0.24)] backdrop-blur-xl">
      <header className="border-b border-border/46 px-5 py-4">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </header>
      <div className="divide-y divide-border/42">{children}</div>
    </section>
  );
}

function SwitchRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <RowText label={label} detail={detail} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 rounded-full border outline-none transition duration-200 focus-visible:ring-[4px] focus-visible:ring-ring/24",
          checked
            ? "border-primary/70 bg-primary shadow-[0_8px_20px_hsl(var(--primary)/0.26)]"
            : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-primary shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        >
          {checked && <Check aria-hidden="true" className="size-3" />}
        </span>
      </button>
    </div>
  );
}

function SegmentedRow({
  label,
  detail,
  value,
  options,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="settings-row items-start">
      <RowText label={label} detail={detail} />
      <div className="flex rounded-xl border border-border/70 bg-background/58 p-1 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]">
        {options.map(([optionValue, labelText]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={cn(
              "min-w-16 rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/24",
              value === optionValue
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {labelText}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  detail,
  value,
  options,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-row">
      <RowText label={label} detail={detail} />
      <span className="relative w-56">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-border/72 bg-background/64 px-3 pr-9 text-[13px] text-foreground outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition focus:border-primary/65 focus:ring-[4px] focus:ring-primary/14"
        >
          {options.map(([optionValue, labelText]) => (
            <option key={optionValue} value={optionValue}>
              {labelText}
            </option>
          ))}
        </select>
        <ChevronRight
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 rotate-90 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

function TextRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-row">
      <RowText label={label} detail={detail} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-64 rounded-xl border border-border/72 bg-background/64 px-3 text-[13px] text-foreground outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition placeholder:text-muted-foreground focus:border-primary/65 focus:ring-[4px] focus:ring-primary/14"
      />
    </label>
  );
}

function ColorInputRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-row">
      <RowText label={label} detail={detail} />
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#050608"}
          onChange={(event) => onChange(event.target.value)}
          className="size-10 rounded-xl border border-border/72 bg-background/64 p-1"
        />
        <input
          value={value}
          readOnly
          aria-label={`${label} value`}
          className="h-10 w-28 rounded-xl border border-border/72 bg-background/64 px-3 text-[13px] text-foreground outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition focus:border-primary/65 focus:ring-[4px] focus:ring-primary/14"
        />
      </span>
    </label>
  );
}

function TextAreaRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-row items-start">
      <RowText label={label} detail={detail} />
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-64 resize-none rounded-xl border border-border/72 bg-background/64 px-3 py-2 text-[13px] text-foreground outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] transition focus:border-primary/65 focus:ring-[4px] focus:ring-primary/14"
      />
    </label>
  );
}

function RangeRow({
  label,
  detail,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settings-row">
      <RowText label={label} detail={detail} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-56 accent-primary"
      />
    </label>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
}) {
  return (
    <div className="settings-row">
      <RowText label="Accent color" detail="Used for focus, buttons, and highlights." />
      <div className="flex justify-end gap-2">
        {accentColors.map(([accent, label, className]) => (
          <button
            key={accent}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={value === accent}
            onClick={() => onChange(accent)}
            className={cn(
              "size-8 rounded-full border border-white/30 outline-none ring-offset-2 ring-offset-background transition duration-200 focus-visible:ring-[4px] focus-visible:ring-ring/30",
              className,
              value === accent && "scale-110 ring-2 ring-white/80",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ActionRow({
  label,
  detail,
  actionLabel,
  icon,
  danger,
  onAction,
}: {
  label: string;
  detail: string;
  actionLabel: string;
  icon: ReactNode;
  danger?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="settings-row">
      <RowText label={label} detail={detail} />
      <Button
        type="button"
        variant={danger ? "danger" : "outline"}
        size="sm"
        onClick={onAction}
        className="rounded-xl"
      >
        {icon}
        {actionLabel}
      </Button>
    </div>
  );
}

function InfoRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="settings-row">
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <span className="max-w-[340px] text-right text-xs leading-5 text-muted-foreground">
        {detail}
      </span>
    </div>
  );
}

function ComingSoonRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="settings-row opacity-85">
      <RowText label={label} detail={detail} />
      <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        Coming soon
      </span>
    </div>
  );
}

function InlineActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 px-5 py-3">{children}</div>;
}

function RowText({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[13px] font-medium text-foreground">{label}</span>
      <span className="mt-0.5 block max-w-[360px] text-xs leading-5 text-muted-foreground">
        {detail}
      </span>
    </span>
  );
}

function StatusCard({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <section className="settings-card flex items-start gap-4 rounded-3xl border border-border/60 bg-primary/10 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary/16 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </span>
    </section>
  );
}

function AppearancePreview({ settings }: { settings: BrowserSettings }) {
  const radiusClass =
    settings.cornerRadius === "subtle"
      ? "rounded-lg"
      : settings.cornerRadius === "ultra-rounded"
        ? "rounded-[2rem]"
        : "rounded-2xl";
  const densityClass =
    settings.toolbarDensity === "compact"
      ? "gap-2 p-3"
      : settings.toolbarDensity === "spacious"
        ? "gap-4 p-5"
        : "gap-3 p-4";
  const transparencyClass =
    settings.panelTransparency === "low"
      ? "bg-card/88"
      : settings.panelTransparency === "high"
        ? "bg-card/48"
        : "bg-card/68";

  return (
    <section
      className={cn(
        "settings-card overflow-hidden border border-border/62 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_54px_hsl(225_40%_2%/0.24)]",
        radiusClass,
        transparencyClass,
      )}
    >
      <div className={cn("relative min-h-44", densityClass)}>
        <div className="absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,hsl(var(--primary)/0.28),transparent_30%),radial-gradient(circle_at_82%_70%,hsl(188_93%_48%/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--card)))]" />
        </div>
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-7 w-24 rounded-t-xl border border-border/70 border-b-card bg-card/92" />
            <span className="grid size-7 place-items-center rounded-lg border border-border/60 bg-background/42 text-primary">
              +
            </span>
            <span className="ml-auto h-2 w-12 rounded-full bg-primary/70" />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border/64 bg-background/50 px-3 py-2">
            <span className="size-3 rounded-full bg-primary" />
            <span className="h-2 flex-1 rounded-full bg-muted" />
            <span className="size-5 rounded-lg bg-primary/18" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className={cn("h-14 border border-border/60 bg-background/45", radiusClass)} />
            <span className={cn("h-14 border border-primary/45 bg-primary/12", radiusClass)} />
            <span className={cn("h-14 border border-border/60 bg-background/45", radiusClass)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ExtensionCard({
  extension,
  developerMode,
  selected,
  onDetails,
  onToggle,
  onOpenPanel,
  onSettings,
  onRemove,
}: {
  extension: InstalledExtension;
  developerMode: boolean;
  selected: boolean;
  onDetails: () => void;
  onToggle: (enabled: boolean) => void;
  onOpenPanel: () => void;
  onSettings: () => void;
  onRemove: () => void;
}) {
  const canRemove = extension.source !== "builtin" && developerMode;
  const canOpenPanel = Boolean(extension.manifest.panel && extension.enabled && extension.status !== "error");

  return (
    <section
      className={cn(
        "settings-card rounded-3xl border bg-card/62 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_54px_hsl(225_40%_2%/0.2)] backdrop-blur-xl transition",
        selected ? "border-primary/55" : "border-border/62",
      )}
    >
      <div className="flex items-start gap-4">
        <ExtensionIcon extension={extension} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold">{extension.manifest.name}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                v{extension.manifest.version}
                {extension.manifest.author ? ` by ${extension.manifest.author}` : ""}
              </p>
            </span>
            <ExtensionStatusBadge extension={extension} />
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {extension.manifest.description ?? "No description provided."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {extension.manifest.permissions.slice(0, 5).map((permission) => (
              <PermissionPill key={permission} permission={permission} />
            ))}
            {extension.manifest.permissions.length > 5 && (
              <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">
                +{extension.manifest.permissions.length - 5} more
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={extension.enabled}
          onClick={() => onToggle(!extension.enabled)}
          className={cn(
            "relative h-7 w-12 rounded-full border outline-none transition duration-200 focus-visible:ring-[4px] focus-visible:ring-ring/24",
            extension.enabled
              ? "border-primary/70 bg-primary shadow-[0_8px_20px_hsl(var(--primary)/0.26)]"
              : "border-border bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-primary shadow-sm transition-transform duration-200",
              extension.enabled ? "translate-x-5" : "translate-x-0.5",
            )}
          >
            {extension.enabled && <Check aria-hidden="true" className="size-3" />}
          </span>
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDetails} className="rounded-xl">
            <Info aria-hidden="true" />
            Details
          </Button>
          {extension.manifest.panel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenPanel}
              disabled={!canOpenPanel}
              className="rounded-xl"
            >
              <Blocks aria-hidden="true" />
              Open Panel
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onSettings} className="rounded-xl">
            <SlidersHorizontal aria-hidden="true" />
            Settings
          </Button>
          {canRemove && (
            <Button type="button" variant="danger" size="sm" onClick={onRemove} className="rounded-xl">
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ExtensionDetailsPanel({
  extension,
  developerMode,
  onClose,
  onToggle,
  onReload,
  onOpenPanel,
  onSettings,
  onClearErrors,
  onRemove,
}: {
  extension: InstalledExtension;
  developerMode: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onReload: () => void;
  onOpenPanel: () => void;
  onSettings: () => void;
  onClearErrors: () => void;
  onRemove: () => void;
}) {
  const canOpenPanel = Boolean(extension.manifest.panel && extension.enabled && extension.status !== "error");

  return (
    <section className="settings-card overflow-hidden rounded-3xl border border-border/62 bg-card/62 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_54px_hsl(225_40%_2%/0.24)] backdrop-blur-xl">
      <header className="flex items-start justify-between gap-4 border-b border-border/46 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <ExtensionIcon extension={extension} />
          <span className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold">{extension.manifest.name}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {extension.manifest.description ?? "No description provided."}
            </p>
          </span>
        </div>
        <Button type="button" variant="chrome" size="icon" onClick={onClose} className="rounded-xl">
          <X aria-hidden="true" />
        </Button>
      </header>
      <div className="divide-y divide-border/42">
        <InfoRow label="Extension ID" detail={extension.id} />
        <InfoRow label="Version" detail={extension.manifest.version} />
        <InfoRow label="Author" detail={extension.manifest.author ?? "Unknown"} />
        <InfoRow label="Source" detail={extension.source === "builtin" ? "Built-in UltraX extension" : "Local developer extension"} />
        <InfoRow label="Install path" detail={extension.installPath ?? "Not available"} />
        <InfoRow label="Status" detail={extension.status} />
        <InfoRow label="Developer Mode" detail={extension.developerMode ? "Required" : "Not required"} />
        <div className="settings-row items-start">
          <RowText label="Requested permissions" detail="Only requested permissions can be used by the future runtime API." />
          <div className="flex max-w-[330px] flex-wrap justify-end gap-1.5">
            {extension.manifest.permissions.map((permission) => (
              <PermissionPill key={permission} permission={permission} />
            ))}
          </div>
        </div>
        {developerMode && extension.validationWarnings.length > 0 && (
          <InfoRow label="Validation" detail={extension.validationWarnings.join(" ")} />
        )}
        {developerMode && extension.errors.length > 0 && (
          <InfoRow label="Errors" detail={extension.errors.join(" ")} />
        )}
        {extension.runtimeLogs.length > 0 && (
          <InfoRow
            label="Runtime logs"
            detail={extension.runtimeLogs.slice(0, 3).map((log) => `${log.level}: ${log.message}`).join(" ")}
          />
        )}
        <InlineActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggle(!extension.enabled)}
            className="rounded-xl"
          >
            <Check aria-hidden="true" />
            {extension.enabled ? "Disable" : "Enable"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onReload} className="rounded-xl">
            <RefreshCw aria-hidden="true" />
            Reload
          </Button>
          {extension.manifest.panel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenPanel}
              disabled={!canOpenPanel}
              className="rounded-xl"
            >
              <Blocks aria-hidden="true" />
              Open Panel
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onSettings} className="rounded-xl">
            <SlidersHorizontal aria-hidden="true" />
            Settings
          </Button>
          {developerMode && extension.errors.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={onClearErrors} className="rounded-xl">
              <RotateCcw aria-hidden="true" />
              Clear Errors
            </Button>
          )}
          {extension.source !== "builtin" && developerMode && (
            <Button type="button" variant="danger" size="sm" onClick={onRemove} className="rounded-xl">
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          )}
        </InlineActions>
      </div>
    </section>
  );
}

function ExtensionStoreCard({
  item,
  onInstall,
  onDetails,
  onRemove,
}: {
  item: ExtensionStoreItem;
  onInstall: () => void;
  onDetails: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="settings-card rounded-3xl border border-border/62 bg-card/62 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_54px_hsl(225_40%_2%/0.2)] backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/16 text-base font-semibold text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]">
          {item.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold">{item.name}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                v{item.version} by {item.author} - {item.category}
              </p>
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                item.installed
                  ? "border-primary/38 bg-primary/14 text-primary"
                  : "border-border/60 bg-background/50 text-muted-foreground",
              )}
            >
              {item.updateAvailable ? "Update Available" : item.installed ? "Installed" : "Not Installed"}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.permissions.map((permission) => (
              <PermissionPill key={permission} permission={permission} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDetails} className="rounded-xl">
          <Info aria-hidden="true" />
          Details
        </Button>
        {item.installed ? (
          <Button type="button" variant="danger" size="sm" onClick={onRemove} className="rounded-xl">
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onInstall} className="rounded-xl">
            <Download aria-hidden="true" />
            Install
          </Button>
        )}
      </div>
    </section>
  );
}

function ExtensionRuntimeLogList({ extensions }: { extensions: InstalledExtension[] }) {
  const logs = extensions
    .flatMap((extension) =>
      extension.runtimeLogs.map((log) => ({
        ...log,
        extensionName: extension.manifest.name,
      })),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 16);

  if (logs.length === 0) {
    return (
      <StatusCard
        title="Runtime logs"
        detail="No extension runtime logs yet. Open an extension panel or run a local extension to see activity here."
        icon={<Activity aria-hidden="true" />}
      />
    );
  }

  return (
    <SettingSection title="Runtime Logs" detail="Recent sandbox host events and extension API activity.">
      {logs.map((log) => (
        <InfoRow
          key={log.id}
          label={`${log.extensionName} - ${log.level}`}
          detail={`${new Date(log.timestamp).toLocaleTimeString()} - ${log.message}`}
        />
      ))}
    </SettingSection>
  );
}

function ExtensionIcon({ extension }: { extension: InstalledExtension }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/16 text-base font-semibold text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)]">
      {extension.manifest.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ExtensionStatusBadge({ extension }: { extension: InstalledExtension }) {
  const label =
    extension.status === "error"
      ? "Error"
      : extension.enabled
        ? extension.developerMode
          ? "Developer Mode"
          : "Enabled"
        : "Disabled";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        extension.status === "error"
          ? "border-red-400/40 bg-red-500/12 text-red-200"
          : extension.enabled
            ? "border-primary/38 bg-primary/14 text-primary"
            : "border-border/60 bg-background/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function PermissionPill({ permission }: { permission: UltraXExtensionPermission }) {
  const sensitive = sensitiveExtensionPermissions.has(permission);

  return (
    <span
      title={extensionPermissionDescriptions[permission]}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        sensitive
          ? "border-amber-300/36 bg-amber-400/12 text-amber-100"
          : "border-border/60 bg-background/50 text-muted-foreground",
      )}
    >
      {permission}
    </span>
  );
}

function EmptyFeature({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <section className="settings-card flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary/70 text-primary [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p>
    </section>
  );
}

function ConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-background/50 p-8 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={state.title}
        className="settings-modal w-full max-w-sm rounded-3xl border border-border/70 bg-popover/94 p-5 shadow-2xl shadow-black/45 backdrop-blur-2xl"
      >
        <h2 className="text-base font-semibold">{state.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{state.detail}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} className="rounded-xl">
            {state.actionLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
