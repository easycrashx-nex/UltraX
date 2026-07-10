import { expect, test, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type UltraXTestApp = {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
};

type ElementBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TestPageServer = {
  url: string;
  close: () => Promise<void>;
};

async function launchUltraX(userDataDir?: string): Promise<UltraXTestApp> {
  const resolvedUserDataDir =
    userDataDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-e2e-")));
  const executablePath = process.env.ULTRAX_E2E_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath
      ? { executablePath: path.resolve(executablePath), args: [] }
      : { args: ["."] }),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      ULTRAX_E2E: "1",
      ULTRAX_E2E_USER_DATA: resolvedUserDataDir,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => Boolean((window as Window & { ultraX?: unknown }).ultraX));
  await expect.poll(async () => {
    const state = await page.evaluate(() => (window as any).ultraX.getState());
    return state.tabs.length > 0 && Boolean(state.activeTabId);
  }).toBe(true);
  return { app, page, userDataDir: resolvedUserDataDir };
}

async function closeUltraX({ app, userDataDir }: UltraXTestApp, removeUserData = true): Promise<void> {
  const childProcess = app.process();
  if (!childProcess.killed && childProcess.exitCode === null) {
    if (process.platform === "win32" && childProcess.pid) {
      await execFileAsync("taskkill", ["/PID", String(childProcess.pid), "/T", "/F"]).catch(
        () => undefined,
      );
    } else {
      childProcess.kill();
    }
  }
  await Promise.race([app.close().catch(() => undefined), delay(2_000)]);

  if (removeUserData) {
    await removeUserDataDirectory(userDataDir);
  }
}

async function startTestPageServer(html: string): Promise<TestPageServer> {
  const server: Server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test page server did not expose a TCP port.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function removeUserDataDirectory(userDataDir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
      return;
    } catch {
      await delay(500);
    }
  }
}

async function getState(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).ultraX.getState());
}

async function waitForTabCount(page: Page, count: number): Promise<void> {
  await expect.poll(async () => (await getState(page)).tabs.length).toBe(count);
}

