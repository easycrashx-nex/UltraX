import { app, BrowserWindow, Notification, shell } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import { IPC } from "../../shared/ipc";
import type { BrowserSettings, UpdateSettings, UpdateStatusSnapshot } from "../../shared/types";
import { formatUpdateError } from "../../shared/update-errors";
import { formatVisibleVersion } from "../../shared/version";
import { SILENT_UPDATE_INSTALL_OPTIONS } from "../../shared/update-install";

const DEFAULT_RELEASES_URL = "https://github.com/easycrashx-nex/UltraX/releases";

type UpdateSettingsPatch = Partial<BrowserSettings["updates"]>;
type UpdaterEvent =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded"
  | "error";

export class UpdateManager {
  private static operation: "checking" | "downloading" | "installing" | undefined;
  private static installInProgress = false;
  private readonly updater = autoUpdater;
  private readonly listeners: Array<{ event: UpdaterEvent; listener: (...args: never[]) => void }> = [];
  private snapshot: UpdateStatusSnapshot;
  private initialized = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly getUpdateSettings: () => UpdateSettings,
    private readonly patchUpdateSettings: (patch: UpdateSettingsPatch) => void,
    private readonly prepareForInstall: () => Promise<void>,
  ) {
    const settings = this.getUpdateSettings();
    this.snapshot = {
      status: "idle",
      currentVersion: formatVisibleVersion(app.getVersion()),
      channel: settings.channel,
      updateAvailable: false,
      lastCheckedAt: settings.lastCheckedAt,
      source: "github-releases",
      releasesUrl: DEFAULT_RELEASES_URL,
      canCheck: true,
      canDownload: false,
      canInstall: false,
    };
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.configureUpdater();
    this.registerUpdaterEvents();

    const settings = this.getUpdateSettings();
    this.updateSnapshot({ channel: settings.channel, lastCheckedAt: settings.lastCheckedAt });
    if (settings.autoCheck) setTimeout(() => void this.checkForUpdates(), 2500);
  }

  dispose(): void {
    for (const { event, listener } of this.listeners) this.updater.removeListener(event, listener);
    this.listeners.length = 0;
  }

  getStatus(): UpdateStatusSnapshot {
    return structuredClone(this.snapshot);
  }

  async checkForUpdates(): Promise<UpdateStatusSnapshot> {
    if (UpdateManager.operation) return this.getStatus();

    UpdateManager.operation = "checking";
    const settings = this.getUpdateSettings();
    const checkedAt = Date.now();
    this.patchUpdateSettings({ lastCheckedAt: checkedAt });
    this.configureUpdater();
    this.updateSnapshot({
      status: "checking",
      channel: settings.channel,
      error: undefined,
      progress: undefined,
      lastCheckedAt: checkedAt,
      updateAvailable: false,
      canCheck: false,
      canDownload: false,
      canInstall: false,
    });

    if (!app.isPackaged) {
      UpdateManager.operation = undefined;
      this.updateSnapshot({
        status: "error",
        error: "Update checks require an installed UltraX build. Open the official GitHub Release when developing locally.",
        canCheck: true,
      });
      return this.getStatus();
    }

    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      UpdateManager.operation = undefined;
      this.updateSnapshot({ status: "error", error: formatUpdateError(error), canCheck: true });
    }
    return this.getStatus();
  }

  async downloadUpdate(): Promise<UpdateStatusSnapshot> {
    if (UpdateManager.operation) return this.getStatus();
    if (this.snapshot.status !== "available") {
      this.updateSnapshot({ status: "error", error: "No downloadable update is currently available.", canCheck: true });
      return this.getStatus();
    }

    UpdateManager.operation = "downloading";
    this.configureUpdater();
    this.updateSnapshot({
      status: "downloading",
      error: undefined,
      progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 },
      canCheck: false,
      canDownload: false,
      canInstall: false,
    });
    try {
      this.logUpdateEvent("download-started", this.snapshot.latestVersion);
      await this.updater.downloadUpdate();
    } catch (error) {
      UpdateManager.operation = undefined;
      this.updateSnapshot({ status: "error", error: formatUpdateError(error), canCheck: true });
    }
    return this.getStatus();
  }

  async installUpdate(): Promise<UpdateStatusSnapshot> {
    if (UpdateManager.operation || UpdateManager.installInProgress) return this.getStatus();
    if (this.snapshot.status !== "downloaded") {
      this.updateSnapshot({ status: "error", error: "No downloaded update is ready to install.", canCheck: true });
      return this.getStatus();
    }

    UpdateManager.operation = "installing";
    UpdateManager.installInProgress = true;
    this.updateSnapshot({ status: "installing", error: undefined, canCheck: false, canDownload: false, canInstall: false });
    try {
      await this.prepareForInstall();
      this.logUpdateEvent("install-and-restart", this.snapshot.latestVersion);
      // electron-updater delegates to the downloaded NSIS package. The first
      // argument is the supported silent-install flag; the second requests
      // automatic relaunch after the installer exits.
      this.updater.quitAndInstall(
        SILENT_UPDATE_INSTALL_OPTIONS.isSilent,
        SILENT_UPDATE_INSTALL_OPTIONS.isForceRunAfter,
      );
    } catch (error) {
      UpdateManager.installInProgress = false;
      UpdateManager.operation = undefined;
      this.updateSnapshot({ status: "error", error: formatUpdateError(error), canCheck: true, canInstall: true });
    }
    return this.getStatus();
  }

  async openReleasesPage(): Promise<void> {
    await shell.openExternal(DEFAULT_RELEASES_URL);
  }

  private configureUpdater(): void {
    const settings = this.getUpdateSettings();
    // Downloads and installation are explicit actions in Settings. This also
    // prevents an update from being installed as a side effect of auto-check.
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.autoRunAppAfterInstall = true;
    this.updater.allowPrerelease = settings.channel !== "stable";
    this.updater.channel = settings.channel === "stable" ? "latest" : settings.channel;
  }

  private on(event: UpdaterEvent, listener: (...args: never[]) => void): void {
    this.updater.on(event, listener);
    this.listeners.push({ event, listener });
  }

  private registerUpdaterEvents(): void {
    this.on("checking-for-update", () => {
      this.logUpdateEvent("checking-for-update");
      this.updateSnapshot({ status: "checking", error: undefined, progress: undefined, updateAvailable: false, canCheck: false, canDownload: false, canInstall: false });
    });
    this.on("update-available", ((info: UpdateInfo) => {
      UpdateManager.operation = undefined;
      this.logUpdateEvent("update-available", info.version);
      const settings = this.getUpdateSettings();
      if (settings.notifyWhenAvailable && Notification.isSupported()) {
        new Notification({ title: "UltraX update available", body: `Version ${formatVisibleVersion(info.version)} is ready to download.` }).show();
      }
      this.updateSnapshot({
        status: "available",
        latestVersion: formatVisibleVersion(info.version),
        releaseName: optionalString(info.releaseName),
        releaseDate: optionalString(info.releaseDate),
        releaseNotes: releaseNotesToText(info.releaseNotes),
        updateAvailable: true,
        canCheck: true,
        canDownload: true,
        canInstall: false,
      });
    }) as (...args: never[]) => void);
    this.on("update-not-available", ((info: UpdateInfo) => {
      UpdateManager.operation = undefined;
      this.logUpdateEvent("update-not-available", info.version);
      this.updateSnapshot({ status: "not-available", latestVersion: formatVisibleVersion(info.version), releaseName: optionalString(info.releaseName), releaseDate: optionalString(info.releaseDate), releaseNotes: releaseNotesToText(info.releaseNotes), updateAvailable: false, canCheck: true, canDownload: false, canInstall: false });
    }) as (...args: never[]) => void);
    this.on("download-progress", ((progress: ProgressInfo) => {
      this.updateSnapshot({ status: "downloading", progress: { percent: clampPercent(progress.percent), transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond }, canCheck: false, canDownload: false, canInstall: false });
    }) as (...args: never[]) => void);
    this.on("update-downloaded", ((info: UpdateInfo) => {
      UpdateManager.operation = undefined;
      this.logUpdateEvent("update-downloaded", info.version);
      this.updateSnapshot({ status: "downloaded", latestVersion: formatVisibleVersion(info.version), releaseName: optionalString(info.releaseName), releaseDate: optionalString(info.releaseDate), releaseNotes: releaseNotesToText(info.releaseNotes), updateAvailable: true, progress: undefined, canCheck: true, canDownload: false, canInstall: true });
    }) as (...args: never[]) => void);
    this.on("error", ((error: Error) => {
      UpdateManager.operation = undefined;
      this.logUpdateEvent("error");
      this.updateSnapshot({ status: "error", error: formatUpdateError(error), canCheck: true, canDownload: false, canInstall: this.snapshot.status === "downloaded" });
    }) as (...args: never[]) => void);
  }

  private logUpdateEvent(event: string, version?: string): void {
    console.info(`[updates] ${event}${version ? ` (${version})` : ""}`);
  }

  private updateSnapshot(patch: Partial<UpdateStatusSnapshot>): void {
    const settings = this.getUpdateSettings();
    this.snapshot = { ...this.snapshot, ...patch, currentVersion: formatVisibleVersion(app.getVersion()), channel: settings.channel, releasesUrl: DEFAULT_RELEASES_URL, source: "github-releases" };
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(IPC.updateStatusChanged, this.getStatus());
    }
  }
}

function releaseNotesToText(value: UpdateInfo["releaseNotes"]): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return stripHtml(value).slice(0, 6000);
  if (Array.isArray(value)) {
    return value.map((item) => `${item.version ? `Version ${formatVisibleVersion(item.version)}` : "Release"}\n${stripHtml(item.note ?? "")}`).join("\n\n").slice(0, 6000);
  }
  return undefined;
}

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
