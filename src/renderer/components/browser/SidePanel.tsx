import type {
  Bookmark,
  DownloadItem,
  ExtensionApiRequest,
  ExtensionApiResponse,
  ExtensionPanelDescriptor,
  ExtensionRuntimeLogLevel,
  HistoryEntry,
} from "@shared/types";
import {
  Bookmark as BookmarkIcon,
  Clock,
  Download,
  ExternalLink,
  FolderOpen,
  RotateCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PanelId } from "./types";

type SidePanelProps = {
  panel: PanelId;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: DownloadItem[];
  extensionPanel: ExtensionPanelDescriptor | null;
  developerMode: boolean;
  onClose: () => void;
  onCloseExtensionPanel: () => void;
  onReloadExtensionPanel: () => void;
  onExtensionApiRequest: (request: ExtensionApiRequest) => Promise<ExtensionApiResponse>;
  onExtensionLog: (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => void;
  onOpenBookmark: (bookmarkId: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onOpenHistoryEntry: (entryId: string) => void;
  onClearHistory: () => void;
  onOpenDownload: (downloadId: string) => void;
  onRevealDownload: (downloadId: string) => void;
};

export function SidePanel({
  panel,
  bookmarks,
  history,
  downloads,
  extensionPanel,
  developerMode,
  onClose,
  onCloseExtensionPanel,
  onReloadExtensionPanel,
  onExtensionApiRequest,
  onExtensionLog,
  onOpenBookmark,
  onRemoveBookmark,
  onOpenHistoryEntry,
  onClearHistory,
  onOpenDownload,
  onRevealDownload,
}: SidePanelProps) {
  if (!panel && !extensionPanel) {
    return null;
  }

  const isExtensionPanel = Boolean(extensionPanel);

  return (
    <aside className="browser-content-start fixed bottom-0 right-0 z-30 w-[392px] border-l border-border bg-popover text-popover-foreground shadow-2xl shadow-black/30">
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {panel === "bookmarks" && <BookmarkIcon aria-hidden="true" className="size-4" />}
            {panel === "history" && <Clock aria-hidden="true" className="size-4" />}
            {panel === "downloads" && <Download aria-hidden="true" className="size-4" />}
            {extensionPanel && <ExternalLink aria-hidden="true" className="size-4" />}
            <h2 className="text-sm font-semibold capitalize">
              {extensionPanel ? extensionPanel.title : panel}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {extensionPanel && developerMode && (
              <Button
                type="button"
                variant="chrome"
                size="iconSm"
                title="Reload extension panel"
                aria-label="Reload extension panel"
                onClick={onReloadExtensionPanel}
              >
                <RotateCw aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="chrome"
              size="iconSm"
              title="Close panel"
              aria-label="Close panel"
              onClick={isExtensionPanel ? onCloseExtensionPanel : onClose}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div className={cn("min-h-0 flex-1", extensionPanel ? "overflow-hidden" : "overflow-y-auto p-4")}>
          {panel === "bookmarks" && (
            <BookmarksPanel
              bookmarks={bookmarks}
              onOpenBookmark={onOpenBookmark}
              onRemoveBookmark={onRemoveBookmark}
            />
          )}
          {panel === "history" && (
            <HistoryPanel
              history={history}
              onOpenHistoryEntry={onOpenHistoryEntry}
              onClearHistory={onClearHistory}
            />
          )}
          {panel === "downloads" && (
            <DownloadsPanel
              downloads={downloads}
              onOpenDownload={onOpenDownload}
              onRevealDownload={onRevealDownload}
            />
          )}
          {extensionPanel && (
            <ExtensionPanelFrame
              descriptor={extensionPanel}
              onApiRequest={onExtensionApiRequest}
              onLog={onExtensionLog}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

function ExtensionPanelFrame({
  descriptor,
  onApiRequest,
  onLog,
}: {
  descriptor: ExtensionPanelDescriptor;
  onApiRequest: (request: ExtensionApiRequest) => Promise<ExtensionApiResponse>;
  onLog: (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => void;
}) {
  if (descriptor.extensionId === "ultrax-page-info") {
    return <PageInfoExtensionPanel descriptor={descriptor} onApiRequest={onApiRequest} />;
  }

  if (descriptor.extensionId === "ultrax-notes-sidebar") {
    return <NotesExtensionPanel descriptor={descriptor} onApiRequest={onApiRequest} />;
  }

  return <GenericExtensionIframe descriptor={descriptor} onApiRequest={onApiRequest} onLog={onLog} />;
}

function GenericExtensionIframe({
  descriptor,
  onApiRequest,
  onLog,
}: {
  descriptor: ExtensionPanelDescriptor;
  onApiRequest: (request: ExtensionApiRequest) => Promise<ExtensionApiResponse>;
  onLog: (
    extensionId: string,
    level: ExtensionRuntimeLogLevel,
    message: string,
  ) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [frameUrl, setFrameUrl] = useState("about:blank");

  useEffect(() => {
    setFrameKey((key) => key + 1);
  }, [descriptor.html, descriptor.extensionId]);

  useEffect(() => {
    setFrameUrl(`data:text/html;charset=utf-8,${encodeURIComponent(descriptor.html)}`);
  }, [descriptor.html]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data as Partial<ExtensionApiRequest> & {
        type?: unknown;
        extensionId?: unknown;
        level?: unknown;
        message?: unknown;
      };

      if (!message || message.extensionId !== descriptor.extensionId) {
        return;
      }

      if (message.type === "ultrax-extension-log") {
        const level =
          message.level === "error" || message.level === "warn" ? message.level : "info";
        onLog(
          descriptor.extensionId,
          level,
          typeof message.message === "string" ? message.message : "Extension log event.",
        );
        return;
      }

      if (message.type !== "ultrax-api-request") {
        return;
      }

      const request: ExtensionApiRequest = {
        requestId: typeof message.requestId === "string" ? message.requestId : "",
        method: typeof message.method === "string" ? message.method : "",
        args: Array.isArray(message.args) ? message.args : [],
      };

      void onApiRequest(request).then((response) => {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "ultrax-api-response",
            ...response,
          },
          "*",
        );
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [descriptor.extensionId, onApiRequest, onLog]);

  return (
    <iframe
      key={frameKey}
      ref={iframeRef}
      title={`${descriptor.title} panel`}
      className="h-full w-full border-0 bg-background"
      src={frameUrl}
    />
  );
}

function PageInfoExtensionPanel({
  descriptor,
  onApiRequest,
}: {
  descriptor: ExtensionPanelDescriptor;
  onApiRequest: (request: ExtensionApiRequest) => Promise<ExtensionApiResponse>;
}) {
  const [title, setTitle] = useState("Loading...");
  const [url, setUrl] = useState("Loading...");
  const [tabCount, setTabCount] = useState("0");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [active, tabs] = await Promise.all([
        onApiRequest({
          requestId: `${descriptor.extensionId}:active:${Date.now()}`,
          method: "tabs.getActive",
          args: [],
        }),
        onApiRequest({
          requestId: `${descriptor.extensionId}:tabs:${Date.now()}`,
          method: "tabs.query",
          args: [],
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (!active.ok || !tabs.ok) {
        setStatus(active.error ?? tabs.error ?? "Could not read tab info.");
        return;
      }

      const activeTab = active.result as { title?: string; url?: string } | null;
      const tabList = Array.isArray(tabs.result) ? tabs.result : [];
      setTitle(activeTab?.title ?? "No active tab");
      setUrl(activeTab?.url ?? "No URL");
      setTabCount(String(tabList.length));
      setStatus("Updated from UltraX Extension API v1.");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [descriptor.extensionId, onApiRequest]);

  return (
    <div className="h-full overflow-y-auto bg-[#080c14] p-5 text-slate-100">
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold">Page Info</h3>
        <ExtensionPanelMetric label="Active Tab" value={title} />
        <ExtensionPanelMetric label="URL" value={url} />
        <ExtensionPanelMetric label="Open Tabs" value={tabCount} />
        <p className="text-xs leading-5 text-slate-400">{status}</p>
      </div>
    </div>
  );
}

function NotesExtensionPanel({
  descriptor,
  onApiRequest,
}: {
  descriptor: ExtensionPanelDescriptor;
  onApiRequest: (request: ExtensionApiRequest) => Promise<ExtensionApiResponse>;
}) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    let cancelled = false;
    void onApiRequest({
      requestId: `${descriptor.extensionId}:notes:${Date.now()}`,
      method: "storage.get",
      args: ["notes"],
    }).then((response) => {
      if (cancelled) {
        return;
      }
      if (response.ok) {
        setNotes(typeof response.result === "string" ? response.result : "");
        setStatus("Ready.");
      } else {
        setStatus(response.error ?? "Could not load notes.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [descriptor.extensionId, onApiRequest]);

  const save = () => {
    void onApiRequest({
      requestId: `${descriptor.extensionId}:save:${Date.now()}`,
      method: "storage.set",
      args: ["notes", notes],
    }).then((response) => setStatus(response.ok ? "Saved locally." : response.error ?? "Save failed."));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#080c14] p-5 text-slate-100">
      <div className="grid gap-4">
        <div>
          <h3 className="text-lg font-semibold">UltraX Notes</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">Private notes stored in this extension only.</p>
        </div>
        <textarea
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setStatus("Unsaved changes");
          }}
          className="min-h-64 resize-y rounded-2xl border border-slate-700 bg-slate-950/80 p-3 text-sm text-slate-100 outline-none focus:border-blue-400"
          aria-label="Notes"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={save} className="rounded-xl">
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNotes("");
              void onApiRequest({
                requestId: `${descriptor.extensionId}:clear:${Date.now()}`,
                method: "storage.remove",
                args: ["notes"],
              }).then((response) => setStatus(response.ok ? "Cleared." : response.error ?? "Clear failed."));
            }}
            className="rounded-xl"
          >
            Clear
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-400">{status}</p>
      </div>
    </div>
  );
}

function ExtensionPanelMetric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
      <span className="text-[11px] uppercase text-slate-400">{label}</span>
      <p className="mt-2 break-words text-sm leading-6 text-slate-100">{value}</p>
    </section>
  );
}

function BookmarksPanel({
  bookmarks,
  onOpenBookmark,
  onRemoveBookmark,
}: {
  bookmarks: Bookmark[];
  onOpenBookmark: (bookmarkId: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}) {
  if (bookmarks.length === 0) {
    return <EmptyState title="No bookmarks yet" detail="Use the star button to save a page." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {bookmarks.map((bookmark) => (
        <ListRow
          key={bookmark.id}
          title={bookmark.title}
          detail={bookmark.url}
          onOpen={() => onOpenBookmark(bookmark.id)}
          trailing={
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              title="Remove bookmark"
              aria-label="Remove bookmark"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveBookmark(bookmark.id);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          }
        />
      ))}
    </div>
  );
}

function HistoryPanel({
  history,
  onOpenHistoryEntry,
  onClearHistory,
}: {
  history: HistoryEntry[];
  onOpenHistoryEntry: (entryId: string) => void;
  onClearHistory: () => void;
}) {
  if (history.length === 0) {
    return <EmptyState title="No history yet" detail="Visited pages will appear here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" size="sm" onClick={onClearHistory}>
        <Trash2 aria-hidden="true" />
        Clear history
      </Button>
      <div className="flex flex-col gap-2">
        {history.map((entry) => (
          <ListRow
            key={entry.id}
            title={entry.title}
            detail={`${formatRelativeTime(entry.visitedAt)} - ${entry.url}`}
            onOpen={() => onOpenHistoryEntry(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DownloadsPanel({
  downloads,
  onOpenDownload,
  onRevealDownload,
}: {
  downloads: DownloadItem[];
  onOpenDownload: (downloadId: string) => void;
  onRevealDownload: (downloadId: string) => void;
}) {
  if (downloads.length === 0) {
    return <EmptyState title="No downloads" detail="Download activity will be tracked here." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {downloads.map((download) => {
        const progress =
          download.totalBytes > 0
            ? Math.min(100, (download.receivedBytes / download.totalBytes) * 100)
            : 0;

        return (
          <Card key={download.id} className="bg-card/80">
            <CardHeader>
              <CardTitle className="truncate">{download.filename}</CardTitle>
              <CardDescription>
                {download.state} - {formatBytes(download.receivedBytes)}
                {download.totalBytes > 0 ? ` of ${formatBytes(download.totalBytes)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${download.state === "completed" ? 100 : progress}%` }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!download.savePath}
                  onClick={() => onOpenDownload(download.id)}
                >
                  <ExternalLink aria-hidden="true" />
                  Open
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!download.savePath}
                  onClick={() => onRevealDownload(download.id)}
                >
                  <FolderOpen aria-hidden="true" />
                  Reveal
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ListRow({
  title,
  detail,
  trailing,
  onOpen,
}: {
  title: string;
  detail: string;
  trailing?: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-card/70 p-3 text-left transition-colors hover:bg-accent/70"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
        <Search aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      {trailing}
    </button>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-56 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
