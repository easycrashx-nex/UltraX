import {
  app,
  autoUpdater as nativeAutoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
  powerMonitor,
  screen,
  session,
  type IpcMainInvokeEvent,
  type MessageBoxOptions,
} from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { IPC } from "../shared/ipc";
import { formatVisibleVersion } from "../shared/version";
import { normalizeHttpOrigin } from "../shared/origin-policy";
import { normalizeShortcutOverrides } from "../shared/shortcuts";
import { areCredentialOriginsAffiliated } from "../shared/password-affiliations";
import type {
  BrowserSettings,
  BrowserWindowBounds,
  BrowserWindowSession,
  ExtensionApiRequest,
  ExtensionRuntimeLogLevel,
  FindInPageOptions,
  PermissionPolicy,
  RuntimeInfo,
  SitePermissionKey,
  TabReorderPlacement,
  UpdateSettings,
  ViewInsets,
} from "../shared/types";
import type {
  PasswordFillRequest,
  PasswordGeneratorSettings,
  PasswordManagerSettings,
  PasswordAutofillSnapshot,
  PasswordPageMessage,
  PasswordPromptAction,
  PasswordPromptSnapshot,
  PasswordVaultItemInput,
  PasswordVaultItemUpdate,
} from "../shared/password-manager";
import { BrowserController } from "./browser-controller";
import { ensureExtensionsWorkspace } from "./extension-workspace";
import { WEB_PARTITION } from "./navigation";
import { StorageService } from "./storage";
import { PasswordManagerService } from "./password-manager/password-manager-service";
import { UpdateManager } from "./updates/update-manager";

type WindowRecord = {
  id: string;
  window: BrowserWindow;
  controller: BrowserController;
  updateManager: UpdateManager;
  allowWindowClose: boolean;
};

type CreateWindowOptions = {
  session?: BrowserWindowSession;
  focus?: boolean;
};

const windowRecords = new Map<number, WindowRecord>();
type PendingPasswordCandidate = {
  promptId: string;
  recordId: string;
  tabId: string;
  origin: string;
  actionOrigin: string;
  username: string;
  password: string;
  timer: NodeJS.Timeout;
};
const pendingPasswordCandidates = new Map<string, PendingPasswordCandidate>();
let storage = undefined as unknown as StorageService;
let passwordManager = undefined as unknown as PasswordManagerService;
let ipcHandlersRegistered = false;
let updateQuitRequested = false;

const shouldUseDevServer = !app.isPackaged && process.env.ULTRAX_DEV_SERVER === "1";
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

app.setName("UltraX");
app.setAppUserModelId("com.ultrax.browser");
if (process.env.ULTRAX_E2E_USER_DATA) {
  app.setPath("userData", process.env.ULTRAX_E2E_USER_DATA);
}
storage = new StorageService();
passwordManager = new PasswordManagerService({
  directory: path.join(app.getPath("userData"), "password-manager"),
  getSettings: () => getCurrentPasswordManagerSettings(),
  onStatusChanged: (status) => {
    if (status.state === "locked" || status.state === "corrupted") clearAllPendingPasswordCandidates();
    for (const record of windowRecords.values()) {
      if (!record.window.isDestroyed()) record.window.webContents.send(IPC.passwordManagerStatusChanged, status);
    }
  },
});
applyStartupHardwareAccelerationPreference();

function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const initialBounds = getInitialWindowBounds(options.session?.bounds, workArea);

  const window = new BrowserWindow({
    ...initialBounds,
    minWidth: 940,
    minHeight: 620,
    frame: false,
    show: false,
    fullscreenable: true,
    backgroundColor: "#050608",
    icon: getWindowIconPath(),
    title: "UltraX",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const windowId = options.session?.id ?? randomUUID();
  const controller = new BrowserController(window, storage, {
    windowId,
    initialSession: options.session,
    onCreateWindowFromTab: (tab) => {
      const newWindow = createWindow({
        session: {
          id: randomUUID(),
          tabs: [tab],
          activeTabId: tab.id,
          bounds: offsetBounds(window.getBounds()),
        },
        focus: true,
      });
      newWindow.focus();
    },
    onPasswordNavigation: (tabId, origin) => handlePasswordNavigation(windowId, tabId, origin),
  });
  const updateManager = new UpdateManager(
    window,
    () => controller.getState().settings.updates ?? {
      autoCheck: false,
      autoDownload: false,
      notifyWhenAvailable: true,
      channel: "stable",
    },
    (patch) => {
      const current = controller.getState().settings.updates;
      if (!current) {
        return;
      }

      controller.updateSettings({
        updates: {
          ...current,
          ...patch,
        },
      });
    },
    prepareForUpdateInstall,
  );

  const record: WindowRecord = {
    id: windowId,
    window,
    controller,
    updateManager,
    allowWindowClose: false,
  };
  const webContentsId = window.webContents.id;
  windowRecords.set(webContentsId, record);

  window.on("close", (event) => {
    if (record.allowWindowClose || updateQuitRequested) {
      return;
    }

    if (record.controller.shouldAskBeforeWindowClose()) {
      event.preventDefault();
      window.webContents.send(IPC.requestCloseConfirmation);
      return;
    }

    const discardSession =
      record.controller.getState().settings.closeBehavior === "close-and-discard-session";
    record.controller.prepareForWindowClose(discardSession);
    record.allowWindowClose = true;
  });

  window.once("ready-to-show", () => {
    window.show();
    if (options.focus !== false) {
      window.focus();
    }
    record.controller.init();
    record.updateManager.init();
  });

  if (shouldUseDevServer) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  window.on("closed", () => {
    clearPendingPasswordCandidates(record.id);
    const lockWhenAllWindowsClose = record.controller.getState().settings.passwordManager.lockOnAllWindowsClosed;
    record.controller.dispose();
    record.updateManager.dispose();
    windowRecords.delete(webContentsId);
    if (windowRecords.size === 0 && lockWhenAllWindowsClose) {
      void passwordManager.lock();
    }
  });

  return window;
}

function getWindowIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(app.getAppPath(), "build", "icon.ico");
}

function configureSecurity(): void {
  const browserSession = session.fromPartition(WEB_PARTITION);

  browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const decision = resolveSitePermissionDecision(
      permission,
      webContents.getURL(),
      details,
    );
    if (!decision) {
      callback(false);
      return;
    }

    if (decision.policy === "allow") {
      callback(true);
      return;
    }

    if (decision.policy === "block") {
      callback(false);
      return;
    }

    const ownerWindow =
      BrowserWindow.fromWebContents(webContents) ?? BrowserWindow.getFocusedWindow();
    const options: MessageBoxOptions = {
      type: "question",
      buttons: ["Allow", "Block"],
      defaultId: 1,
      cancelId: 1,
      checkboxLabel: "Remember for this site",
        message: `Allow ${decision.origin} to use ${formatPermissionKeys(decision.keys)}?`,
      detail:
        "UltraX will only remember this choice for this site if you enable the checkbox.",
    };
    const prompt = ownerWindow
      ? dialog.showMessageBox(ownerWindow, options)
      : dialog.showMessageBox(options);

    void prompt
      .then((result) => {
        const allowed = result.response === 0;
        if (result.checkboxChecked) {
          rememberPermissionDecision(
            decision.origin,
            decision.keys,
            allowed ? "allow" : "block",
          );
        }
        callback(allowed);
      })
      .catch(() => callback(false));
  });

  browserSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const decision = resolveSitePermissionDecision(permission, requestingOrigin, details);
    return decision?.policy === "allow";
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
  });
}

function resolveSitePermissionDecision(
  permission: string,
  origin: string,
  details?: unknown,
): { origin: string; keys: SitePermissionKey[]; policy: PermissionPolicy } | null {
  const normalizedOrigin = normalizeHttpOrigin(origin);
  const keys = getSitePermissionKeys(permission, details);
  if (!normalizedOrigin || keys.length === 0) {
    return null;
  }

  const settings = storage.load().settings;
  const policies = keys.map((key) =>
    resolvePermissionPolicyForOrigin(settings, normalizedOrigin, key),
  );
  const policy = policies.includes("block")
    ? "block"
    : policies.every((item) => item === "allow")
      ? "allow"
      : "ask";

  return { origin: normalizedOrigin, keys, policy };
}

function getSitePermissionKeys(permission: string, details?: unknown): SitePermissionKey[] {
  if (permission === "media") {
    const mediaTypes = (details as { mediaTypes?: unknown } | undefined)?.mediaTypes;
    const types = Array.isArray(mediaTypes) ? mediaTypes : [];
    const keys: SitePermissionKey[] = [];
    if (types.includes("video")) {
      keys.push("camera");
    }
    if (types.includes("audio")) {
      keys.push("microphone");
    }
    return keys.length > 0 ? keys : ["camera", "microphone"];
  }

  const mapping: Record<string, SitePermissionKey | undefined> = {
    geolocation: "location",
    notifications: "notifications",
    "clipboard-read": "clipboard",
    "clipboard-write": "clipboard",
    "clipboard-sanitized-write": "clipboard",
  };

  const key = mapping[permission];
  return key ? [key] : [];
}

