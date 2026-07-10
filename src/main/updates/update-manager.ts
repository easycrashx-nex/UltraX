import { app, BrowserWindow, net, Notification, shell } from "electron";
import { IPC } from "../../shared/ipc";
import type { BrowserSettings, UpdateChannel, UpdateSettings, UpdateStatusSnapshot } from "../../shared/types";
import { isNewerVersion } from "../../shared/version";

const ULTRAX_GITHUB_REPOSITORY = "easycrashx-nex/UltraX";
const DEFAULT_RELEASES_URL = `https://github.com/${ULTRAX_GITHUB_REPOSITORY}/releases`;
const MANUAL_UPDATE_MESSAGE =
  "Automatic installation is disabled until UltraX releases are Windows code signed. Open the verified GitHub Release and install it manually.";

type UpdateSettingsPatch = Partial<BrowserSettings["updates"]>;

type GitHubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  published_at?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
};

export class UpdateManager {
  private snapshot: UpdateStatusSnapshot;
  private initialized = false;
  private selectedReleaseUrl: string | undefined;

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
    if (this.initialized) return;
    this.initialized = true;
    const settings = this.getUpdateSettings();
    this.updateSnapshot({ channel: settings.channel, lastCheckedAt: settings.lastCheckedAt });
    if (settings.autoCheck) {
      setTimeout(() => void this.checkForUpdates(), 2500);
    }
  }

  getStatus(): UpdateStatusSnapshot {
    return structuredClone(this.snapshot);
  }

  async checkForUpdates(): Promise<UpdateStatusSnapshot> {
    if (this.snapshot.status === "checking") return this.getStatus();

    const settings = this.getUpdateSettings();
    const checkedAt = Date.now();
    this.patchUpdateSettings({ lastCheckedAt: checkedAt, autoDownload: false });
    this.selectedReleaseUrl = undefined;
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
        error: "Update checks require a packaged UltraX build. Open GitHub Releases for published versions.",
        canCheck: true,
      });
      return this.getStatus();
    }

    try {
      const release = await fetchRelease(settings.channel);
      if (!release) {
        this.updateSnapshot({
          status: "not-available",
          updateAvailable: false,
          canCheck: true,
        });
        return this.getStatus();
      }

      const latestVersion = release.tagName.replace(/^v/, "");
      const updateAvailable = isNewerVersion(latestVersion, app.getVersion());
      this.selectedReleaseUrl = release.url;
      if (updateAvailable && settings.notifyWhenAvailable && Notification.isSupported()) {
        new Notification({
          title: "UltraX update available",
          body: `Version ${latestVersion} is available as a verified GitHub Release.`,
        }).show();
      }
      this.updateSnapshot({
        status: updateAvailable ? "available" : "not-available",
        latestVersion,
        releaseName: release.name,
        releaseDate: release.publishedAt,
        releaseNotes: release.notes,
        updateAvailable,
        canCheck: true,
        canDownload: false,
        canInstall: false,
      });
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
    this.updateSnapshot({ status: "error", error: MANUAL_UPDATE_MESSAGE, canCheck: true });
    return this.getStatus();
  }

  installUpdate(): UpdateStatusSnapshot {
    this.updateSnapshot({ status: "error", error: MANUAL_UPDATE_MESSAGE, canCheck: true });
    return this.getStatus();
  }

  async openReleasesPage(): Promise<void> {
    const url = this.selectedReleaseUrl ?? this.snapshot.releasesUrl;
    if (!url.startsWith("https://github.com/easycrashx-nex/UltraX/releases")) {
      throw new Error("Release URL is outside the official UltraX GitHub repository.");
    }
    await shell.openExternal(url);
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
      canDownload: false,
      canInstall: false,
    };
    this.window.webContents.send(IPC.updateStatusChanged, this.getStatus());
  }
}

async function fetchRelease(channel: UpdateChannel): Promise<{
  tagName: string;
  name?: string;
  notes?: string;
  publishedAt?: string;
  url: string;
} | null> {
  const repository = resolveRepository();
  const response = await net.fetch(`https://api.github.com/repos/${repository}/releases?per_page=20`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `UltraX-Browser/${app.getVersion()}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub Releases returned HTTP ${response.status}.`);
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error("GitHub Releases returned an invalid response.");

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const release = item as GitHubRelease;
    if (release.draft === true || !matchesChannel(release, channel)) continue;
    if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") continue;
    if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(release.tag_name)) continue;
    if (!release.html_url.startsWith(`https://github.com/${repository}/releases/`)) continue;
    return {
      tagName: release.tag_name,
      name: optionalString(release.name),
      notes: optionalString(release.body)?.slice(0, 6000),
      publishedAt: optionalString(release.published_at),
      url: release.html_url,
    };
  }
  return null;
}

function matchesChannel(release: GitHubRelease, channel: UpdateChannel): boolean {
  if (channel === "stable") return release.prerelease !== true;
  const label = `${optionalString(release.tag_name) ?? ""} ${optionalString(release.name) ?? ""}`.toLowerCase();
  return release.prerelease === true && label.includes(channel);
}

function resolveRepository(): string {
  const repository = process.env.ULTRAX_GITHUB_REPOSITORY ?? ULTRAX_GITHUB_REPOSITORY;
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    ? repository
    : ULTRAX_GITHUB_REPOSITORY;
}

function resolveReleasesUrl(): string {
  return `https://github.com/${resolveRepository()}/releases`;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Update check failed.";
}
