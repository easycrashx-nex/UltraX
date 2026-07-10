import type { BrowserTab } from "@shared/types";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe2,
  ListFilter,
  LoaderCircle,
  Minus,
  PanelTopOpen,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabStripProps = {
  tabs: BrowserTab[];
  activeTabId: string | null;
  tabHoverPreviewEnabled: boolean;
  reducedMotion: boolean;
  onCreateTab: () => void;
  onReopenClosedTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onPinTab: (tabId: string, pinned: boolean) => void;
  onReorderTab: (tabId: string, targetTabId: string, placement?: ReorderPlacement) => void;
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

type TabPreviewState = {
  tabId: string;
  x: number;
  y: number;
};

type TabOverflowState = {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

type ReorderPlacement = "before" | "after";

type TabDragState = {
  tabId: string;
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  isPinned: boolean;
  isDragging: boolean;
  dropIndex: number;
};

const DRAG_START_THRESHOLD = 5;
const DROP_CANCEL_Y_MARGIN = 42;
const DEFAULT_BROWSER_CHROME_BOTTOM = 108;
const TAB_PREVIEW_CHROME_GAP = 8;
const TAB_SCROLL_STEP = 260;
const TAB_EDGE_SCROLL_ZONE = 44;
const TAB_EDGE_SCROLL_SPEED = 10;

function getTabAccessibleLabel(tab: BrowserTab) {
  const state = tab.isMuted ? "Muted" : tab.isAudible ? "Playing audio" : null;
  const title = tab.title || "Untitled tab";
  return [state, tab.isPinned ? "Pinned" : null, title].filter(Boolean).join(" - ");
}

function getBrowserChromeBottom() {
  const contentStartElement = document.querySelector<HTMLElement>(".browser-content-start");
  return contentStartElement?.getBoundingClientRect().top ?? DEFAULT_BROWSER_CHROME_BOTTOM;
}

export function TabStrip({
  tabs,
  activeTabId,
  tabHoverPreviewEnabled,
  reducedMotion,
  onCreateTab,
  onReopenClosedTab,
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
  const stripRef = useRef<HTMLDivElement | null>(null);
  const normalScrollRef = useRef<HTMLDivElement | null>(null);
  const edgeScrollFrameRef = useRef<number | null>(null);
  const edgeScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const tabsRef = useRef(tabs);
  const dragStateRef = useRef<TabDragState | null>(null);
  const suppressClickRef = useRef(false);
  const hoverPreviewTimerRef = useRef<number | null>(null);
  const [dragState, setDragState] = useState<TabDragState | null>(null);
  const [menu, setMenu] = useState<TabMenuState | null>(null);
  const [preview, setPreview] = useState<TabPreviewState | null>(null);
  const [allTabsOpen, setAllTabsOpen] = useState(false);
  const [allTabsQuery, setAllTabsQuery] = useState("");
  const [overflow, setOverflow] = useState<TabOverflowState>({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  tabsRef.current = tabs;
  const menuTab = useMemo(
    () => tabs.find((tab) => tab.id === menu?.tabId),
    [menu?.tabId, tabs],
  );
  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.isPinned), [tabs]);
  const normalTabs = useMemo(() => tabs.filter((tab) => !tab.isPinned), [tabs]);
  const ghostTab = useMemo(
    () => tabs.find((tab) => tab.id === dragState?.tabId) ?? null,
    [dragState?.tabId, tabs],
  );
  const previewTab = useMemo(
    () => tabs.find((tab) => tab.id === preview?.tabId) ?? null,
    [preview?.tabId, tabs],
  );
  const filteredTabs = useMemo(() => {
    const query = allTabsQuery.trim().toLocaleLowerCase();
    if (!query) return tabs;
    return tabs.filter((tab) =>
      `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query),
    );
  }, [allTabsQuery, tabs]);

  const updateOverflow = useCallback(() => {
    const element = normalScrollRef.current;
    if (!element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const hasOverflow = maxScrollLeft > 2;
    setOverflow({
      hasOverflow,
      canScrollLeft: hasOverflow && element.scrollLeft > 2,
      canScrollRight: hasOverflow && element.scrollLeft < maxScrollLeft - 2,
    });
  }, []);

  const stopEdgeScroll = useCallback(() => {
    edgeScrollDirectionRef.current = 0;
    if (edgeScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(edgeScrollFrameRef.current);
      edgeScrollFrameRef.current = null;
    }
  }, []);

  const clearHoverPreviewTimer = useCallback(() => {
    if (hoverPreviewTimerRef.current !== null) {
      window.clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
  }, []);

  const closePreview = useCallback(() => {
    clearHoverPreviewTimer();
    setPreview(null);
  }, [clearHoverPreviewTimer]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", closePreview);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", closePreview);
    };
  }, [closePreview]);

  useEffect(() => {
    if (dragState?.isDragging) {
      closePreview();
    }
  }, [closePreview, dragState?.isDragging]);

  useEffect(() => () => clearHoverPreviewTimer(), [clearHoverPreviewTimer]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const setTabElement = useCallback((tabId: string, element: HTMLButtonElement | null) => {
    if (element) {
      tabRefs.current.set(tabId, element);
      return;
    }

    tabRefs.current.delete(tabId);
  }, []);

  const calculateDropIndex = useCallback(
    (tabId: string, isPinned: boolean, pointerX: number) => {
      const sameGroupTabs = tabsRef.current.filter(
        (tab) => Boolean(tab.isPinned) === isPinned && tab.id !== tabId,
      );

      if (sameGroupTabs.length === 0) {
        return 0;
      }

      const rects = sameGroupTabs
        .map((tab) => {
          const element = tabRefs.current.get(tab.id);
          if (!element) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            midpoint: rect.left + rect.width / 2,
          };
        })
        .filter((rect): rect is { left: number; midpoint: number } => rect !== null)
        .sort((a, b) => a.left - b.left);

      if (rects.length === 0) {
        return 0;
      }

      return rects.reduce((index, rect) => (pointerX > rect.midpoint ? index + 1 : index), 0);
    },
    [],
  );

  const runEdgeScroll = useCallback(function scrollDragEdge() {
    const scroll = normalScrollRef.current;
    const direction = edgeScrollDirectionRef.current;
    if (!scroll || direction === 0) {
      edgeScrollFrameRef.current = null;
      return;
    }

    const before = scroll.scrollLeft;
    scroll.scrollLeft += direction * TAB_EDGE_SCROLL_SPEED;
    updateOverflow();
    const current = dragStateRef.current;
    if (current && scroll.scrollLeft !== before) {
      const dropIndex = calculateDropIndex(current.tabId, false, current.currentX);
      const nextState = { ...current, dropIndex };
      dragStateRef.current = nextState;
      setDragState(nextState);
    }
    edgeScrollFrameRef.current = window.requestAnimationFrame(scrollDragEdge);
  }, [calculateDropIndex, updateOverflow]);

  const updateDragEdgeScroll = useCallback((pointerX: number, enabled: boolean) => {
    const scroll = normalScrollRef.current;
    if (!enabled || !scroll) {
      stopEdgeScroll();
      return;
    }

    const rect = scroll.getBoundingClientRect();
    const direction: -1 | 0 | 1 =
      pointerX < rect.left + TAB_EDGE_SCROLL_ZONE
        ? -1
        : pointerX > rect.right - TAB_EDGE_SCROLL_ZONE
          ? 1
          : 0;
    if (direction === edgeScrollDirectionRef.current) return;
    stopEdgeScroll();
    edgeScrollDirectionRef.current = direction;
    if (direction !== 0) {
      edgeScrollFrameRef.current = window.requestAnimationFrame(runEdgeScroll);
    }
  }, [runEdgeScroll, stopEdgeScroll]);

  useEffect(() => {
    const element = normalScrollRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(element);
    const content = element.firstElementChild;
    if (content) resizeObserver.observe(content);
    updateOverflow();
    return () => resizeObserver.disconnect();
  }, [normalTabs.length, updateOverflow]);

  useEffect(() => {
    if (!activeTabId) return;
    const element = tabRefs.current.get(activeTabId);
    const scroll = normalScrollRef.current;
    if (!element || !scroll || element.closest('[data-tab-group="normal"]') === null) return;
    const tabRect = element.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    if (tabRect.left >= scrollRect.left + 2 && tabRect.right <= scrollRect.right - 2) return;
    const delta = tabRect.left < scrollRect.left
      ? tabRect.left - scrollRect.left - 4
      : tabRect.right - scrollRect.right + 4;
    scroll.scrollBy({ left: delta, behavior: reducedMotion ? "auto" : "smooth" });
    window.setTimeout(updateOverflow, reducedMotion ? 0 : 180);
  }, [activeTabId, normalTabs.length, reducedMotion, updateOverflow]);

  useEffect(() => {
    if (!allTabsOpen) return;
    const close = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      setAllTabsOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [allTabsOpen]);

  useEffect(() => () => stopEdgeScroll(), [stopEdgeScroll]);

  const getPreviewTabs = useCallback(
    (groupTabs: BrowserTab[], isPinned: boolean) => {
      if (!dragState?.isDragging || dragState.isPinned !== isPinned) {
        return groupTabs;
      }

      const draggedTab = groupTabs.find((tab) => tab.id === dragState.tabId);
      if (!draggedTab) {
        return groupTabs;
      }

      const remainingTabs = groupTabs.filter((tab) => tab.id !== draggedTab.id);
      const dropIndex = Math.max(0, Math.min(dragState.dropIndex, remainingTabs.length));

      return [
        ...remainingTabs.slice(0, dropIndex),
        draggedTab,
        ...remainingTabs.slice(dropIndex),
      ];
    },
    [dragState],
  );

  const finishTabDrag = useCallback(
    (state: TabDragState) => {
      if (!state.isDragging) {
        dragStateRef.current = null;
        setDragState(null);
        return;
      }

      const stripRect = stripRef.current?.getBoundingClientRect();
      const droppedNearStrip =
        !stripRect ||
        (state.currentY >= stripRect.top - DROP_CANCEL_Y_MARGIN &&
          state.currentY <= stripRect.bottom + DROP_CANCEL_Y_MARGIN);

      if (droppedNearStrip) {
        const groupTabs = tabsRef.current.filter(
          (tab) => Boolean(tab.isPinned) === state.isPinned,
        );
        const draggedTab = groupTabs.find((tab) => tab.id === state.tabId);

        if (draggedTab) {
          const originalOrder = groupTabs.map((tab) => tab.id).join("|");
          const remainingTabs = groupTabs.filter((tab) => tab.id !== draggedTab.id);
          const dropIndex = Math.max(0, Math.min(state.dropIndex, remainingTabs.length));
          const nextGroupTabs = [
            ...remainingTabs.slice(0, dropIndex),
            draggedTab,
            ...remainingTabs.slice(dropIndex),
          ];
          const nextOrder = nextGroupTabs.map((tab) => tab.id).join("|");

          if (nextOrder !== originalOrder) {
            const nextIndex = nextGroupTabs.findIndex((tab) => tab.id === draggedTab.id);
            const beforeTab = nextGroupTabs[nextIndex + 1];
            const afterTab = nextGroupTabs[nextIndex - 1];

            if (beforeTab) {
              onReorderTab(draggedTab.id, beforeTab.id, "before");
            } else if (afterTab) {
              onReorderTab(draggedTab.id, afterTab.id, "after");
            }
          }
        }
      }

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      dragStateRef.current = null;
      setDragState(null);
    },
    [onReorderTab],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }

      const isDragging = current.isDragging ||
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >=
          DRAG_START_THRESHOLD;
      updateDragEdgeScroll(event.clientX, isDragging && !current.isPinned);

      setDragState((previous) => {
        if (!previous || event.pointerId !== previous.pointerId) {
          return previous;
        }

        const dx = event.clientX - previous.startX;
        const dy = event.clientY - previous.startY;
        const isDragging =
          previous.isDragging || Math.hypot(dx, dy) >= DRAG_START_THRESHOLD;
        const dropIndex = isDragging
          ? calculateDropIndex(previous.tabId, previous.isPinned, event.clientX)
          : previous.dropIndex;

        const nextState = {
          ...previous,
          currentX: event.clientX,
          currentY: event.clientY,
          isDragging,
          dropIndex,
        };

        dragStateRef.current = nextState;
        return nextState;
      });
    };

    const end = (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current || event.pointerId !== current.pointerId) {
        return;
      }

      stopEdgeScroll();

      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      const isDragging = current.isDragging || Math.hypot(dx, dy) >= DRAG_START_THRESHOLD;

      finishTabDrag({
        ...current,
        currentX: event.clientX,
        currentY: event.clientY,
        isDragging,
        dropIndex: isDragging
          ? calculateDropIndex(current.tabId, current.isPinned, event.clientX)
          : current.dropIndex,
      });
    };

    const cancel = () => {
      if (!dragStateRef.current) {
        return;
      }

      stopEdgeScroll();

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      dragStateRef.current = null;
      setDragState(null);
    };

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel();
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
    };
  }, [calculateDropIndex, finishTabDrag, stopEdgeScroll, updateDragEdgeScroll]);

  const openContextMenu = (tab: BrowserTab, x: number, y: number) => {
    closePreview();
    setMenu({
      tabId: tab.id,
      x: Math.min(x, window.innerWidth - 236),
      y: Math.min(y, window.innerHeight - 320),
    });
  };

  const schedulePreview = (tab: BrowserTab, element: HTMLElement) => {
    if (!tabHoverPreviewEnabled || dragStateRef.current?.isDragging) {
      return;
    }

    clearHoverPreviewTimer();
    hoverPreviewTimerRef.current = window.setTimeout(() => {
      const rect = element.getBoundingClientRect();
      const chromeBottom = getBrowserChromeBottom();
      setPreview({
        tabId: tab.id,
        x: Math.min(Math.max(10, rect.left), window.innerWidth - 310),
        y: Math.max(rect.bottom + TAB_PREVIEW_CHROME_GAP, chromeBottom + TAB_PREVIEW_CHROME_GAP),
      });
    }, reducedMotion ? 520 : 360);
  };

  const runMenuAction = (action: () => void) => {
    action();
    setMenu(null);
  };

  const startTabDrag = (tab: BrowserTab, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-tab-action]")) {
      return;
    }

    closePreview();
    const rect = event.currentTarget.getBoundingClientRect();
    const groupTabs = tab.isPinned ? pinnedTabs : normalTabs;
    const dropIndex = Math.max(
      0,
      groupTabs.findIndex((item) => item.id === tab.id),
    );

    const nextState: TabDragState = {
      tabId: tab.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      isPinned: Boolean(tab.isPinned),
      isDragging: false,
      dropIndex,
    };

    setMenu(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = nextState;
    setDragState(nextState);
  };

  const renderTab = (tab: BrowserTab) => {
    const isActive = tab.id === activeTabId;
    const tabPosition = tabs.findIndex((item) => item.id === tab.id) + 1;
    const isDragSource = dragState?.tabId === tab.id;
    const isDragPlaceholder = Boolean(isDragSource && dragState?.isDragging);

    return (
      <button
        key={tab.id}
        ref={(element) => setTabElement(tab.id, element)}
        type="button"
        role="tab"
        aria-label={getTabAccessibleLabel(tab)}
        aria-selected={isActive}
        aria-setsize={tabs.length}
        aria-posinset={tabPosition}
        tabIndex={isActive ? 0 : -1}
        data-testid="browser-tab"
        data-tab-id={tab.id}
        aria-grabbed={isDragPlaceholder}
        onPointerDown={(event) => startTabDrag(tab, event)}
        onAuxClick={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          event.stopPropagation();
          closePreview();
          onCloseTab(tab.id);
        }}
        onPointerEnter={(event) => {
          if (event.buttons !== 0) {
            closePreview();
            return;
          }

          schedulePreview(tab, event.currentTarget);
        }}
        onPointerLeave={closePreview}
        onClick={() => {
          if (suppressClickRef.current) {
            return;
          }

          closePreview();
          onSwitchTab(tab.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu(tab, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const nextIndex = (tabPosition - 1 + direction + tabs.length) % tabs.length;
            onSwitchTab(tabs[nextIndex].id);
            return;
          }
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            openContextMenu(tab, rect.left + 20, rect.bottom + 4);
          }
        }}
        className={cn(
          "no-drag group relative flex h-8 touch-none items-center gap-2 rounded-t-lg border text-left text-xs outline-none transition-[background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/30",
          tab.isPinned
            ? "w-11 flex-none justify-center px-0"
            : "w-[220px] min-w-[140px] max-w-[280px] flex-none px-3",
          isActive
            ? "z-10 border-border/90 border-b-card bg-card/95 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
            : "z-0 border-transparent bg-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
          dragState?.tabId === tab.id && "cursor-grabbing",
          dragState?.isDragging && !isDragPlaceholder && "duration-100",
          isDragPlaceholder &&
            "z-20 border-primary/24 bg-primary/5 text-foreground shadow-none",
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            tab.isPinned && "justify-center",
            isDragPlaceholder && "invisible",
          )}
        >
          <TabIcon tab={tab} />
          <TabAudioIndicator tab={tab} />
          {!tab.isPinned && <span className="min-w-0 flex-1 truncate">{tab.title}</span>}
          {!tab.isPinned && (
            <span
              role="button"
              tabIndex={0}
              title="Close tab"
              aria-label={`Close ${tab.title}`}
              data-tab-action="close"
              onPointerDown={(event) => event.stopPropagation()}
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
        </span>
      </button>
    );
  };

  const previewPinnedTabs = getPreviewTabs(pinnedTabs, true);
  const previewNormalTabs = getPreviewTabs(normalTabs, false);
  const dragPreviewLeft = dragState
    ? Math.max(
        8,
        Math.min(window.innerWidth - dragState.width - 8, dragState.currentX - dragState.offsetX),
      )
    : 0;
  const dragPreviewTop = dragState
    ? Math.max(
        8,
        Math.min(window.innerHeight - dragState.height - 8, dragState.currentY - dragState.offsetY),
      )
    : 0;

  return (
    <div
      ref={stripRef}
      className="drag-region relative flex h-10 select-none items-end gap-2 border-b border-border/75 bg-background/90 px-3 backdrop-blur-xl"
    >
      <div
        className="flex min-w-0 flex-1 items-end gap-1 overflow-hidden"
        role="tablist"
        aria-label="Open tabs"
      >
        {previewPinnedTabs.length > 0 && (
          <div className="flex shrink-0 items-end gap-1" data-tab-group="pinned">
            {previewPinnedTabs.map(renderTab)}
          </div>
        )}

        {previewPinnedTabs.length > 0 && previewNormalTabs.length > 0 && (
          <div className="mb-1 h-6 w-px shrink-0 bg-border/60" aria-hidden="true" />
        )}

        <div
          ref={normalScrollRef}
          className="tab-strip-scrollbar no-drag min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
          data-tab-group="normal"
          data-testid="normal-tab-scroll"
          onScroll={updateOverflow}
          onWheel={(event) => {
            if (!overflow.hasOverflow || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            event.preventDefault();
            event.currentTarget.scrollLeft += event.deltaY;
            updateOverflow();
          }}
        >
          <div className="flex min-w-max items-end gap-1">
            {previewNormalTabs.map(renderTab)}
          </div>
        </div>

        {overflow.hasOverflow && (
          <div className="no-drag mb-0.5 flex shrink-0 items-center gap-0.5" data-testid="tab-overflow-controls">
            <Button
              type="button"
              variant="chrome"
              size="iconSm"
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
              disabled={!overflow.canScrollLeft}
              onClick={() => {
                normalScrollRef.current?.scrollBy({
                  left: -TAB_SCROLL_STEP,
                  behavior: reducedMotion ? "auto" : "smooth",
                });
                window.setTimeout(updateOverflow, reducedMotion ? 0 : 180);
              }}
              className="size-7"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="chrome"
              size="iconSm"
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
              disabled={!overflow.canScrollRight}
              onClick={() => {
                normalScrollRef.current?.scrollBy({
                  left: TAB_SCROLL_STEP,
                  behavior: reducedMotion ? "auto" : "smooth",
                });
                window.setTimeout(updateOverflow, reducedMotion ? 0 : 180);
              }}
              className="size-7"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="chrome"
              size="iconSm"
              title="All tabs"
              aria-label="Show all tabs"
              aria-expanded={allTabsOpen}
              onClick={() => {
                setAllTabsQuery("");
                setAllTabsOpen((open) => !open);
              }}
              className="size-7"
            >
              <ListFilter aria-hidden="true" />
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="chrome"
          size="iconSm"
          title="New tab"
          aria-label="New tab"
          data-testid="new-tab-button"
          onClick={onCreateTab}
          className="no-drag mb-0.5 shrink-0"
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

      {allTabsOpen &&
        createPortal(
          <section
            className="no-drag fixed right-[118px] top-11 z-[100] flex max-h-[min(520px,calc(100vh-64px))] w-[360px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-popover/98 p-2 text-foreground shadow-2xl shadow-black/45 backdrop-blur-2xl"
            role="dialog"
            aria-label="All open tabs"
            data-testid="all-tabs-menu"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                autoFocus
                value={allTabsQuery}
                onChange={(event) => setAllTabsQuery(event.target.value)}
                placeholder="Search open tabs"
                aria-label="Search open tabs"
                className="h-9 w-full rounded-xl border border-border/70 bg-background/72 pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/55 focus:ring-[3px] focus:ring-primary/14"
              />
            </div>
            <div className="settings-scrollbar min-h-0 overflow-y-auto" role="list">
              {filteredTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={cn(
                    "group flex min-h-12 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors",
                    tab.id === activeTabId ? "bg-primary/12" : "hover:bg-accent/70",
                  )}
                  role="listitem"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchTab(tab.id);
                      setAllTabsOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary/75">
                      <TabIcon tab={tab} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{tab.title || "Untitled tab"}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{tab.isNewTab ? "UltraX New Tab" : tab.url}</span>
                    </span>
                    {tab.isPinned && <Pin className="size-3 shrink-0 text-primary" aria-label="Pinned" />}
                    {(tab.isMuted || tab.isAudible) && <TabAudioIndicator tab={tab} />}
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      title={tab.isPinned ? "Unpin tab" : "Pin tab"}
                      aria-label={`${tab.isPinned ? "Unpin" : "Pin"} ${tab.title}`}
                      onClick={() => onPinTab(tab.id, !tab.isPinned)}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    >
                      {tab.isPinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      title={tab.isMuted ? "Unmute tab" : "Mute tab"}
                      aria-label={`${tab.isMuted ? "Unmute" : "Mute"} ${tab.title}`}
                      onClick={() => onToggleTabMuted(tab.id)}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    >
                      {tab.isMuted ? <Volume2 className="size-3.5" aria-hidden="true" /> : <VolumeX className="size-3.5" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      title="Close tab"
                      aria-label={`Close ${tab.title}`}
                      onClick={() => onCloseTab(tab.id)}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-destructive/18 hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredTabs.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">No matching tabs</p>
              )}
            </div>
          </section>,
          document.body,
        )}

      {menu &&
        menuTab &&
        createPortal(
          <div
            className="no-drag fixed z-[100] w-56 overflow-hidden rounded-2xl border border-border/70 bg-popover/96 p-1.5 text-foreground shadow-2xl shadow-black/45 backdrop-blur-2xl"
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
              icon={<RotateCcw aria-hidden="true" />}
              label="Reopen Closed Tab"
              onClick={() => runMenuAction(onReopenClosedTab)}
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
          </div>,
          document.body,
        )}

      {dragState?.isDragging && ghostTab && (
        <div
          className="no-drag pointer-events-none fixed left-0 top-0 z-[60]"
          style={{
            width: dragState.width,
            height: dragState.height,
            transform: `translate3d(${dragPreviewLeft}px, ${dragPreviewTop}px, 0)`,
          }}
          aria-hidden="true"
        >
          <div
            className={cn(
              "flex h-full items-center gap-2 rounded-t-lg border border-primary/55 bg-card/98 text-left text-xs text-foreground shadow-[0_18px_46px_hsl(225_45%_2%/0.44),inset_0_1px_0_hsl(0_0%_100%/0.08)] backdrop-blur-xl",
              ghostTab.isPinned
                ? "w-11 justify-center px-0"
                : "w-full min-w-24 px-3",
            )}
          >
            <TabIcon tab={ghostTab} />
            <TabAudioIndicator tab={ghostTab} />
            {!ghostTab.isPinned && <span className="min-w-0 flex-1 truncate">{ghostTab.title}</span>}
          </div>
        </div>
      )}

      {preview && previewTab && !dragState?.isDragging && (
        <TabHoverPreview
          tab={previewTab}
          x={preview.x}
          y={preview.y}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}

function TabHoverPreview({
  tab,
  x,
  y,
  reducedMotion,
}: {
  tab: BrowserTab;
  x: number;
  y: number;
  reducedMotion: boolean;
}) {
  return (
    <section
      data-testid="tab-hover-preview"
      aria-hidden="true"
      className={cn(
        "no-drag pointer-events-none fixed z-[65] w-[300px] rounded-2xl border border-border/70 bg-popover/96 p-3 text-foreground shadow-2xl shadow-black/45 backdrop-blur-2xl",
        !reducedMotion && "tab-preview-motion",
      )}
      style={{ left: x, top: y }}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/58 bg-secondary/78 text-primary">
          <TabIcon tab={tab} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">
            {tab.title || "Untitled"}
          </span>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {tab.isNewTab ? "UltraX New Tab" : tab.url}
          </span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tab.isLoading && <PreviewBadge label="Loading" tone="primary" />}
        {tab.isPinned && <PreviewBadge label="Pinned" />}
        {tab.isMuted && <PreviewBadge label="Muted" tone="primary" />}
        {!tab.isMuted && tab.isAudible && <PreviewBadge label="Audio" tone="primary" />}
        {tab.error && <PreviewBadge label="Needs reload" tone="danger" />}
      </div>
    </section>
  );
}

function PreviewBadge({
  label,
  tone,
}: {
  label: string;
  tone?: "primary" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone === "danger"
          ? "border-destructive/42 bg-destructive/14 text-destructive"
          : tone === "primary"
            ? "border-primary/42 bg-primary/14 text-primary"
            : "border-border/60 bg-background/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function TabIcon({ tab }: { tab: BrowserTab }) {
  if (tab.isLoading) {
    return <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden="true" />;
  }

  if (tab.favicon) {
    return <img src={tab.favicon} alt="" className="size-4 rounded-sm" />;
  }

  return <Globe2 className="size-3.5" aria-hidden="true" />;
}

function TabAudioIndicator({ tab }: { tab: BrowserTab }) {
  if (!tab.isMuted && !tab.isAudible) {
    return null;
  }

  return (
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
