import type { BrowserTab } from "@shared/types";
import { Globe2, LoaderCircle, Minus, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabStripProps = {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onCreateTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
};

export function TabStrip({
  tabs,
  activeTabId,
  onCreateTab,
  onSwitchTab,
  onCloseTab,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TabStripProps) {
  return (
    <div className="drag-region flex h-10 items-end gap-2 border-b border-border/75 bg-background/90 px-3 backdrop-blur-xl">
      <div className="no-drag flex min-w-0 flex-1 items-end gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              type="button"
              title={tab.title}
              onClick={() => onSwitchTab(tab.id)}
              className={cn(
                "group flex h-8 min-w-24 max-w-56 flex-1 items-center gap-2 rounded-t-lg border px-3 text-left text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30",
                isActive
                  ? "border-border/90 border-b-card bg-card/95 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              {tab.isLoading ? (
                <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden="true" />
              ) : tab.favicon ? (
                <img src={tab.favicon} alt="" className="size-4 rounded-sm" />
              ) : (
                <Globe2 className="size-3.5" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">{tab.title}</span>
              <span
                role="button"
                tabIndex={0}
                title="Close tab"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }
                }}
                className="grid size-5 place-items-center rounded-md text-muted-foreground opacity-65 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 group-hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </span>
            </button>
          );
        })}

        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="New tab"
          aria-label="New tab"
          onClick={onCreateTab}
          className="mb-0.5"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <div className="no-drag mb-0.5 flex items-center gap-1">
        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="Minimize"
          aria-label="Minimize window"
          onClick={onMinimize}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="Maximize"
          aria-label="Maximize window"
          onClick={onToggleMaximize}
        >
          <Square aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="Close"
          aria-label="Close window"
          onClick={onCloseWindow}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
