import type { DownloadItem } from "@shared/types";
import { Download, ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

type DownloadShelfProps = {
  downloads: DownloadItem[];
  panelOpen: boolean;
  onOpenDownload: (downloadId: string) => void;
  onRevealDownload: (downloadId: string) => void;
};

export function DownloadShelf({
  downloads,
  panelOpen,
  onOpenDownload,
  onRevealDownload,
}: DownloadShelfProps) {
  const latest = downloads[0];

  if (!latest) {
    return null;
  }

  const progress =
    latest.totalBytes > 0
      ? Math.min(100, (latest.receivedBytes / latest.totalBytes) * 100)
      : latest.state === "completed"
        ? 100
        : 0;

  return (
    <div
      className={cn(
        "fixed bottom-3 z-40 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl shadow-black/30",
        panelOpen ? "left-3 right-[408px]" : "left-3 right-3",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-secondary text-primary">
          <Download aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{latest.filename}</div>
          <div className="text-xs text-muted-foreground">
            {latest.state} - {formatBytes(latest.receivedBytes)}
            {latest.totalBytes > 0 ? ` of ${formatBytes(latest.totalBytes)}` : ""}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title="Open download"
            aria-label="Open download"
            disabled={!latest.savePath}
            onClick={() => onOpenDownload(latest.id)}
          >
            <ExternalLink aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="chrome"
            size="icon"
            title="Reveal in folder"
            aria-label="Reveal in folder"
            disabled={!latest.savePath}
            onClick={() => onRevealDownload(latest.id)}
          >
            <FolderOpen aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
