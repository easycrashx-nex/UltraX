import type { BrowserTab } from "@shared/types";
import {
  Copy,
  Globe2,
  LoaderCircle,
  Minus,
  PanelTopOpen,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabStripProps = {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onCreateTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onPinTab: (tabId: string, pinned: boolean) => void;
  onReorderTab: (tabId: string, targetTabId: string) => void;
  onReloadTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onMoveTabToNewWindow: (tabId: string) => void;
  onToggleTabMuted: (tabId: string) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onCloseWindow: () => void;
};

type TabMenuState = {
  tabId: string;
  x: number;
  y: number;
};

export function TabStrip({
  tabs,
  activeTabId,
  onCreateTab,
  onSwitchTab,
  onCloseTab,
  onDuplicateTab,
  onPinTab,
  onReorderTab,
  onReloadTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onMoveTabToNewWindow,
  onToggleTabMuted,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TabStripProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTargetTabId, setDropTargetTabId] = useState<string | null>(null);
  const [menu, setMenu] = useState<TabMenuState | null>(null);
  const menuTab = useMemo(
    () => tabs.find((tab) => tab.id === menu?.tabId),
    [menu?.tabId, tabs],
  );

  useEffect(() => {
    if (!menu) {
      return;
    }

    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  const openContextMenu = (tab: BrowserTab, x: number, y: number) => {
    setMenu({
      tabId: tab.id,
      x: Math.min(x, window.innerWidth - 236),
      y: Math.min(y, window.innerHeight - 320),
    });
  };

  const runMenuAction = (action: () => void) => {
    action();
    setMenu(null);
  };

  return (
    <div className="drag-region flex h-10 select-none items-end gap-2 border-b border-border/75 bg-background/90 px-3 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-end gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDropTarget = tab.id === dropTargetTabId && tab.id !== draggedTabId;

          return (
            <button
              key={tab.id}
              type="button"
              title={`${tab.isMuted ? "Muted - " : tab.isAudible ? "Playing audio - " : ""}${tab.title}`}
              data-testid="browser-tab"
              data-tab-id={tab.id}
              draggable
              onDragStart={(event) => {
                setDraggedTabId(tab.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragOver={(event) => {
                if (!draggedTabId || draggedTabId === tab.id) {
                  return;
                }
                event.preventDefault();
                setDropTargetTabId(tab.id);
              }}
              onDragLeave={() => {
                if (dropTargetTabId === tab.id) {
                  setDropTargetTabId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceTabId = event.dataTransfer.getData("text/plain") || draggedTabId;
                if (sourceTabId && sourceTabId !== tab.id) {
                  onReorderTab(sourceTabId, tab.id);
                }
                setDraggedTabId(null);
                setDropTargetTabId(null);
              }}
              onDragEnd={() => {
                setDraggedTabId(null);
                setDropTargetTabId(null);
              }}
              onClick={() => onSwitchTab(tab.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                openContextMenu(tab, event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openContextMenu(tab, rect.left + 20, rect.bottom + 4);
                }
              }}
              className={cn(
                "no-drag group relative flex h-8 items-center gap-2 rounded-t-lg border text-left text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30",
                tab.isPinned
                  ? "w-11 flex-none justify-center px-0"
                  : "min-w-24 max-w-56 flex-1 px-3",
                isActive
                  ? "border-border/90 border-b-card bg-card/95 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                isDropTarget && "before:absolute before:-left-1 before:top-1 before:h-6 before:w-0.5 before:rounded-full before:bg-primary",
                draggedTabId === tab.id && "opacity-55",
              )}
            >
              {tab.isLoading ? (
                <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden="true" />
              ) : tab.favicon ? (
                <img src={tab.favicon} alt="" className="size-4 rounded-sm" />
              ) : (
                <Globe2 className="size-3.5" aria-hidden="true" />
              )}
              {(tab.isMuted || tab.isAudible) && (
                <span
                  title={tab.isMuted ? "Muted tab" : "Audio playing"}
                  data-testid={tab.isMuted ? "tab-muted-indicator" : "tab-audible-indicator"}
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-md text-muted-foreground",
                    tab.isMuted && "text-primary",
                    tab.isPinned && "absolute bottom-0.5 right-0.5 size-3 bg-background/90",
                  )}
                >
                  {tab.isMuted ? (
                    <VolumeX className="size-3" aria-hidden="true" />
                  ) : (
                    <Volume2 className="size-3" aria-hidden="true" />
                  )}
                </span>
              )}
              {!tab.isPinned && <span className="min-w-0 flex-1 truncate">{tab.title}</span>}
              {!tab.isPinned && (
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
              )}
            </button>
          );
        })}

        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="New tab"
          aria-label="New tab"
          data-testid="new-tab-button"
          onClick={onCreateTab}
          className="no-drag mb-0.5"
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

      {menu && menuTab && (
        <div
          className="no-drag fixed z-[70] w-56 overflow-hidden rounded-2xl border border-border/70 bg-popover/96 p-1.5 text-foreground shadow-2xl shadow-black/45 backdrop-blur-2xl"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <TabMenuItem
            icon={<Plus aria-hidden="true" />}
            label="New Tab"
            onClick={() => runMenuAction(onCreateTab)}
          />
          <TabMenuItem
            icon={<RefreshCw aria-hidden="true" />}
            label="Reload"
            onClick={() => runMenuAction(() => onReloadTab(menuTab.id))}
          />
          <TabMenuItem
            icon={<Copy aria-hidden="true" />}
            label="Duplicate"
            onClick={() => runMenuAction(() => onDuplicateTab(menuTab.id))}
          />
          <TabMenuItem
            icon={menuTab.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            label={menuTab.isPinned ? "Unpin Tab" : "Pin Tab"}
            onClick={() => runMenuAction(() => onPinTab(menuTab.id, !menuTab.isPinned))}
          />
          <TabMenuItem
            icon={menuTab.isMuted ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            label={menuTab.isMuted ? "Unmute Tab" : "Mute Tab"}
            onClick={() => runMenuAction(() => onToggleTabMuted(menuTab.id))}
          />
          <div className="my-1 h-px bg-border/70" />
          <TabMenuItem
            icon={<X aria-hidden="true" />}
            label="Close Tab"
            onClick={() => runMenuAction(() => onCloseTab(menuTab.id))}
          />
          <TabMenuItem
            icon={<X aria-hidden="true" />}
            label="Close Other Tabs"
            onClick={() => runMenuAction(() => onCloseOtherTabs(menuTab.id))}
          />
          <TabMenuItem
            icon={<X aria-hidden="true" />}
            label="Close Tabs to the Right"
            onClick={() => runMenuAction(() => onCloseTabsToRight(menuTab.id))}
          />
          <TabMenuItem
            icon={<PanelTopOpen aria-hidden="true" />}
            label="Move Tab to New Window"
            onClick={() => runMenuAction(() => onMoveTabToNewWindow(menuTab.id))}
          />
        </div>
      )}
    </div>
  );
}

function TabMenuItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick?.();
        }
      }}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/24 [&_svg]:size-3.5",
        disabled
          ? "cursor-not-allowed text-muted-foreground/45"
          : "text-foreground hover:bg-accent",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
