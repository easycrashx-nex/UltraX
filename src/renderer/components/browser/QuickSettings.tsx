import type {
  BrowserSettings,
  DownloadItem,
  InstalledExtension,
  RuntimeInfo,
  SearchEngine,
  UpdateStatusSnapshot,
} from "@shared/types";
import {
  Blocks,
  Check,
  ChevronRight,
  DatabaseZap,
  Download,
  Info,
  Moon,
  Palette,
  Power,
  Puzzle,
  Search,
  Settings,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SettingsCategoryId } from "./types";

type QuickSettingsProps = {
  open: boolean;
  settings: BrowserSettings;
  downloads: DownloadItem[];
  installedExtensions: InstalledExtension[];
  runtimeInfo: RuntimeInfo | null;
  updateStatus: UpdateStatusSnapshot | null;
  onClose: () => void;
  onOpenSettings: (category?: SettingsCategoryId) => void;
  onUpdateSettings: (settings: Partial<BrowserSettings>) => void;
  onOpenExtensionPanel: (extensionId: string) => void;
  onSetExtensionEnabled: (extensionId: string, enabled: boolean) => Promise<void>;
  onClearHistory: () => void;
  onOpenDownloads: () => void;
};

const searchEngineLabel: Record<SearchEngine, string> = {
  duckduckgo: "DuckDuckGo",
  google: "Google",
  bing: "Bing",
  brave: "Brave Search",
  custom: "Custom",
};

export function QuickSettings({
  open,
  settings,
  downloads,
  installedExtensions,
  runtimeInfo,
  updateStatus,
  onClose,
  onOpenSettings,
  onUpdateSettings,
  onOpenExtensionPanel,
  onSetExtensionEnabled,
  onClearHistory,
  onOpenDownloads,
}: QuickSettingsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-quick-settings-trigger]")) {
        return;
      }

      if (!panelRef.current?.contains(target)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="glass-panel settings-modal quick-settings-panel fixed right-4 top-[112px] z-50 max-h-[calc(100vh-128px)] w-[380px] overflow-hidden rounded-2xl p-3 text-foreground shadow-2xl shadow-black/45"
      role="dialog"
      aria-label="Quick Settings"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold">Quick Settings</h2>
          <p className="text-xs text-muted-foreground">Fast controls for UltraX.</p>
        </div>
        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="Close Quick Settings"
          aria-label="Close Quick Settings"
          onClick={onClose}
          className="rounded-lg"
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="settings-scrollbar max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/35">
          <QuickSelectRow
            icon={<Moon aria-hidden="true" />}
            label="Theme"
            value={settings.theme}
            onChange={(value) => onUpdateSettings({ theme: value as BrowserSettings["theme"] })}
            options={[
              ["dark", "Dark"],
              ["light", "Light"],
              ["system", "System"],
            ]}
          />
          <QuickSwitchRow
            icon={<Sparkles aria-hidden="true" />}
            label="Shader Animation"
            detail="New Tab background"
            checked={settings.shaderEnabled}
            onChange={(checked) => onUpdateSettings({ shaderEnabled: checked })}
          />
          <QuickSwitchRow
            icon={<Palette aria-hidden="true" />}
            label="Reduced Motion"
            detail="Limit animated effects"
            checked={settings.reducedMotion}
            onChange={(checked) => onUpdateSettings({ reducedMotion: checked })}
          />
          <QuickActionRow
            icon={<Search aria-hidden="true" />}
            label="Search Engine"
            detail={searchEngineLabel[settings.searchEngine]}
            onClick={() => onOpenSettings("search")}
          />
          <QuickActionRow
            icon={<Shield aria-hidden="true" />}
            label="Privacy"
            detail={settings.doNotTrack ? "Do Not Track on" : "Standard local controls"}
            onClick={() => onOpenSettings("privacy")}
          />
          <QuickActionRow
            icon={<DatabaseZap aria-hidden="true" />}
            label="Clear Recent History"
            detail="Remove local history list"
            onClick={onClearHistory}
          />
          <QuickActionRow
            icon={<Download aria-hidden="true" />}
            label="Downloads"
            detail={
              downloads.length
                ? `${downloads.length} item${downloads.length > 1 ? "s" : ""}`
                : "No downloads"
            }
            onClick={onOpenDownloads}
          />
          <QuickActionRow
            icon={<Info aria-hidden="true" />}
            label={hasUpdateAttention(updateStatus) ? "Update Available" : "About"}
            detail={getAboutDetail(runtimeInfo, updateStatus)}
            onClick={() => onOpenSettings(hasUpdateAttention(updateStatus) ? "updates" : "about")}
          />
        </div>

        <QuickExtensionsSection
          extensions={installedExtensions}
          onManage={() => onOpenSettings("extensions")}
          onOpenPanel={onOpenExtensionPanel}
          onSetEnabled={onSetExtensionEnabled}
        />

        <QuickPluginsSection onManage={() => onOpenSettings("plugins")} />

        <Button
          type="button"
          className="mt-3 h-10 w-full rounded-xl"
          onClick={() => onOpenSettings()}
        >
          <Settings aria-hidden="true" />
          Open Settings
        </Button>
      </div>
    </div>
  );
}