function resolvePermissionPolicyForOrigin(
  settings: BrowserSettings,
  origin: string,
  permission: SitePermissionKey,
): PermissionPolicy {
  const exception = settings.sitePermissionExceptions.find(
    (item) => item.origin === origin && item.permission === permission,
  );
  return exception?.policy ?? settings.permissionPolicy[permission] ?? "block";
}

function rememberPermissionDecision(
  origin: string,
  keys: SitePermissionKey[],
  policy: PermissionPolicy,
): void {
  const state = storage.load();
  const existing = state.settings.sitePermissionExceptions.filter(
    (item) => !(item.origin === origin && keys.includes(item.permission)),
  );
  const now = Date.now();
  state.settings.sitePermissionExceptions = [
    ...keys.map((key) => ({
      id: randomUUID(),
      origin,
      permission: key,
      policy,
      updatedAt: now,
    })),
    ...existing,
  ].slice(0, 80);
  storage.save(state);

  for (const record of windowRecords.values()) {
    record.controller.syncSettings(state.settings);
  }
}

function formatPermissionKeys(keys: SitePermissionKey[]): string {
  const labels: Record<SitePermissionKey, string> = {
    camera: "camera",
    microphone: "microphone",
    location: "location",
    notifications: "notifications",
    popups: "pop-ups",
    downloads: "downloads",
    clipboard: "clipboard",
    autoplay: "autoplay",
    javascript: "JavaScript",
    images: "images",
  };
  return keys.map((key) => labels[key]).join(" and ");
}

function createInitialWindows(): void {
  const state = storage.load();
  const shouldRestoreSession =
    state.settings.startupBehavior === "restore-session" && state.windows.length > 0;

  if (!shouldRestoreSession) {
    createWindow();
    return;
  }

  const lastActiveWindowId = state.lastActiveWindowId ?? state.windows[0]?.id;
  for (const session of state.windows) {
    createWindow({
      session,
      focus: session.id === lastActiveWindowId,
    });
  }
}