async function readVisibleTabBox(page: Page, tabId: string): Promise<ElementBox | null> {
  return page.locator(`[data-tab-id="${tabId}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }).catch(() => null);
}

async function getVisibleTabBox(page: Page, tabId: string): Promise<ElementBox> {
  const target = page.locator(`[data-tab-id="${tabId}"]`);
  await expect(target).toBeVisible();

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const box = await readVisibleTabBox(page, tabId);
    if (box) {
      return box;
    }

    await page.waitForTimeout(50);
  }

  throw new Error(`Tab ${tabId} is not visible.`);
}

async function extensionsWorkspaceExists(userDataDir: string): Promise<boolean> {
  const paths = ["extensions", "extensions/installed", "extensions/unpacked", "extensions/samples", "extensions/storage", "extensions/logs"]
    .map((item) => path.join(userDataDir, item));

  try {
    await Promise.all(paths.map((item) => fs.access(item)));
    return true;
  } catch {
    return false;
  }
}

async function dragTabTo(page: Page, tabId: string, targetX: number, targetY: number): Promise<void> {
  const source = page.locator(`[data-tab-id="${tabId}"]`);
  const sourceBox = await getVisibleTabBox(page, tabId);

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await expect(source).toHaveAttribute("aria-grabbed", "true");
  await page.mouse.up();
}

async function dragTabBefore(page: Page, sourceTabId: string, targetTabId: string): Promise<void> {
  const targetBox = await getVisibleTabBox(page, targetTabId);
  await dragTabTo(
    page,
    sourceTabId,
    Math.max(4, targetBox.x - 10),
    targetBox.y + targetBox.height / 2,
  );
}

test("tab UX supports create, pin, reorder, mute, close, and move to new window", async () => {
  const app = await launchUltraX();

  try {
    await app.page.getByTestId("new-tab-button").click();
    await waitForTabCount(app.page, 2);

    const initial = await getState(app.page);
    const firstTabId = initial.tabs[0].id;
    const secondTabId = initial.tabs[1].id;

    await app.page.evaluate((tabId) => (window as any).ultraX.pinTab(tabId, true), secondTabId);
    await expect.poll(async () => (await getState(app.page)).tabs[0].id).toBe(secondTabId);

    await app.page.evaluate((tabId) => (window as any).ultraX.pinTab(tabId, false), secondTabId);
    await expect.poll(async () => (await getState(app.page)).tabs.find((tab: any) => tab.id === secondTabId)?.isPinned).toBe(false);

    await app.page.evaluate((tabId) => (window as any).ultraX.toggleTabMuted(tabId), secondTabId);
    await expect(app.page.getByTestId("tab-muted-indicator")).toBeVisible();
    await expect.poll(async () => (await getState(app.page)).tabs.find((tab: any) => tab.id === secondTabId)?.isMuted).toBe(true);

    await app.page.evaluate((tabId) => (window as any).ultraX.toggleTabMuted(tabId), secondTabId);
    await expect.poll(async () => (await getState(app.page)).tabs.find((tab: any) => tab.id === secondTabId)?.isMuted).toBe(false);

    await app.page.evaluate(
      ([tabId, targetTabId]) => (window as any).ultraX.reorderTab(tabId, targetTabId),
      [secondTabId, firstTabId],
    );
    await expect.poll(async () => (await getState(app.page)).tabs[0].id).toBe(secondTabId);

    await app.page.evaluate((tabId) => (window as any).ultraX.moveTabToNewWindow(tabId), secondTabId);
    await expect.poll(() => app.app.windows().length).toBe(2);

    const movedWindow = app.app.windows().find((windowPage) => windowPage !== app.page);
    expect(movedWindow).toBeTruthy();
    await movedWindow!.waitForFunction(() => (window as any).ultraX.getState().then((state: any) => state.tabs.length === 1));
    await expect.poll(async () => (await getState(movedWindow!)).tabs[0].id).toBe(secondTabId);
    await expect.poll(async () => (await getState(app.page)).tabs.some((tab: any) => tab.id === secondTabId)).toBe(false);

    const remaining = await getState(app.page);
    await app.page.evaluate((tabId) => (window as any).ultraX.closeTab(tabId), remaining.tabs[0].id);
    await waitForTabCount(app.page, 1);
  } finally {
    await closeUltraX(app);
  }
});

test("tab pointer drag keeps normal and pinned tab groups stable", async () => {
  const app = await launchUltraX();

  try {
    await app.page.getByTestId("new-tab-button").click();
    await app.page.getByTestId("new-tab-button").click();
    await waitForTabCount(app.page, 3);

    const initial = await getState(app.page);
    const [firstTabId, secondTabId, thirdTabId] = initial.tabs.map((tab: any) => tab.id);

    await dragTabBefore(app.page, thirdTabId, firstTabId);
    await expect.poll(async () => (await getState(app.page)).tabs[0].id).toBe(thirdTabId);

    await app.page.evaluate((tabId) => (window as any).ultraX.pinTab(tabId, true), thirdTabId);
    await app.page.evaluate((tabId) => (window as any).ultraX.pinTab(tabId, true), firstTabId);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.filter((tab: any) => tab.isPinned).map((tab: any) => tab.id);
    }).toEqual([thirdTabId, firstTabId]);

    await dragTabBefore(app.page, firstTabId, thirdTabId);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.filter((tab: any) => tab.isPinned).map((tab: any) => tab.id);
    }).toEqual([firstTabId, thirdTabId]);

    await app.page.getByTestId("new-tab-button").click();
    await waitForTabCount(app.page, 4);
    const withExtraTab = await getState(app.page);
    const normalTabIds = withExtraTab.tabs
      .filter((tab: any) => !tab.isPinned)
      .map((tab: any) => tab.id);
    const normalSourceId = normalTabIds[normalTabIds.length - 1];
    const firstPinnedBox = await app.page.locator(`[data-tab-id="${firstTabId}"]`).boundingBox();
    if (!firstPinnedBox) {
      throw new Error("Pinned tab is not visible.");
    }

    await dragTabTo(
      app.page,
      normalSourceId,
      firstPinnedBox.x + firstPinnedBox.width / 2,
      firstPinnedBox.y + firstPinnedBox.height / 2,
    );

    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.map((tab: any) => Boolean(tab.isPinned));
    }).toEqual([true, true, false, false]);
  } finally {
    await closeUltraX(app);
  }
});

test("settings persist across an app restart", async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-e2e-persist-"));
  const firstRun = await launchUltraX(userDataDir);

  await firstRun.page.evaluate(() =>
    (window as any).ultraX.updateSettings({
      closeBehavior: "ask-before-closing-multiple-tabs",
      startupBehavior: "restore-session",
      restoreTabsOnLaunch: true,
      toolbarDensity: "compact",
      newTabBackground: "minimal-dark",
      reduceTransparency: true,
      focusRingVisibility: "high",
      textScale: "extra-large",
      permissionPolicy: {
        camera: "ask",
        microphone: "ask",
        location: "ask",
        notifications: "ask",
        popups: "block",
        downloads: "ask",
        clipboard: "ask",
        autoplay: "block",
        javascript: "allow",
        images: "allow",
      },
      sitePermissionExceptions: [
        {
          id: "example-notifications",
          origin: "https://www.example.com:8443",
          permission: "notifications",
          policy: "block",
          updatedAt: Date.now(),
        },
      ],
      shortcutOverrides: {
        newTab: ["Ctrl+Shift+N"],
      },
    }),
  );
  await expect.poll(async () => (await getState(firstRun.page)).settings.toolbarDensity).toBe("compact");
  await closeUltraX(firstRun, false);

  const secondRun = await launchUltraX(userDataDir);
  try {
    const state = await getState(secondRun.page);
    expect(state.settings.closeBehavior).toBe("ask-before-closing-multiple-tabs");
    expect(state.settings.startupBehavior).toBe("restore-session");
    expect(state.settings.restoreTabsOnLaunch).toBe(true);
    expect(state.settings.toolbarDensity).toBe("compact");
    expect(state.settings.newTabBackground).toBe("minimal-dark");
    expect(state.settings.reduceTransparency).toBe(true);
    expect(state.settings.focusRingVisibility).toBe("high");
    expect(state.settings.textScale).toBe("extra-large");
    expect(state.settings.permissionPolicy.notifications).toBe("ask");
    expect(state.settings.sitePermissionExceptions[0].origin).toBe("https://www.example.com:8443");
    expect(state.settings.shortcutOverrides.newTab).toEqual(["Ctrl+Shift+N"]);
  } finally {
    await closeUltraX(secondRun);
  }
});

test("fresh settings use v1.1.9 search, suggestions, home, and permission defaults", async () => {
  const app = await launchUltraX();

  try {
    const state = await getState(app.page);
    expect(state.settings.searchEngine).toBe("google");
    expect(state.settings.customSearchUrl).toBe("");
    expect(state.settings.searchSuggestions).toBe(true);
    expect(state.settings.searchSuggestionSettings).toEqual({
      localSuggestions: true,
      historySuggestions: true,
      bookmarkSuggestions: true,
      openTabSuggestions: true,
      onlineSuggestions: true,
      suggestionProvider: "google",
    });
    expect(state.settings.homeBehavior).toBe("new-tab");
    expect(state.settings.homeUrl).toBe("https://google.com");
    expect(state.settings.permissionPolicy.camera).toBe("ask");
    expect(state.settings.permissionPolicy.popups).toBe("block");
    expect(state.settings.tabHoverPreview).toBe(true);
    expect(state.settings.shortcutOverrides).toEqual({});
  } finally {
    await closeUltraX(app);
  }
});

test("Google search works with an empty custom template and Custom reports validation", async () => {
  const app = await launchUltraX();

  try {
    await app.page.evaluate(() =>
      (window as any).ultraX.updateSettings({
        searchEngine: "google",
        customSearchUrl: "",
      }),
    );
    await app.page.evaluate(() => (window as any).ultraX.navigate("test"));
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.url;
    }).toBe("https://www.google.com/search?q=test");

    await app.page.evaluate(() =>
      (window as any).ultraX.updateSettings({
        searchEngine: "custom",
        customSearchUrl: "",
      }),
    );
    await app.page.evaluate(() => (window as any).ultraX.navigate("custom query"));
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.error;
    }).toContain("Custom search template");
  } finally {
    await closeUltraX(app);
  }
});

test("Ctrl+Shift+T reopens the most recently closed page", async () => {
  const server = await startTestPageServer("<!doctype html><title>Restorable Page</title><p>restore me</p>");
  const app = await launchUltraX();

  try {
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.url;
    }).toBe(`${server.url}/`);

    const beforeClose = await getState(app.page);
    await app.page.evaluate((tabId) => (window as any).ultraX.closeTab(tabId), beforeClose.activeTabId);
    await app.page.keyboard.press("Control+Shift+T");

    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.url;
    }).toBe(`${server.url}/`);

    await app.page.evaluate(() => (window as any).ultraX.createTab());
    const withNewTab = await getState(app.page);
    const existingNewTab = withNewTab.tabs.find((tab: any) => tab.isNewTab);
    const restoredPage = withNewTab.tabs.find((tab: any) => tab.url === `${server.url}/`);
    await app.page.evaluate((tabId) => (window as any).ultraX.closeTab(tabId), restoredPage.id);
    await app.page.keyboard.press("Control+Shift+T");
    await waitForTabCount(app.page, 2);
    const afterSecondRestore = await getState(app.page);
    expect(afterSecondRestore.tabs.some((tab: any) => tab.id === existingNewTab.id)).toBe(true);
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});

test("middle-click closes the hovered inactive tab only", async () => {
  const app = await launchUltraX();

  try {
    await app.page.getByTestId("new-tab-button").click();
    await app.page.getByTestId("new-tab-button").click();
    await waitForTabCount(app.page, 3);

    const state = await getState(app.page);
    const [firstTab, , thirdTab] = state.tabs;
    await app.page.evaluate((tabId) => (window as any).ultraX.switchTab(tabId), firstTab.id);
    await app.page.locator(`[data-tab-id="${thirdTab.id}"]`).click({ button: "middle" });

    await waitForTabCount(app.page, 2);
    const after = await getState(app.page);
    expect(after.activeTabId).toBe(firstTab.id);
    expect(after.tabs.some((tab: any) => tab.id === thirdTab.id)).toBe(false);
  } finally {
    await closeUltraX(app);
  }
});

test("Ctrl+F opens a working find bar for web content", async () => {
  const server = await startTestPageServer(
    "<!doctype html><title>Find Page</title><main>UltraX needle and another needle.</main>",
  );
  const app = await launchUltraX();

  try {
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.isNewTab;
    }).toBe(false);

    await app.page.keyboard.press("Control+F");
    const findBar = app.page.getByTestId("find-bar");
    await expect(findBar).toBeVisible();
    await findBar.getByRole("textbox", { name: "Find in page" }).fill("needle");
    await expect(findBar.getByText("1 / 2")).toBeVisible();

    await findBar.getByRole("button", { name: "Next match" }).click();
    await expect(findBar.getByText("2 / 2")).toBeVisible();
    await app.page.keyboard.press("Escape");
    await expect(findBar).toBeHidden();
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});

test("shortcut editor detects conflicts and can replace or reset bindings", async () => {
  const app = await launchUltraX();

  try {
    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-shortcuts").click();

    await app.page.getByTestId("shortcut-edit-newTab").click();
    await app.page.keyboard.press("Control+W");

    const conflict = app.page.getByRole("dialog", { name: "Shortcut conflict" });
    await expect(conflict).toContainText("Close Tab");
    await conflict.getByRole("button", { name: "Replace" }).click();

    await expect.poll(async () => (await getState(app.page)).settings.shortcutOverrides.newTab)
      .toEqual(["Ctrl+W"]);
    await app.page.getByRole("button", { name: "Reset all shortcuts" }).click();
    await expect.poll(async () => (await getState(app.page)).settings.shortcutOverrides)
      .toEqual({});
  } finally {
    await closeUltraX(app);
  }
});

test("bookmark HTML import preserves folders and reports duplicates", async () => {
  const app = await launchUltraX();
  const htmlPath = path.join(app.userDataDir, "bookmarks.html");
  await fs.writeFile(
    htmlPath,
    `<!DOCTYPE NETSCAPE-Bookmark-file-1>
     <DL><p>
       <DT><A HREF="https://example.com/">Example</A>
       <DT><H3>Work</H3>
       <DL><p>
         <DT><A HREF="https://docs.example.com/">Docs</A>
         <DT><A HREF="https://example.com/">Duplicate Example</A>
         <DT><A HREF="javascript:alert(1)">Unsafe</A>
       </DL><p>
     </DL><p>`,
    "utf8",
  );

  try {
    await app.app.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [selectedPath],
        bookmarks: [],
      });
    }, htmlPath);

    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-bookmarks").click();
    await app.page.getByRole("button", { name: "Import Bookmarks" }).click();

    await expect(app.page.getByText("Imported 2, skipped 1 duplicate, 1 failed.")).toBeVisible();
    const state = await getState(app.page);
    expect(state.bookmarks).toHaveLength(2);
    expect(state.bookmarks.find((bookmark: any) => bookmark.url === "https://docs.example.com/")?.folderPath)
      .toEqual(["Work"]);
  } finally {
    await closeUltraX(app);
  }
});

test("tab hover preview appears and disappears", async () => {
  const app = await launchUltraX();

  try {
    const tab = app.page.getByTestId("browser-tab").first();
    await expect(tab).not.toHaveAttribute("title", /.+/);
    await expect(tab).toHaveAttribute("aria-label", /New Tab/);

    await tab.hover();
    const preview = app.page.getByTestId("tab-hover-preview");
    await expect(preview).toBeVisible();

    const previewBox = await preview.boundingBox();
    expect(previewBox).not.toBeNull();
    const chromeBottom = await app.page
      .locator(".browser-content-start")
      .first()
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(previewBox!.y).toBeGreaterThanOrEqual(chromeBottom);

    await app.page.mouse.move(420, 260);
    await expect(app.page.getByTestId("tab-hover-preview")).toBeHidden();
  } finally {
    await closeUltraX(app);
  }
});

test("tab context menu renders above the address bar", async () => {
  const app = await launchUltraX();

  try {
    await app.page.getByTestId("browser-tab").first().click({ button: "right" });
    const menu = app.page.getByRole("menu");
    await expect(menu).toBeVisible();

    const layering = await app.page.evaluate(() => {
      const contextMenu = document.querySelector<HTMLElement>('[role="menu"]');
      const addressInput = document.querySelector<HTMLElement>(
        'input[placeholder="Search or enter address"]',
      );

      if (!contextMenu || !addressInput) {
        return { overlapsAddressBar: false, contextMenuIsTopmost: false };
      }

      const menuRect = contextMenu.getBoundingClientRect();
      const addressRect = addressInput.getBoundingClientRect();
      const overlapLeft = Math.max(menuRect.left, addressRect.left);
      const overlapRight = Math.min(menuRect.right, addressRect.right);
      const overlapTop = Math.max(menuRect.top, addressRect.top);
      const overlapBottom = Math.min(menuRect.bottom, addressRect.bottom);
      const overlapsAddressBar = overlapRight > overlapLeft && overlapBottom > overlapTop;

      if (!overlapsAddressBar) {
        return { overlapsAddressBar, contextMenuIsTopmost: false };
      }

      const topmostElement = document.elementFromPoint(
        overlapLeft + (overlapRight - overlapLeft) / 2,
        overlapTop + (overlapBottom - overlapTop) / 2,
      );

      return {
        overlapsAddressBar,
        contextMenuIsTopmost: Boolean(
          topmostElement && contextMenu.contains(topmostElement),
        ),
      };
    });

    expect(layering.overlapsAddressBar).toBe(true);
    expect(layering.contextMenuIsTopmost).toBe(true);
    await expect(menu.getByRole("menuitem", { name: "Reopen Closed Tab" })).toBeVisible();

    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await waitForTabCount(app.page, 2);
    await expect(menu).toBeHidden();
  } finally {
    await closeUltraX(app);
  }
});

test("address suggestions remain above web content with Settings open", async () => {
  const server = await startTestPageServer(
    "<!doctype html><title>Suggestion Layer Test</title><main>Native web content</main>",
  );
  const app = await launchUltraX();

  try {
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.isLoading;
    }).toBe(false);

    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.keyboard.press("Control+L");
    await app.page.getByRole("combobox", { name: "Search or enter address" }).fill(
      "https://search.brave.com/ask?q=a+long+query+that+keeps+the+address+suggestion+open",
    );

    const suggestions = app.page.getByRole("listbox");
    await expect(suggestions).toBeVisible();
    const suggestionsBox = await suggestions.boundingBox();
    expect(suggestionsBox).not.toBeNull();
    const requiredViewTop = Math.ceil(suggestionsBox!.y + suggestionsBox!.height);

    await expect.poll(async () => {
      const bounds = await app.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return window?.contentView.children.map((child) => child.getBounds()) ?? [];
      });
      return bounds[0]?.y ?? 0;
    }).toBeGreaterThanOrEqual(requiredViewTop);

    await app.page.keyboard.press("Escape");
    await expect(suggestions).toBeHidden();
    await expect.poll(async () => {
      const bounds = await app.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return window?.contentView.children.map((child) => child.getBounds()) ?? [];
      });
      return bounds[0]?.y ?? 0;
    }).toBe(108);
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});

test("Quick Settings reserves its full native overlay region on remote pages", async () => {
  const server = await startTestPageServer("<!doctype html><title>Quick Settings Layer Test</title><main>Remote content</main>");
  const app = await launchUltraX();

  try {
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.isLoading;
    }).toBe(false);
    await app.page.locator('[data-quick-settings-trigger="true"]').click();

    const panel = app.page.getByRole("dialog", { name: "Quick Settings" });
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    const viewport = await app.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(panelBox!.y).toBeGreaterThanOrEqual(108);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(viewport.height);

    const bounds = await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.contentView.children.map((child) => child.getBounds()) ?? []);
    expect(bounds[0]?.x ?? -1).toBe(0);
    expect((bounds[0]?.width ?? viewport.width) <= Math.ceil(panelBox!.x)).toBe(true);

    await app.page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect.poll(async () => (await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.contentView.children[0]?.getBounds().width ?? 0))).toBe(viewport.width);
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});

test("switching remote page to New Tab detaches the native view cleanly", async () => {
  const server = await startTestPageServer("<!doctype html><title>New Tab Bounds Test</title><main>Remote content</main>");
  const app = await launchUltraX();

  try {
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.isLoading;
    }).toBe(false);
    await app.page.getByTestId("new-tab-button").click();
    await expect(app.page.getByText("A clean browser shell with Chromium underneath.")).toBeVisible();
    await expect.poll(async () => (await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.contentView.children.length ?? 0))).toBe(0);

    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => {
      const state = await getState(app.page);
      return state.tabs.find((tab: any) => tab.id === state.activeTabId)?.isNewTab;
    }).toBe(false);
    await expect.poll(async () => (await app.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.contentView.children[0]?.getBounds().y ?? 0))).toBe(108);
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});

test("extensions workspace is recreated on startup and when opening Extensions settings", async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-e2e-extensions-"));
  const app = await launchUltraX(userDataDir);

  try {
    await expect.poll(() => extensionsWorkspaceExists(userDataDir)).toBe(true);

    const root = path.join(userDataDir, "extensions");
    await fs.rm(root, { recursive: true, force: true });
    await expect.poll(() => extensionsWorkspaceExists(userDataDir)).toBe(false);

    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-extensions").click();

    await expect.poll(() => extensionsWorkspaceExists(userDataDir)).toBe(true);

    const workspace = await app.page.evaluate(() => (window as any).ultraX.ensureExtensionsWorkspace());
    expect(path.normalize(workspace.root)).toBe(path.normalize(root));
    expect(path.basename(workspace.unpacked)).toBe("unpacked");
  } finally {
    await closeUltraX(app);
  }
});

test("updates page opens and renders current version controls", async () => {
  const app = await launchUltraX();

  try {
    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-updates").click();

    await expect(app.page.getByText("Current version")).toBeVisible();
    await expect(app.page.getByText(/UltraX Browser (?:1\.1\.[89]|1\.1\.9-Fix|1\.1\.10-DevU|1\.2\.0)/).last()).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Check for Updates" })).toBeVisible();
    await expect(app.page.getByText(/SmartScreen warning until UltraX is code signed/i)).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Open Official Release" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Download Update" })).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: "Install and Restart" })).toHaveCount(0);
  } finally {
    await closeUltraX(app);
  }
});

test("packaged security boundaries sandbox generic extension panels", async () => {
  test.skip(!process.env.ULTRAX_E2E_EXECUTABLE, "Requires the packaged UltraX executable.");
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-e2e-packaged-"));
  const extensionDir = path.join(userDataDir, "hostile-extension");
  await fs.mkdir(extensionDir, { recursive: true });
  await fs.writeFile(
    path.join(extensionDir, "ultrax-extension.json"),
    JSON.stringify({
      id: "sandbox-test-extension",
      name: "Sandbox Test Extension",
      version: "1.0.0",
      panel: "panel.html",
      permissions: ["sidebar"],
    }),
    "utf8",
  );
  await fs.writeFile(
    path.join(extensionDir, "panel.html"),
    '<!doctype html><script>top.location.href="https://attacker.invalid/escaped";</script><p>Sandbox test</p>',
    "utf8",
  );
  await fs.writeFile(
    path.join(userDataDir, "ultrax-state.json"),
    JSON.stringify({
      version: 8,
      state: {
        installedExtensions: [
          {
            id: "sandbox-test-extension",
            manifest: {
              id: "sandbox-test-extension",
              name: "Sandbox Test Extension",
              version: "1.0.0",
              panel: "panel.html",
              permissions: ["sidebar"],
            },
            source: "local",
            installPath: extensionDir,
            enabled: true,
            developerMode: true,
            installedAt: Date.now(),
            updatedAt: Date.now(),
            status: "enabled",
            errors: [],
            validationWarnings: [],
            runtimeLogs: [],
          },
        ],
      },
    }),
    "utf8",
  );

  const app = await launchUltraX(userDataDir);
  try {
    const shellUrl = app.page.url();
    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByTitle("Open Sandbox Test Extension").click();
    const frame = app.page.getByTitle("Sandbox Test Extension panel");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    await app.page.waitForTimeout(500);
    expect(app.page.url()).toBe(shellUrl);
  } finally {
    await closeUltraX(app);
  }
});

test("normal tabs scroll without moving pinned tabs or the New Tab control", async () => {
  const app = await launchUltraX();
  try {
    for (let index = 0; index < 11; index += 1) {
      await app.page.evaluate(() => (window as any).ultraX.createTab());
    }
    await waitForTabCount(app.page, 12);
    const state = await getState(app.page);
    await app.page.evaluate((tabId) => (window as any).ultraX.pinTab(tabId, true), state.tabs[0].id);

    const normalScroll = app.page.getByTestId("normal-tab-scroll");
    await expect(app.page.getByTestId("tab-overflow-controls")).toBeVisible();
    await expect(app.page.getByTestId("new-tab-button")).toBeVisible();
    const metrics = await normalScroll.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    const normalWidths = await app.page.locator('[data-tab-group="normal"] [data-testid="browser-tab"]').evaluateAll((tabs) =>
      tabs.map((tab) => tab.getBoundingClientRect().width),
    );
    expect(normalWidths.every((width) => width >= 140)).toBe(true);

    const pinned = app.page.locator('[data-tab-group="pinned"] [data-testid="browser-tab"]').first();
    const pinnedBefore = await pinned.boundingBox();
    await normalScroll.dispatchEvent("wheel", { deltaY: 480, deltaX: 0 });
    await expect.poll(() => normalScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const pinnedAfter = await pinned.boundingBox();
    expect(Math.round(pinnedAfter!.x)).toBe(Math.round(pinnedBefore!.x));

    const latestState = await getState(app.page);
    const firstNormal = latestState.tabs.find((tab: any) => !tab.isPinned);
    const lastNormal = [...latestState.tabs].reverse().find((tab: any) => !tab.isPinned);
    await app.page.evaluate((tabId) => (window as any).ultraX.switchTab(tabId), firstNormal.id);
    await expect.poll(() => normalScroll.evaluate((element) => element.scrollLeft)).toBeLessThan(40);
    await app.page.evaluate((tabId) => (window as any).ultraX.switchTab(tabId), lastNormal.id);
    await expect.poll(async () => {
      const tabBox = await app.page.locator(`[data-tab-id="${lastNormal.id}"]`).boundingBox();
      const scrollBox = await normalScroll.boundingBox();
      return Boolean(tabBox && scrollBox && tabBox.x >= scrollBox.x - 2 && tabBox.x + tabBox.width <= scrollBox.x + scrollBox.width + 2);
    }).toBe(true);

    await normalScroll.evaluate((element) => { element.scrollLeft = 0; });
    const dragTab = app.page.locator(`[data-tab-id="${firstNormal.id}"]`);
    const dragBox = await dragTab.boundingBox();
    const dragScrollBox = await normalScroll.boundingBox();
    await app.page.mouse.move(dragBox!.x + dragBox!.width / 2, dragBox!.y + dragBox!.height / 2);
    await app.page.mouse.down();
    await app.page.mouse.move(dragScrollBox!.x + dragScrollBox!.width - 8, dragBox!.y + dragBox!.height / 2, { steps: 8 });
    await expect.poll(() => normalScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(20);
    await app.page.mouse.up();

    await app.page.getByRole("button", { name: "Show all tabs" }).click();
    await expect(app.page.getByTestId("all-tabs-menu")).toBeVisible();
    await app.page.getByRole("textbox", { name: "Search open tabs" }).fill("New Tab");
    await expect(app.page.getByTestId("all-tabs-menu").getByRole("listitem")).toHaveCount(12);

    await app.page.keyboard.press("Escape");
    const visibleRects = await app.page.locator('[data-tab-group="normal"] [data-testid="browser-tab"]').evaluateAll((tabs) => {
      const viewport = tabs[0]?.parentElement?.parentElement?.getBoundingClientRect();
      return tabs.map((tab) => tab.getBoundingClientRect())
        .filter((rect) => viewport && rect.right > viewport.left && rect.left < viewport.right)
        .map((rect) => ({ left: rect.left, right: rect.right }))
        .sort((left, right) => left.left - right.left);
    });
    expect(visibleRects.every((rect, index) => index === 0 || rect.left >= visibleRects[index - 1].right)).toBe(true);
  } finally {
    await closeUltraX(app);
  }
});

test("password vault setup, encrypted CRUD, lock and hostile HTTP fill block work end to end", async () => {
  const app = await launchUltraX();
  const server = await startTestPageServer('<!doctype html><input name="username"><input type="password">');
  const masterPassword = "UltraX E2E master password 2026!";
  try {
    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-passwords").click();
    await expect(app.page.getByText("Create your local UltraX vault")).toBeVisible();

    await app.page.getByLabel("Master password", { exact: true }).fill(masterPassword);
    await app.page.getByLabel("Confirm master password").fill(masterPassword);
    await app.page.getByRole("button", { name: "Create encrypted vault" }).click();
    await expect(app.page.getByText("Local vault unlocked")).toBeVisible({ timeout: 15_000 });

    await app.page.getByRole("button", { name: "Add login" }).click();
    await app.page.getByLabel("Title").fill("UltraX E2E Login");
    await app.page.getByLabel("Website origins").fill("https://example.com/login");
    await app.page.getByRole("textbox", { name: "Username", exact: true }).fill("e2e-user@example.com");
    await app.page.getByLabel("Password", { exact: true }).fill("E2E-only-password-93!");
    await app.page.getByLabel("Tags").fill("test, local");
    await app.page.getByRole("button", { name: "Encrypt and save" }).click();
    await expect(app.page.getByRole("heading", { name: "UltraX E2E Login", exact: true })).toBeVisible();

    const vaultPath = path.join(app.userDataDir, "password-manager", "vault.ultraxvault");
    await expect.poll(async () => fs.readFile(vaultPath, "utf8").then(() => true).catch(() => false)).toBe(true);
    const rawVault = await fs.readFile(vaultPath, "utf8");
    expect(rawVault).not.toContain("E2E-only-password-93!");
    expect(rawVault).not.toContain("e2e-user@example.com");
    expect(rawVault).not.toContain("example.com");

    const state = await getState(app.page);
    await app.page.evaluate((url) => (window as any).ultraX.navigate(url), server.url);
    await expect.poll(async () => (await getState(app.page)).tabs.find((tab: any) => tab.id === state.activeTabId)?.url).toContain(server.url);
    const item = await app.page.evaluate(() => (window as any).ultraX.passwordManager.list("").then((items: any[]) => items[0]));
    const fillError = await app.page.evaluate(async ({ itemId, tabId }) => {
      try {
        await (window as any).ultraX.passwordManager.fill({ itemId, tabId });
        return null;
      } catch (error) {
        return String(error);
      }
    }, { itemId: item.id, tabId: state.activeTabId });
    expect(fillError).toMatch(/HTTP|origin/i);

    await app.page.getByRole("button", { name: "Lock now" }).click();
    await expect(app.page.getByText("Password vault locked")).toBeVisible();
    await app.page.getByLabel("Master password", { exact: true }).fill("wrong master password");
    await app.page.getByRole("button", { name: "Unlock vault" }).click();
    await expect(app.page.getByText(/could not be unlocked/i)).toBeVisible({ timeout: 15_000 });
    await app.page.getByLabel("Master password", { exact: true }).fill(masterPassword);
    await app.page.getByRole("button", { name: "Unlock vault" }).click();
    await expect(app.page.getByText("Local vault unlocked")).toBeVisible({ timeout: 15_000 });
    await app.page.getByRole("button", { name: "Analyze locally" }).click();
    await expect(app.page.getByText("Insecure origins")).toBeVisible();
  } finally {
    await closeUltraX(app);
    await server.close();
  }
});
