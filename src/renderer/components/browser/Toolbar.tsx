import type { Bookmark, BrowserSettings, BrowserTab, HistoryEntry } from "@shared/types";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark as BookmarkIcon,
  Clock,
  Download,
  Globe2,
  Home,
  PanelTopOpen,
  RotateCw,
  Search,
  Settings,
  Star,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAddressValue, getHostname, isBookmarked } from "@/lib/browser";
import { cn } from "@/lib/utils";
import type { PanelId } from "./types";

type ToolbarProps = {
  activeTab?: BrowserTab;
  tabs: BrowserTab[];
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  settings: BrowserSettings;
  addressValue: string;
  addressInputRef: RefObject<HTMLInputElement | null>;
  activePanel: PanelId;
  quickSettingsOpen: boolean;
  onAddressChange: (value: string) => void;
  onNavigate: (input: string) => void;
  onSwitchTab: (tabId: string) => void;
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

type AddressSuggestionKind = "search" | "history" | "bookmark" | "tab" | "url" | "online";

type AddressSuggestion = {
  id: string;
  kind: AddressSuggestionKind;
  title: string;
  detail: string;
  value: string;
  action: "navigate" | "switch-tab";
  tabId?: string;
};

const MAX_VISIBLE_SUGGESTIONS = 8;
const ONLINE_SUGGESTION_DELAY_MS = 180;

export function Toolbar({
  activeTab,
  tabs,
  bookmarks,
  history,
  settings,
  addressValue,
  addressInputRef,
  activePanel,
  quickSettingsOpen,
  onAddressChange,
  onNavigate,
  onSwitchTab,
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
  const isSpacious = settings.toolbarDensity === "spacious";
  const visibleBookmarks = bookmarks.slice(0, 6);
  const [focused, setFocused] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [onlineSuggestions, setOnlineSuggestions] = useState<AddressSuggestion[]>([]);
  const onlineSuggestionCache = useRef(new Map<string, AddressSuggestion[]>());
  const trimmedAddress = addressValue.trim();
  const localSuggestions = useMemo(
    () => buildLocalSuggestions(trimmedAddress, settings, tabs, bookmarks, history, activeTab?.id),
    [activeTab?.id, bookmarks, history, settings, tabs, trimmedAddress],
  );
  const suggestions = useMemo(
    () =>
      [...localSuggestions, ...onlineSuggestions]
        .filter((suggestion, index, all) => {
          const firstIndex = all.findIndex((item) => item.id === suggestion.id);
          return firstIndex === index;
        })
        .slice(0, MAX_VISIBLE_SUGGESTIONS),
    [localSuggestions, onlineSuggestions],
  );
  const suggestionsOpen = focused && settings.searchSuggestions && suggestions.length > 0;

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (suggestionsOpen && suggestions[selectedSuggestionIndex]) {
      selectSuggestion(suggestions[selectedSuggestionIndex]);
      return;
    }

    onNavigate(addressValue || getAddressValue(activeTab));
  };

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [addressValue]);

  useEffect(() => {
    if (!settings.searchSuggestions || !canUseOnlineSuggestions(settings, trimmedAddress)) {
      setOnlineSuggestions([]);
      return;
    }

    const provider = resolveOnlineSuggestionProvider(settings);
    if (!provider) {
      setOnlineSuggestions([]);
      return;
    }

    const cacheKey = `${provider}:${trimmedAddress.toLowerCase()}`;
    const cached = onlineSuggestionCache.current.get(cacheKey);
    if (cached) {
      setOnlineSuggestions(cached);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchOnlineSuggestions(provider, trimmedAddress, controller.signal)
        .then((items) => {
          const suggestionsForQuery = items.slice(0, 3).map<AddressSuggestion>((item, index) => ({
            id: createSuggestionId("online", item, index),
            kind: "online",
            title: item,
            detail: `${provider === "google" ? "Google" : "DuckDuckGo"} suggestion`,
            value: item,
            action: "navigate",
          }));
          onlineSuggestionCache.current.set(cacheKey, suggestionsForQuery);
          setOnlineSuggestions(suggestionsForQuery);
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setOnlineSuggestions([]);
          }
        });
    }, ONLINE_SUGGESTION_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [settings, trimmedAddress]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    setFocused(false);
    if (suggestion.action === "switch-tab" && suggestion.tabId) {
      onSwitchTab(suggestion.tabId);
      return;
    }

    onAddressChange(suggestion.value);
    onNavigate(suggestion.value);
  };

  const completeSuggestion = (suggestion: AddressSuggestion) => {
    onAddressChange(suggestion.value);
    setFocused(false);
    window.setTimeout(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.setSelectionRange(suggestion.value.length, suggestion.value.length);
    }, 0);
  };

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedSuggestionIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedSuggestionIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setFocused(false);
      return;
    }

    if (event.key === "Tab" && suggestions[selectedSuggestionIndex]) {
      event.preventDefault();
      completeSuggestion(suggestions[selectedSuggestionIndex]);
    }
  };

  return (
    <div className="drag-region flex h-[68px] flex-col gap-1 border-b border-border/75 bg-card/88 px-3 py-1 backdrop-blur-xl">
      <div className="flex min-h-9 min-w-0 items-center gap-2">
        <div className="no-drag flex items-center gap-1">
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

        <form onSubmit={submitAddress} className="no-drag relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={addressInputRef}
            value={addressValue}
            onChange={(event) => onAddressChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setFocused(false), 120);
            }}
            onKeyDown={handleAddressKeyDown}
            placeholder="Search or enter address"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="address-suggestions"
            aria-activedescendant={
              suggestionsOpen && suggestions[selectedSuggestionIndex]
                ? `address-suggestion-${suggestions[selectedSuggestionIndex].id}`
                : undefined
            }
            className={cn(
              "rounded-xl border-border bg-background/72 pl-9 pr-10 text-[13px] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
              isCompact ? "h-8" : isSpacious ? "h-10" : "h-9",
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
          {suggestionsOpen && (
            <div
              id="address-suggestions"
              role="listbox"
              className="glass-panel absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-border/70 bg-card/96 p-1.5 text-foreground shadow-2xl shadow-black/35 backdrop-blur-xl"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`address-suggestion-${suggestion.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === selectedSuggestionIndex}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors",
                    index === selectedSuggestionIndex
                      ? "bg-primary/16 text-foreground"
                      : "hover:bg-accent/65",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/80 text-primary [&_svg]:size-4">
                    {getSuggestionIcon(suggestion.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {suggestion.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {suggestion.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="no-drag flex items-center gap-1">
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
        <div className="no-drag flex min-h-[20px] min-w-0 items-center gap-2 text-[11px] leading-none text-muted-foreground">
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
        <div className="no-drag flex min-h-[20px] items-center justify-between text-[11px] leading-none text-muted-foreground">
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

function buildLocalSuggestions(
  query: string,
  settings: BrowserSettings,
  tabs: BrowserTab[],
  bookmarks: Bookmark[],
  history: HistoryEntry[],
  activeTabId?: string,
): AddressSuggestion[] {
  if (!settings.searchSuggestions || !query) {
    return [];
  }

  const suggestions: AddressSuggestion[] = [];
  const seenTargets = new Set<string>();
  const directUrl = getDirectNavigationValue(query);
  const suggestionSettings = settings.searchSuggestionSettings;

  if (directUrl) {
    addSuggestion(suggestions, seenTargets, {
      id: createSuggestionId("url", directUrl, 0),
      kind: "url",
      title: `Go to ${getHostname(directUrl)}`,
      detail: directUrl,
      value: directUrl,
      action: "navigate",
    });
  }

  if (suggestionSettings.localSuggestions) {
    if (suggestionSettings.openTabSuggestions) {
      tabs
        .filter((tab) => tab.id !== activeTabId && !tab.isNewTab && matchesSuggestionQuery(query, tab.title, tab.url))
        .slice(0, 3)
        .forEach((tab, index) => {
          addSuggestion(suggestions, seenTargets, {
            id: createSuggestionId("tab", tab.id, index),
            kind: "tab",
            title: tab.title || getHostname(tab.url),
            detail: `Switch to tab - ${tab.url}`,
            value: tab.url,
            action: "switch-tab",
            tabId: tab.id,
          });
        });
    }

    if (suggestionSettings.bookmarkSuggestions) {
      bookmarks
        .filter((bookmark) => matchesSuggestionQuery(query, bookmark.title, bookmark.url))
        .slice(0, 4)
        .forEach((bookmark, index) => {
          addSuggestion(suggestions, seenTargets, {
            id: createSuggestionId("bookmark", bookmark.url, index),
            kind: "bookmark",
            title: bookmark.title || getHostname(bookmark.url),
            detail: `Bookmark - ${bookmark.url}`,
            value: bookmark.url,
            action: "navigate",
          });
        });
    }

    if (suggestionSettings.historySuggestions) {
      history
        .filter((entry) => matchesSuggestionQuery(query, entry.title, entry.url))
        .slice(0, 4)
        .forEach((entry, index) => {
          addSuggestion(suggestions, seenTargets, {
            id: createSuggestionId("history", entry.url, index),
            kind: "history",
            title: entry.title || getHostname(entry.url),
            detail: `History - ${entry.url}`,
            value: entry.url,
            action: "navigate",
          });
        });
    }
  }

  if (!directUrl && settings.addressBarSearch) {
    addSuggestion(suggestions, seenTargets, {
      id: createSuggestionId("search", query, 0),
      kind: "search",
      title: `Search ${getSearchEngineLabel(settings.searchEngine)} for "${query}"`,
      detail: "Search query",
      value: query,
      action: "navigate",
    });
  }

  return suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
}

function addSuggestion(
  suggestions: AddressSuggestion[],
  seenTargets: Set<string>,
  suggestion: AddressSuggestion,
): void {
  const targetKey =
    suggestion.action === "switch-tab"
      ? `tab:${suggestion.tabId}`
      : suggestion.value.toLowerCase();
  if (seenTargets.has(targetKey)) {
    return;
  }

  seenTargets.add(targetKey);
  suggestions.push(suggestion);
}

function matchesSuggestionQuery(query: string, title: string, url: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const haystack = `${title} ${url} ${getHostname(url)}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

function getDirectNavigationValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  const withoutSlashes = trimmed.replace(/^\/\//, "");
  if (/\s/.test(withoutSlashes)) {
    return null;
  }

  const localHostPattern = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#].*)?$/i;
  const hostWithPortPattern = /^[^/?#\s]+:\d{2,5}(?:[/?#].*)?$/;
  const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:[/?#].*)?$/;
  const domainPattern = /^[^/?#\s]+\.[^/?#\s]{2,}(?:[/?#].*)?$/;
  const looksLikeWebTarget =
    localHostPattern.test(withoutSlashes) ||
    hostWithPortPattern.test(withoutSlashes) ||
    ipv4Pattern.test(withoutSlashes) ||
    domainPattern.test(withoutSlashes);

  if (!looksLikeWebTarget) {
    return null;
  }

  const protocol =
    localHostPattern.test(withoutSlashes) ||
    hostWithPortPattern.test(withoutSlashes) ||
    ipv4Pattern.test(withoutSlashes)
      ? "http://"
      : "https://";

  try {
    return new URL(`${protocol}${withoutSlashes}`).toString();
  } catch {
    return null;
  }
}

function canUseOnlineSuggestions(settings: BrowserSettings, query: string): boolean {
  return (
    settings.searchSuggestionSettings.onlineSuggestions &&
    !settings.doNotTrack &&
    settings.addressBarSearch &&
    query.length >= 2 &&
    !getDirectNavigationValue(query) &&
    Boolean(resolveOnlineSuggestionProvider(settings))
  );
}

function resolveOnlineSuggestionProvider(settings: BrowserSettings): "google" | "duckduckgo" | null {
  const provider = settings.searchSuggestionSettings.suggestionProvider;
  if (provider === "none") {
    return null;
  }

  if (provider === "google" || provider === "duckduckgo") {
    return provider;
  }

  if (settings.searchEngine === "google" || settings.searchEngine === "duckduckgo") {
    return settings.searchEngine;
  }

  return null;
}

async function fetchOnlineSuggestions(
  provider: "google" | "duckduckgo",
  query: string,
  signal: AbortSignal,
): Promise<string[]> {
  const url =
    provider === "google"
      ? `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
      : `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
  const response = await fetch(url, {
    signal,
    referrerPolicy: "no-referrer",
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as unknown;
  if (provider === "google") {
    if (!Array.isArray(data) || !Array.isArray(data[1])) {
      return [];
    }

    return data[1].filter((item): item is string => typeof item === "string");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const phrase = (item as { phrase?: unknown }).phrase;
      return typeof phrase === "string" ? phrase : "";
    })
    .filter(Boolean);
}

function getSearchEngineLabel(engine: BrowserSettings["searchEngine"]): string {
  const labels: Record<BrowserSettings["searchEngine"], string> = {
    duckduckgo: "DuckDuckGo",
    google: "Google",
    bing: "Bing",
    brave: "Brave Search",
    custom: "Custom Search",
  };
  return labels[engine];
}

function getSuggestionIcon(kind: AddressSuggestionKind): ReactNode {
  if (kind === "history") {
    return <Clock aria-hidden="true" />;
  }

  if (kind === "bookmark") {
    return <BookmarkIcon aria-hidden="true" />;
  }

  if (kind === "tab") {
    return <PanelTopOpen aria-hidden="true" />;
  }

  if (kind === "url") {
    return <Globe2 aria-hidden="true" />;
  }

  return <Search aria-hidden="true" />;
}

function createSuggestionId(kind: AddressSuggestionKind, value: string, index: number): string {
  return `${kind}-${index}-${hashString(value)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
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
