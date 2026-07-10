const assert = require("node:assert/strict");
const test = require("node:test");

const { calculateBrowserViewInsets, QUICK_SETTINGS_PANEL_WIDTH } = require("../../dist-electron/shared/browser-layout.js");

test("reserves the full Quick Settings panel width plus edge gap", () => {
  const insets = calculateBrowserViewInsets({
    quickSettingsOpen: true,
    quickSettingsWidth: QUICK_SETTINGS_PANEL_WIDTH,
    addressSuggestionsOpen: false,
    addressSuggestionsHeight: 0,
    settingsOpen: false,
    sidePanelOpen: false,
    sidePanelWidth: 392,
    downloadsOpen: false,
    activeTabType: "remote",
  });

  assert.equal(insets.right, QUICK_SETTINGS_PANEL_WIDTH + 16);
});

test("combines suggestion and side-panel insets without shrinking the content twice", () => {
  const insets = calculateBrowserViewInsets({
    quickSettingsOpen: false,
    quickSettingsWidth: 380,
    addressSuggestionsOpen: true,
    addressSuggestionsHeight: 280,
    settingsOpen: false,
    sidePanelOpen: true,
    sidePanelWidth: 392,
    downloadsOpen: true,
    activeTabType: "remote",
  });

  assert.deepEqual(insets, { top: 280, right: 392, bottom: 76 });
});

test("does not reserve native page space for an internal New Tab", () => {
  const insets = calculateBrowserViewInsets({
    quickSettingsOpen: false,
    quickSettingsWidth: 380,
    addressSuggestionsOpen: true,
    addressSuggestionsHeight: 280,
    settingsOpen: false,
    sidePanelOpen: false,
    sidePanelWidth: 392,
    downloadsOpen: false,
    activeTabType: "new-tab",
  });

  assert.deepEqual(insets, { top: 0, right: 0, bottom: 0 });
});
