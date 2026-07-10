import type {
  BrowserState,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  RuntimeInfo,
  ShortcutAction,
  UpdateStatusSnapshot,
} from "@shared/types";
import { resolveShortcutAction } from "@shared/shortcuts";
import { AlertTriangle, RotateCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAddressValue } from "@/lib/browser";
import { DownloadShelf } from "./DownloadShelf";
import { FindBar } from "./FindBar";
import { NewTabPage } from "./NewTabPage";
import { QuickSettings } from "./QuickSettings";
import { SettingsPage } from "./SettingsPage";
import { SidePanel } from "./SidePanel";
import { TabStrip } from "./TabStrip";
import { Toolbar } from "./Toolbar";
import type { PanelId, SettingsCategoryId } from "./types";

type BrowserShellProps = {
  state: BrowserState;
};

export function BrowserShell({ state }: BrowserShellProps) {
  const [activePanel, setActivePanel] = useState<PanelId>(null);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategoryId>("general");
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusSnapshot | null>(null);
  const [extensionStoreItems, setExtensionStoreItems] = useState<ExtensionStoreItem[]>([]);
  const [extensionPanel, setExtensionPanel] = useState<ExtensionPanelDescriptor | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [restoreTabsNextClose, setRestoreTabsNextClose] = useState(
    state.settings.closeBehavior !== "close-and-discard-session",
  );
  const activeTab = useMemo(
    () => state.tabs.find((tab) => tab.id === state.activeTabId),
    [state.activeTabId, state.tabs],
  );
  const [addressValue, setAddressValue] = useState(getAddressValue(activeTab));
  const addressInputRef = useRef<HTMLInputElement>(null);

  const invokeShortcut = useCallback((action: ShortcutAction) => {
    switch (action) {
      case "focusAddressBar":
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
        return;
      case "newTab": void window.ultraX.createTab(); return;
      case "closeTab": if (activeTab) void window.ultraX.closeTab(activeTab.id); return;
      case "reopenClosedTab": void window.ultraX.reopenClosedTab(); return;
      case "nextTab": void window.ultraX.nextTab(); return;
      case "previousTab": void window.ultraX.previousTab(); return;
      case "reload": void window.ultraX.reload(); return;
      case "hardReload": void window.ultraX.hardReload(); return;
      case "back": void window.ultraX.goBack(); return;
      case "forward": void window.ultraX.goForward(); return;
      case "toggleBookmark": void window.ultraX.toggleBookmark(); return;
      case "toggleBookmarksBar":
        void window.ultraX.updateSettings({ showBookmarksBar: !state.settings.showBookmarksBar });
        return;
      case "findInPage": setFindOpen(true); return;
      case "openHistory":
      case "openDownloads":
        setSettingsOpen(false);
        setQuickSettingsOpen(false);
        setExtensionPanel(null);
        setActivePanel(action === "openHistory" ? "history" : "downloads");
        return;
      case "openSettings":
      case "clearBrowsingData":
        setActivePanel(null);
        setExtensionPanel(null);
        setQuickSettingsOpen(false);
        setSettingsCategory(action === "clearBrowsingData" ? "privacy" : "general");
        setSettingsOpen(true);
    }
  }, [activeTab, state.settings.showBookmarksBar]);

  useEffect(() => {
    setAddressValue(getAddressValue(activeTab));
  }, [activeTab?.id, activeTab?.url, activeTab?.isNewTab]);

  useEffect(() => {
    return window.ultraX.onFocusAddressBar(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    return window.ultraX.onCloseRequested(() => {
      setRestoreTabsNextClose(state.settings.closeBehavior !== "close-and-discard-session");
      setCloseDialogOpen(true);
    });
  }, [state.settings.closeBehavior]);

  useEffect(() => {
    void window.ultraX.getRuntimeInfo().then(setRuntimeInfo);
  }, []);

  useEffect(() => {
    void window.ultraX.getUpdateStatus().then(setUpdateStatus);
    return window.ultraX.onUpdateStatusChanged(setUpdateStatus);
  }, []);

  useEffect(() => {
    void window.ultraX.listExtensionStore().then(setExtensionStoreItems);
  }, [state.installedExtensions]);

  useEffect(() => {
    const panelInset = settingsOpen
      ? 980
      : activePanel || extensionPanel
        ? 392
        : quickSettingsOpen
          ? 368
          : 0;
    const rightInset = Math.max(panelInset, findOpen ? 380 : 0);

    void window.ultraX.setViewInsets({
      right: rightInset,
      bottom: state.downloads.length > 0 ? 76 : 0,
    });
  }, [activePanel, extensionPanel, findOpen, quickSettingsOpen, settingsOpen, state.downloads.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (findOpen) {
          event.preventDefault();
          setFindOpen(false);
          void window.ultraX.stopFindInPage();
        }
        setQuickSettingsOpen(false);
        setExtensionPanel(null);
        return;
      }

      const action = resolveShortcutAction(event, state.settings.shortcutOverrides);
      if (!action) return;
      event.preventDefault();
      invokeShortcut(action);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [findOpen, invokeShortcut, state.settings.shortcutOverrides]);

  useEffect(() => window.ultraX.onShortcutInvoked(invokeShortcut), [invokeShortcut]);

  const navigate = (input: string) => {
    void window.ultraX.navigate(input);
  };

  const openSettings = (category: SettingsCategoryId = "general") => {
    setActivePanel(null);
    setExtensionPanel(null);
    setQuickSettingsOpen(false);
    setSettingsCategory(category);
    setSettingsOpen(true);
  };

  const openPanel = (panel: PanelId) => {
    setSettingsOpen(false);
    setQuickSettingsOpen(false);
    setExtensionPanel(null);
    setActivePanel(panel);
  };

  const openExtensionPanel = (extensionId: string) => {
    void window.ultraX.openExtensionPanel(extensionId)
      .then((descriptor) => {
        setSettingsOpen(false);
        setQuickSettingsOpen(false);
        setActivePanel(null);
        setExtensionPanel(descriptor);
      })
      .catch((error) => {
        window.alert(error instanceof Error ? error.message : "Extension panel could not be opened.");
      });
  };

  const reloadExtensionPanel = () => {
    if (!extensionPanel) {
      return;
    }

    void window.ultraX.openExtensionPanel(extensionPanel.extensionId).then(setExtensionPanel);
  };

  const handleExtensionApiRequest = async (
    request: ExtensionApiRequest,
  ): Promise<ExtensionApiResponse> => {
    if (!extensionPanel) {
      return {
        requestId: request.requestId,
        ok: false,
        error: "No active extension panel.",
      };
    }

    const response = await window.ultraX.invokeExtensionApi(extensionPanel.extensionId, request);
    if (response.ok && isExtensionSidebarCloseAction(response.result, extensionPanel.extensionId)) {
      setExtensionPanel(null);
    }
    return response;
  };

  const logExtensionRuntimeMessage = (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => {
    void window.ultraX.logExtensionRuntimeMessage(extensionId, level, message);
  };

  const closeWindow = () => {
    if (shouldShowCloseDialog(state)) {
      setRestoreTabsNextClose(state.settings.closeBehavior !== "close-and-discard-session");
      setCloseDialogOpen(true);
      return;
    }

    void window.ultraX.closeWindowWithBehavior(
      state.settings.closeBehavior === "close-and-discard-session",
    );
  };

  const confirmCloseWindow = () => {
    setCloseDialogOpen(false);
    void (async () => {
      const discardSession =
        state.settings.closeBehavior === "close-and-discard-session" && !restoreTabsNextClose;

      if (restoreTabsNextClose && state.settings.closeBehavior === "close-and-discard-session") {
        await window.ultraX.updateSettings({
          closeBehavior: "close-and-restore-session",
          startupBehavior: "restore-session",
          restoreTabsOnLaunch: true,
          confirmBeforeClosingMultipleTabs: false,
        });
      }

      await window.ultraX.closeWindowWithBehavior(discardSession);
    })();
  };

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <TabStrip
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        tabHoverPreviewEnabled={state.settings.tabHoverPreview}
        reducedMotion={state.settings.reducedMotion}
        onCreateTab={() => void window.ultraX.createTab()}
        onReopenClosedTab={() => void window.ultraX.reopenClosedTab()}
        onSwitchTab={(tabId) => void window.ultraX.switchTab(tabId)}
        onCloseTab={(tabId) => void window.ultraX.closeTab(tabId)}
        onDuplicateTab={(tabId) => void window.ultraX.duplicateTab(tabId)}
        onPinTab={(tabId, pinned) => void window.ultraX.pinTab(tabId, pinned)}
        onReorderTab={(tabId, targetTabId, placement) =>
          void window.ultraX.reorderTab(tabId, targetTabId, placement)
        }
        onReloadTab={(tabId) =>
          void window.ultraX.switchTab(tabId).then(() => window.ultraX.reload())
        }
        onCloseOtherTabs={(tabId) => void window.ultraX.closeOtherTabs(tabId)}
        onCloseTabsToRight={(tabId) => void window.ultraX.closeTabsToRight(tabId)}
        onMoveTabToNewWindow={(tabId) => void window.ultraX.moveTabToNewWindow(tabId)}
        onToggleTabMuted={(tabId) => void window.ultraX.toggleTabMuted(tabId)}
        onMinimize={() => void window.ultraX.minimizeWindow()}
        onToggleMaximize={() => void window.ultraX.toggleMaximizeWindow()}
        onCloseWindow={closeWindow}
      />

      <Toolbar
        activeTab={activeTab}
        tabs={state.tabs}
        bookmarks={state.bookmarks}
        history={state.history}
        settings={state.settings}
        addressValue={addressValue}
        addressInputRef={addressInputRef}
        activePanel={activePanel}
        quickSettingsOpen={quickSettingsOpen}
        onAddressChange={setAddressValue}
        onNavigate={navigate}
        onSwitchTab={(tabId) => void window.ultraX.switchTab(tabId)}
        onBack={() => void window.ultraX.goBack()}
        onForward={() => void window.ultraX.goForward()}
        onReload={() => void window.ultraX.reload()}
        onStopLoading={() => void window.ultraX.stopLoading()}
        onHome={() => void window.ultraX.goHome()}
        onToggleBookmark={() => void window.ultraX.toggleBookmark()}
        onOpenBookmark={(bookmarkId) => void window.ultraX.openBookmark(bookmarkId)}
        onOpenPanel={openPanel}
        onToggleQuickSettings={() => {
          setSettingsOpen(false);
          setActivePanel(null);
          setQuickSettingsOpen((open) => !open);
        }}
      />

      <FindBar
        open={findOpen}
        tabId={activeTab?.id ?? "none"}
        onClose={() => {
          setFindOpen(false);
          void window.ultraX.stopFindInPage();
        }}
      />

      <QuickSettings
        open={quickSettingsOpen}
        settings={state.settings}
        downloads={state.downloads}
        installedExtensions={state.installedExtensions}
        runtimeInfo={runtimeInfo}
        updateStatus={updateStatus}
        onClose={() => setQuickSettingsOpen(false)}
        onOpenSettings={openSettings}
        onUpdateSettings={(settings) => void window.ultraX.updateSettings(settings)}
        onOpenExtensionPanel={openExtensionPanel}
        onSetExtensionEnabled={(extensionId, enabled) =>
          window.ultraX.setExtensionEnabled(extensionId, enabled).then(() => {
            if (!enabled && extensionPanel?.extensionId === extensionId) {
              setExtensionPanel(null);
            }
          })
        }
        onClearHistory={() => void window.ultraX.clearHistory()}
        onOpenDownloads={() => openPanel("downloads")}
      />

      <SettingsPage
        open={settingsOpen}
        activeCategory={settingsCategory}
        settings={state.settings}
        runtimeInfo={runtimeInfo}
        updateStatus={updateStatus}
        tabCount={state.tabs.length}
        installedExtensions={state.installedExtensions}
        extensionStoreItems={extensionStoreItems}
        onClose={() => setSettingsOpen(false)}
        onCategoryChange={setSettingsCategory}
        onOpenPanel={openPanel}
        onUpdateSettings={(settings) => void window.ultraX.updateSettings(settings)}
        onClearHistory={() => void window.ultraX.clearHistory()}
        onClearBrowserData={() => void window.ultraX.clearBrowserData()}
        onClearNetworkCache={() => void window.ultraX.clearNetworkCache()}
        onClearDownloads={() => void window.ultraX.clearDownloads()}
        onClearBookmarks={() => void window.ultraX.clearBookmarks()}
        onImportBookmarks={(policy) => window.ultraX.importBookmarks(policy)}
        onExportBookmarks={() => window.ultraX.exportBookmarks()}
        onChooseDownloadFolder={() => void window.ultraX.chooseDownloadFolder()}
        onOpenDownloadsFolder={() => void window.ultraX.openDownloadsFolder()}
        onChooseNewTabCustomImage={() => window.ultraX.chooseNewTabCustomImage()}
        onRemoveNewTabCustomImage={() => window.ultraX.removeNewTabCustomImage()}
        onResetSettings={() => void window.ultraX.resetSettings()}
        onOpenShellDevTools={() => void window.ultraX.openShellDevTools()}
        onRelaunchApp={() => void window.ultraX.relaunchApp()}
        onCheckForUpdates={() =>
          window.ultraX.checkForUpdates().then((status) => {
            setUpdateStatus(status);
            return status;
          })
        }
        onDownloadUpdate={() =>
          window.ultraX.downloadUpdate().then((status) => {
            setUpdateStatus(status);
            return status;
          })
        }
        onInstallUpdate={() =>
          window.ultraX.installUpdate().then((status) => {
            setUpdateStatus(status);
            return status;
          })
        }
        onOpenReleasesPage={() => window.ultraX.openReleasesPage()}
        onEnsureExtensionsWorkspace={() => window.ultraX.ensureExtensionsWorkspace()}
        onLoadUnpackedExtension={() => window.ultraX.loadUnpackedExtension()}
        onValidateUnpackedExtension={() => window.ultraX.validateUnpackedExtension()}
        onSetExtensionEnabled={(extensionId, enabled) =>
          window.ultraX.setExtensionEnabled(extensionId, enabled)
        }
        onRemoveExtension={(extensionId) => window.ultraX.removeExtension(extensionId)}
        onReloadExtensions={() => window.ultraX.reloadExtensions()}
        onOpenExtensionsFolder={() => window.ultraX.openExtensionsFolder()}
        onInstallStoreExtension={(extensionId) =>
          window.ultraX.installStoreExtension(extensionId).then((extension) => {
            void window.ultraX.listExtensionStore().then(setExtensionStoreItems);
            return extension;
          })
        }
        onOpenExtensionPanel={openExtensionPanel}
        onClearExtensionErrors={(extensionId) => window.ultraX.clearExtensionErrors(extensionId)}
      />

      {activeTab?.isNewTab && (
        <NewTabPage
          bookmarks={state.bookmarks}
          settings={state.settings}
          onNavigate={navigate}
          onOpenBookmark={(bookmarkId) => void window.ultraX.openBookmark(bookmarkId)}
          onOpenPanel={(panel) => {
            if (panel === null) {
              openPanel(null);
            } else {
              openPanel(panel);
            }
          }}
          onOpenSettings={() => openSettings()}
        />
      )}

      {activeTab?.error && !activeTab.isNewTab && (
        <ErrorSurface
          title={activeTab.title}
          detail={activeTab.error}
          onReload={() => void window.ultraX.reload()}
          onHome={() => void window.ultraX.goHome()}
        />
      )}

      <SidePanel
        panel={activePanel}
        bookmarks={state.bookmarks}
        history={state.history}
        downloads={state.downloads}
        extensionPanel={extensionPanel}
        developerMode={state.settings.extensionDeveloperMode}
        onClose={() => setActivePanel(null)}
        onCloseExtensionPanel={() => setExtensionPanel(null)}
        onReloadExtensionPanel={reloadExtensionPanel}
        onExtensionApiRequest={handleExtensionApiRequest}
        onExtensionLog={logExtensionRuntimeMessage}
        onOpenBookmark={(bookmarkId) => void window.ultraX.openBookmark(bookmarkId)}
        onRemoveBookmark={(bookmarkId) => void window.ultraX.removeBookmark(bookmarkId)}
        onOpenHistoryEntry={(entryId) => void window.ultraX.openHistoryEntry(entryId)}
        onClearHistory={() => void window.ultraX.clearHistory()}
        onOpenDownload={(downloadId) => void window.ultraX.openDownload(downloadId)}
        onRevealDownload={(downloadId) => void window.ultraX.revealDownload(downloadId)}
      />

      <DownloadShelf
        downloads={state.downloads}
        panelOpen={Boolean(activePanel)}
        onOpenDownload={(downloadId) => void window.ultraX.openDownload(downloadId)}
        onRevealDownload={(downloadId) => void window.ultraX.revealDownload(downloadId)}
      />

      {closeDialogOpen && (
        <CloseUltraXDialog
          tabCount={state.tabs.filter((tab) => !tab.isNewTab).length}
          hasActiveDownloads={state.downloads.some((download) => download.state === "progressing")}
          restoreTabsNextClose={restoreTabsNextClose}
          closeBehavior={state.settings.closeBehavior}
          onRestoreTabsChange={setRestoreTabsNextClose}
          onCancel={() => setCloseDialogOpen(false)}
          onConfirm={confirmCloseWindow}
          onOpenSettings={() => {
            setCloseDialogOpen(false);
            openSettings("tabs");
          }}
        />
      )}
    </div>
  );
}

function shouldShowCloseDialog(state: BrowserState): boolean {
  if (state.downloads.some((download) => download.state === "progressing")) {
    return true;
  }

  if (state.settings.closeBehavior !== "ask-before-closing-multiple-tabs") {
    return false;
  }

  return state.tabs.filter((tab) => !tab.isNewTab).length > 1;
}

function isExtensionSidebarCloseAction(result: unknown, extensionId: string): boolean {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    (result as { action?: unknown; extensionId?: unknown }).action === "close-sidebar" &&
    (result as { extensionId?: unknown }).extensionId === extensionId
  );
}

