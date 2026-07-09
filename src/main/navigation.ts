import type { BrowserSettings, SearchEngine } from "../shared/types";

export const INTERNAL_NEW_TAB_URL = "ultrax://newtab";
export const WEB_PARTITION = "persist:ultrax-web";

type NavigationTarget =
  | { kind: "internal"; url: typeof INTERNAL_NEW_TAB_URL }
  | { kind: "web"; url: string };

const SEARCH_URLS: Record<SearchEngine, string> = {
  duckduckgo: "https://duckduckgo.com/?q=",
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  brave: "https://search.brave.com/search?q=",
  custom: "",
};

const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const LOCAL_HOST_PATTERN =
  /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#].*)?$/i;
const HOST_WITH_PORT_PATTERN = /^[^/?#\s]+:\d{2,5}(?:[/?#].*)?$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:[/?#].*)?$/;
const DOMAIN_PATTERN = /^[^/?#\s]+\.[^/?#\s]{2,}(?:[/?#].*)?$/;

export function normalizeNavigationInput(
  input: string,
  settings: BrowserSettings,
): NavigationTarget {
  const trimmed = input.trim();

  if (!trimmed || trimmed.toLowerCase() === INTERNAL_NEW_TAB_URL) {
    return { kind: "internal", url: INTERNAL_NEW_TAB_URL };
  }

  if (SCHEME_PATTERN.test(trimmed)) {
    const parsed = new URL(trimmed);
    if (!isSafeWebUrl(parsed.toString())) {
      throw new Error(`Blocked unsupported protocol: ${parsed.protocol}`);
    }

    return { kind: "web", url: parsed.toString() };
  }

  const withoutSlashes = trimmed.replace(/^\/\//, "");
  const hasWhitespace = /\s/.test(withoutSlashes);
  const looksLikeWebTarget =
    !hasWhitespace &&
    (LOCAL_HOST_PATTERN.test(withoutSlashes) ||
      IPV4_PATTERN.test(withoutSlashes) ||
      HOST_WITH_PORT_PATTERN.test(withoutSlashes) ||
      DOMAIN_PATTERN.test(withoutSlashes));

  if (looksLikeWebTarget) {
    const protocol =
      LOCAL_HOST_PATTERN.test(withoutSlashes) ||
      IPV4_PATTERN.test(withoutSlashes) ||
      HOST_WITH_PORT_PATTERN.test(withoutSlashes)
        ? "http://"
        : "https://";
    const parsed = new URL(`${protocol}${withoutSlashes}`);

    return { kind: "web", url: parsed.toString() };
  }

  if (!settings.addressBarSearch) {
    throw new Error("Address bar search is disabled.");
  }

  if (settings.searchEngine === "custom" && settings.customSearchUrl.trim()) {
    const encodedQuery = encodeURIComponent(trimmed);
    const rawTemplate = settings.customSearchUrl.trim();
    const rawUrl = rawTemplate.includes("{query}")
      ? rawTemplate.replace("{query}", encodedQuery)
      : `${rawTemplate}${rawTemplate.includes("?") ? "&" : "?"}q=${encodedQuery}`;

    try {
      const parsed = new URL(rawUrl);

      if (isSafeWebUrl(parsed.toString())) {
        return { kind: "web", url: parsed.toString() };
      }
    } catch {
      // Fall through to the safe default engine when a custom template is invalid.
    }
  }

  const engineBaseUrl = SEARCH_URLS[settings.searchEngine] || SEARCH_URLS.duckduckgo;
  return { kind: "web", url: `${engineBaseUrl}${encodeURIComponent(trimmed)}` };
}

export function isSafeWebUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getHostnameLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
