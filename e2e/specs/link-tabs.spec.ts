/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator } from "playwright/test";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Links";
const VIEW = ".nol-browser-page-view";
const NOTICE_MESSAGE = ".nol-browser-request-notice-message";
const TAB_GROUP = "nol-tab-group";
const NEW_PAGE = ".nol-tab-row-command[data-command=\"browser.newPage\"]";
const POPUP_SIGN = "button.nol-browser-toolbar-popup";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";
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

// The box of the page's view in the window, in CSS pixels.
class ViewBox {
  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;

  private constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public static async ofAsync(view: Locator): Promise<ViewBox> {
    const box = await view.boundingBox();
    if (Object.isNull(box))
      throw new Error("The page's view has no box.");
    return new ViewBox(box.x, box.y, box.width, box.height);
  }
}

// A person's press that opens a link in a new tab: its mouse button and the key held with it, if any.
class Press {
  public readonly name: string;
  public readonly button: "left" | "middle";
  public readonly modifier: string | null;

  public constructor(name: string, button: "left" | "middle", modifier: string | null) {
    this.name = name;
    this.button = button;
    this.modifier = modifier;
  }

  public async clickAsync(app: TestApp, box: ViewBox): Promise<void> {
    if (!Object.isNull(this.modifier))
      await app.window.keyboard.down(this.modifier);
    await app.window.mouse.click(box.x + 50, box.y + 20, { button: this.button });
    if (!Object.isNull(this.modifier))
      await app.window.keyboard.up(this.modifier);
  }
}

const PRESSES: readonly Press[] = [new Press("middle click", "middle", null), new Press("Ctrl or Cmd click", "left", MODIFIER)];

async function openAsync(app: TestApp, docs: FixtureServer, path: string = "/", title: string = TITLE): Promise<ViewBox> {
  await app.allowLocalSitesAsync([docs.origin]);
  await app.openPageAsync(docs.url(path));
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url(path), title)]);
  await expect.poll(() => app.viewPages.runAtAsync(docs.url(path), "performance.getEntriesByName(\"first-contentful-paint\").length > 0"),
    { message: "The page never painted." }).toBe("true");
  const view = app.window.locator(VIEW).filter({ visible: true });
  await expect(view).toHaveCount(1);
  return ViewBox.ofAsync(view);
}

// An allowed local site, with a page that links to a public origin, a `.test` name, that the workspace doesn't allow, and a page whose
// handlers open that origin with `window.open` on the person's middle or Ctrl click.
class PublicSite {
  public readonly docs: FixtureServer;
  public readonly other: FixtureServer;

  private constructor(docs: FixtureServer, other: FixtureServer) {
    this.docs = docs;
    this.other = other;
  }

  public static async startAsync(servers: FixtureServers): Promise<PublicSite> {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    const other = await servers.startAsync("public.test", { "/": TARGET("Public") });
    const target = JSON.stringify(other.url("/"));
    docs.serve("/public", `<!doctype html><title>${TITLE}</title><body style="margin:0"><a href="${other.url("/")}" style="display:inline-block;width:100px;height:40px">Public</a>`);
    docs.serve("/public-handlers", `<!doctype html><title>${TITLE}</title><body style="margin:0"><div id="d" style="width:100px;height:40px">D</div><script>`
      + "const d = document.getElementById(\"d\");"
      + `d.addEventListener("auxclick", e => { if (e.button === 1) window.open(${target}); });`
      + `d.addEventListener("click", e => { if (e.ctrlKey || e.metaKey) window.open(${target}); });</script>`);
    return new PublicSite(docs, other);
  }
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
  test("two middle clicks on links in a row open two tabs behind the page at once, each loading when shown, and a script's new window right after is blocked", async ({ app, servers }) => {
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
    expect(await ViewBox.ofAsync(app.window.locator(VIEW).filter({ visible: true })), "The page's view moved or changed size.").toEqual(box);
    await expect(app.window.locator(POPUP_SIGN), "The address bar blocked a middle click's tab.").toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/c\"))"), "window.open gave the page a window.").toBe("null");
    await expect(app.window.locator(POPUP_SIGN), "The script's new window wasn't blocked.").toHaveAccessibleName("Pop-up blocked");
    await expect(tabs, "The script's new window opened a tab.").toHaveCount(3);

