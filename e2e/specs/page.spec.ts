/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "playwright/test";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const VIEW = ".nol-browser-page-view";
const PAGE_AREA = ".nol-browser-page-area";
const STATE_HEADING = ".nol-browser-page-state-heading";
const STATE_ACTION = ".nol-browser-page-state-action";
const TAB_MENU = ".cdk-overlay-container nol-menu[data-place='desktop.tab']";
const SIZES: readonly (readonly [number, number])[] = [[1000, 760], [720, 540]];

// A page with a field and a counter its own timer moves, so a test sees that the page kept its state and kept running.
const PAGE = (title: string): string => `<!doctype html><title>${title}</title><body style="margin:0;height:3000px">`
  + "<input id=\"field\" aria-label=\"Field\"><script>window.ticks = 0; setInterval(() => ticks++, 20);</script>";

// Each shown view's address, the box of the element that holds it and the box of its page, in the window's CSS pixels; a view the pane
// hides, as it does under a failed load or a crash, stays in its element, hidden.
interface IShownView {
  readonly url: string;
  readonly host: readonly number[];
  readonly guest: readonly number[];
}

function tabOf(app: TestApp, instance: string): Locator {
  return app.window.locator(`nol-tab[data-tab-key="document/browser.page/${instance}"]`);
}

async function shownViewsAsync(window: Page): Promise<readonly IShownView[]> {
  return window.evaluate((selector: string): IShownView[] => {
    const boxOf = (element: Element): number[] => {
      const box = element.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height].map(t => Math.round(t));
    };
    const shown = [...document.querySelectorAll(selector)].map(host => [host, host.querySelector("webview")] as const)
      .filter((t): t is readonly [Element, HTMLElement] => t[1] !== null && t[1].checkVisibility({ visibilityProperty: true }));
    return shown.map(([host, guest]) => {
      // A view that moved has no address until its new page attaches, and its getURL throws until then.
      let url = "";
      try {
        url = "getURL" in guest && typeof guest.getURL === "function" ? String(guest.getURL()) : "";
      }
      catch {
        url = "";
      }
      return { url, host: boxOf(host), guest: boxOf(guest) };
    }).sort((a, b) => (a.host[0] ?? 0) - (b.host[0] ?? 0));
  }, VIEW);
}

// Each page's own size, as its script reads it, which matches its view's box only once the view has been laid out again.
async function pageSizeAsync(app: TestApp, url: string): Promise<readonly number[]> {
  return (await app.viewPages.runAtAsync(url, "innerWidth + ' ' + innerHeight")).split(" ").map(Number);
}

async function expectFollowedAsync(app: TestApp, urls: readonly string[], what: string): Promise<readonly IShownView[]> {
  await expect.poll(async () => {
    const shown = await shownViewsAsync(app.window);
    return Promise.all(shown.map(async t => [t.url, t.guest.join(" ") === t.host.join(" "), t.url !== "" && (await pageSizeAsync(app, t.url)).join(" ") === t.host.slice(2).join(" ")]));
  }, { message: `The views didn't follow their documents ${what}.` }).toEqual(urls.map(t => [t, true, true]));
  return shownViewsAsync(app.window);
}

async function openAsync(app: TestApp, docs: FixtureServer, path: string, title: string): Promise<string> {
  const instance = await app.openPageAsync(docs.url(path));
  await expect.poll(async () => (await app.viewPages.listAsync()).some(t => t.url === docs.url(path) && t.title === title && !t.isLoading)).toBe(true);
  return instance;
}

async function chooseRowAsync(window: Page, label: string, key: string = "Enter"): Promise<void> {
  for (let step = 0; step < 12; step++) {
    if ((await window.evaluate(() => document.activeElement?.textContent?.trim() ?? "")).includes(label)) {
      await window.keyboard.press(key);
      return;
    }
    await window.keyboard.press("ArrowDown");
  }
  throw new Error(`The menu has no row ${label}.`);
}

async function runTabMenuAsync(app: TestApp, instance: string, rows: readonly (readonly [string, string])[]): Promise<void> {
  await tabOf(app, instance).focus();
  await app.window.keyboard.press("Shift+F10");
  await expect(app.window.locator(TAB_MENU)).toBeVisible();
  for (const [label, key] of rows)
    await chooseRowAsync(app.window, label, key);
}

