import type {
  BrowserState,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  ExtensionStoreItem,
  RuntimeInfo,
  UpdateStatusSnapshot,
} from "@shared/types";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAddressValue } from "@/lib/browser";
import { DownloadShelf } from "./DownloadShelf";
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
  const activeTab = useMemo(
    () => state.tabs.find((tab) => tab.id === state.activeTabId),
    [state.activeTabId, state.tabs],
  );
  const [addressValue, setAddressValue] = useState(getAddressValue(activeTab));
  const addressInputRef = useRef<HTMLInputElement>(null);

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
    const rightInset = settingsOpen
      ? 980
      : activePanel || extensionPanel
        ? 392
        : quickSettingsOpen
          ? 368
          : 0;

    void window.ultraX.setViewInsets({
      right: rightInset,
      bottom: state.downloads.length > 0 ? 76 : 0,
    });
  }, [activePanel, extensionPanel, quickSettingsOpen, settingsOpen, state.downloads.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      if (mod && key === "l") {
        event.preventDefault();
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
        return;
      }

      if (mod && key === "t") {
        event.preventDefault();
        void window.ultraX.createTab();
        return;
      }

      if (mod && key === "w" && activeTab) {
        event.preventDefault();
        void window.ultraX.closeTab(activeTab.id);
        return;
      }

      if (mod && key === "r") {
        event.preventDefault();
        if (event.shiftKey) {
          void window.ultraX.hardReload();
        } else {
          void window.ultraX.reload();
        }
        return;
      }

      if (mod && key === "d") {
        event.preventDefault();
        void window.ultraX.toggleBookmark();
        return;
      }

      if (mod && key === "tab") {
        event.preventDefault();
        if (event.shiftKey) {
          void window.ultraX.previousTab();
        } else {
          void window.ultraX.nextTab();
        }
        return;
      }

      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        void window.ultraX.goBack();
        return;
      }

      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        void window.ultraX.goForward();
        return;
      }

      if (event.key === "Escape") {
        setQuickSettingsOpen(false);
        setExtensionPanel(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab]);

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
    if (
      state.settings.confirmBeforeClosingMultipleTabs &&
      state.tabs.length > 1 &&
      !window.confirm("Close UltraX and all open tabs?")
    ) {
      return;
    }

    void window.ultraX.closeWindow();
  };

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <TabStrip
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        onCreateTab={() => void window.ultraX.createTab()}
        onSwitchTab={(tabId) => void window.ultraX.switchTab(tabId)}
        onCloseTab={(tabId) => void window.ultraX.closeTab(tabId)}
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
        onChooseDownloadFolder={() => void window.ultraX.chooseDownloadFolder()}
        onOpenDownloadsFolder={() => void window.ultraX.openDownloadsFolder()}
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
    </div>
  );
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
