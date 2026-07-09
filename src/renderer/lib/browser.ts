import type { Bookmark, BrowserTab } from "@shared/types";

export function getAddressValue(tab?: BrowserTab): string {
  if (!tab || tab.isNewTab) {
    return "";
  }

  return tab.url;
}

export function isBookmarked(tab: BrowserTab | undefined, bookmarks: Bookmark[]) {
  return Boolean(tab && !tab.isNewTab && bookmarks.some((bookmark) => bookmark.url === tab.url));
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