function registerIpcHandlers(): void {
  if (ipcHandlersRegistered) {
    return;
  }
  ipcHandlersRegistered = true;

  const handle = (
    channel: string,
    listener: (record: WindowRecord, event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (event, ...args) => {
      return listener(getRecordForEvent(event), event, ...args);
    });
  };

  ipcMain.removeAllListeners(IPC.passwordManagerPageMessage);
  ipcMain.on(IPC.passwordManagerPageMessage, (event, value: unknown) => {
    const record = [...windowRecords.values()].find((candidate) => candidate.controller.getTabIdForWebContents(event.sender) !== undefined);
    if (!record || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) return;
    const tabId = record.controller.getTabIdForWebContents(event.sender);
    if (!tabId) return;
    void handlePasswordPageMessage(record, tabId, value);
  });

  ipcMain.removeAllListeners(IPC.htmlFullscreenChanged);
  ipcMain.on(IPC.htmlFullscreenChanged, (event, value: unknown) => {
    const record = [...windowRecords.values()].find((candidate) => candidate.controller.getTabIdForWebContents(event.sender) !== undefined);
    if (!record || !event.senderFrame || event.senderFrame !== event.sender.mainFrame || typeof value !== "boolean") return;
    record.controller.setHtmlFullscreen(value);
  });

  handle(IPC.getState, (record) => record.controller.getState());
  handle(IPC.setViewInsets, (record, _event, insets) => record.controller.setViewInsets(readInsets(insets)));
  handle(IPC.createTab, (record) => record.controller.createTab(undefined, true));
  handle(IPC.closeTab, (record, _event, tabId) =>
    (() => {
      const id = readString(tabId, "tabId", 128);
      clearPendingPasswordCandidates(record.id, id);
      record.controller.closeTab(id);
    })(),
  );
  handle(IPC.duplicateTab, (record, _event, tabId) =>
    record.controller.duplicateTab(readString(tabId, "tabId", 128)),
  );
  handle(IPC.pinTab, (record, _event, tabId, pinned) =>
    record.controller.setTabPinned(
      readString(tabId, "tabId", 128),
      readBoolean(pinned, "pinned tab state"),
    ),
  );
  handle(IPC.reorderTab, (record, _event, tabId, targetTabId, placement) =>
    record.controller.reorderTab(
      readString(tabId, "tabId", 128),
      readString(targetTabId, "target tabId", 128),
      readTabReorderPlacement(placement),
    ),
  );
  handle(IPC.closeOtherTabs, (record, _event, tabId) =>
    record.controller.closeOtherTabs(readString(tabId, "tabId", 128)),
  );
  handle(IPC.closeTabsToRight, (record, _event, tabId) =>
    record.controller.closeTabsToRight(readString(tabId, "tabId", 128)),
  );
  handle(IPC.moveTabToNewWindow, (record, _event, tabId) =>
    record.controller.moveTabToNewWindow(readString(tabId, "tabId", 128)),
  );
  handle(IPC.toggleTabMuted, (record, _event, tabId) =>
    record.controller.toggleTabMuted(readString(tabId, "tabId", 128)),
  );
  handle(IPC.switchTab, (record, _event, tabId) =>
    record.controller.switchTab(readString(tabId, "tabId", 128)),
  );
  handle(IPC.navigate, (record, _event, input) =>
    record.controller.navigateActive(readString(input, "navigation input", 4096)),
  );
  handle(IPC.goHome, (record) => record.controller.goHome());
  handle(IPC.goBack, (record) => record.controller.goBack());
  handle(IPC.goForward, (record) => record.controller.goForward());
  handle(IPC.reload, (record) => record.controller.reload(false));
  handle(IPC.stopLoading, (record) => record.controller.stopLoading());
  handle(IPC.hardReload, (record) => record.controller.reload(true));
  handle(IPC.nextTab, (record) => record.controller.nextTab());
  handle(IPC.previousTab, (record) => record.controller.previousTab());
  handle(IPC.reopenClosedTab, (record) => record.controller.reopenClosedTab());
  handle(IPC.findInPage, (record, _event, text, options) =>
    record.controller.findInPage(
      readString(text, "find text", 512),
      readFindInPageOptions(options),
    ),
  );
  handle(IPC.stopFindInPage, (record, _event, action) =>
    record.controller.stopFindInPage(readStopFindAction(action)),
  );
  handle(IPC.toggleBookmark, (record) => record.controller.toggleCurrentBookmark());
  handle(IPC.removeBookmark, (record, _event, bookmarkId) =>
    record.controller.removeBookmark(readString(bookmarkId, "bookmarkId", 128)),
  );
  handle(IPC.openBookmark, (record, _event, bookmarkId) =>
    record.controller.openBookmark(readString(bookmarkId, "bookmarkId", 128)),
  );
  handle(IPC.clearHistory, (record) => record.controller.clearHistory());
  handle(IPC.openHistoryEntry, (record, _event, entryId) =>
    record.controller.openHistoryEntry(readString(entryId, "entryId", 128)),
  );
  handle(IPC.updateSettings, (record, _event, partial) => {
    const patch = readSettingsPatch(partial);
    record.controller.updateSettings(patch);
    syncSettingsToOtherWindows(record);
    passwordManager.configure();
  });
  handle(IPC.clearBrowserData, async (record) => {
    await record.controller.clearBrowserData();
  });
  handle(IPC.clearNetworkCache, async (record) => {
    await record.controller.clearNetworkCache();
  });
  handle(IPC.resetSettings, (record) => {
    record.controller.resetSettings();
    syncSettingsToOtherWindows(record);
    passwordManager.configure();
  });
  handle(IPC.getRuntimeInfo, () => getRuntimeInfo());
  handle(IPC.openShellDevTools, (record) => {
    if (app.isPackaged) throw new Error("Shell developer tools are disabled in production builds.");
    record.window.webContents.openDevTools({ mode: "detach" });
  });
  handle(IPC.relaunchApp, () => {
    app.relaunch();
    app.exit(0);
  });
  handle(IPC.getUpdateStatus, (record) => record.updateManager.getStatus());
  handle(IPC.checkForUpdates, async (record) => record.updateManager.checkForUpdates());
  handle(IPC.downloadUpdate, async (record) => record.updateManager.downloadUpdate());
  handle(IPC.installUpdate, (record) => record.updateManager.installUpdate());
  handle(IPC.openReleasesPage, async (record) => {
    await record.updateManager.openReleasesPage();
  });
  handle(IPC.openDownload, async (record, _event, downloadId) => {
    await record.controller.openDownload(readString(downloadId, "downloadId", 128));
  });
  handle(IPC.revealDownload, (record, _event, downloadId) =>
    record.controller.revealDownload(readString(downloadId, "downloadId", 128)),
  );
  handle(IPC.chooseDownloadFolder, async (record) => {
    const result = await record.controller.chooseDownloadFolder();
    syncSettingsToOtherWindows(record);
    return result;
  });
  handle(IPC.openDownloadsFolder, async (record) => {
    await record.controller.openDownloadsFolder();
  });
  handle(IPC.clearDownloads, (record) => record.controller.clearDownloads());
  handle(IPC.chooseNewTabCustomImage, async (record) => {
    const result = await record.controller.chooseNewTabCustomImage();
    syncSettingsToOtherWindows(record);
    return result;
  });
  handle(IPC.removeNewTabCustomImage, (record) => {
    record.controller.removeNewTabCustomImage();
    syncSettingsToOtherWindows(record);
  });
  handle(IPC.clearBookmarks, (record) => record.controller.clearBookmarks());
  handle(IPC.importBookmarks, async (record, _event, duplicatePolicy) => {
    if (duplicatePolicy !== "skip" && duplicatePolicy !== "keep") {
      throw new Error("Invalid bookmark duplicate policy.");
    }
    return record.controller.importBookmarks(duplicatePolicy);
  });
  handle(IPC.exportBookmarks, (record) => record.controller.exportBookmarks());
  handle(IPC.ensureExtensionsWorkspace, (record) => record.controller.ensureExtensionsWorkspace());
  handle(IPC.loadUnpackedExtension, async (record) => record.controller.loadUnpackedExtension());
  handle(IPC.validateUnpackedExtension, async (record) => record.controller.validateUnpackedExtension());
  handle(IPC.setExtensionEnabled, (record, _event, extensionId, enabled) =>
    record.controller.setExtensionEnabled(
      readString(extensionId, "extension id", 128),
      readBoolean(enabled, "extension enabled state"),
    ),
  );
  handle(IPC.removeExtension, (record, _event, extensionId) =>
    record.controller.removeExtension(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.reloadExtensions, (record) => record.controller.reloadExtensions());
  handle(IPC.openExtensionsFolder, async (record) => {
    await record.controller.openExtensionsFolder();
  });
  handle(IPC.listExtensionStore, async (record) => record.controller.listExtensionStore());
  handle(IPC.installStoreExtension, async (record, _event, extensionId) =>
    record.controller.installStoreExtension(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.openExtensionPanel, (record, _event, extensionId) =>
    record.controller.openExtensionPanel(readString(extensionId, "extension id", 128)),
  );
  handle(IPC.invokeExtensionApi, (record, _event, extensionId, request) =>
    record.controller.invokeExtensionApi(
      readString(extensionId, "extension id", 128),
      readExtensionApiRequest(request),
    ),
  );
  handle(IPC.logExtensionRuntimeMessage, (record, _event, extensionId, level, message) =>
    record.controller.logExtensionRuntimeMessage(
      readString(extensionId, "extension id", 128),
      readExtensionLogLevel(level),
      readString(message, "extension runtime message", 300),
    ),
  );
  handle(IPC.clearExtensionErrors, (record, _event, extensionId) =>
    record.controller.clearExtensionErrors(
      extensionId === undefined ? undefined : readString(extensionId, "extension id", 128),
    ),
  );
  handle(IPC.passwordManagerGetStatus, () => passwordManager.getStatus());
  handle(IPC.passwordManagerSetup, (_record, _event, masterPassword, enableQuickUnlock) =>
    passwordManager.setup(
      readString(masterPassword, "master password", 1024),
      readBoolean(enableQuickUnlock, "OS quick unlock setting"),
    ),
  );
  handle(IPC.passwordManagerUnlock, (_record, _event, masterPassword) =>
    passwordManager.unlock(readString(masterPassword, "master password", 1024)),
  );
  handle(IPC.passwordManagerUnlockWithOs, () => passwordManager.unlockWithOs());
  handle(IPC.passwordManagerLock, () => {
    clearAllPendingPasswordCandidates();
    return passwordManager.lock();
  });
  handle(IPC.passwordManagerList, (_record, _event, query) =>
    passwordManager.list(readString(query, "password search", 256)),
  );
  handle(IPC.passwordManagerCreate, (_record, _event, input) =>
    passwordManager.create(readPasswordItemInput(input)),
  );
  handle(IPC.passwordManagerUpdate, (_record, _event, itemId, input) =>
    passwordManager.update(
      readString(itemId, "password item id", 128),
      readPasswordItemUpdate(input),
    ),
  );
  handle(IPC.passwordManagerDelete, (_record, _event, itemId) =>
    passwordManager.delete(readString(itemId, "password item id", 128)),
  );
  handle(IPC.passwordManagerDuplicate, (_record, _event, itemId) =>
    passwordManager.duplicate(readString(itemId, "password item id", 128)),
  );
  handle(IPC.passwordManagerGenerate, (_record, _event, options) =>
    passwordManager.generate(readPasswordGeneratorOptions(options)),
  );
  handle(IPC.passwordManagerCopyField, (_record, _event, itemId, field) => {
    if (field !== "username" && field !== "password") throw new Error("Invalid password field.");
    return passwordManager.copyField(readString(itemId, "password item id", 128), field);
  });
  handle(IPC.passwordManagerFill, async (record, _event, request) => {
    const fillRequest = readPasswordFillRequest(request);
    const settings = record.controller.getState().settings.passwordManager;
    if (!settings.offerAutofill) throw new Error("Password fill is disabled in Settings.");
    const origin = record.controller.getActiveTabOrigin(fillRequest.tabId);
    return passwordManager.withCredentialForOrigin(fillRequest.itemId, origin, (credential) =>
      record.controller.fillActiveCredential(
        fillRequest.tabId,
        origin,
        credential,
        settings.autofillUsername,
      ),
    );
  });
  handle(IPC.passwordManagerHealth, () => passwordManager.health());
  handle(IPC.passwordManagerImportCsv, (record) => passwordManager.importCsv(record.window));
  handle(IPC.passwordManagerExportBackup, (record, _event, backupPassword) =>
    passwordManager.exportBackup(record.window, readString(backupPassword, "backup password", 1024)),
  );
  handle(IPC.passwordManagerImportBackup, (record, _event, backupPassword) =>
    passwordManager.importBackup(record.window, readString(backupPassword, "backup password", 1024)),
  );
  handle(IPC.passwordManagerChangeMaster, (_record, _event, currentPassword, newPassword) =>
    passwordManager.changeMasterPassword(
      readString(currentPassword, "current master password", 1024),
      readString(newPassword, "new master password", 1024),
    ),
  );
  handle(IPC.passwordManagerDeleteVault, (_record, _event, masterPassword) =>
    passwordManager.deleteVault(readString(masterPassword, "master password", 1024)),
  );
  handle(IPC.passwordManagerPromptAction, async (record, _event, promptId, action) =>
    handlePasswordPromptAction(
      record,
      readString(promptId, "password prompt id", 128),
      readPasswordPromptAction(action),
    ),
  );
  handle(IPC.minimizeWindow, (record) => record.window.minimize());
  handle(IPC.toggleMaximizeWindow, (record) => {
    if (record.window.isMaximized()) {
      record.window.unmaximize();
    } else {
      record.window.maximize();
    }
  });
  handle(IPC.closeWindow, (record) => record.window.close());
  handle(IPC.closeWindowWithBehavior, (record, _event, discardSession) => {
    record.controller.prepareForWindowClose(readBoolean(discardSession, "discard session close state"));
    record.allowWindowClose = true;
    record.window.close();
  });
}

function getRecordForEvent(event: IpcMainInvokeEvent): WindowRecord {
  const record = windowRecords.get(event.sender.id);
  if (!record) {
    throw new Error("Rejected IPC call from untrusted sender.");
  }

  return record;
}

async function handlePasswordPageMessage(record: WindowRecord, tabId: string, value: unknown): Promise<void> {
  const message = readPasswordPageMessage(value);
  if (!message) return;

  if (message.kind === "field-focused") {
    await publishAutofillSuggestions(record, tabId, message.origin);
    return;
  }

  if (message.kind === "candidate-submitted") {
    const origin = normalizeHttpOrigin(message.origin);
    const actionOrigin = normalizeHttpOrigin(message.actionOrigin);
    const settings = record.controller.getState().settings.passwordManager;
    if (!origin || origin !== actionOrigin || !origin.startsWith("https://") ||
      settings.neverSaveOrigins.includes(origin) || !settings.offerToSavePasswords) {
      return;
    }
    clearPendingPasswordCandidates(record.id, tabId);
    const promptId = randomUUID();
    const timer = setTimeout(() => clearPendingPasswordCandidate(promptId), 60_000);
    timer.unref();
    pendingPasswordCandidates.set(promptId, {
      promptId,
      recordId: record.id,
      tabId,
      origin,
      actionOrigin,
      username: message.username,
      password: message.password,
      timer,
    });
    return;
  }

  if (message.likelySuccess) {
    const candidate = [...pendingPasswordCandidates.values()].find(
      (item) => item.recordId === record.id && item.tabId === tabId && item.origin === normalizeHttpOrigin(message.origin),
    );
    if (candidate) await finalizePasswordCandidate(record, candidate);
  } else {
    clearPendingPasswordCandidates(record.id, tabId);
  }
}

async function publishAutofillSuggestions(record: WindowRecord, tabId: string, rawOrigin: string): Promise<void> {
  const origin = normalizeHttpOrigin(rawOrigin);
  const settings = record.controller.getState().settings.passwordManager;
  if (!origin || !origin.startsWith("https://") || !settings.offerAutofill) {
    sendAutofillSnapshot(record, null);
    return;
  }
  try {
    if (record.controller.getActiveTabOrigin(tabId) !== origin) {
      sendAutofillSnapshot(record, null);
      return;
    }
  } catch {
    sendAutofillSnapshot(record, null);
    return;
  }
  const status = await passwordManager.getStatus();
  try {
    if (record.controller.getActiveTabOrigin(tabId) !== origin) {
      sendAutofillSnapshot(record, null);
      return;
    }
  } catch {
    sendAutofillSnapshot(record, null);
    return;
  }
  const snapshot: PasswordAutofillSnapshot = {
    tabId,
    origin,
    vaultLocked: status.state !== "unlocked",
    suggestions: status.state === "unlocked"
      ? (await passwordManager.listMatchingCredentials(origin)).slice(0, 8).map((item) => ({
          itemId: item.id,
          title: item.title,
          username: item.username,
          origin,
        }))
      : [],
  };
  sendAutofillSnapshot(record, snapshot);
}

async function finalizePasswordCandidate(record: WindowRecord, candidate: PendingPasswordCandidate): Promise<void> {
  const settings = record.controller.getState().settings.passwordManager;
  const status = await passwordManager.getStatus();
  let action: PasswordPromptSnapshot["action"] = "save";
  if (status.state === "unlocked") {
    const classification = await passwordManager.classifyCredentialCandidate(candidate.origin, candidate.username, candidate.password);
    if (classification === "duplicate") {
      clearPendingPasswordCandidate(candidate.promptId);
      return;
    }
    action = classification;
  }
  if (action === "save" && !settings.offerToSavePasswords) {
    clearPendingPasswordCandidate(candidate.promptId);
    return;
  }
  if (action === "update" && !settings.offerToUpdatePasswords) {
    clearPendingPasswordCandidate(candidate.promptId);
    return;
  }
  const prompt: PasswordPromptSnapshot = {
    promptId: candidate.promptId,
    action,
    origin: candidate.origin,
    username: candidate.username,
    passwordLength: candidate.password.length,
    vaultLocked: status.state !== "unlocked",
  };
  if (!record.window.isDestroyed() && !record.window.webContents.isDestroyed()) {
    record.window.webContents.send(IPC.passwordManagerPromptChanged, prompt);
  }
}

async function handlePasswordPromptAction(
  record: WindowRecord,
  promptId: string,
  action: PasswordPromptAction,
): Promise<"completed" | "vault-locked"> {
  const candidate = pendingPasswordCandidates.get(promptId);
  if (!candidate || candidate.recordId !== record.id) throw new Error("This password prompt has expired.");
  if (action === "dismiss") {
    clearPendingPasswordCandidate(promptId);
    sendPrompt(record, null);
    return "completed";
  }
  if (action === "never-save") {
    const settings = record.controller.getState().settings.passwordManager;
    record.controller.updateSettings({
      passwordManager: {
        ...settings,
        neverSaveOrigins: [...new Set([...settings.neverSaveOrigins, candidate.origin])].slice(0, 200),
      },
    });
    syncSettingsToOtherWindows(record);
    clearPendingPasswordCandidate(promptId);
    sendPrompt(record, null);
    return "completed";
  }
  if ((await passwordManager.getStatus()).state !== "unlocked") {
    return "vault-locked";
  }
  const currentOrigin = record.controller.getActiveTabOrigin(candidate.tabId);
  if (!areCredentialOriginsAffiliated(candidate.origin, currentOrigin)) {
    clearPendingPasswordCandidate(promptId);
    throw new Error("The login page changed origin before the password was saved.");
  }
  await passwordManager.saveCredentialCandidate(candidate.origin, candidate.username, candidate.password);
  clearPendingPasswordCandidate(promptId);
  sendPrompt(record, null);
  return "completed";
}

function handlePasswordNavigation(recordId: string, tabId: string, origin: string): void {
  const candidate = [...pendingPasswordCandidates.values()].find(
    (item) => item.recordId === recordId && item.tabId === tabId && item.origin !== origin,
  );
  if (!candidate) {
    const record = [...windowRecords.values()].find((item) => item.id === recordId);
    if (record) sendAutofillSnapshot(record, null);
    return;
  }
  const record = [...windowRecords.values()].find((item) => item.id === recordId);
  if (record) void finalizePasswordCandidate(record, candidate);
}

function clearPendingPasswordCandidate(promptId: string): void {
  const candidate = pendingPasswordCandidates.get(promptId);
  if (!candidate) return;
  clearTimeout(candidate.timer);
  pendingPasswordCandidates.delete(promptId);
  const record = [...windowRecords.values()].find((item) => item.id === candidate.recordId);
  if (record) sendPrompt(record, null);
}

function clearPendingPasswordCandidates(recordId: string, tabId?: string): void {
  for (const candidate of pendingPasswordCandidates.values()) {
    if (candidate.recordId === recordId && (!tabId || candidate.tabId === tabId)) clearPendingPasswordCandidate(candidate.promptId);
  }
}

function clearAllPendingPasswordCandidates(): void {
  for (const candidate of pendingPasswordCandidates.values()) clearPendingPasswordCandidate(candidate.promptId);
}

function sendPrompt(record: WindowRecord, prompt: PasswordPromptSnapshot | null): void {
  if (!record.window.isDestroyed() && !record.window.webContents.isDestroyed()) record.window.webContents.send(IPC.passwordManagerPromptChanged, prompt);
}

function sendAutofillSnapshot(record: WindowRecord, snapshot: PasswordAutofillSnapshot | null): void {
  if (!record.window.isDestroyed() && !record.window.webContents.isDestroyed()) record.window.webContents.send(IPC.passwordManagerAutofillChanged, snapshot);
}

function readPasswordPageMessage(value: unknown): PasswordPageMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;
  const origin = typeof candidate.origin === "string" ? normalizeHttpOrigin(candidate.origin) : "";
  if (!origin) return null;
  if (kind === "field-focused" && (candidate.field === "username" || candidate.field === "password")) {
    return { kind, origin, field: candidate.field };
  }
  if (kind === "login-transition") return { kind, origin, likelySuccess: candidate.likelySuccess === true };
  if (kind === "candidate-submitted" && typeof candidate.actionOrigin === "string" && typeof candidate.username === "string" && typeof candidate.password === "string") {
    return { kind, origin, actionOrigin: normalizeHttpOrigin(candidate.actionOrigin), username: candidate.username.slice(0, 512), password: candidate.password.slice(0, 4096) };
  }
  return null;
}

function readPasswordPromptAction(value: unknown): PasswordPromptAction {
  if (value === "save" || value === "update" || value === "dismiss" || value === "never-save") return value;
  throw new Error("Invalid password prompt action.");
}

function syncSettingsToOtherWindows(source: WindowRecord): void {
  const settings = source.controller.getState().settings;
  for (const record of windowRecords.values()) {
    if (record.id !== source.id) {
      record.controller.syncSettings(settings);
    }
  }
}

function getCurrentPasswordManagerSettings(): PasswordManagerSettings {
  return windowRecords.values().next().value?.controller.getState().settings.passwordManager ??
    storage.load().settings.passwordManager;
}

function getInitialWindowBounds(
  storedBounds: BrowserWindowBounds | undefined,
  workArea: { width: number; height: number },
): BrowserWindowBounds {
  const fallbackWidth = Math.min(1320, Math.max(940, Math.floor(workArea.width * 0.9)));
  const fallbackHeight = Math.min(860, Math.max(620, Math.floor(workArea.height * 0.9)));

  if (!storedBounds) {
    return {
      width: fallbackWidth,
      height: fallbackHeight,
    };
  }

  return {
    ...storedBounds,
    width: Math.min(workArea.width, Math.max(940, storedBounds.width)),
    height: Math.min(workArea.height, Math.max(620, storedBounds.height)),
  };
}

function offsetBounds(bounds: BrowserWindowBounds): BrowserWindowBounds {
  return {
    x: typeof bounds.x === "number" ? bounds.x + 28 : undefined,
    y: typeof bounds.y === "number" ? bounds.y + 28 : undefined,
    width: bounds.width,
    height: bounds.height,
  };
}

function readString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readTabReorderPlacement(value: unknown): TabReorderPlacement {
  if (value === undefined) {
    return "before";
  }

  if (value !== "before" && value !== "after") {
    throw new Error("Invalid tab reorder placement.");
  }

  return value;
}

function readHexColor(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readInsets(value: unknown): ViewInsets {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid view insets.");
  }

  const candidate = value as Partial<ViewInsets>;
  if (
    !Number.isFinite(candidate.top) ||
    !Number.isFinite(candidate.right) ||
    !Number.isFinite(candidate.bottom)
  ) {
    throw new Error("Invalid view insets.");
  }

  return {
    top: Number(candidate.top),
    right: Number(candidate.right),
    bottom: Number(candidate.bottom),
  };
}

function readExtensionApiRequest(value: unknown): ExtensionApiRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid extension API request.");
  }

  const candidate = value as Partial<ExtensionApiRequest>;
  return {
    requestId: readString(candidate.requestId, "extension request id", 80),
    method: readString(candidate.method, "extension API method", 80),
    args: Array.isArray(candidate.args) ? candidate.args.slice(0, 4) : [],
  };
}

