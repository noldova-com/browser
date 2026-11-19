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

const TITLE = "Links";
const VIEW = ".nol-browser-page-view";
const NOTICE_MESSAGE = ".nol-browser-request-notice-message";
const TAB_GROUP = "nol-tab-group";
// The page tabs' group is the one with the New page button in its row.
const NEW_PAGE = ".nol-tab-row-command[data-command=\"browser.newPage\"]";
const HELD_NOTICE = /^.+ opened a new tab a moment ago, so this window waits here\.$/;
// Two links side by side at the page's top left, so the person's clicks land on them at a known place.
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0">`
  + "<a id=\"a\" href=\"/a\" style=\"display:inline-block;width:100px;height:40px\">A</a>"
  + "<a id=\"b\" href=\"/b\" style=\"display:inline-block;width:100px;height:40px\">B</a>"
  + "<a id=\"c\" href=\"/c\" target=\"_blank\">C</a>";
// A click the page's script makes on a link with the Ctrl key, as if it were the person's.
const SCRIPT_CTRL_CLICK = "for (let i = 0; i < 3; i++) document.getElementById(\"c\").dispatchEvent(new MouseEvent(\"click\", "
  + "{ bubbles: true, cancelable: true, ctrlKey: true, metaKey: true }))";
const TARGET = (title: string): string => `<!doctype html><title>${title}</title>`;
const PAGES = { "/": PAGE, "/a": TARGET("A"), "/b": TARGET("B"), "/c": TARGET("C") };

// Opens the page of links and gives the place of its view in the window, once the page has painted.
async function openAsync(app: TestApp, docs: FixtureServer): Promise<{ x: number; y: number }> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url("/"));
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "performance.getEntriesByName(\"first-contentful-paint\").length > 0"),
    { message: "The page never painted." }).toBe("true");
  const view = app.window.locator(VIEW).filter({ visible: true });
  await expect(view).toHaveCount(1);
  const box = await view.boundingBox();
  if (box === null)
    throw new Error("The page's view has no box.");
  return box;
}

async function titlesAsync(app: TestApp): Promise<readonly string[]> {
  return (await app.viewPages.listAsync()).map(t => t.title).sort();
}

test.describe("tabs from the person's link clicks", () => {
  test("two middle clicks on links in a row open two tabs behind the page at once, each loading when shown, and a script's new window right after still waits in the notice", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    const box = await openAsync(app, docs);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

    await app.window.mouse.click(box.x + 50, box.y + 20, { button: "middle" });
    await app.window.mouse.click(box.x + 150, box.y + 20, { button: "middle" });

    await expect(tabs, "The two middle clicks didn't open two tabs.").toHaveCount(3);
    await expect(tabs.first(), "A middle click's tab came to the front.").toHaveAttribute("aria-selected", "true");
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane held a middle click's tab.").toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/c\"))"), "window.open gave the page a window.").toBe("null");
    await expect(app.window.locator(NOTICE_MESSAGE), "The script's new window didn't wait in the notice.").toHaveText(HELD_NOTICE);
    await expect(tabs, "The script's new window opened a tab.").toHaveCount(3);

    // A tab behind the page loads once the person shows it, since Desktop mounts a document's view only then.
    await tabs.nth(1).click();
    await expect.poll(() => titlesAsync(app), { message: "The first middle click's tab didn't load its link once shown." }).toEqual(["A", TITLE]);
  });

  test("a script's Ctrl clicks on a link right after the person's middle click open no tab", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    const box = await openAsync(app, docs);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

    await app.window.mouse.click(box.x + 50, box.y + 20, { button: "middle" });
    await expect(tabs, "The middle click didn't open a tab.").toHaveCount(2);
    await expect(app.window.locator(NOTICE_MESSAGE)).toHaveCount(0);
    // The engine may drop a script's clicks on a link or ask for a window; a script's window.open after them always asks, so its
    // notice shows that the pane heard every request before it.
    expect(await app.viewPages.runAtAsync(docs.url("/"), `${SCRIPT_CTRL_CLICK}; String(window.open("/c"))`)).toBe("null");

    await expect(app.window.locator(NOTICE_MESSAGE), "The script's new window didn't wait in the notice.").toHaveText(HELD_NOTICE);
    await expect(tabs, "The script's Ctrl clicks on a link opened a tab.").toHaveCount(2);
  });
});