function getAboutDetail(
  runtimeInfo: RuntimeInfo | null,
  updateStatus: UpdateStatusSnapshot | null,
): string {
  if (updateStatus?.status === "available") {
    return `Update ${updateStatus.latestVersion ?? "available"}`;
  }

  if (updateStatus?.status === "downloaded") {
    return "Restart to update";
  }

  return runtimeInfo ? `UltraX ${runtimeInfo.appVersion}` : "Version info";
}

function hasUpdateAttention(updateStatus: UpdateStatusSnapshot | null): boolean {
  return updateStatus?.status === "available" || updateStatus?.status === "downloaded";
}

function QuickExtensionsSection({
  extensions,
  onManage,
  onOpenPanel,
  onSetEnabled,
}: {
  extensions: InstalledExtension[];
  onManage: () => void;
  onOpenPanel: (extensionId: string) => void;
  onSetEnabled: (extensionId: string, enabled: boolean) => Promise<void>;
}) {
  const visibleExtensions = extensions.slice(0, 4);
  const hiddenCount = Math.max(0, extensions.length - visibleExtensions.length);

  return (
    <section className="mt-3 rounded-2xl border border-border/70 bg-background/35 p-2">
      <QuickSectionHeader
        icon={<Blocks aria-hidden="true" />}
        title="Extensions"
        actionLabel={extensions.length > 4 ? "View all" : "Manage"}
        onAction={onManage}
      />

      {visibleExtensions.length === 0 ? (
        <QuickEmptyState
          title="No extensions installed"
          detail="Install or load extensions from Settings."
          actionLabel="Manage Extensions"
          onAction={onManage}
        />
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-border/55 bg-background/28">
          {visibleExtensions.map((extension) => (
            <QuickExtensionRow
              key={extension.id}
              extension={extension}
              onOpenPanel={() => onOpenPanel(extension.id)}
              onSetEnabled={(enabled) => onSetEnabled(extension.id, enabled)}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onManage}
              className="flex min-h-11 w-full items-center justify-between border-t border-border/55 px-3 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              <span>{hiddenCount} more extension{hiddenCount > 1 ? "s" : ""}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function QuickExtensionRow({
  extension,
  onOpenPanel,
  onSetEnabled,
}: {
  extension: InstalledExtension;
  onOpenPanel: () => void;
  onSetEnabled: (enabled: boolean) => Promise<void>;
}) {
  const hasPanel = Boolean(extension.manifest.panel);
  const canOpen = hasPanel && extension.enabled && extension.status !== "error";
  const statusText =
    extension.status === "error"
      ? "Needs attention"
      : extension.enabled
        ? "Enabled"
        : "Disabled";
  const detailText = hasPanel
    ? canOpen
      ? "Panel ready"
      : "Enable to open panel"
    : "No panel";

  return (
    <div
      className={cn(
        "group flex min-h-16 w-full items-center gap-3 border-b border-border/55 px-3 text-left last:border-b-0",
        "transition-colors hover:bg-accent/55",
        !canOpen && "hover:bg-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (canOpen) {
            onOpenPanel();
          }
        }}
        aria-disabled={!canOpen}
        title={canOpen ? `Open ${extension.manifest.name}` : `${extension.manifest.name} cannot be opened now`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/14 text-xs font-semibold text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]">
          {extension.manifest.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{extension.manifest.name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                extension.status === "error"
                  ? "bg-red-400"
                  : extension.enabled
                    ? "bg-primary"
                    : "bg-muted-foreground/55",
              )}
            />
            <span className="truncate">
              {statusText} - {detailText}
            </span>
          </span>
        </span>
        {canOpen && (
          <span className="rounded-lg border border-border/60 bg-background/45 px-2 py-1 text-[11px] font-medium text-foreground transition-colors group-hover:border-primary/45 group-hover:text-primary">
            Open
          </span>
        )}
      </button>
      <button
        type="button"
        role="switch"
        aria-label={`${extension.enabled ? "Disable" : "Enable"} ${extension.manifest.name}`}
        aria-checked={extension.enabled}
        disabled={extension.status === "error"}
        onClick={(event) => {
          event.stopPropagation();
          void onSetEnabled(!extension.enabled).catch((error) => {
            window.alert(error instanceof Error ? error.message : "Extension state could not be changed.");
          });
        }}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border outline-none transition duration-200 focus-visible:ring-[4px] focus-visible:ring-ring/24 disabled:cursor-not-allowed disabled:opacity-45",
          extension.enabled ? "border-primary/70 bg-primary" : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 grid size-5 place-items-center rounded-full bg-white text-primary shadow-sm transition-transform duration-200",
            extension.enabled ? "translate-x-5" : "translate-x-0.5",
          )}
        >
          {extension.enabled && <Check aria-hidden="true" className="size-3" />}
        </span>
      </button>
    </div>
  );
}

function QuickPluginsSection({ onManage }: { onManage: () => void }) {
  return (
    <section className="mt-3 rounded-2xl border border-border/70 bg-background/35 p-2">
      <QuickSectionHeader
        icon={<Puzzle aria-hidden="true" />}
        title="Plugins"
        actionLabel="Manage"
        onAction={onManage}
      />
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border/65 bg-background/24 px-3 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/75 text-muted-foreground">
          <Power aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Plugins coming soon</span>
          <span className="block truncate text-xs text-muted-foreground">
            UltraX plugins will appear here
          </span>
        </span>
      </div>
    </section>
  );
}

function QuickSectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary/75 text-primary [&_svg]:size-3.5">
          {icon}
        </span>
        <h3 className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="rounded-lg px-2 py-1 text-[11px] font-medium text-primary outline-none transition-colors hover:bg-primary/12 focus-visible:ring-[3px] focus-visible:ring-ring/35"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function QuickEmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-border/65 bg-background/24 p-3">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-2 rounded-lg px-2 py-1 text-[11px] font-medium text-primary outline-none transition-colors hover:bg-primary/12 focus-visible:ring-[3px] focus-visible:ring-ring/35"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function QuickSwitchRow({
  icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-border/55 px-3 last:border-b-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/75 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full border outline-none transition duration-200 focus-visible:ring-[4px] focus-visible:ring-ring/24",
          checked ? "border-primary/70 bg-primary" : "border-border bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 grid size-5 place-items-center rounded-full bg-white text-primary shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        >
          {checked && <Check aria-hidden="true" className="size-3" />}
        </span>
      </button>
    </div>
  );
}

function QuickSelectRow({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-14 items-center gap-3 border-b border-border/55 px-3 last:border-b-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/75 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 min-w-24 appearance-none rounded-lg border border-border bg-background/70 px-2 pr-7 text-xs text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
        >
          {options.map(([optionValue, labelText]) => (
            <option key={optionValue} value={optionValue}>
              {labelText}
            </option>
          ))}
        </select>
        <ChevronRight
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 rotate-90 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

function QuickActionRow({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 border-b border-border/55 px-3 text-left",
        "transition-colors last:border-b-0 hover:bg-accent/55 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/75 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
    </button>
  );
}
