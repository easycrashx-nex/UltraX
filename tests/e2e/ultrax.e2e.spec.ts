import { expect, test, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type UltraXTestApp = {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
};

async function launchUltraX(userDataDir?: string): Promise<UltraXTestApp> {
  const resolvedUserDataDir =
    userDataDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-e2e-")));
  const app = await electron.launch({
    args: ["."],
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
  return { app, page, userDataDir: resolvedUserDataDir };
}

async function closeUltraX({ app, userDataDir }: UltraXTestApp, removeUserData = true): Promise<void> {
  const childProcess = app.process();
  try {
    await app.close();
  } catch {
    if (!childProcess.killed && childProcess.exitCode === null) {
      childProcess.kill();
    }
  }

  if (removeUserData) {
    await removeUserDataDirectory(userDataDir);
  }
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
  await page.waitForFunction(
    (expected) => (window as any).ultraX.getState().then((state: any) => state.tabs.length === expected),
    count,
  );
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
  await expect(source).toBeVisible();
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error(`Tab ${tabId} is not visible.`);
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await expect(source).toHaveAttribute("aria-grabbed", "true");
  await page.mouse.up();
}

async function dragTabBefore(page: Page, sourceTabId: string, targetTabId: string): Promise<void> {
  const target = page.locator(`[data-tab-id="${targetTabId}"]`);
  await expect(target).toBeVisible();
  const targetBox = await target.boundingBox();
  if (!targetBox) {
    throw new Error(`Tab ${targetTabId} is not visible.`);
  }

  await dragTabTo(page, sourceTabId, targetBox.x + 3, targetBox.y + targetBox.height / 2);
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
          host: "example.com",
          permission: "notifications",
          policy: "block",
          updatedAt: Date.now(),
        },
      ],
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
    expect(state.settings.sitePermissionExceptions[0].host).toBe("example.com");
  } finally {
    await closeUltraX(secondRun);
  }
});

test("fresh settings use v1.1.2 search, suggestions, home, and permission defaults", async () => {
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
  } finally {
    await closeUltraX(app);
  }
});

test("tab hover preview appears and disappears", async () => {
  const app = await launchUltraX();

  try {
    const tab = app.page.getByTestId("browser-tab").first();
    await tab.hover();
    await expect(app.page.getByTestId("tab-hover-preview")).toBeVisible();

    await app.page.mouse.move(420, 260);
    await expect(app.page.getByTestId("tab-hover-preview")).toBeHidden();
  } finally {
    await closeUltraX(app);
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
    await expect(app.page.getByText(/UltraX Browser 1\.1\.2/)).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Check for Updates" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Download Update" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Install and Restart" })).toBeVisible();
  } finally {
    await closeUltraX(app);
  }
});
