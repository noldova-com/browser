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

const TITLE = "Docs";
const VIEW = ".nol-browser-page-view";
const FIELD = "input.nol-browser-toolbar-field";
const MODIFIER = process.platform === "darwin" ? "meta" : "control";
const PAGE = (title: string): string => `<!doctype html><title>${title}</title><body style="margin:0;height:600px"><p>${title}</p>`
  + "<script>window.escapes = 0; addEventListener(\"keydown\", t => { if (t.key === \"Escape\") window.escapes++; });</script>";

async function openAsync(app: TestApp, docs: FixtureServer): Promise<void> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url("/"));
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the docs page." }).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  await app.window.locator(VIEW).filter({ visible: true }).click();
  await expect.poll(() => app.window.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? ""), { message: "A click in the page didn't focus its view." }).toBe("webview");
  // The engine keeps keys from a page until its first contentful paint (Noldova Desktop's documents/WEB-VIEWS.md, "Keys from a view").
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "String(performance.getEntriesByName(\"first-contentful-paint\").length)"),
    { message: "The page never painted its content." }).toBe("1");
}

test.describe("the pane's keys from its page", () => {
  test("Ctrl+L, or Cmd+L on macOS, in the page focuses the address field with its whole address selected, though the app binds the same key to a command", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE(TITLE) });
    await app.setSettingAsync("desktop.keyBindings", { "browser.newPage": "Mod+L" });
    await openAsync(app, docs);
    const tabs = app.window.getByRole("tab");
    const count: number = await tabs.count();

    await app.viewPages.pressAtAsync(docs.url("/"), "L", [MODIFIER]);

    await expect(app.window.locator(`${FIELD}:focus`), "Ctrl+L in the page didn't focus the address field.").toHaveCount(1);
    expect(await app.window.locator(FIELD).evaluate((t: HTMLInputElement) => [t.selectionStart, t.selectionEnd, t.value.length]), "The field's address isn't all selected.")
      .toEqual([0, docs.url("/").length, docs.url("/").length]);
    await expect(tabs, "The app's command on the same key ran in the page.").toHaveCount(count);
  });

  test("Escape in the page stops a loading page without reaching it", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE(TITLE), "/slow": PAGE("Slow") });
    await openAsync(app, docs);
    const release = docs.hold("/slow");
    await app.viewPages.runAtAsync(docs.url("/"), "location.href = '/slow'; true");
    await expect(app.window.getByRole("button", { name: "Stop", exact: true }), "The page never showed it was loading.").toBeVisible();

    await app.viewPages.pressAtAsync(docs.url("/"), "Escape", []);

    await expect(app.window.getByRole("button", { name: "Reload", exact: true }), "Escape in the page didn't stop its load.").toBeVisible();
    release();
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.escapes)"), "The page got the Escape that stopped its load.").toBe("0");
  });

  test("Escape in a loaded page reaches the page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE(TITLE) });
    await openAsync(app, docs);

    await app.viewPages.pressAtAsync(docs.url("/"), "Escape", []);

    await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "String(window.escapes)"), { message: "Escape didn't reach the loaded page." }).toBe("1");
    await expect(app.window.getByRole("button", { name: "Reload", exact: true }), "Escape in a loaded page changed the toolbar.").toBeVisible();
  });

  test("Shift+F6 in the page moves the focus to the pane's toolbar, and F6 there moves it back to the page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE(TITLE) });
    await openAsync(app, docs);

    await app.viewPages.pressAtAsync(docs.url("/"), "F6", ["shift"]);
    await expect.poll(() => app.window.evaluate(() => document.activeElement?.closest("nol-browser-toolbar") instanceof Element),
      { message: "Shift+F6 in the page didn't move the focus to the pane's toolbar." }).toBe(true);
    await app.window.keyboard.press("F6");

    await expect.poll(() => app.window.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? ""), { message: "F6 in the toolbar didn't move the focus back to the page." }).toBe("webview");
  });
});