function readExtensionLogLevel(value: unknown): ExtensionRuntimeLogLevel {
  if (value !== "info" && value !== "warn" && value !== "error") {
    throw new Error("Invalid extension runtime log level.");
  }

  return value;
}

function readSettingsPatch(value: unknown): Partial<BrowserSettings> {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid settings patch.");
  }

  const candidate = value as Partial<BrowserSettings>;
  const patch: Partial<BrowserSettings> = {};

  if (candidate.searchEngine !== undefined) {
    if (
      !["duckduckgo", "google", "bing", "brave", "custom"].includes(
        candidate.searchEngine,
      )
    ) {
      throw new Error("Invalid search engine.");
    }
    patch.searchEngine = candidate.searchEngine;
  }

  if (candidate.customSearchUrl !== undefined) {
    patch.customSearchUrl = readString(candidate.customSearchUrl, "custom search URL", 512);
  }

  if (candidate.searchSuggestions !== undefined) {
    patch.searchSuggestions = readBoolean(candidate.searchSuggestions, "search suggestions");
  }

  if (candidate.searchSuggestionSettings !== undefined) {
    if (
      !candidate.searchSuggestionSettings ||
      typeof candidate.searchSuggestionSettings !== "object" ||
      Array.isArray(candidate.searchSuggestionSettings)
    ) {
      throw new Error("Invalid search suggestion settings.");
    }

    const suggestions = candidate.searchSuggestionSettings as Partial<
      BrowserSettings["searchSuggestionSettings"]
    >;
    if (
      suggestions.suggestionProvider !== undefined &&
      !["current-search-engine", "google", "duckduckgo", "none"].includes(
        suggestions.suggestionProvider,
      )
    ) {
      throw new Error("Invalid search suggestion provider.");
    }

    patch.searchSuggestionSettings = {
      localSuggestions: readBoolean(
        suggestions.localSuggestions,
        "local suggestion setting",
      ),
      historySuggestions: readBoolean(
        suggestions.historySuggestions,
        "history suggestion setting",
      ),
      bookmarkSuggestions: readBoolean(
        suggestions.bookmarkSuggestions,
        "bookmark suggestion setting",
      ),
      openTabSuggestions: readBoolean(
        suggestions.openTabSuggestions,
        "open tab suggestion setting",
      ),
      onlineSuggestions: readBoolean(
        suggestions.onlineSuggestions,
        "online suggestion setting",
      ),
      suggestionProvider: suggestions.suggestionProvider ?? "google",
    };
  }

  if (candidate.addressBarSearch !== undefined) {
    patch.addressBarSearch = readBoolean(candidate.addressBarSearch, "address bar search");
  }

  if (candidate.startupBehavior !== undefined) {
    if (!["new-tab", "restore-session", "specific-pages"].includes(candidate.startupBehavior)) {
      throw new Error("Invalid startup behavior.");
    }
    patch.startupBehavior = candidate.startupBehavior;
  }

  if (candidate.startupPages !== undefined) {
    if (!Array.isArray(candidate.startupPages) || candidate.startupPages.length > 12) {
      throw new Error("Invalid startup pages.");
    }

    patch.startupPages = candidate.startupPages.map((item) =>
      readString(item, "startup page", 512),
    );
  }

  if (candidate.closeBehavior !== undefined) {
    if (
      ![
        "ask-before-closing-multiple-tabs",
        "close-and-restore-session",
        "close-and-discard-session",
      ].includes(candidate.closeBehavior)
    ) {
      throw new Error("Invalid close behavior.");
    }
    patch.closeBehavior = candidate.closeBehavior;
    patch.confirmBeforeClosingMultipleTabs =
      candidate.closeBehavior === "ask-before-closing-multiple-tabs";
  }

  if (candidate.homeBehavior !== undefined) {
    if (!["new-tab", "custom-url"].includes(candidate.homeBehavior)) {
      throw new Error("Invalid home behavior.");
    }
    patch.homeBehavior = candidate.homeBehavior;
  }

  if (candidate.homeUrl !== undefined) {
    patch.homeUrl = readString(candidate.homeUrl, "home URL", 512);
  }

  if (candidate.theme !== undefined) {
    if (!["dark", "light", "system"].includes(candidate.theme)) {
      throw new Error("Invalid theme.");
    }
    patch.theme = candidate.theme;
  }

  if (candidate.glassMode !== undefined) {
    patch.glassMode = readBoolean(candidate.glassMode, "glass mode");
  }

  if (candidate.accentColor !== undefined) {
    if (!["blue", "purple", "cyan", "green", "rose", "orange"].includes(candidate.accentColor)) {
      throw new Error("Invalid accent color.");
    }
    patch.accentColor = candidate.accentColor;
  }

  if (candidate.toolbarDensity !== undefined) {
    if (!["compact", "comfortable", "spacious"].includes(candidate.toolbarDensity)) {
      throw new Error("Invalid toolbar density.");
    }
    patch.toolbarDensity = candidate.toolbarDensity;
  }

  if (candidate.cornerRadius !== undefined) {
    if (!["subtle", "rounded", "ultra-rounded"].includes(candidate.cornerRadius)) {
      throw new Error("Invalid corner radius.");
    }
    patch.cornerRadius = candidate.cornerRadius;
  }

  if (candidate.blurIntensity !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.blurIntensity)) {
      throw new Error("Invalid blur intensity.");
    }
    patch.blurIntensity = candidate.blurIntensity;
  }

  if (candidate.panelTransparency !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.panelTransparency)) {
      throw new Error("Invalid panel transparency.");
    }
    patch.panelTransparency = candidate.panelTransparency;
  }

  if (candidate.animationLevel !== undefined) {
    if (!["minimal", "balanced", "expressive"].includes(candidate.animationLevel)) {
      throw new Error("Invalid animation level.");
    }
    patch.animationLevel = candidate.animationLevel;
  }

  if (candidate.newTabBackground !== undefined) {
    if (
      ![
        "ultrax-wave",
        "aurora",
        "gradient-mesh",
        "minimal-dark",
        "solid-color",
        "custom-image",
      ].includes(candidate.newTabBackground)
    ) {
      throw new Error("Invalid New Tab background.");
    }
    patch.newTabBackground = candidate.newTabBackground;
  }

  if (candidate.newTabSolidColor !== undefined) {
    patch.newTabSolidColor = readHexColor(candidate.newTabSolidColor, "New Tab solid color");
  }

  if (candidate.newTabCustomImagePath !== undefined) {
    if (candidate.newTabCustomImagePath !== "") {
      throw new Error("Custom New Tab image paths must be chosen through UltraX.");
    }
    patch.newTabCustomImagePath = "";
  }

  if (candidate.shaderPreset !== undefined) {
    if (
      ![
        "ultrax-wave",
        "blue-nebula",
        "purple-flow",
        "aurora-lines",
        "calm-grid",
      ].includes(candidate.shaderPreset)
    ) {
      throw new Error("Invalid shader preset.");
    }
    patch.shaderPreset = candidate.shaderPreset;
  }

  if (candidate.shaderIntensity !== undefined) {
    if (!["low", "balanced", "high"].includes(candidate.shaderIntensity)) {
      throw new Error("Invalid shader intensity.");
    }
    patch.shaderIntensity = candidate.shaderIntensity;
  }

  if (candidate.shaderSpeed !== undefined) {
    if (!["slow", "normal", "fast"].includes(candidate.shaderSpeed)) {
      throw new Error("Invalid shader speed.");
    }
    patch.shaderSpeed = candidate.shaderSpeed;
  }

  if (candidate.showBookmarksBar !== undefined) {
    patch.showBookmarksBar = readBoolean(candidate.showBookmarksBar, "bookmarks bar");
  }

  if (candidate.showHomeButton !== undefined) {
    patch.showHomeButton = readBoolean(candidate.showHomeButton, "home button");
  }

  if (candidate.shaderEnabled !== undefined) {
    patch.shaderEnabled = readBoolean(candidate.shaderEnabled, "shader setting");
  }

  if (candidate.reducedMotion !== undefined) {
    patch.reducedMotion = readBoolean(candidate.reducedMotion, "motion setting");
  }

  if (candidate.restoreTabsOnLaunch !== undefined) {
    patch.restoreTabsOnLaunch = readBoolean(
      candidate.restoreTabsOnLaunch,
      "restore tabs setting",
    );
  }

  if (candidate.openTabsNextToCurrent !== undefined) {
    patch.openTabsNextToCurrent = readBoolean(
      candidate.openTabsNextToCurrent,
      "tab placement setting",
    );
  }

  if (candidate.confirmBeforeClosingMultipleTabs !== undefined) {
    const confirmBeforeClosingMultipleTabs = readBoolean(
      candidate.confirmBeforeClosingMultipleTabs,
      "close confirmation setting",
    );
    patch.confirmBeforeClosingMultipleTabs = confirmBeforeClosingMultipleTabs;
    patch.closeBehavior = confirmBeforeClosingMultipleTabs
      ? "ask-before-closing-multiple-tabs"
      : "close-and-restore-session";
  }

  if (candidate.askWhereToSaveDownloads !== undefined) {
    patch.askWhereToSaveDownloads = readBoolean(
      candidate.askWhereToSaveDownloads,
      "download prompt setting",
    );
  }

  if (candidate.downloadPath !== undefined) {
    patch.downloadPath = readString(candidate.downloadPath, "download path", 1024);
  }

  if (candidate.downloadRetention !== undefined) {
    if (!["forever", "30-days", "session"].includes(candidate.downloadRetention)) {
      throw new Error("Invalid download retention.");
    }
    patch.downloadRetention = candidate.downloadRetention;
  }

  if (candidate.historyRetention !== undefined) {
    if (!["forever", "30-days", "7-days"].includes(candidate.historyRetention)) {
      throw new Error("Invalid history retention.");
    }
    patch.historyRetention = candidate.historyRetention;
  }

  if (candidate.doNotTrack !== undefined) {
    patch.doNotTrack = readBoolean(candidate.doNotTrack, "Do Not Track setting");
  }

  if (candidate.blockThirdPartyCookies !== undefined) {
    patch.blockThirdPartyCookies = readBoolean(
      candidate.blockThirdPartyCookies,
      "third-party cookies setting",
    );
  }

  if (candidate.permissionPolicy !== undefined) {
    patch.permissionPolicy = readPermissionPolicy(candidate.permissionPolicy);
  }

  if (candidate.sitePermissionExceptions !== undefined) {
    patch.sitePermissionExceptions = readPermissionExceptions(candidate.sitePermissionExceptions);
  }

  if (candidate.safeBrowsing !== undefined) {
    patch.safeBrowsing = readBoolean(candidate.safeBrowsing, "safe browsing setting");
  }

  if (candidate.alwaysUseSecureConnections !== undefined) {
    patch.alwaysUseSecureConnections = readBoolean(
      candidate.alwaysUseSecureConnections,
      "secure connections setting",
    );
  }

  if (candidate.blockInsecureContent !== undefined) {
    patch.blockInsecureContent = readBoolean(
      candidate.blockInsecureContent,
      "insecure content setting",
    );
  }

  if (candidate.warnDangerousDownloads !== undefined) {
    patch.warnDangerousDownloads = readBoolean(
      candidate.warnDangerousDownloads,
      "dangerous downloads warning setting",
    );
  }

  if (candidate.reviewExtensionPermissions !== undefined) {
    patch.reviewExtensionPermissions = readBoolean(
      candidate.reviewExtensionPermissions,
      "extension permission review setting",
    );
  }

  if (candidate.blockUnsignedRemoteExtensions !== undefined) {
    patch.blockUnsignedRemoteExtensions = readBoolean(
      candidate.blockUnsignedRemoteExtensions,
      "unsigned remote extensions setting",
    );
  }

  if (candidate.privacyClearTimeRange !== undefined) {
    if (
      !["last-hour", "last-24-hours", "last-7-days", "all-time"].includes(
        candidate.privacyClearTimeRange,
      )
    ) {
      throw new Error("Invalid privacy clear time range.");
    }
    patch.privacyClearTimeRange = candidate.privacyClearTimeRange;
  }

  if (candidate.clearHistoryOnClose !== undefined) {
    patch.clearHistoryOnClose = readBoolean(
      candidate.clearHistoryOnClose,
      "clear history on close setting",
    );
  }

  if (candidate.clearCacheOnClose !== undefined) {
    patch.clearCacheOnClose = readBoolean(
      candidate.clearCacheOnClose,
      "clear cache on close setting",
    );
  }

  if (candidate.clearDownloadsOnClose !== undefined) {
    patch.clearDownloadsOnClose = readBoolean(
      candidate.clearDownloadsOnClose,
      "clear downloads on close setting",
    );
  }

  if (candidate.hardwareAcceleration !== undefined) {
    patch.hardwareAcceleration = readBoolean(
      candidate.hardwareAcceleration,
      "hardware acceleration setting",
    );
  }

  if (candidate.performanceMode !== undefined) {
    if (!["efficiency", "balanced", "performance", "ultra"].includes(candidate.performanceMode)) {
      throw new Error("Invalid performance mode.");
    }
    patch.performanceMode = candidate.performanceMode;
  }

  if (candidate.backgroundShaderPerformance !== undefined) {
    if (!["low", "balanced", "high", "ultra"].includes(candidate.backgroundShaderPerformance)) {
      throw new Error("Invalid shader performance setting.");
    }
    patch.backgroundShaderPerformance = candidate.backgroundShaderPerformance;
  }

  if (candidate.shaderFpsCap !== undefined) {
    if (!["30", "60", "unlimited"].includes(candidate.shaderFpsCap)) {
      throw new Error("Invalid shader FPS cap.");
    }
    patch.shaderFpsCap = candidate.shaderFpsCap;
  }

  if (candidate.pauseShaderWhenUnfocused !== undefined) {
    patch.pauseShaderWhenUnfocused = readBoolean(
      candidate.pauseShaderWhenUnfocused,
      "pause shader when unfocused setting",
    );
  }

  if (candidate.pauseShaderOnBatterySaver !== undefined) {
    patch.pauseShaderOnBatterySaver = readBoolean(
      candidate.pauseShaderOnBatterySaver,
      "pause shader on battery saver setting",
    );
  }

  if (candidate.disableShaderOnEfficiencyMode !== undefined) {
    patch.disableShaderOnEfficiencyMode = readBoolean(
      candidate.disableShaderOnEfficiencyMode,
      "disable shader on efficiency mode setting",
    );
  }

  if (candidate.reducedVisualEffects !== undefined) {
    patch.reducedVisualEffects = readBoolean(
      candidate.reducedVisualEffects,
      "reduced visual effects setting",
    );
  }

  if (candidate.preloadNewTab !== undefined) {
    patch.preloadNewTab = readBoolean(candidate.preloadNewTab, "preload New Tab setting");
  }

  if (candidate.keepNewTabWarm !== undefined) {
    patch.keepNewTabWarm = readBoolean(candidate.keepNewTabWarm, "keep New Tab warm setting");
  }

  if (candidate.lazyLoadQuickLinks !== undefined) {
    patch.lazyLoadQuickLinks = readBoolean(
      candidate.lazyLoadQuickLinks,
      "lazy load quick links setting",
    );
  }

  if (candidate.reduceNewTabAnimations !== undefined) {
    patch.reduceNewTabAnimations = readBoolean(
      candidate.reduceNewTabAnimations,
      "reduce New Tab animations setting",
    );
  }

  if (candidate.memorySaver !== undefined) {
    patch.memorySaver = readBoolean(candidate.memorySaver, "memory saver setting");
  }

  if (candidate.suspendInactiveTabs !== undefined) {
    patch.suspendInactiveTabs = readBoolean(
      candidate.suspendInactiveTabs,
      "suspend inactive tabs setting",
    );
  }

  if (candidate.suspendTabsAfter !== undefined) {
    if (!["5-minutes", "15-minutes", "30-minutes", "1-hour", "never"].includes(candidate.suspendTabsAfter)) {
      throw new Error("Invalid tab suspend delay.");
    }
    patch.suspendTabsAfter = candidate.suspendTabsAfter;
  }

  if (candidate.keepPinnedTabsActive !== undefined) {
    patch.keepPinnedTabsActive = readBoolean(
      candidate.keepPinnedTabsActive,
      "keep pinned tabs active setting",
    );
  }

  if (candidate.keepAudioVideoTabsActive !== undefined) {
    patch.keepAudioVideoTabsActive = readBoolean(
      candidate.keepAudioVideoTabsActive,
      "keep media tabs active setting",
    );
  }

  if (candidate.keepDownloadsTabsActive !== undefined) {
    patch.keepDownloadsTabsActive = readBoolean(
      candidate.keepDownloadsTabsActive,
      "keep download tabs active setting",
    );
  }

  if (candidate.neverSuspendSites !== undefined) {
    patch.neverSuspendSites = readStringList(candidate.neverSuspendSites, "never suspend sites", 24, 256);
  }

  if (candidate.lazyRestoreSession !== undefined) {
    patch.lazyRestoreSession = readBoolean(
      candidate.lazyRestoreSession,
      "lazy restore session setting",
    );
  }

  if (candidate.loadTabsOnDemand !== undefined) {
    patch.loadTabsOnDemand = readBoolean(
      candidate.loadTabsOnDemand,
      "load tabs on demand setting",
    );
  }

  if (candidate.restoreActiveTabOnly !== undefined) {
    patch.restoreActiveTabOnly = readBoolean(
      candidate.restoreActiveTabOnly,
      "restore active tab only setting",
    );
  }

  if (candidate.keepRunningInBackground !== undefined) {
    patch.keepRunningInBackground = readBoolean(
      candidate.keepRunningInBackground,
      "keep running in background setting",
    );
  }

  if (candidate.continueDownloadsInBackground !== undefined) {
    patch.continueDownloadsInBackground = readBoolean(
      candidate.continueDownloadsInBackground,
      "continue downloads in background setting",
    );
  }

  if (candidate.reduceActivityWhenMinimized !== undefined) {
    patch.reduceActivityWhenMinimized = readBoolean(
      candidate.reduceActivityWhenMinimized,
      "reduce activity when minimized setting",
    );
  }

  if (candidate.backgroundUpdateChecks !== undefined) {
    patch.backgroundUpdateChecks = readBoolean(
      candidate.backgroundUpdateChecks,
      "background update checks setting",
    );
  }

  if (candidate.preconnectFrequentSites !== undefined) {
    patch.preconnectFrequentSites = readBoolean(
      candidate.preconnectFrequentSites,
      "preconnect frequent sites setting",
    );
  }

  if (candidate.dnsPrefetching !== undefined) {
    patch.dnsPrefetching = readBoolean(candidate.dnsPrefetching, "DNS prefetching setting");
  }

  if (candidate.pagePreloading !== undefined) {
    patch.pagePreloading = readBoolean(candidate.pagePreloading, "page preloading setting");
  }

  if (candidate.predictiveNavigation !== undefined) {
    patch.predictiveNavigation = readBoolean(
      candidate.predictiveNavigation,
      "predictive navigation setting",
    );
  }

  if (candidate.reduceDataUsage !== undefined) {
    patch.reduceDataUsage = readBoolean(candidate.reduceDataUsage, "reduce data usage setting");
  }

  if (candidate.extensionDeveloperMode !== undefined) {
    patch.extensionDeveloperMode = readBoolean(
      candidate.extensionDeveloperMode,
      "extension developer mode setting",
    );
  }

  if (candidate.extensionStore !== undefined) {
    if (!candidate.extensionStore || typeof candidate.extensionStore !== "object") {
      throw new Error("Invalid extension store setting.");
    }

    const store = candidate.extensionStore;
    if (store.provider !== "local" && store.provider !== "remote") {
      throw new Error("Invalid extension store provider.");
    }

    patch.extensionStore = {
      provider: store.provider,
      remoteUrl:
        store.remoteUrl === undefined
          ? undefined
          : readString(store.remoteUrl, "extension store remote URL", 512),
    };
  }

  if (candidate.updates !== undefined) {
    if (!candidate.updates || typeof candidate.updates !== "object") {
      throw new Error("Invalid update settings.");
    }

    const updates = candidate.updates as Partial<UpdateSettings>;
    if (
      updates.channel !== undefined &&
      !["stable", "beta", "nightly"].includes(updates.channel)
    ) {
      throw new Error("Invalid update channel.");
    }

    patch.updates = {
      autoCheck: readBoolean(updates.autoCheck, "auto-check update setting"),
      autoDownload: false,
      notifyWhenAvailable: readBoolean(
        updates.notifyWhenAvailable,
        "update notification setting",
      ),
      channel: updates.channel ?? "stable",
      lastCheckedAt:
        updates.lastCheckedAt === undefined
          ? undefined
          : readOptionalTimestamp(updates.lastCheckedAt, "last update check time"),
    };
  }

  if (candidate.increaseContrast !== undefined) {
    patch.increaseContrast = readBoolean(candidate.increaseContrast, "contrast setting");
  }

  if (candidate.reduceTransparency !== undefined) {
    patch.reduceTransparency = readBoolean(
      candidate.reduceTransparency,
      "transparency setting",
    );
  }

  if (candidate.focusRingVisibility !== undefined) {
    if (!["subtle", "standard", "high"].includes(candidate.focusRingVisibility)) {
      throw new Error("Invalid focus ring visibility.");
    }
    patch.focusRingVisibility = candidate.focusRingVisibility;
  }

  if (candidate.textScale !== undefined) {
    if (!["small", "default", "large", "extra-large"].includes(candidate.textScale)) {
      throw new Error("Invalid text scale.");
    }
    patch.textScale = candidate.textScale;
  }

  if (candidate.alwaysShowFocusIndicators !== undefined) {
    patch.alwaysShowFocusIndicators = readBoolean(
      candidate.alwaysShowFocusIndicators,
      "focus indicator setting",
    );
  }

  if (candidate.tabThroughToolbarControls !== undefined) {
    patch.tabThroughToolbarControls = readBoolean(
      candidate.tabThroughToolbarControls,
      "toolbar tab navigation setting",
    );
  }

  if (candidate.underlineLinks !== undefined) {
    patch.underlineLinks = readBoolean(candidate.underlineLinks, "underline links setting");
  }

  if (candidate.readableFontSmoothing !== undefined) {
    patch.readableFontSmoothing = readBoolean(
      candidate.readableFontSmoothing,
      "font smoothing setting",
    );
  }

  if (candidate.pageZoom !== undefined) {
    if (!Number.isFinite(candidate.pageZoom)) {
      throw new Error("Invalid page zoom.");
    }

    patch.pageZoom = Math.max(0.67, Math.min(1.5, Number(candidate.pageZoom)));
  }

  if (candidate.tabHoverPreview !== undefined) {
    patch.tabHoverPreview = readBoolean(candidate.tabHoverPreview, "tab hover preview setting");
  }

  if (candidate.shortcutOverrides !== undefined) {
    if (
      !candidate.shortcutOverrides ||
      typeof candidate.shortcutOverrides !== "object" ||
      Array.isArray(candidate.shortcutOverrides)
    ) {
      throw new Error("Invalid shortcut overrides.");
    }
    patch.shortcutOverrides = normalizeShortcutOverrides(candidate.shortcutOverrides);
  }

  if (candidate.passwordManager !== undefined) {
    patch.passwordManager = readPasswordManagerSettings(candidate.passwordManager);
  }

  return patch;
}

