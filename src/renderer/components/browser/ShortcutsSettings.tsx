import type { BrowserSettings, ShortcutAction } from "@shared/types";
import {
  findShortcutConflict,
  getEffectiveShortcutBindings,
  getShortcutFromInput,
  replaceShortcutBinding,
  SHORTCUTS,
  validateShortcutBinding,
} from "@shared/shortcuts";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ShortcutsSettingsProps = {
  settings: BrowserSettings;
  onUpdateSettings: (settings: Partial<BrowserSettings>) => void;
};

type ConflictState = {
  action: ShortcutAction;
  binding: string;
  conflictLabel: string;
};

export function ShortcutsSettings({ settings, onUpdateSettings }: ShortcutsSettingsProps) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        setRecording(null);
        setError(null);
        return;
      }

      const binding = getShortcutFromInput(event);
      if (!binding) return;
      const validationError = validateShortcutBinding(binding);
      if (validationError) {
        setError(validationError);
        return;
      }

      const existing = findShortcutConflict(recording, binding, settings.shortcutOverrides);
      if (existing) {
        setConflict({ action: recording, binding, conflictLabel: existing.label });
      } else {
        onUpdateSettings({
          shortcutOverrides: { ...settings.shortcutOverrides, [recording]: [binding] },
        });
      }
      setRecording(null);
      setError(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onUpdateSettings, recording, settings.shortcutOverrides]);

  const resetAction = (action: ShortcutAction) => {
    const next = { ...settings.shortcutOverrides };
    delete next[action];
    onUpdateSettings({ shortcutOverrides: next });
  };

  return (
    <>
      <section className="settings-card overflow-hidden rounded-xl border border-border/70 bg-card/62 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Keyboard Shortcuts</h3>
            <p className="mt-1 text-xs text-muted-foreground">Select a shortcut, then press the new key combination.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => onUpdateSettings({ shortcutOverrides: {} })}>
            <RotateCcw aria-hidden="true" />
            Reset all shortcuts
          </Button>
        </div>
        <div>
          {[...new Set(SHORTCUTS.map((shortcut) => shortcut.category))].map((category) => (
            <section key={category} aria-label={`${category} shortcuts`}>
              <div className="border-b border-border/55 bg-secondary/28 px-5 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
                {category}
              </div>
              <div className="divide-y divide-border/55">
          {SHORTCUTS.filter((shortcut) => shortcut.category === category).map((shortcut) => {
            const bindings = getEffectiveShortcutBindings(shortcut.action, settings.shortcutOverrides);
            const customized = settings.shortcutOverrides[shortcut.action] !== undefined;
            return (
              <div key={shortcut.action} className="settings-row">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{shortcut.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{shortcut.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    data-testid={`shortcut-edit-${shortcut.action}`}
                    data-shortcut-recording={recording === shortcut.action ? "true" : undefined}
                    onClick={() => {
                      setRecording(shortcut.action);
                      setError(null);
                    }}
                    className="min-w-28 rounded-md border border-border/80 bg-secondary/65 px-3 py-2 text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  >
                    {recording === shortcut.action ? "Press shortcut..." : bindings.join(" / ") || "Unassigned"}
                  </button>
                    <Button type="button" size="icon" variant="ghost" title="Reset shortcut" aria-label={`Reset ${shortcut.label}`} disabled={!customized} onClick={() => resetAction(shortcut.action)} className="size-8 disabled:opacity-25">
                      <RotateCcw aria-hidden="true" />
                    </Button>
                </div>
              </div>
            );
          })}
              </div>
            </section>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="status">
          {error}
        </div>
      )}

      {conflict && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/55 p-5 backdrop-blur-sm" role="dialog" aria-label="Shortcut conflict" aria-modal="true">
          <div className="settings-modal w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Keyboard aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">Shortcut conflict</h3>
                <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">{conflict.binding}</strong> is currently assigned to {conflict.conflictLabel}.</p>
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="Close conflict" onClick={() => setConflict(null)}><X aria-hidden="true" /></Button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConflict(null)}>Cancel</Button>
              <Button type="button" onClick={() => {
                onUpdateSettings({ shortcutOverrides: replaceShortcutBinding(conflict.action, conflict.binding, settings.shortcutOverrides) });
                setConflict(null);
              }}>Replace</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
