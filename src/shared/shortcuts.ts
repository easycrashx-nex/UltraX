import type { ShortcutAction, ShortcutOverrides } from "./types";

export type ShortcutDescriptor = {
  action: ShortcutAction;
  category: "Tabs" | "Navigation" | "Address Bar" | "Bookmarks" | "History & Downloads" | "Search & Settings";
  label: string;
  description: string;
  bindings: string[];
  scope: "browser" | "page";
};

export type ShortcutInput = {
  key?: string;
  code?: string;
  control?: boolean;
  ctrlKey?: boolean;
  meta?: boolean;
  metaKey?: boolean;
  alt?: boolean;
  altKey?: boolean;
  shift?: boolean;
  shiftKey?: boolean;
};

export const SHORTCUTS: readonly ShortcutDescriptor[] = [
  { action: "newTab", category: "Tabs", label: "New Tab", description: "Open a new tab.", bindings: ["Ctrl+T"], scope: "browser" },
  { action: "closeTab", category: "Tabs", label: "Close Tab", description: "Close the active tab.", bindings: ["Ctrl+W"], scope: "browser" },
  { action: "reopenClosedTab", category: "Tabs", label: "Reopen closed tab", description: "Restore the most recently closed tab.", bindings: ["Ctrl+Shift+T"], scope: "browser" },
  { action: "nextTab", category: "Tabs", label: "Next tab", description: "Switch to the next tab.", bindings: ["Ctrl+Tab", "Ctrl+PageDown"], scope: "browser" },
  { action: "previousTab", category: "Tabs", label: "Previous tab", description: "Switch to the previous tab.", bindings: ["Ctrl+Shift+Tab", "Ctrl+PageUp"], scope: "browser" },
  { action: "reload", category: "Navigation", label: "Reload page", description: "Reload the active page.", bindings: ["Ctrl+R", "F5"], scope: "page" },
  { action: "hardReload", category: "Navigation", label: "Reload without cache", description: "Reload the active page and bypass cached resources.", bindings: ["Ctrl+Shift+R", "Ctrl+F5"], scope: "page" },
  { action: "back", category: "Navigation", label: "Go back", description: "Return to the previous page.", bindings: ["Alt+ArrowLeft"], scope: "page" },
  { action: "forward", category: "Navigation", label: "Go forward", description: "Move to the next page.", bindings: ["Alt+ArrowRight"], scope: "page" },
  { action: "focusAddressBar", category: "Address Bar", label: "Focus address bar", description: "Move focus to the address bar.", bindings: ["Ctrl+L", "Alt+D", "F4"], scope: "browser" },
  { action: "toggleBookmark", category: "Bookmarks", label: "Bookmark page", description: "Add or remove a bookmark for the active page.", bindings: ["Ctrl+D"], scope: "browser" },
  { action: "toggleBookmarksBar", category: "Bookmarks", label: "Show bookmarks bar", description: "Show or hide the bookmarks bar.", bindings: ["Ctrl+Shift+B"], scope: "browser" },
  { action: "openHistory", category: "History & Downloads", label: "Open history", description: "Open browsing history.", bindings: ["Ctrl+H"], scope: "browser" },
  { action: "openDownloads", category: "History & Downloads", label: "Open downloads", description: "Open the downloads view.", bindings: ["Ctrl+J"], scope: "browser" },
  { action: "findInPage", category: "Search & Settings", label: "Find in page", description: "Search within the active page.", bindings: ["Ctrl+F"], scope: "page" },
  { action: "openSettings", category: "Search & Settings", label: "Open settings", description: "Open UltraX Settings.", bindings: ["Ctrl+Comma"], scope: "browser" },
  { action: "clearBrowsingData", category: "Search & Settings", label: "Clear browsing data", description: "Open privacy settings for clearing local browsing data.", bindings: ["Ctrl+Shift+Delete"], scope: "browser" },
] as const;

const DESCRIPTOR_BY_ACTION = new Map(SHORTCUTS.map((shortcut) => [shortcut.action, shortcut]));
const MODIFIER_ORDER = ["Ctrl", "Alt", "Shift"] as const;
const RESERVED_EDITING_SHORTCUTS = new Set([
  "Ctrl+A",
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+X",
  "Ctrl+Y",
  "Ctrl+Z",
]);

export function getShortcutFromInput(input: ShortcutInput): string | null {
  const key = normalizeKey(input.key ?? input.code ?? "");
  if (!key || key === "Control" || key === "Alt" || key === "Shift" || key === "Meta") {
    return null;
  }

  const modifiers: string[] = [];
  if (input.control || input.ctrlKey || input.meta || input.metaKey) modifiers.push("Ctrl");
  if (input.alt || input.altKey) modifiers.push("Alt");
  if (input.shift || input.shiftKey) modifiers.push("Shift");

  return [...modifiers, key].join("+");
}