function readPasswordManagerSettings(value: unknown): PasswordManagerSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid password manager settings.");
  const candidate = value as Partial<PasswordManagerSettings>;
  if (![0, 1, 5, 15, 30, 60].includes(Number(candidate.autoLockMinutes))) throw new Error("Invalid password vault auto-lock timeout.");
  if (![0, 15, 30, 60].includes(Number(candidate.clipboardClearSeconds))) throw new Error("Invalid password clipboard timeout.");
  return {
    offerToSavePasswords: readBoolean(candidate.offerToSavePasswords, "save password setting"),
    offerToUpdatePasswords: readBoolean(candidate.offerToUpdatePasswords, "update password setting"),
    offerAutofill: readBoolean(candidate.offerAutofill, "password autofill setting"),
    autofillUsername: readBoolean(candidate.autofillUsername, "username autofill setting"),
    requireUserGestureForPassword: readBoolean(candidate.requireUserGestureForPassword, "password gesture setting"),
    requireVaultUnlock: readBoolean(candidate.requireVaultUnlock, "vault unlock setting"),
    allowInsecureHttpAutofill: readBoolean(candidate.allowInsecureHttpAutofill, "insecure autofill setting"),
    neverSaveOrigins: readStringArray(candidate.neverSaveOrigins, "never-save origin", 200, 2048)
      .map((origin) => normalizeHttpOrigin(origin))
      .filter(Boolean),
    autoLockMinutes: candidate.autoLockMinutes!,
    lockOnAppClose: readBoolean(candidate.lockOnAppClose, "vault app-close lock setting"),
    lockOnAllWindowsClosed: readBoolean(candidate.lockOnAllWindowsClosed, "vault window-close lock setting"),
    lockOnScreenLock: readBoolean(candidate.lockOnScreenLock, "vault screen-lock setting"),
    lockOnSleep: readBoolean(candidate.lockOnSleep, "vault sleep-lock setting"),
    clipboardClearSeconds: candidate.clipboardClearSeconds!,
    generator: readPasswordGeneratorOptions(candidate.generator),
  };
}

