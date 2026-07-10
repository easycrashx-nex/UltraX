const assert = require("node:assert/strict");
const test = require("node:test");

const { formatUpdateError } = require("../../dist-electron/shared/update-errors.js");

test("maps missing update metadata to an actionable message", () => {
  assert.match(
    formatUpdateError(new Error("Cannot find latest.yml in the latest release artifacts")),
    /latest\.yml.*official GitHub Release/i,
  );
});

test("maps checksum failures without hiding integrity enforcement", () => {
  assert.match(
    formatUpdateError(new Error("sha512 checksum mismatch")),
    /integrity check failed.*not installed/i,
  );
});

test("maps offline failures to a retryable network error", () => {
  assert.match(formatUpdateError(new Error("net::ERR_INTERNET_DISCONNECTED")), /internet connection.*retry/i);
});

test("does not expose URL credentials or query secrets", () => {
  const message = formatUpdateError(
    new Error("request failed https://token-user:token-pass@example.com/latest.yml?token=secret-value"),
  );
  assert.doesNotMatch(message, /token-pass|secret-value/);
  assert.match(message, /example\.com/);
});
