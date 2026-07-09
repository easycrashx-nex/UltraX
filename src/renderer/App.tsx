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
  root.classList.toggle("glass-off", !settings.glassMode || settings.reduceTransparency);
  root.classList.toggle("contrast-more", settings.increaseContrast);
  root.classList.toggle("text-small", settings.textScale === "small");
  root.classList.toggle("text-large", settings.textScale === "large");
  root.classList.toggle("text-extra-large", settings.textScale === "extra-large");
  root.classList.toggle("motion-reduced", settings.reducedMotion);
  root.classList.toggle("focus-always", settings.alwaysShowFocusIndicators);
  root.classList.toggle("focus-subtle", settings.focusRingVisibility === "subtle");
  root.classList.toggle("focus-high", settings.focusRingVisibility === "high");
  root.classList.toggle("links-underlined", settings.underlineLinks);
  root.classList.toggle("font-readable", settings.readableFontSmoothing);
  root.classList.toggle("density-compact", settings.toolbarDensity === "compact");
  root.classList.toggle("density-spacious", settings.toolbarDensity === "spacious");
  root.classList.toggle("animation-minimal", settings.animationLevel === "minimal");
  root.classList.toggle("animation-expressive", settings.animationLevel === "expressive");

  const accent = getAccentHsl(settings.accentColor);
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--radius", getRadiusValue(settings.cornerRadius));
  root.style.setProperty("--glass-blur", getGlassBlur(settings.blurIntensity));
  root.style.setProperty("--panel-alpha", getPanelAlpha(settings.panelTransparency));
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

function getRadiusValue(radius: BrowserSettings["cornerRadius"]): string {
  const radii: Record<BrowserSettings["cornerRadius"], string> = {
    subtle: "6px",
    rounded: "8px",
    "ultra-rounded": "14px",
  };
  return radii[radius];
}

function getGlassBlur(blur: BrowserSettings["blurIntensity"]): string {
  const blurs: Record<BrowserSettings["blurIntensity"], string> = {
    low: "14px",
    balanced: "24px",
    high: "34px",
  };
  return blurs[blur];
}

function getPanelAlpha(transparency: BrowserSettings["panelTransparency"]): string {
  const values: Record<BrowserSettings["panelTransparency"], string> = {
    low: "0.9",
    balanced: "0.72",
    high: "0.54",
  };
  return values[transparency];
}