function readPasswordItemInput(value: unknown): PasswordVaultItemInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid login data.");
  const candidate = value as Partial<PasswordVaultItemInput>;
  return {
    title: readString(candidate.title, "login title", 256),
    origins: readStringArray(candidate.origins, "login origin", 20, 2048),
    username: readString(candidate.username, "login username", 512),
    password: readString(candidate.password, "login password", 4096),
    notes: candidate.notes === undefined ? undefined : readString(candidate.notes, "login notes", 16_384),
    favorite: readBoolean(candidate.favorite, "login favorite state"),
    tags: readStringArray(candidate.tags, "login tag", 30, 64),
  };
}

function readPasswordItemUpdate(value: unknown): PasswordVaultItemUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid login update.");
  const candidate = value as Partial<PasswordVaultItemUpdate>;
  return {
    title: readString(candidate.title, "login title", 256),
    origins: readStringArray(candidate.origins, "login origin", 20, 2048),
    username: readString(candidate.username, "login username", 512),
    password: candidate.password === undefined ? undefined : readString(candidate.password, "login password", 4096),
    notes: candidate.notes === undefined ? undefined : readString(candidate.notes, "login notes", 16_384),
    favorite: readBoolean(candidate.favorite, "login favorite state"),
    tags: readStringArray(candidate.tags, "login tag", 30, 64),
  };
}

