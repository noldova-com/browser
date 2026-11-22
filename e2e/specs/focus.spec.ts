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

const TITLE = "Docs";
const VIEW = ".nol-browser-page-view";
const ADDRESS_FIELD = "input.nol-browser-toolbar-field";
// A page with a field at its top left, and a text that paints, that records the field's focus and blur.
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0"><input id="field" style="display:block;width:200px;height:30px;margin:0;box-sizing:border-box"><p>${TITLE}</p>`
  + "<script>window.seen = []; const field = document.getElementById(\"field\");"
  + " for (const name of [\"focus\", \"blur\"]) field.addEventListener(name, () => seen.push(`field ${name}`));</script>";

// One of the pane's own controls the person clicks, what the person's typing then leaves in it, and whether it is unavailable; the address
// field's accessible name is the address it shows, so it is found by its class.
class PaneControl {
  public readonly name: string;
  public readonly typed: string | null;
  public readonly isUnavailable: boolean;
  private readonly locate: (window: Page) => Locator;

  public constructor(name: string, typed: string | null, isUnavailable: boolean, locate: (window: Page) => Locator) {
    this.name = name;
    this.typed = typed;
    this.isUnavailable = isUnavailable;
    this.locate = locate;
  }

  public in(app: TestApp): Locator {
    return this.locate(app.window);
  }
}

// A click on the address field selects its whole address, so typing replaces it; the page toolbar's Forward, unavailable with no page to go
// forward to, takes the focus and does nothing with keys.
const CONTROLS: readonly PaneControl[] = [new PaneControl("the address field", "cd", false, t => t.locator(ADDRESS_FIELD)),
  new PaneControl("Forward", null, true, t => t.getByRole("toolbar", { name: "Page", exact: true }).getByRole("button", { name: "Forward", exact: true }))];

async function openAsync(app: TestApp, docs: FixtureServer): Promise<void> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url("/"));
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the docs page." }).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  // The engine keeps keys from a page until its first contentful paint (Noldova Desktop's documents/WEB-VIEWS.md, "Keys from a view").
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "String(performance.getEntriesByName(\"first-contentful-paint\").length)"),
    { message: "The page never painted its content." }).toBe("1");
  // Playwright turns on focus emulation in every page it attaches to, the view's page too, so the page would read itself as focused and its
  // field would get no blur; it is turned off so the page's own focus state is the engine's.
  await expect.poll(() => guestAsync(app, docs), { message: "Playwright never attached to the view's page." }).not.toBeNull();
  const guest = await guestAsync(app, docs);
  if (Object.isNull(guest))
    throw new Error("The view's page is gone.");
  const session = await app.application.context().newCDPSession(guest);
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
}

async function guestAsync(app: TestApp, docs: FixtureServer): Promise<Page | null> {
  return app.application.context().pages().find(t => t.url() === docs.url("/")) ?? null;
}

async function windowFocusAsync(app: TestApp): Promise<string> {
  return app.window.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? "");
}

// Whether the page reads itself as focused, and the field's focus and blur it saw.
async function pageFocusAsync(app: TestApp, docs: FixtureServer): Promise<string> {
  return app.viewPages.runAtAsync(docs.url("/"), "`${String(document.hasFocus())} ${seen.join()}`");
}

async function fieldAsync(app: TestApp, docs: FixtureServer): Promise<string> {
  return app.viewPages.runAtAsync(docs.url("/"), "document.getElementById(\"field\").value");
}

// The person's own press on the page's field, through the window's mouse at the view, as a click in the window reaches the page.
async function clickFieldAsync(app: TestApp): Promise<void> {
  const box = await app.window.locator(VIEW).filter({ visible: true }).boundingBox();
  if (Object.isNull(box))
    throw new Error("The page's view has no box.");
  await app.window.mouse.click(box.x + 20, box.y + 15);
}

// The click moved the window's focus to the page's view, the page's field took it, and the person's typing reaches that field.
async function expectTypingInPageAsync(app: TestApp, docs: FixtureServer, text: string, how: string): Promise<void> {
  await expect.poll(() => windowFocusAsync(app), { message: `The window's focus didn't move to the page's view ${how}.` }).toBe("webview");
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "document.activeElement?.id ?? \"\""), { message: `The page's field didn't take the focus ${how}.` })
    .toBe("field");
  const address = await app.window.locator(ADDRESS_FIELD).inputValue();
  await app.window.keyboard.type(text);
  await expect.poll(() => fieldAsync(app, docs), { message: `The person's typing didn't reach the page's field ${how}.` }).toBe(text);
  expect(await app.window.locator(ADDRESS_FIELD).inputValue(), `The person's typing in the page changed the address field ${how}.`).toBe(address);
}

async function clearFieldAsync(app: TestApp, docs: FixtureServer): Promise<void> {
  await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById(\"field\").value = \"\"; true");
}

test.describe("focus between the page and the pane", () => {
  test("A person's click in the page moves the focus from the address field into the page's field, where their typing goes", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await openAsync(app, docs);
    const address = app.window.locator(ADDRESS_FIELD);
    await address.click();
    await expect(address, "A click on the address field didn't focus it.").toBeFocused();

    await clickFieldAsync(app);

    await expectTypingInPageAsync(app, docs, "ab", "on a click in the page");
    expect(await pageFocusAsync(app, docs), "The page didn't take the focus, or its field didn't take it once.").toBe("true field focus");
  });

  for (const control of CONTROLS)
    test(`A person's click on ${control.name} moves the focus back out of the page, and their typing with it`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
      await openAsync(app, docs);
      await clickFieldAsync(app);
      await expectTypingInPageAsync(app, docs, "ab", "on a click in the page");
      await clearFieldAsync(app, docs);
      const target = control.in(app);

      // An unavailable button, marked aria-disabled, still takes the person's click and the focus, which Playwright's check that a control is
      // enabled would refuse.
      await target.click({ force: control.isUnavailable });

      await expect(target, `${control.name} didn't take the focus.`).toBeFocused();
      expect(await windowFocusAsync(app), `The window's focus stayed on the page's view after a click on ${control.name}.`).not.toBe("webview");
      await app.window.keyboard.type("cd");
      if (!Object.isNull(control.typed))
        await expect(target, `The person's typing didn't reach ${control.name}.`).toHaveValue(control.typed);
      await expect(target, `${control.name} lost the focus to the person's typing.`).toBeFocused();
      expect(await fieldAsync(app, docs), `The person's typing after a click on ${control.name} reached the page.`).toBe("");
      await expect.poll(() => pageFocusAsync(app, docs), { message: `The page kept the focus, or its field got no blur, after a click on ${control.name}.` })
        .toBe("false field focus,field blur");

      await clickFieldAsync(app);

      await expectTypingInPageAsync(app, docs, "ef", `on a second click in the page, after ${control.name}`);
      expect(await pageFocusAsync(app, docs), `The page or its field didn't take the focus back after ${control.name}.`).toBe("true field focus,field blur,field focus");
    });
});
