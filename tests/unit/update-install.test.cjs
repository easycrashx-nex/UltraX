const assert = require("node:assert/strict");
const test = require("node:test");

const { SILENT_UPDATE_INSTALL_OPTIONS } = require("../../dist-electron/shared/update-install.js");

test("in-app update uses a silent installer and relaunches UltraX", () => {
  assert.deepEqual(SILENT_UPDATE_INSTALL_OPTIONS, {
    isSilent: true,
    isForceRunAfter: true,
  });
});