// Whether the element at the box's centre in the window belongs to the element the box is of, and that centre lies on a shown view.
async function liesOverViewAsync(window: Page, over: Locator): Promise<readonly boolean[]> {
  const box = await over.boundingBox();
  if (box === null)
    throw new Error("The element over the view has no box.");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const onTop = await over.evaluate((element: Element, point: readonly number[]): boolean => element.contains(document.elementFromPoint(point[0] ?? 0, point[1] ?? 0)), [x, y]);
  const onView = (await shownViewsAsync(window)).some(t => {
    const [left = 0, top = 0, width = 0, height = 0] = t.host;
    return x >= left && x < left + width && y >= top && y < top + height;
  });
  return [onTop, onView];
}

async function ticksAsync(app: TestApp, url: string): Promise<number> {
  return Number(await app.viewPages.runAtAsync(url, "String(ticks)"));
}

test.describe("the page's view", () => {
  test("fills its document's area as the window grows and shrinks", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One") });
    await app.allowLocalSitesAsync([docs.origin]);
    await openAsync(app, docs, "/", "One");

    for (const [width, height] of SIZES) {
      await app.resizeAsync(width, height);
      await expectFollowedAsync(app, [docs.url("/")], `at ${String(width)} by ${String(height)}`);
    }
  });

  test("follows its document to a group of its own and back, with its field and scroll kept, while the other page's view follows its own", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/one": PAGE("One"), "/two": PAGE("Two") });
    await app.allowLocalSitesAsync([docs.origin]);
    await app.resizeAsync(1000, 760);
    await openAsync(app, docs, "/two", "Two");
    const one = await openAsync(app, docs, "/one", "One");
    const full = await expectFollowedAsync(app, [docs.url("/one")], "before the split");
    await app.window.mouse.click((full[0]?.host[0] ?? 0) + 20, (full[0]?.host[1] ?? 0) + 10);
    await app.window.keyboard.type("kept");
    await app.viewPages.runAtAsync(docs.url("/one"), "scrollTo(0, 400); true");
    expect(await app.viewPages.runAtAsync(docs.url("/one"), "document.getElementById('field').value + ' ' + scrollY"), "The person's typing didn't reach the field.").toBe("kept 400");
    // A moved view gets a new page, which Noldova Desktop restores from what the page last committed to its history.
    await expect.poll(() => app.viewPages.holdsPageStateAsync(docs.url("/one"), "kept"), { message: "The page never committed the typed text." }).toBe(true);

    await runTabMenuAsync(app, one, [["Split", "ArrowRight"], ["Split right", "Enter"]]);

    const [left, right] = await expectFollowedAsync(app, [docs.url("/two"), docs.url("/one")], "after the split");
    expect([(right?.host[0] ?? 0) > (left?.host[0] ?? 0) + (left?.host[2] ?? 0) - 1, (right?.host[2] ?? 0) < (full[0]?.host[2] ?? 0)], "The split page isn't in a group to the right.")
      .toEqual([true, true]);
    await expect.poll(() => app.viewPages.runAtAsync(docs.url("/one"), "document.getElementById('field').value + ' ' + scrollY"), { message: "The page lost its field or scroll after the split." })
      .toBe("kept 400");

    await runTabMenuAsync(app, one, [["Move to previous group", "Enter"]]);

    const [back] = await expectFollowedAsync(app, [docs.url("/one")], "after the move back");
    expect(back?.host, "The page's view isn't where it was before the split.").toEqual(full[0]?.host);
    await expect.poll(() => app.viewPages.runAtAsync(docs.url("/one"), "document.getElementById('field').value + ' ' + scrollY"), { message: "The page lost its field or scroll after the move back." })
      .toBe("kept 400");
  });

  test("lies under the toolbar's menu and the clear-data dialog, which the page doesn't stop", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One") });
    await app.allowLocalSitesAsync([docs.origin]);
    await openAsync(app, docs, "/", "One");
    const url = docs.url("/");

    await app.window.locator(".nol-browser-toolbar-more").click();
    const menu = app.window.getByRole("menu");
    await expect(menu).toBeVisible();

    expect(await liesOverViewAsync(app.window, menu), "The menu isn't drawn over the view.").toEqual([true, true]);
    const beforeMenu = await ticksAsync(app, url);
    await expect.poll(() => ticksAsync(app, url), { message: "The page stopped under the menu." }).toBeGreaterThan(beforeMenu);

    await menu.getByRole("menuitem", { name: "Clear browsing data…", exact: true }).click();
    const dialog = app.window.getByRole("dialog", { name: "Clear browsing data?", exact: true });
    await expect(dialog).toBeVisible();

    expect(await liesOverViewAsync(app.window, dialog), "The dialog isn't drawn over the view.").toEqual([true, true]);
    const beforeDialog = await ticksAsync(app, url);
    await expect.poll(() => ticksAsync(app, url), { message: "The page stopped under the dialog." }).toBeGreaterThan(beforeDialog);
    await app.window.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectFollowedAsync(app, [url], "after the dialog closed");
  });
});

