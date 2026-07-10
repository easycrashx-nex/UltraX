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