    await tabs.nth(1).click();
    await expect.poll(() => titlesAsync(app), { message: "The first middle click's tab didn't load its link once shown." }).toEqual(["A", TITLE]);
  });

  for (const press of PRESSES) {
    test(`a page's handler that opens two windows on the person's ${press.name} opens one tab, and blocks its second window`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", PAGES);
      const box = await openAsync(app, docs, "/handlers", "Handlers");
      const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

      await press.clickAsync(app, box);

      await expect.poll(async () => [await tabs.count(), await app.window.locator(POPUP_SIGN).count(), await app.window.locator(NOTICE_MESSAGE).count()],
        { message: `The ${press.name} didn't open one tab, as [tabs, signs, notices], with the handler's second window blocked.` }).toEqual([2, 1, 0]);
    });
  }

  test("a blocked pop-up opens as a tab from the address bar's sign, and Always allow lets the site's next new window open with no press", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    await openAsync(app, docs);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");
    const sign = app.window.locator(POPUP_SIGN).filter({ visible: true });
    const back = async (): Promise<void> => {
      await tabs.first().click();
      await expect(tabs.first(), "The asking page's tab didn't come to the front.").toHaveAttribute("aria-selected", "true");
    };
    const choose = async (name: string): Promise<void> => {
      await sign.click();
      await app.window.locator(".nol-browser-toolbar-popup-menu button[nol-menu-item]", { hasText: name }).click();
    };

    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/a\"))")).toBe("null");
    await choose("Open the pop-up");
    await expect(tabs, "Open the pop-up didn't open a tab.").toHaveCount(2);
    await back();
    await expect(sign, "The sign stayed after its pop-up opened.").toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/b\"))")).toBe("null");
    await choose(`Always allow pop-ups from ${new URL(docs.url("/")).hostname}`);
    await expect(tabs, "Always allow didn't open the blocked pop-up.").toHaveCount(3);
    await expect.poll(async () => JSON.stringify(await app.requestAsync("desktop.readSetting", { name: "browser.popupSites" })),
      { message: "Always allow never added the site to Allow pop-ups." }).toContain(new URL(docs.url("/")).hostname);
    await back();
    expect(await app.viewPages.runAtAsync(docs.url("/"), "String(window.open(\"/c\"))")).toBe("null");

    await expect(tabs, "The allowed site's new window didn't open.").toHaveCount(4);
    await back();
    await expect(sign, "The allowed site's new window was blocked.").toHaveCount(0);
  });

  test("a script's Ctrl clicks on a link right after the person's middle click open no tab", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", PAGES);
    const box = await openAsync(app, docs);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

    await app.window.mouse.click(box.x + 50, box.y + 20, { button: "middle" });
    await expect(tabs, "The middle click didn't open a tab.").toHaveCount(2);
    await expect(app.window.locator(POPUP_SIGN)).toHaveCount(0);
    expect(await app.viewPages.runAtAsync(docs.url("/"), `${SCRIPT_CTRL_CLICK}; String(window.open("/c"))`)).toBe("null");

    await expect(app.window.locator(POPUP_SIGN), "The script's new window wasn't blocked.").toHaveAccessibleName("Pop-up blocked");
    await expect(tabs, "The script's Ctrl clicks on a link opened a tab.").toHaveCount(2);
  });

  for (const press of PRESSES)
    test(`a page's handler that opens a public site on the person's ${press.name} opens its tab, and the site doesn't join the workspace`, async ({ app, servers }) => {
      const { docs, other } = await PublicSite.startAsync(servers);
      const box = await openAsync(app, docs, "/public-handlers");
      const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");

      await press.clickAsync(app, box);

      await expect(tabs, `The handler's window on the ${press.name} didn't open a tab.`).toHaveCount(2);
      await expect(tabs.nth(1), "The tab isn't the handler's window's.").toHaveAccessibleName(`${other.url("/")}, Opened from ${TITLE}`);
      await app.viewPages.runAtAsync(docs.url("/public-handlers"), `location.href = ${JSON.stringify(other.url("/"))};`);
      await expect(app.window.locator(PAGE_STATE_HEADING), "The page's own navigation to the handler's site wasn't refused.").toHaveText(`This workspace doesn't allow ${other.origin}`);
      expect(other.requests, "The handler's site's server received a request.").toEqual([]);
    });

  test("an agent's middle click on a link to a public site the workspace doesn't allow opens no tab, and the site doesn't join the workspace", async ({ app, servers }) => {
    const { docs, other } = await PublicSite.startAsync(servers);
    await app.allowLocalSitesAsync([docs.origin]);
    const bindings = { page: await app.openPageAsync(docs.url("/public")), profileKey: TestApp.PROFILE_KEY };
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/public"), TITLE)]);
    const tabs = app.window.locator(TAB_GROUP, { has: app.window.locator(NEW_PAGE) }).getByRole("tab");
    const snapshot = ToolReply.textOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings }));
    const reference = /- link "Public"[^[]*\[(e\d+)\]/u.exec(snapshot)?.[1] ?? "";
    expect(reference, `The snapshot has no link Public: ${snapshot}`).not.toBe("");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

    const clicked = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference, button: "middle" }, bindings });

    expect(clicked, "The agent's middle click failed.").toEqual(expect.objectContaining({ isFailure: false }));
    await expect(app.window.locator(POPUP_SIGN), "The agent's middle click's new window wasn't blocked.").toHaveAccessibleName("Pop-up blocked");
    await expect(tabs, "The agent's middle click opened a tab.").toHaveCount(1);
    await app.viewPages.runAtAsync(docs.url("/public"), `location.href = ${JSON.stringify(other.url("/"))};`);
    await expect(app.window.locator(PAGE_STATE_HEADING), "The page's own navigation to the public site wasn't refused.").toHaveText(`This workspace doesn't allow ${other.origin}`);
    expect(other.requests, "The public site's server received a request.").toEqual([]);
  });
});
