export const BASE_BROWSER_CHROME_HEIGHT = 108;
export const BROWSER_OVERLAY_GAP = 8;
export const QUICK_SETTINGS_PANEL_WIDTH = 380;
export const QUICK_SETTINGS_EDGE_GAP = 16;

export type BrowserLayoutState = {
  windowWidth: number;
  windowHeight: number;
  topChromeHeight: number;
  bookmarksBarHeight: number;
  quickSettingsOpen: boolean;
  quickSettingsWidth: number;
  sidePanelOpen: boolean;
  sidePanelWidth: number;
  settingsOpen: boolean;
  addressSuggestionsOpen: boolean;
  addressSuggestionsHeight: number;
  downloadsOpen: boolean;
  activeTabType: "remote" | "new-tab" | "settings";
};

export type BrowserLayoutInsets = {
  top: number;
  right: number;
  bottom: number;
};

export function calculateBrowserViewInsets(state: BrowserLayoutState): BrowserLayoutInsets {
  if (state.activeTabType === "new-tab") {
    return { top: 0, right: 0, bottom: 0 };
  }

  const quickSettingsInset = state.quickSettingsOpen
    ? Math.max(QUICK_SETTINGS_PANEL_WIDTH, Math.round(state.quickSettingsWidth || QUICK_SETTINGS_PANEL_WIDTH)) +
      QUICK_SETTINGS_EDGE_GAP
    : 0;
  const sidePanelInset = state.sidePanelOpen ? Math.max(0, Math.round(state.sidePanelWidth)) : 0;
  const settingsInset = state.settingsOpen ? 980 : 0;

  return {
    top: state.addressSuggestionsOpen ? Math.max(0, Math.round(state.addressSuggestionsHeight)) : 0,
    right: Math.max(quickSettingsInset, sidePanelInset, settingsInset),
    bottom: state.downloadsOpen ? 76 : 0,
  };
}