function readPasswordGeneratorOptions(value: unknown): PasswordGeneratorSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid password generator settings.");
  const candidate = value as Partial<PasswordGeneratorSettings>;
  if (!Number.isInteger(candidate.length) || Number(candidate.length) < 8 || Number(candidate.length) > 128) throw new Error("Invalid generated password length.");
  return {
    length: Number(candidate.length),
    uppercase: readBoolean(candidate.uppercase, "uppercase generator setting"),
    lowercase: readBoolean(candidate.lowercase, "lowercase generator setting"),
    digits: readBoolean(candidate.digits, "digits generator setting"),
    symbols: readBoolean(candidate.symbols, "symbols generator setting"),
    avoidAmbiguous: readBoolean(candidate.avoidAmbiguous, "ambiguous character generator setting"),
  };
}

function readPasswordFillRequest(value: unknown): PasswordFillRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid password fill request.");
  const candidate = value as Partial<PasswordFillRequest>;
  return {
    itemId: readString(candidate.itemId, "password item id", 128),
    tabId: readString(candidate.tabId, "password fill tab id", 128),
  };
}

function readStringArray(value: unknown, label: string, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`Invalid ${label} list.`);
  return value.map((item) => readString(item, label, maximumLength));
}

function readFindInPageOptions(value: unknown): FindInPageOptions {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid find-in-page options.");
  }
  const candidate = value as Record<string, unknown>;
  return {
    forward: candidate.forward === undefined ? undefined : readBoolean(candidate.forward, "find direction"),
    findNext: candidate.findNext === undefined ? undefined : readBoolean(candidate.findNext, "find next setting"),
    matchCase: candidate.matchCase === undefined ? undefined : readBoolean(candidate.matchCase, "find match case setting"),
  };
}

