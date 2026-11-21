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
const NEW_PAGE = ".nol-tab-row-command[data-command=\"browser.newPage\"]";
const HELD_NOTICE = /^.+ opened a new tab a moment ago, so this window waits here\.$/;
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0">`
  + "<a id=\"a\" href=\"/a\" style=\"display:inline-block;width:100px;height:40px\">A</a>"
  + "<a id=\"b\" href=\"/b\" style=\"display:inline-block;width:100px;height:40px\">B</a>"
  + "<a id=\"c\" href=\"/c\" target=\"_blank\">C</a>";
const SCRIPT_CTRL_CLICK = "for (let i = 0; i < 3; i++) document.getElementById(\"c\").dispatchEvent(new MouseEvent(\"click\", "
  + "{ bubbles: true, cancelable: true, ctrlKey: true, metaKey: true }))";
const TARGET = (title: string): string => `<!doctype html><title>${title}</title>`;
const HANDLERS = "<!doctype html><title>Handlers</title><body style=\"margin:0\"><div id=\"d\" style=\"width:100px;height:40px\">D</div><script>"
  + "const d = document.getElementById(\"d\");"
  + "d.addEventListener(\"auxclick\", e => { if (e.button === 1) { window.open(\"/a\"); window.open(\"/b\"); } });"
  + "d.addEventListener(\"click\", e => { if (e.ctrlKey || e.metaKey) { window.open(\"/a\"); window.open(\"/b\"); } });</script>";
const MODIFIER = process.platform === "darwin" ? "Meta" : "Control";
const PAGES = { "/": PAGE, "/handlers": HANDLERS, "/a": TARGET("A"), "/b": TARGET("B"), "/c": TARGET("C") };

async function openAsync(app: TestApp, docs: FixtureServer, path: string = "/", title: string = TITLE): Promise<{ x: number; y: number; width: number; height: number }> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url(path));
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url(path), title)]);
  await expect.poll(() => app.viewPages.runAtAsync(docs.url(path), "performance.getEntriesByName(\"first-contentful-paint\").length > 0"),
    { message: "The page never painted." }).toBe("true");
  const view = app.window.locator(VIEW).filter({ visible: true });
  await expect(view).toHaveCount(1);
  const box = await view.boundingBox();
  if (box === null)
    throw new Error("The page's view has no box.");
  return box;
}

async function tabEdgesAsync(app: TestApp): Promise<readonly number[]> {
  return app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab").evaluateAll(tabs => {
    const rem: number = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return tabs.map(t => t.getBoundingClientRect().left / rem);
  });
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
    await expect(tabs.nth(1), "The first middle click's tab isn't right after the page.").toHaveAccessibleName(`${docs.url("/a")}, Opened from ${TITLE}`);
    await expect(tabs.nth(2), "The second middle click's tab isn't right after the first.").toHaveAccessibleName(`${docs.url("/b")}, Opened from ${TITLE}`);
    const edges: readonly number[] = await tabEdgesAsync(app);
    expect(edges.every((t, i) => i === 0 || t > (edges[i - 1] ?? t)), `The tabs' left edges, ${edges.join(", ")} rem, aren't in the row's order.`).toBe(true);
    expect(await app.window.locator(VIEW).filter({ visible: true }).boundingBox(), "The page's view moved or changed size.").toEqual(box);
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane held a middle click's tab.").toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/c\"))"), "window.open gave the page a window.").toBe("null");
    await expect(app.window.locator(NOTICE_MESSAGE), "The script's new window didn't wait in the notice.").toHaveText(HELD_NOTICE);
    await expect(tabs, "The script's new window opened a tab.").toHaveCount(3);

    await tabs.nth(1).click();
    await expect.poll(() => titlesAsync(app), { message: "The first middle click's tab didn't load its link once shown." }).toEqual(["A", TITLE]);
  });

  for (const press of [{ name: "middle click", button: "middle" as const, modifier: null }, { name: "Ctrl or Cmd click", button: "left" as const, modifier: MODIFIER }]) {
    test(`a page's handler that opens two windows on the person's ${press.name} opens one tab, and its second window waits in the notice`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", PAGES);
      const box = await openAsync(app, docs, "/handlers", "Handlers");
      const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

      if (press.modifier !== null)
        await app.window.keyboard.down(press.modifier);
      await app.window.mouse.click(box.x + 50, box.y + 20, { button: press.button });
      if (press.modifier !== null)
        await app.window.keyboard.up(press.modifier);

      await expect.poll(async () => [await tabs.count(), await app.window.locator(NOTICE_MESSAGE).count()],
        { message: `The ${press.name} didn't open one tab, as [tabs, notices], with the handler's second window in the notice.` }).toEqual([2, 1]);
      await expect(app.window.locator(NOTICE_MESSAGE)).toHaveText(HELD_NOTICE);
    });
  }

  test("a script's Ctrl clicks on a link right after the person's middle click open no tab", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    const box = await openAsync(app, docs);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

    await app.window.mouse.click(box.x + 50, box.y + 20, { button: "middle" });
    await expect(tabs, "The middle click didn't open a tab.").toHaveCount(2);
    await expect(app.window.locator(NOTICE_MESSAGE)).toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), `${SCRIPT_CTRL_CLICK}; String(window.open("/c"))`)).toBe("null");

    await expect(app.window.locator(NOTICE_MESSAGE), "The script's new window didn't wait in the notice.").toHaveText(HELD_NOTICE);
    await expect(tabs, "The script's Ctrl clicks on a link opened a tab.").toHaveCount(2);
  });
});
