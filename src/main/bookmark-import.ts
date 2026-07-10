import { randomUUID } from "node:crypto";
import { Parser } from "htmlparser2";
import type {
  Bookmark,
  BookmarkDuplicatePolicy,
  BookmarkImportSummary,
} from "../shared/types";

export type ParsedBookmarks = {
  bookmarks: Array<Pick<Bookmark, "title" | "url" | "folderPath">>;
  failed: number;
};

export type BookmarkMergeResult = {
  bookmarks: Bookmark[];
  summary: BookmarkImportSummary;
};

const MAX_IMPORT_CANDIDATES = 5_000;
const MAX_BOOKMARKS = 500;

export function parseBookmarkHtml(html: string): ParsedBookmarks {
  const bookmarks: ParsedBookmarks["bookmarks"] = [];
  const folderPath: string[] = [];
  const dlOwnsFolder: boolean[] = [];
  let pendingFolder: string | null = null;
  let activeTag: "a" | "h3" | null = null;
  let activeText = "";
  let activeHref = "";
  let failed = 0;

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const tag = name.toLowerCase();
        if (tag === "dl") {
          const ownsFolder = Boolean(pendingFolder);
          if (pendingFolder) folderPath.push(pendingFolder);
          dlOwnsFolder.push(ownsFolder);
          pendingFolder = null;
          return;
        }
        if (tag === "h3") {
          activeTag = "h3";
          activeText = "";
          return;
        }
        if (tag === "a") {
          activeTag = "a";
          activeText = "";
          activeHref = attributes.href ?? "";
        }
      },
      ontext(text) {
        if (activeTag) activeText += text;
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "h3" && activeTag === "h3") {
          pendingFolder = cleanText(activeText) || null;
          activeTag = null;
          activeText = "";
          return;
        }
        if (tag === "a" && activeTag === "a") {
          if (bookmarks.length >= MAX_IMPORT_CANDIDATES) {
            failed += 1;
          } else {
            const url = normalizeBookmarkUrl(activeHref);
            if (!url) {
              failed += 1;
            } else {
              bookmarks.push({
                title: cleanText(activeText) || new URL(url).hostname,
                url,
                folderPath: folderPath.length ? [...folderPath] : undefined,
              });
            }
          }
          activeTag = null;
          activeText = "";
          activeHref = "";
          return;
        }
        if (tag === "dl" && dlOwnsFolder.pop()) folderPath.pop();
      },
    },
    { decodeEntities: true, lowerCaseAttributeNames: true },
  );

  parser.write(html);
  parser.end();
  return { bookmarks, failed };
}

export function mergeBookmarkCandidates(
  existing: Bookmark[],
  parsed: ParsedBookmarks,
  duplicatePolicy: BookmarkDuplicatePolicy,
  timestamp = Date.now(),
): BookmarkMergeResult {
  const merged = [...existing];
  const knownUrls = new Set(existing.map((bookmark) => normalizeBookmarkUrl(bookmark.url)).filter(Boolean));
  const summary: BookmarkImportSummary = {
    imported: 0,
    skippedDuplicates: 0,
    failed: parsed.failed,
  };

  for (const candidate of parsed.bookmarks) {
    const normalizedUrl = normalizeBookmarkUrl(candidate.url);
    if (!normalizedUrl) {
      summary.failed += 1;
      continue;
    }
    if (duplicatePolicy === "skip" && knownUrls.has(normalizedUrl)) {
      summary.skippedDuplicates += 1;
      continue;
    }
    if (merged.length >= MAX_BOOKMARKS) {
      summary.failed += 1;
      continue;
    }

    merged.push({
      id: randomUUID(),
      title: candidate.title.slice(0, 512),
      url: normalizedUrl,
      createdAt: timestamp + summary.imported,
      folderPath: candidate.folderPath?.map((folder) => folder.slice(0, 128)).slice(0, 12),
    });
    knownUrls.add(normalizedUrl);
    summary.imported += 1;
  }

  return { bookmarks: merged, summary };
}

export function exportBookmarksHtml(bookmarks: Bookmark[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>UltraX Bookmarks</TITLE>",
    "<H1>UltraX Bookmarks</H1>",
    "<DL><p>",
  ];
  for (const bookmark of bookmarks) {
    lines.push(`  <DT><A HREF="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.title)}</A>`);
  }
  lines.push("</DL><p>");
  return lines.join("\n");
}

function normalizeBookmarkUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 512);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
