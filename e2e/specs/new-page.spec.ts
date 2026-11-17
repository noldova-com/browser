/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { Locator } from "playwright/test";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PAGE_TITLE = "Docs";
const OTHER_KEY = "other";
const PARTITION = "Partitions/browser.other";
const NEW_PAGE = ".nol-tab-row-command[data-command=\"browser.newPage\"]";
const ADDRESS_FIELD = "input.nol-browser-toolbar-field";
const SETTINGS_BUTTON = ".nol-window-row-settings";
const TOOLTIP = ".cdk-overlay-container nol-tooltip";
const NEW_PAGE_KEY = "ControlOrMeta+KeyT";
const MODIFIER = process.platform === "darwin" ? "meta" : "control";
const KEY_LABEL = process.platform === "darwin" ? "⌘T" : "Ctrl+T";

interface IButtonGeometry {
  readonly size: readonly number[];
  readonly groupButtonSize: readonly number[];
  readonly gap: number;
  readonly middleOffset: number;
  readonly isBeforeGroupButtons: boolean;
}

async function openDocsAsync(app: TestApp, docs: FixtureServer): Promise<void> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url("/"), OTHER_KEY);
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the docs page." }).toEqual([new ViewPage(docs.url("/"), PAGE_TITLE)]);
}

function geometryOf(button: Locator): Promise<IButtonGeometry> {
  return button.evaluate(t => {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const round = (pixels: number): number => Math.round(pixels / rem * 100) / 100;
    const groupButton = t.closest(".nol-tab-group-actions")?.querySelector(".nol-tab-group-menu");
    const box = t.getBoundingClientRect();
    const other = groupButton?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    return {
      size: [round(box.width), round(box.height)],
      groupButtonSize: [round(other.width), round(other.height)],
      gap: round(other.left - box.right),
      middleOffset: round(other.top + other.height / 2 - (box.top + box.height / 2)),
      isBeforeGroupButtons: groupButton instanceof Element && (t.compareDocumentPosition(groupButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    };
  });
}

async function newPageSessionsAsync(app: TestApp, docs: FixtureServer): Promise<readonly string[]> {
  return (await app.viewPages.sessionsAsync()).filter(t => t.url !== docs.url("/"))
    .map(t => t.storagePath === null ? "" : `${path.basename(path.dirname(t.storagePath))}/${path.basename(t.storagePath)}`);
}

test.describe("new page", () => {
  test("the tab row's New page button sits flush before the group's own buttons at their size, names its key, and opens an empty page at the row's end on the page's workspace, its address field focused", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": `<!doctype html><title>${PAGE_TITLE}</title><p>Docs fixture page</p>` });
    await openDocsAsync(app, docs);
    const button = app.window.locator(NEW_PAGE);
    const tabs = app.window.locator("nol-tab-group", { has: button }).getByRole("tab");

    await expect(button).toHaveCount(1);
    await expect(button).toHaveAccessibleName("New page");
    const geometry = await geometryOf(button);
    expect(geometry).toEqual(expect.objectContaining({ gap: 0, middleOffset: 0, isBeforeGroupButtons: true }));
    expect(geometry.size, "The New page button's size differs from the group's own buttons.").toEqual(geometry.groupButtonSize);
    await button.hover();
    await expect(app.window.locator(TOOLTIP)).toHaveText(`New page (${KEY_LABEL})`);
    await expect(tabs).toHaveCount(1);
    await button.click();

    await expect(tabs).toHaveCount(2);
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.last()).toHaveAccessibleName(/New tab/u);
    await expect(app.window.locator(`${ADDRESS_FIELD}:focus`)).toHaveValue("");
    await expect.poll(() => newPageSessionsAsync(app, docs), { message: "The new page's view isn't on the docs page's workspace." }).toEqual([PARTITION]);
  });

  test("Ctrl+T, or Cmd+T on macOS, opens a page from the toolbar and from inside the page, and passes through to the part that has the focus outside every page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": `<!doctype html><title>${PAGE_TITLE}</title><p>Docs fixture page</p>` });
    await openDocsAsync(app, docs);
    const tabs = app.window.locator("nol-tab-group", { has: app.window.locator(NEW_PAGE) }).getByRole("tab");
    const view = app.window.locator(".nol-browser-page-view").filter({ visible: true });

    await app.window.locator(ADDRESS_FIELD).first().focus();
    await app.window.keyboard.press(NEW_PAGE_KEY);
    await expect(tabs).toHaveCount(2);
    await expect(app.window.locator(`${ADDRESS_FIELD}:focus`)).toHaveValue("");

    await tabs.first().click();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(view, "The docs page's view didn't become the only one shown.").toHaveCount(1);
    await view.click();
    await expect.poll(() => app.window.evaluate(() => (document.activeElement?.closest(".nol-browser-page") ?? null) !== null),
      { message: "A click in the page didn't move the window's focus into the page's document." }).toBe(true);
    await app.viewPages.pressAtAsync(docs.url("/"), "T", [MODIFIER]);
    await expect(tabs).toHaveCount(3);
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

    await app.window.locator(SETTINGS_BUTTON).focus();
    await expect(app.window.locator(SETTINGS_BUTTON)).toBeFocused();
    await app.window.evaluate(() => {
      globalThis.addEventListener("keydown", event => {
        if (event.code === "KeyT")
          document.body.setAttribute("data-new-page-key", event.defaultPrevented ? "taken" : "passed");
      });
    });
    await app.window.keyboard.press(NEW_PAGE_KEY);
    await expect(app.window.locator("body")).toHaveAttribute("data-new-page-key", "passed");
    await expect(tabs).toHaveCount(3);
  });
});
