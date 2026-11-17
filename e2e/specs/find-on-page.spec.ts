/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PAGE_TITLE = "Docs";
const OTHER_KEY = "other";
const FIND_FIELD = "nol-browser-find-bar input";
const FIND_COUNT = ".nol-browser-find-count";
const MODIFIER = process.platform === "darwin" ? "meta" : "control";

async function openDocsAsync(app: TestApp, docs: FixtureServer): Promise<void> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url("/"), OTHER_KEY);
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the docs page." }).toEqual([new ViewPage(docs.url("/"), PAGE_TITLE)]);
}

test.describe("find on page", () => {
  test("Ctrl+F, or Cmd+F on macOS, inside the page opens the find bar, which counts the page's matches, moves through them on Enter and closes on Escape", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", {
      "/": `<!doctype html><title>${PAGE_TITLE}</title><p>Plans</p><p>Pricing plans</p><p>Docs fixture page</p>`
    });
    await openDocsAsync(app, docs);
    const view = app.window.locator(".nol-browser-page-view").filter({ visible: true });

    await view.click();
    await expect.poll(() => app.window.evaluate(() => (document.activeElement?.closest(".nol-browser-page") ?? null) !== null),
      { message: "A click in the page didn't move the window's focus into the page's document." }).toBe(true);
    await app.viewPages.pressAtAsync(docs.url("/"), "F", [MODIFIER]);
    await expect(app.window.locator(`${FIND_FIELD}:focus`)).toHaveCount(1);
    await app.window.keyboard.type("plans");

    await expect(app.window.locator(FIND_COUNT)).toHaveText("1 of 2");
    await app.window.keyboard.press("Enter");
    await expect(app.window.locator(FIND_COUNT)).toHaveText("2 of 2");
    await app.window.keyboard.press("Shift+Enter");
    await expect(app.window.locator(FIND_COUNT)).toHaveText("1 of 2");
    await app.window.keyboard.type("zz");
    await expect(app.window.locator(FIND_COUNT)).toHaveText("No matches");
    await app.window.keyboard.press("Escape");
    await expect(app.window.locator("nol-browser-find-bar")).toHaveCount(0);
  });
});
