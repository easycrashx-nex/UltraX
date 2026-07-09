import { app, BrowserWindow, Notification, shell } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import { IPC } from "../../shared/ipc";
import type { BrowserSettings, UpdateSettings, UpdateStatusSnapshot } from "../../shared/types";

const DEFAULT_RELEASES_URL = "https://github.com/YOUR_USERNAME/ultrax-browser/releases";

type UpdateSettingsPatch = Partial<BrowserSettings["updates"]>;

export class UpdateManager {
  private readonly updater = autoUpdater;
  private snapshot: UpdateStatusSnapshot;
  private initialized = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly getUpdateSettings: () => UpdateSettings,
    private readonly patchUpdateSettings: (patch: UpdateSettingsPatch) => void,
  ) {
    const settings = this.getUpdateSettings();
    this.snapshot = {
      status: "idle",
      currentVersion: app.getVersion(),
      channel: settings.channel,
      updateAvailable: false,
      lastCheckedAt: settings.lastCheckedAt,
      source: "github-releases",
      releasesUrl: resolveReleasesUrl(),
      canCheck: true,
      canDownload: false,
      canInstall: false,
    };
  }

  init(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.configureUpdater();
    this.registerUpdaterEvents();

    const settings = this.getUpdateSettings();
    this.updateSnapshot({
      channel: settings.channel,
      lastCheckedAt: settings.lastCheckedAt,
    });

    if (settings.autoCheck) {
      setTimeout(() => {
        void this.checkForUpdates();
      }, 2500);
    }
  }

  getStatus(): UpdateStatusSnapshot {
    return structuredClone(this.snapshot);
  }

  async checkForUpdates(): Promise<UpdateStatusSnapshot> {
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
      this.updateSnapshot({
        status: "error",
        error: "Update checks require a packaged UltraX build. Use GitHub Releases or the installer for production checks.",
        canCheck: true,
      });
      return this.getStatus();
    }

    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      this.updateSnapshot({
        status: "error",
        error: errorToMessage(error),
        canCheck: true,
      });
    }

    return this.getStatus();
  }

  async downloadUpdate(): Promise<UpdateStatusSnapshot> {
    if (this.snapshot.status !== "available") {
      this.updateSnapshot({
        status: "error",
        error: "No downloadable update is currently available.",
        canCheck: true,
      });
      return this.getStatus();
    }

    this.configureUpdater();
    this.updateSnapshot({
      status: "downloading",
      error: undefined,
      canCheck: false,
      canDownload: false,
      canInstall: false,
    });

    try {
      await this.updater.downloadUpdate();
    } catch (error) {
      this.updateSnapshot({
        status: "error",
        error: errorToMessage(error),
        canCheck: true,
      });
    }

    return this.getStatus();
  }

  installUpdate(): UpdateStatusSnapshot {
    if (this.snapshot.status !== "downloaded") {
      this.updateSnapshot({
        status: "error",
        error: "No downloaded update is ready to install.",
        canCheck: true,
      });
      return this.getStatus();
    }

    this.updateSnapshot({
      status: "installing",
      canCheck: false,
      canDownload: false,
      canInstall: false,
    });
    this.updater.quitAndInstall(false, true);
    return this.getStatus();
  }

  async openReleasesPage(): Promise<void> {
    const url = this.snapshot.releasesUrl;
    if (!url.startsWith("https://")) {
      throw new Error("Release URL must use HTTPS.");
    }

    await shell.openExternal(url);
  }

  private configureUpdater(): void {
    const settings = this.getUpdateSettings();
    this.updater.autoDownload = settings.autoDownload;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowPrerelease = settings.channel !== "stable";
    this.updater.channel = settings.channel === "stable" ? "latest" : settings.channel;
  }

  private registerUpdaterEvents(): void {
    this.updater.on("checking-for-update", () => {
      this.updateSnapshot({
        status: "checking",
        error: undefined,
        progress: undefined,
        updateAvailable: false,
        canCheck: false,
        canDownload: false,
        canInstall: false,
      });
    });

    this.updater.on("update-available", (info: UpdateInfo) => {
      const settings = this.getUpdateSettings();
      if (settings.notifyWhenAvailable && Notification.isSupported()) {
        new Notification({
          title: "UltraX update available",
          body: `Version ${info.version} is ready to download.`,
        }).show();
      }

      this.updateSnapshot({
        status: settings.autoDownload ? "downloading" : "available",
        latestVersion: info.version,
        releaseName: optionalString(info.releaseName),
        releaseDate: optionalString(info.releaseDate),
        releaseNotes: releaseNotesToText(info.releaseNotes),
        updateAvailable: true,
        canCheck: true,
        canDownload: !settings.autoDownload,
        canInstall: false,
      });
    });

    this.updater.on("update-not-available", (info: UpdateInfo) => {
      this.updateSnapshot({
        status: "not-available",
        latestVersion: info.version,
        releaseName: optionalString(info.releaseName),
        releaseDate: optionalString(info.releaseDate),
        releaseNotes: releaseNotesToText(info.releaseNotes),
        updateAvailable: false,
        canCheck: true,
        canDownload: false,
        canInstall: false,
      });
    });

    this.updater.on("download-progress", (progress: ProgressInfo) => {
      this.updateSnapshot({
        status: "downloading",
        progress: {
          percent: Math.max(0, Math.min(100, progress.percent)),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
        canCheck: false,
        canDownload: false,
        canInstall: false,
      });
    });

    this.updater.on("update-downloaded", (info: UpdateInfo) => {
      this.updateSnapshot({
        status: "downloaded",
        latestVersion: info.version,
        releaseName: optionalString(info.releaseName),
        releaseDate: optionalString(info.releaseDate),
        releaseNotes: releaseNotesToText(info.releaseNotes),
        updateAvailable: true,
        progress: undefined,
        canCheck: true,
        canDownload: false,
        canInstall: true,
      });
    });

    this.updater.on("error", (error: Error) => {
      this.updateSnapshot({
        status: "error",
        error: errorToMessage(error),
        canCheck: true,
        canDownload: false,
        canInstall: false,
      });
    });
  }

  private updateSnapshot(patch: Partial<UpdateStatusSnapshot>): void {
    const settings = this.getUpdateSettings();
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      currentVersion: app.getVersion(),
      channel: settings.channel,
      releasesUrl: resolveReleasesUrl(),
      source: "github-releases",
    };
    this.window.webContents.send(IPC.updateStatusChanged, this.getStatus());
  }
}

function resolveReleasesUrl(): string {
  const explicitUrl = process.env.ULTRAX_RELEASES_URL;
  if (explicitUrl?.startsWith("https://")) {
    return explicitUrl;
  }

  const repository = process.env.ULTRAX_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
  if (repository && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return `https://github.com/${repository}/releases`;
  }

  return DEFAULT_RELEASES_URL;
}

function releaseNotesToText(value: UpdateInfo["releaseNotes"]): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return stripHtml(value).slice(0, 6000);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const title = item.version ? `Version ${item.version}` : "Release";
        return `${title}\n${stripHtml(item.note ?? "")}`;
      })
      .join("\n\n")
      .slice(0, 6000);
  }

  return undefined;
}

function optionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Update operation failed.";
}
