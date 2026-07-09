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
  } finally {
    await closeUltraX(secondRun);
  }
});

test("updates page opens and renders current version controls", async () => {
  const app = await launchUltraX();

  try {
    await app.page.locator('[data-quick-settings-trigger="true"]').click();
    await app.page.getByRole("button", { name: "Open Settings" }).click();
    await app.page.getByTestId("settings-category-updates").click();

    await expect(app.page.getByText("Current version")).toBeVisible();
    await expect(app.page.getByText(/UltraX Browser 1\.0\.9/)).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Check for Updates" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Download Update" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Install and Restart" })).toBeVisible();
  } finally {
    await closeUltraX(app);
  }
});
