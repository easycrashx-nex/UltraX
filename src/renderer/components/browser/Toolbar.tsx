import type { Bookmark, BrowserSettings, BrowserTab } from "@shared/types";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark as BookmarkIcon,
  Clock,
  Download,
  Home,
  RotateCw,
  Search,
  Settings,
  Star,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAddressValue, getHostname, isBookmarked } from "@/lib/browser";
import { cn } from "@/lib/utils";
import type { PanelId } from "./types";

type ToolbarProps = {
  activeTab?: BrowserTab;
  bookmarks: Bookmark[];
  settings: BrowserSettings;
  addressValue: string;
  addressInputRef: RefObject<HTMLInputElement | null>;
  activePanel: PanelId;
  quickSettingsOpen: boolean;
  onAddressChange: (value: string) => void;
  onNavigate: (input: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStopLoading: () => void;
  onHome: () => void;
  onToggleBookmark: () => void;
  onOpenBookmark: (bookmarkId: string) => void;
  onOpenPanel: (panel: PanelId) => void;
  onToggleQuickSettings: () => void;
};

export function Toolbar({
  activeTab,
  bookmarks,
  settings,
  addressValue,
  addressInputRef,
  activePanel,
  quickSettingsOpen,
  onAddressChange,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStopLoading,
  onHome,
  onToggleBookmark,
  onOpenBookmark,
  onOpenPanel,
  onToggleQuickSettings,
}: ToolbarProps) {
  const bookmarked = isBookmarked(activeTab, bookmarks);
  const isCompact = settings.toolbarDensity === "compact";
  const visibleBookmarks = bookmarks.slice(0, 6);

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNavigate(addressValue || getAddressValue(activeTab));
  };

  return (
    <div className="flex h-[68px] flex-col gap-1 border-b border-border/75 bg-card/88 px-3 py-1 backdrop-blur-xl">
      <div className="flex min-h-9 min-w-0 items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title="Back"
            aria-label="Back"
            disabled={!activeTab?.canGoBack}
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title="Forward"
            aria-label="Forward"
            disabled={!activeTab?.canGoForward}
            onClick={onForward}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title={activeTab?.isLoading ? "Stop loading" : "Reload"}
            aria-label={activeTab?.isLoading ? "Stop loading" : "Reload"}
            disabled={activeTab?.isNewTab}
            onClick={activeTab?.isLoading ? onStopLoading : onReload}
          >
            {activeTab?.isLoading ? <X aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
          </Button>
          {settings.showHomeButton && (
            <Button
              type="button"
              variant="chrome"
              size="icon"
              title="Home"
              aria-label="Home"
              onClick={onHome}
            >
              <Home aria-hidden="true" />
            </Button>
          )}
        </div>

        <form onSubmit={submitAddress} className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={addressInputRef}
            value={addressValue}
            onChange={(event) => onAddressChange(event.target.value)}
            placeholder="Search or enter address"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "rounded-xl border-border bg-background/72 pl-9 pr-10 text-[13px] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
              isCompact ? "h-8" : "h-9",
            )}
          />
          <Button
            type="button"
            variant="chrome"
            size="iconSm"
            title={bookmarked ? "Remove bookmark" : "Bookmark current page"}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark current page"}
            disabled={!activeTab || activeTab.isNewTab}
            onClick={onToggleBookmark}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2",
              bookmarked && "text-primary",
            )}
          >
            <Star aria-hidden="true" fill={bookmarked ? "currentColor" : "none"} />
          </Button>
        </form>

        <div className="flex items-center gap-1">
          <PanelButton
            label="Bookmarks"
            active={activePanel === "bookmarks"}
            onClick={() => onOpenPanel(activePanel === "bookmarks" ? null : "bookmarks")}
          >
            <BookmarkIcon aria-hidden="true" />
          </PanelButton>
          <PanelButton
            label="History"
            active={activePanel === "history"}
            onClick={() => onOpenPanel(activePanel === "history" ? null : "history")}
          >
            <Clock aria-hidden="true" />
          </PanelButton>
          <PanelButton
            label="Downloads"
            active={activePanel === "downloads"}
            onClick={() => onOpenPanel(activePanel === "downloads" ? null : "downloads")}
          >
            <Download aria-hidden="true" />
          </PanelButton>
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title="Quick Settings"
            aria-label="Quick Settings"
            aria-pressed={quickSettingsOpen}
            data-quick-settings-trigger="true"
            onClick={onToggleQuickSettings}
            className={cn(quickSettingsOpen && "border-border bg-accent text-foreground")}
          >
            <Settings aria-hidden="true" />
          </Button>
        </div>
      </div>

      {settings.showBookmarksBar ? (
        <div className="flex min-h-[20px] min-w-0 items-center gap-2 text-[11px] leading-none text-muted-foreground">
          <span className="shrink-0 font-semibold text-foreground/80">Bookmarks</span>
          {visibleBookmarks.length === 0 ? (
            <span className="truncate">Use the star button to save this page.</span>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {visibleBookmarks.map((bookmark) => (
                <button
                  key={bookmark.id}
                  type="button"
                  title={bookmark.title}
                  onClick={() => onOpenBookmark(bookmark.id)}
                  className="max-w-32 truncate rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {getHostname(bookmark.url)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-[20px] items-center justify-between text-[11px] leading-none text-muted-foreground">
          <span className="truncate">
            {activeTab?.isNewTab
              ? "New Tab"
              : activeTab?.error
                ? activeTab.error
                : activeTab?.url}
          </span>
          <span className="shrink-0 capitalize">Search: {settings.searchEngine}</span>
        </div>
      )}
    </div>
  );
}

function PanelButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="chrome"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(active && "border-border bg-accent text-foreground")}
    >
      {children}
    </Button>
  );
}