test.describe("the pane", () => {
  test("shows the page loading, with Stop, while its answer is held, and the page once it comes", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One"), "/slow": PAGE("Slow") });
    await app.allowLocalSitesAsync([docs.origin]);
    await openAsync(app, docs, "/", "One");
    const release = docs.hold("/slow");

    await app.viewPages.runAtAsync(docs.url("/"), "location.href = '/slow'; true");

    await expect(app.window.locator(PAGE_AREA).filter({ visible: true }), "The page area never said it was busy.").toHaveAttribute("aria-busy", "true");
    await expect(app.window.getByRole("progressbar", { name: "Loading the page", exact: true })).toBeVisible();
    await expect(app.window.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
    expect(await shownViewsAsync(app.window), "The view didn't stay shown while the page loads.").toHaveLength(1);
    release();
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/slow"), "Slow")]);
    await expect(app.window.locator(PAGE_AREA).filter({ visible: true })).not.toHaveAttribute("aria-busy", "true");
    await expect(app.window.getByRole("button", { name: "Reload", exact: true })).toBeVisible();
  });

  test("shows a load that failed, with Try again, and no view", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One") });
    const gone = await servers.startAsync("gone.localhost", { "/": PAGE("Gone") });
    await app.allowLocalSitesAsync([docs.origin, gone.origin]);
    await openAsync(app, docs, "/", "One");
    const [host, target] = [`gone.localhost:${String(gone.port)}`, gone.url("/")];
    await gone.closeAsync();

    await app.viewPages.runAtAsync(docs.url("/"), `location.href = ${JSON.stringify(target)}; true`);

    await expect(app.window.locator(STATE_HEADING)).toHaveText(`Can't reach ${host}`);
    await expect(app.window.locator(STATE_ACTION).filter({ hasText: "Try again" })).toBeVisible();
    expect(await shownViewsAsync(app.window), "The failed page's view is still shown.").toEqual([]);
  });

  test("shows a navigation the base refused, naming its origin, and no view", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One") });
    const other = await servers.startAsync("other.localhost", { "/": PAGE("Other") });
    await app.allowLocalSitesAsync([docs.origin]);
    await openAsync(app, docs, "/", "One");

    await app.viewPages.runAtAsync(docs.url("/"), `location.href = ${JSON.stringify(other.url("/"))}; true`);

    await expect(app.window.locator(STATE_HEADING)).toHaveText(`Browser doesn't open ${other.origin}`);
    expect([await shownViewsAsync(app.window), other.requests], "The refused page's view is shown, or its site got a request.").toEqual([[], []]);
  });

  test("shows a crashed page, with no view, and its Reload opens the page again", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One") });
    await app.allowLocalSitesAsync([docs.origin]);
    await openAsync(app, docs, "/", "One");

    await app.viewPages.crashAtAsync(docs.url("/"));

    await expect(app.window.locator(STATE_HEADING)).toHaveText("This page stopped working");
    expect(await shownViewsAsync(app.window), "The crashed page's view is still shown.").toEqual([]);
    await app.window.locator(STATE_ACTION).filter({ hasText: "Reload" }).click();
    await expect(app.window.locator(STATE_HEADING)).toBeHidden();
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "One")]);
    await expectFollowedAsync(app, [docs.url("/")], "after the reload");
    expect(docs.requests.map(t => t.path).filter(t => t === "/"), "The reload didn't ask for the page again.").toEqual(["/", "/"]);
  });
});
