import type { Bookmark, BrowserSettings } from "@shared/types";
import {
  ArrowUpRight,
  Bookmark as BookmarkIcon,
  Clock,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getHostname } from "@/lib/browser";
import { cn } from "@/lib/utils";
import type { PanelId } from "./types";

const ShaderAnimation = lazy(() =>
  import("@/components/ui/shader-animation").then((module) => ({
    default: module.ShaderAnimation,
  })),
);

type NewTabPageProps = {
  bookmarks: Bookmark[];
  settings: BrowserSettings;
  onNavigate: (input: string) => void;
  onOpenBookmark: (bookmarkId: string) => void;
  onOpenPanel: (panel: PanelId) => void;
  onOpenSettings: () => void;
};

export function NewTabPage({
  bookmarks,
  settings,
  onNavigate,
  onOpenBookmark,
  onOpenPanel,
  onOpenSettings,
}: NewTabPageProps) {
  const [query, setQuery] = useState("");
  const [windowFocused, setWindowFocused] = useState(true);
  const visibleBookmarks = useMemo(
    () => bookmarks.slice(0, settings.lazyLoadQuickLinks ? 6 : 9),
    [bookmarks, settings.lazyLoadQuickLinks],
  );
  const reducedVisuals =
    settings.reducedMotion ||
    settings.reducedVisualEffects ||
    settings.reduceNewTabAnimations;
  const disabledByEfficiencyMode =
    settings.performanceMode === "efficiency" && settings.disableShaderOnEfficiencyMode;
  const pausedByFocus = settings.pauseShaderWhenUnfocused && !windowFocused;
  const shouldRenderShader =
    settings.shaderEnabled && !reducedVisuals && !disabledByEfficiencyMode && !pausedByFocus;
  const shaderOpacity =
    settings.backgroundShaderPerformance === "low"
      ? "opacity-45"
      : settings.backgroundShaderPerformance === "high"
        ? "opacity-85"
        : settings.backgroundShaderPerformance === "ultra"
          ? "opacity-95"
          : "opacity-70";

  useEffect(() => {
    const syncFocus = () => setWindowFocused(document.hasFocus());

    syncFocus();
    window.addEventListener("focus", syncFocus);
    window.addEventListener("blur", syncFocus);
    return () => {
      window.removeEventListener("focus", syncFocus);
      window.removeEventListener("blur", syncFocus);
    };
  }, []);

  // TODO: Wire shaderFpsCap and pauseShaderOnBatterySaver into ShaderAnimation
  // once the shader renderer exposes frame scheduling and battery-state hooks.

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNavigate(query);
  };

  return (
    <main className="browser-content-start fixed inset-x-0 bottom-0 overflow-hidden bg-background">
      {shouldRenderShader ? (
        <Suspense fallback={<StaticShaderBackdrop />}>
          <ShaderAnimation className={cn(shaderOpacity)} />
        </Suspense>
      ) : (
        <StaticShaderBackdrop />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background)/0.28),hsl(var(--background)/0.94)_68%),linear-gradient(180deg,hsl(var(--background)/0.62),hsl(var(--background)))]" />

      <section className="relative z-10 flex h-full items-start justify-center px-6 pb-6 pt-10">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="grid size-10 place-items-center rounded-lg border border-border bg-card/70 text-primary shadow-xl shadow-black/20">
              <Sparkles aria-hidden="true" className="size-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-semibold leading-tight text-foreground lg:text-5xl">
                UltraX
              </h1>
              <p className="text-sm text-muted-foreground">
                A clean browser shell with Chromium underneath.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="glass-panel flex w-full items-center gap-3 rounded-xl p-2">
            <Search aria-hidden="true" className="ml-3 size-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or enter address"
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              className="h-11 border-transparent bg-transparent text-base focus:border-transparent focus:ring-0"
            />
            <Button type="submit" className="h-10 rounded-lg">
              Go
            </Button>
          </form>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickAction
              icon={<BookmarkIcon aria-hidden="true" />}
              label="Bookmarks"
              detail={`${bookmarks.length} saved`}
              onClick={() => onOpenPanel("bookmarks")}
            />
            <QuickAction
              icon={<Clock aria-hidden="true" />}
              label="History"
              detail="Recent pages"
              onClick={() => onOpenPanel("history")}
            />
            <QuickAction
              icon={<Settings aria-hidden="true" />}
              label="Settings"
              detail="Preferences"
              onClick={onOpenSettings}
            />
          </div>

          {visibleBookmarks.length > 0 && (
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBookmarks.map((bookmark) => (
                <button
                  key={bookmark.id}
                  type="button"
                  onClick={() => onOpenBookmark(bookmark.id)}
                  className="glass-panel group flex min-h-24 flex-col justify-between gap-3 rounded-lg p-4 text-left transition-colors hover:border-primary/50"
                >
                  <span className="line-clamp-2 text-sm font-medium text-foreground">
                    {bookmark.title}
                  </span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{getHostname(bookmark.url)}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function QuickAction({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <Card className="glass-panel overflow-hidden">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/55"
        >
          <span className="grid size-8 place-items-center rounded-md bg-secondary text-primary">
            {icon}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="truncate text-xs text-muted-foreground">{detail}</span>
          </span>
        </button>
      </CardContent>
    </Card>
  );
}

function StaticShaderBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,hsl(var(--primary)/0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]"
    />
  );
}