export function getEffectiveShortcutBindings(
  action: ShortcutAction,
  overrides: ShortcutOverrides,
): string[] {
  const configured = overrides[action];
  const defaults = DESCRIPTOR_BY_ACTION.get(action)?.bindings ?? [];
  const source = configured === undefined ? defaults : configured;
  return [...new Set(source.map(normalizeShortcutBinding).filter((value): value is string => Boolean(value)))];
}

export function resolveShortcutAction(
  input: ShortcutInput,
  overrides: ShortcutOverrides,
): ShortcutAction | null {
  const binding = getShortcutFromInput(input);
  if (!binding) return null;

  return SHORTCUTS.find((shortcut) =>
    getEffectiveShortcutBindings(shortcut.action, overrides).includes(binding),
  )?.action ?? null;
}

export function findShortcutConflict(
  action: ShortcutAction,
  binding: string,
  overrides: ShortcutOverrides,
): ShortcutDescriptor | null {
  const normalized = normalizeShortcutBinding(binding);
  if (!normalized) return null;

  return SHORTCUTS.find((shortcut) =>
    shortcut.action !== action &&
    getEffectiveShortcutBindings(shortcut.action, overrides).includes(normalized),
  ) ?? null;
}

export function replaceShortcutBinding(
  action: ShortcutAction,
  binding: string,
  overrides: ShortcutOverrides,
): ShortcutOverrides {
  const normalized = normalizeShortcutBinding(binding);
  if (!normalized) return overrides;

  const next: ShortcutOverrides = { ...overrides, [action]: [normalized] };
  const conflict = findShortcutConflict(action, normalized, overrides);
  if (conflict) {
    next[conflict.action] = getEffectiveShortcutBindings(conflict.action, overrides)
      .filter((candidate) => candidate !== normalized);
  }
  return next;
}

export function validateShortcutBinding(binding: string): string | null {
  const normalized = normalizeShortcutBinding(binding);
  if (!normalized) return "Press a complete keyboard shortcut.";
  if (RESERVED_EDITING_SHORTCUTS.has(normalized)) {
    return "This shortcut is reserved for text editing.";
  }

  const parts = normalized.split("+");
  const key = parts.at(-1) ?? "";
  const hasPrimaryModifier = parts.includes("Ctrl") || parts.includes("Alt");
  if (!hasPrimaryModifier && !["F4", "F5", "Escape"].includes(key)) {
    return "Use Ctrl or Alt so normal typing remains available.";
  }
  return null;
}

export function normalizeShortcutOverrides(value: unknown): ShortcutOverrides {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const normalized: ShortcutOverrides = {};
  for (const shortcut of SHORTCUTS) {
    const bindings = source[shortcut.action];
    if (!Array.isArray(bindings)) continue;
    normalized[shortcut.action] = bindings
      .filter((binding): binding is string => typeof binding === "string")
      .map(normalizeShortcutBinding)
      .filter((binding): binding is string => Boolean(binding))
      .slice(0, 4);
  }
  return normalized;
}

export function normalizeShortcutBinding(binding: string): string | null {
  const rawParts = binding.split("+").map((part) => part.trim()).filter(Boolean);
  if (!rawParts.length) return null;
  const key = normalizeKey(rawParts.at(-1) ?? "");
  if (!key) return null;
  const modifierSet = new Set(rawParts.slice(0, -1).map(normalizeModifier).filter(Boolean));
  const modifiers = MODIFIER_ORDER.filter((modifier) => modifierSet.has(modifier));
  return [...modifiers, key].join("+");
}

function normalizeModifier(value: string): (typeof MODIFIER_ORDER)[number] | null {
  switch (value.toLowerCase()) {
    case "control":
    case "ctrl":
    case "command":
    case "cmd":
    case "meta":
      return "Ctrl";
    case "alt":
    case "option":
      return "Alt";
    case "shift":
      return "Shift";
    default:
      return null;
  }
}

function normalizeKey(value: string): string {
  const key = value.trim();
  if (!key) return "";
  const aliases: Record<string, string> = {
    " ": "Space",
    Spacebar: "Space",
    Esc: "Escape",
    Left: "ArrowLeft",
    Right: "ArrowRight",
    Up: "ArrowUp",
    Down: "ArrowDown",
    Del: "Delete",
    ",": "Comma",
  };
  if (aliases[key]) return aliases[key];
  if (/^Key[A-Z]$/.test(key)) return key.slice(3);
  if (/^Digit\d$/.test(key)) return key.slice(5);
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  return key.length > 1 ? `${key[0].toUpperCase()}${key.slice(1)}` : key.toUpperCase();
}
