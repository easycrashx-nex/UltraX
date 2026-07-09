import type { AccentColor, BrowserSettings, BrowserState, ThemeMode } from "@shared/types";
import { useEffect, useState } from "react";
import { BrowserShell } from "@/components/browser/BrowserShell";

export default function App() {
  const [state, setState] = useState<BrowserState | null>(null);

  useEffect(() => {
    let mounted = true;

    void window.ultraX.getState().then((nextState) => {
      if (mounted) {
        setState(nextState);
      }
    });

    const unsubscribe = window.ultraX.onStateChanged((nextState) => {
      setState(nextState);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    applyShellPreferences(state.settings);
  }, [state]);

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Starting UltraX...
      </div>
    );
  }

  return <BrowserShell state={state} />;
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;

  root.classList.add(resolved);
}

function applyShellPreferences(settings: BrowserSettings) {
  applyTheme(settings.theme);

  const root = document.documentElement;
  root.classList.toggle("glass-off", !settings.glassMode);
  root.classList.toggle("contrast-more", settings.increaseContrast);
  root.classList.toggle("text-large", settings.textScale === "large");
  root.classList.toggle("motion-reduced", settings.reducedMotion);

  const accent = getAccentHsl(settings.accentColor);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
}

function getAccentHsl(accent: AccentColor): string {
  const accents: Record<AccentColor, string> = {
    blue: "217 91% 59%",
    purple: "262 89% 66%",
    cyan: "188 93% 48%",
    green: "151 68% 48%",
    rose: "344 89% 66%",
    orange: "24 94% 61%",
  };

  return accents[accent];
}