function ErrorSurface({
  title,
  detail,
  onReload,
  onHome,
}: {
  title: string;
  detail: string;
  onReload: () => void;
  onHome: () => void;
}) {
  return (
    <main className="browser-content-start fixed inset-x-0 bottom-0 flex items-center justify-center bg-background px-6">
      <div className="glass-panel flex max-w-xl flex-col items-center gap-5 rounded-xl p-8 text-center">
        <div className="grid size-12 place-items-center rounded-lg bg-secondary text-primary">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">{title || "Page failed"}</h1>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={onReload}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={onHome}>
            New Tab
          </Button>
        </div>
      </div>
    </main>
  );
}

function CloseUltraXDialog({
  tabCount,
  hasActiveDownloads,
  restoreTabsNextClose,
  closeBehavior,
  onRestoreTabsChange,
  onCancel,
  onConfirm,
  onOpenSettings,
}: {
  tabCount: number;
  hasActiveDownloads: boolean;
  restoreTabsNextClose: boolean;
  closeBehavior: BrowserState["settings"]["closeBehavior"];
  onRestoreTabsChange: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenSettings: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const title = hasActiveDownloads ? "Close while downloads are active?" : "Close UltraX?";
  const detail = hasActiveDownloads
    ? "UltraX has active downloads. Closing now may interrupt them depending on the site and connection."
    : restoreTabsNextClose
      ? `${tabCount} tabs will be saved and restored the next time UltraX opens.`
      : `${tabCount} tabs will be closed and the next launch will start with a clean New Tab.`;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/54 p-8 backdrop-blur-md">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="close-ultrax-title"
        aria-describedby="close-ultrax-detail"
        className="settings-modal no-drag w-full max-w-md rounded-3xl border border-border/70 bg-popover/96 p-5 text-foreground shadow-2xl shadow-black/55 backdrop-blur-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/16 text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="close-ultrax-title" className="text-base font-semibold">
              {title}
            </h2>
            <p id="close-ultrax-detail" className="mt-2 text-sm leading-6 text-muted-foreground">
              {detail}
            </p>
          </div>
        </div>

        {closeBehavior !== "ask-before-closing-multiple-tabs" && (
          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/45 px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={restoreTabsNextClose}
              onChange={(event) => onRestoreTabsChange(event.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">Always restore tabs next time</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Saves this window session before UltraX closes.
              </span>
            </span>
          </label>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onOpenSettings} className="rounded-xl">
            Settings
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl">
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm} className="rounded-xl">
              Close UltraX
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