function readStopFindAction(
  value: unknown,
): "clearSelection" | "keepSelection" | "activateSelection" {
  if (value === "clearSelection" || value === "keepSelection" || value === "activateSelection") {
    return value;
  }
  throw new Error("Invalid stop-find action.");
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return value;
}

function readOptionalTimestamp(value: unknown, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return Number(value);
}

function readStringList(
  value: unknown,
  fieldName: string,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const normalized = readString(item, fieldName, maxLength).trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function readPermissionPolicy(value: unknown): Record<SitePermissionKey, PermissionPolicy> {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid permission policy.");
  }

  const candidate = value as Partial<Record<SitePermissionKey, PermissionPolicy>>;
  const keys: SitePermissionKey[] = [
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
  const policy = {} as Record<SitePermissionKey, PermissionPolicy>;

  for (const key of keys) {
    const permission = candidate[key];
    if (permission !== "block" && permission !== "ask" && permission !== "allow") {
      throw new Error(`Invalid ${key} permission policy.`);
    }
    policy[key] = permission;
  }

  return policy;
}

function readPermissionExceptions(value: unknown): BrowserSettings["sitePermissionExceptions"] {
  if (!Array.isArray(value) || value.length > 80) {
    throw new Error("Invalid site permission exceptions.");
  }

  const keys: SitePermissionKey[] = [
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
  const seen = new Set<string>();
  const exceptions: BrowserSettings["sitePermissionExceptions"] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid site permission exception.");
    }

    const candidate = item as Partial<BrowserSettings["sitePermissionExceptions"][number]>;
    const origin = normalizeHttpOrigin(
      readString(candidate.origin, "permission exception origin", 512),
      true,
    );
    if (!origin) {
      throw new Error("Invalid permission exception origin.");
    }

    if (!candidate.permission || !keys.includes(candidate.permission)) {
      throw new Error("Invalid permission exception type.");
    }

    if (
      candidate.policy !== "ask" &&
      candidate.policy !== "allow" &&
      candidate.policy !== "block"
    ) {
      throw new Error("Invalid permission exception policy.");
    }

    const dedupeKey = `${origin}:${candidate.permission}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    exceptions.push({
      id:
        typeof candidate.id === "string" && candidate.id.length <= 80
          ? candidate.id
          : randomUUID(),
      origin,
      permission: candidate.permission,
      policy: candidate.policy,
      updatedAt:
        Number.isFinite(candidate.updatedAt) && candidate.updatedAt
          ? Number(candidate.updatedAt)
          : Date.now(),
    });
  }

  return exceptions;
}

function getRuntimeInfo(): RuntimeInfo {
  const memory = process.memoryUsage();
  const appMetrics = app.getAppMetrics();

  return {
    appName: app.getName(),
    appVersion: formatVisibleVersion(app.getVersion()),
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    buildType: app.isPackaged ? "packaged" : "development",
    userDataPath: app.getPath("userData"),
    memoryUsage: {
      rssMB: toMegabytes(memory.rss),
      heapTotalMB: toMegabytes(memory.heapTotal),
      heapUsedMB: toMegabytes(memory.heapUsed),
      externalMB: toMegabytes(memory.external),
    },
    processInfo: {
      processCount: appMetrics.length,
      rendererProcessCount: appMetrics.filter((metric) => metric.type === "Tab").length,
    },
    hardwareAccelerationEnabled: app.isHardwareAccelerationEnabled(),
    gpuFeatureStatus: Object.fromEntries(
      Object.entries(app.getGPUFeatureStatus()).map(([key, value]) => [key, String(value)]),
    ),
  };
}

function toMegabytes(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function applyStartupHardwareAccelerationPreference(): void {
  try {
    if (!storage.load().settings.hardwareAcceleration) {
      app.disableHardwareAcceleration();
    }
  } catch {
    // Keep startup resilient if the settings file is temporarily unreadable.
  }
}

app.whenReady().then(async () => {
  try {
    ensureExtensionsWorkspace();
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Extensions workspace setup failed.");
  }
  configureSecurity();
  await passwordManager.initialize();
  powerMonitor.on("lock-screen", () => {
    if (getCurrentPasswordManagerSettings().lockOnScreenLock) void passwordManager.lock();
  });
  powerMonitor.on("suspend", () => {
    if (getCurrentPasswordManagerSettings().lockOnSleep) void passwordManager.lock();
  });
  registerIpcHandlers();
  createInitialWindows();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

async function prepareForUpdateInstall(): Promise<void> {
  updateQuitRequested = true;
  for (const record of windowRecords.values()) {
    record.controller.prepareForWindowClose(false);
    record.allowWindowClose = true;
  }
  await passwordManager.lock();
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (getCurrentPasswordManagerSettings().lockOnAppClose) void passwordManager.lock();
});

nativeAutoUpdater.on("before-quit-for-update", () => {
  // electron-updater closes windows before this event. Keep the close path
  // confirmation-free even if a secondary window is still being torn down.
  updateQuitRequested = true;
  for (const record of windowRecords.values()) record.allowWindowClose = true;
});
