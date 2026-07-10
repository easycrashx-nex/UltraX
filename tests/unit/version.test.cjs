const assert = require("node:assert/strict");
const test = require("node:test");

const { formatVisibleVersion } = require("../../dist-electron/shared/version.js");

test("maps the internal 1.1.10 release to the DevU product label", () => {
  assert.equal(formatVisibleVersion("1.1.10"), "1.1.10-DevU");
});

test("keeps the previous Fix label readable for existing installations", () => {
  assert.equal(formatVisibleVersion("1.1.9-fix.1"), "1.1.9-Fix");
});
