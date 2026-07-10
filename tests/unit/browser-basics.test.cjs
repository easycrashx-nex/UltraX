const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findShortcutConflict,
  getShortcutFromInput,
  resolveShortcutAction,
  validateShortcutBinding,
} = require("../../dist-electron/shared/shortcuts.js");
const {
  mergeBookmarkCandidates,
  parseBookmarkHtml,
} = require("../../dist-electron/main/bookmark-import.js");
const { normalizeHttpOrigin } = require("../../dist-electron/shared/origin-policy.js");
const {
  createSafeRecord,
  isValidExtensionId,
  isValidExtensionStorageKey,
} = require("../../dist-electron/shared/extension-identifiers.js");
const { validateExtensionManifest } = require("../../dist-electron/main/extensions.js");
const {
  resolveSafeDownloadPath,
  sanitizeDownloadFilename,
} = require("../../dist-electron/main/download-path.js");
const {
  executeInBoundCredentialFrame,
} = require("../../dist-electron/main/password-manager/fill-target.js");
const { isNewerVersion } = require("../../dist-electron/shared/version.js");

test("shortcut normalization resolves defaults and reports conflicts", () => {
  assert.equal(
    getShortcutFromInput({ key: "T", control: true, shift: true }),
    "Ctrl+Shift+T",
  );
  assert.equal(
    resolveShortcutAction({ key: "t", control: true, shift: true }, {}),
    "reopenClosedTab",
  );
  assert.equal(findShortcutConflict("newTab", "Ctrl+W", {})?.action, "closeTab");
  assert.match(validateShortcutBinding("Ctrl+C") ?? "", /text editing/i);
  assert.equal(validateShortcutBinding("Ctrl+Shift+N"), null);
});

test("bookmark HTML parsing preserves folders and safely merges duplicates", () => {
  const parsed = parseBookmarkHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <DL><p>
      <DT><A HREF="https://example.com/">Example</A>
      <DT><H3>Work</H3>
      <DL><p>
        <DT><A HREF="https://docs.example.com/">Docs</A>
        <DT><A HREF="https://example.com/">Duplicate</A>
        <DT><A HREF="javascript:alert(1)">Unsafe</A>
      </DL><p>
    </DL><p>`);

  assert.equal(parsed.failed, 1);
  assert.deepEqual(
    parsed.bookmarks.find((bookmark) => bookmark.url === "https://docs.example.com/")?.folderPath,
    ["Work"],
  );

  const merged = mergeBookmarkCandidates([], parsed, "skip", 1_700_000_000_000);
  assert.equal(merged.summary.imported, 2);
  assert.equal(merged.summary.skippedDuplicates, 1);
  assert.equal(merged.summary.failed, 1);
  assert.equal(merged.bookmarks.length, 2);
});

test("permission origins preserve scheme, port, and www boundaries", () => {
  assert.equal(normalizeHttpOrigin("example.com/path", true), "https://example.com");
  assert.equal(normalizeHttpOrigin("https://www.example.com:8443/path"), "https://www.example.com:8443");
  assert.equal(normalizeHttpOrigin("http://example.com"), "http://example.com");
  assert.equal(normalizeHttpOrigin("javascript:alert(1)"), "");
  assert.notEqual(normalizeHttpOrigin("https://example.com"), normalizeHttpOrigin("http://example.com"));
  assert.notEqual(normalizeHttpOrigin("https://example.com"), normalizeHttpOrigin("https://www.example.com"));
});

test("extension identifiers and storage keys reject prototype mutation names", () => {
  for (const unsafe of ["__proto__", "constructor", "prototype"]) {
    assert.equal(isValidExtensionId(unsafe), false);
    assert.equal(isValidExtensionStorageKey(unsafe), false);
    const result = validateExtensionManifest({
      id: unsafe,
      name: "Unsafe",
      version: "1.0.0",
      permissions: ["storage"],
    });
    assert.equal(result.ok, false);
  }

  assert.equal(isValidExtensionId("safe-extension_1"), true);
  assert.equal(isValidExtensionStorageKey("settings.theme"), true);
  const bucket = createSafeRecord();
  bucket.__proto__ = { polluted: true };
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(bucket), null);
});

test("download filenames stay inside the selected directory on Windows semantics", () => {
  assert.equal(sanitizeDownloadFilename("report.pdf"), "report.pdf");
  assert.equal(sanitizeDownloadFilename("../../evil.exe"), "evil.exe");
  assert.equal(sanitizeDownloadFilename("folder\\payload.txt"), "payload.txt");
  assert.equal(sanitizeDownloadFilename("report.txt:evil.exe"), "report.txt_evil.exe");
  assert.equal(sanitizeDownloadFilename("CON.txt"), "_CON.txt");
  assert.equal(sanitizeDownloadFilename("name.   "), "name");
  assert.equal(sanitizeDownloadFilename(".."), "download");

  const resolved = resolveSafeDownloadPath("C:\\Users\\Test\\Downloads", "..\\..\\escape.exe");
  assert.equal(resolved.filename, "escape.exe");
  assert.equal(resolved.savePath, "C:\\Users\\Test\\Downloads\\escape.exe");
});

test("password fill remains bound to the originally authorized frame origin", async () => {
  let executed = false;
  const legitimateFrame = {
    url: "https://example.com/login",
    async executeJavaScript() {
      executed = true;
      return { filledPassword: true };
    },
  };
  assert.deepEqual(
    await executeInBoundCredentialFrame(legitimateFrame, "https://example.com", "void 0"),
    { filledPassword: true },
  );
  assert.equal(executed, true);

  const navigatedFrame = {
    url: "https://example.com/login",
    async executeJavaScript() {
      this.url = "https://attacker.example/steal";
      return { filledPassword: true };
    },
  };
  await assert.rejects(
    () => executeInBoundCredentialFrame(navigatedFrame, "https://example.com", "void 0"),
    /navigated/i,
  );

  let hostileExecuted = false;
  const hostileFrame = {
    url: "https://attacker.example/steal",
    async executeJavaScript() {
      hostileExecuted = true;
      return null;
    },
  };
  await assert.rejects(
    () => executeInBoundCredentialFrame(hostileFrame, "https://example.com", "void 0"),
    /navigated/i,
  );
  assert.equal(hostileExecuted, false);
});

test("release version checks accept only newer semantic versions", () => {
  assert.equal(isNewerVersion("1.1.9", "1.1.8"), true);
  assert.equal(isNewerVersion("v1.2.0", "1.1.9"), true);
  assert.equal(isNewerVersion("1.1.8", "1.1.8"), false);
  assert.equal(isNewerVersion("1.0.9", "1.1.8"), false);
  assert.equal(isNewerVersion("not-a-version", "1.1.8"), false);
});
