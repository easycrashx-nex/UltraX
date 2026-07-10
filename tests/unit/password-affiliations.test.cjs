const assert = require("node:assert/strict");
const test = require("node:test");

const { areCredentialOriginsAffiliated } = require("../../dist-electron/shared/password-affiliations.js");

test("reviewed YouTube and Google login origins are affiliated without fuzzy matching", () => {
  assert.equal(areCredentialOriginsAffiliated("https://accounts.google.com", "https://www.youtube.com"), true);
  assert.equal(areCredentialOriginsAffiliated("https://accounts.google.com", "https://youtube-login.example"), false);
  assert.equal(areCredentialOriginsAffiliated("https://accounts.google.com", "https://google.com.evil.example"), false);
});

test("unreviewed origins require exact equality", () => {
  assert.equal(areCredentialOriginsAffiliated("https://login.example.com", "https://example.com"), false);
  assert.equal(areCredentialOriginsAffiliated("https://login.example.com", "https://login.example.com"), true);
});
