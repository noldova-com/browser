/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import { FolderChanges } from "../fixtures/folder-changes.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { TestCertificate } from "../fixtures/test-certificate.ts";
import { type AppSurfaces, ViewPage } from "../fixtures/view-pages.ts";

interface IRefusedAsk {
  readonly title: string;
  readonly attempt: string;
  readonly outcome: string;
  readonly query: string | null;
  readonly isNoticed: boolean;
}

class Before {
  public readonly surfaces: AppSurfaces;
  public readonly downloads: readonly string[];

  public constructor(surfaces: AppSurfaces, downloads: readonly string[]) {
    this.surfaces = surfaces;
    this.downloads = downloads;
  }
}

const PAGE_TITLE = "Denials";
const AGAIN_TITLE = "Denials again";
const PRIVATE_TITLE = "Private";
const DENIED = "denied";
const NOT_ALLOWED = "rejected NotAllowedError";
const NOT_FOUND = "rejected NotFoundError";
const FAVICON = "/favicon.ico";
const NOTICE_MESSAGE =".nol-browser-request-notice-message";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";
const SECURITY_MODEL = new URL("../../documents/SECURITY-MODEL.md", import.meta.url);
// Chromium writes a temporary file to the downloads folder for each download, before the app can refuse it, and removes it a few milliseconds later.
// So the check is that no file stays: it waits up to this long for the folder to be as it was.
const DOWNLOADS_SETTLE_MS = 10_000;

const PERMISSION_NOTICE = /^Site permissions, such as the camera or your location, aren't available in .+ yet\.$/;
const DOWNLOAD_NOTICE = /^Downloads aren't available in .+ yet\.$/;
const FILE_CHOOSER_NOTICE = /^Opening files from this computer isn't available in .+ yet\.$/;
const AUTHENTICATION_NOTICE = /^Sign-in dialogs aren't available in .+ yet\.$/;
const CERTIFICATE_NOTICE = /^This page's certificate wasn't accepted, so .+ didn't open it\.$/;
const POPUP_SIGN = "button.nol-browser-toolbar-popup";

const PAGE_SCRIPT = `
  window.outcomeAsync = async (attempt) => {
    try {
      return "resolved " + String(await attempt());
    }
    catch (error) {
      return "rejected " + String(error?.name);
    }
  };
  window.permissionAsync = async (descriptor) => (await navigator.permissions.query(descriptor)).state;
  window.clickAsync = (attributes) => {
    const link = Object.assign(document.createElement("a"), attributes);
    document.body.append(link);
    link.click();
    return "clicked";
  };`;

const POSITION = `new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, error => reject({ name: "PositionError " + error.code })))`;

const BLUETOOTH = `"bluetooth" in navigator ? navigator.bluetooth.requestDevice({ acceptAllDevices: true }) : Promise.reject({ name: "Absent" })`;

const REFUSED_ASKS: readonly IRefusedAsk[] = [
  { title: "the camera", attempt: "navigator.mediaDevices.getUserMedia({ video: true })", outcome: NOT_ALLOWED, query: `{ name: "camera" }`, isNoticed: true },
  { title: "the microphone", attempt: "navigator.mediaDevices.getUserMedia({ audio: true })", outcome: NOT_ALLOWED, query: `{ name: "microphone" }`, isNoticed: true },
  { title: "location", attempt: POSITION, outcome: "rejected PositionError 1", query: `{ name: "geolocation" }`, isNoticed: true },
  { title: "notifications", attempt: "Notification.requestPermission()", outcome: `resolved ${DENIED}`, query: `{ name: "notifications" }`, isNoticed: true },
  { title: "clipboard reading", attempt: "navigator.clipboard.readText()", outcome: NOT_ALLOWED, query: `{ name: "clipboard-read" }`, isNoticed: true },
  { title: "USB devices", attempt: "navigator.usb.requestDevice({ filters: [] })", outcome: NOT_FOUND, query: null, isNoticed: false },
  { title: "serial ports", attempt: "navigator.serial.requestPort()", outcome: NOT_FOUND, query: null, isNoticed: false },
  { title: "HID devices", attempt: "navigator.hid.requestDevice({ filters: [] }).then(t => t.length)", outcome: "resolved 0", query: null, isNoticed: false },
  { title: "every other permission the engine can ask for", attempt: "navigator.requestMIDIAccess({ sysex: true })", outcome: NOT_ALLOWED, query: `{ name: "midi", sysex: true }`,
    isNoticed: true },
  { title: "screen capture", attempt: "navigator.mediaDevices.getDisplayMedia({ video: true })", outcome: NOT_ALLOWED, query: null, isNoticed: true }
];

const OWN_TESTS: readonly string[] = ["Bluetooth devices", "downloads", "new windows and pop-ups", "file choosers", "authentication prompts", "certificate errors", "embedded <webview> elements"];

function documentedItems(): readonly string[] {
  const text = readFileSync(SECURITY_MODEL, "utf8");
  const start = text.indexOf("## Denied by default");
  const section = text.slice(start, text.indexOf("\n## ", start + 1));
  return section.split("\n").filter(t => t.startsWith("- ")).map(t => t.slice(2).replace(/[;.]$/, "").split(", which")[0]?.replaceAll("`", "") ?? "").sort();
}

function page(body: string = "", title: string = PAGE_TITLE): string {
  return `<!doctype html><title>${title}</title><script>${PAGE_SCRIPT}</script>${body}`;
}

async function openAsync(app: TestApp, servers: FixtureServers, body: string = ""): Promise<FixtureServer> {
  const allowed = await servers.startAsync("allowed.localhost", { "/": page(body), "/again": page(body, AGAIN_TITLE) });
  await app.allowLocalSitesAsync([allowed.origin]);
  await app.openPageAsync(allowed.url("/"));
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the allowed page." }).toEqual([new ViewPage(allowed.url("/"), PAGE_TITLE)]);
  return allowed;
}

async function openAgainAsync(app: TestApp, allowed: FixtureServer): Promise<void> {
  await app.viewPages.runAsync(`location.href = "/again"; "started"`);
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the allowed page again." }).toEqual([new ViewPage(allowed.url("/again"), AGAIN_TITLE)]);
  await expect(app.window.locator(NOTICE_MESSAGE), "The pane kept its notice after the page loaded again.").toHaveCount(0);
}

async function filesAsync(folder: string): Promise<readonly string[]> {
  return existsSync(folder) ? (await readdir(folder, { withFileTypes: true })).filter(t => t.isFile()).map(t => t.name).sort() : [];
}

async function treeAsync(folder: string): Promise<readonly string[]> {
  return existsSync(folder) ? (await readdir(folder, { recursive: true })).sort() : [];
}

async function beforeAsync(app: TestApp): Promise<Before> {
  return new Before(await app.viewPages.surfacesAsync(), await filesAsync(await app.viewPages.downloadsFolderAsync()));
}

async function expectNothingOpenedAsync(app: TestApp, before: Before, title: string): Promise<void> {
  expect(await app.viewPages.takeChoosersAsync(), `The view's session offered a device chooser for ${title}.`).toEqual([]);
  expect(await app.viewPages.surfacesAsync(), `The app's windows or contents changed after ${title}, so something may have prompted.`).toEqual(before.surfaces);
  const folder: string = await app.viewPages.downloadsFolderAsync();
  await expect.poll(async () => FolderChanges.between(before.downloads, await filesAsync(folder)), { message: `The downloads folder still differs after ${title}.`, timeout: DOWNLOADS_SETTLE_MS })
    .toEqual([]);
}

function pathsOf(server: FixtureServer): readonly string[] {
  return server.requests.map(t => t.path).filter(t => t !== FAVICON);
}

test.describe("denied by default", () => {
  test("has one test for each item of the security model's list", () => {
    expect([...REFUSED_ASKS.map(t => t.title), ...OWN_TESTS].sort()).toEqual(documentedItems());
  });

  for (const ask of REFUSED_ASKS)
    test(ask.title, async ({ app, servers }) => {
      await openAsync(app, servers);
      const before = await beforeAsync(app);

      expect(await app.viewPages.runAsync(`window.outcomeAsync(() => ${ask.attempt})`), `The page wasn't refused ${ask.title}.`).toBe(ask.outcome);

      if (ask.query !== null)
        expect(await app.viewPages.runAsync(`window.permissionAsync(${ask.query})`), `The engine doesn't report ${ask.title} as denied.`).toBe(DENIED);
      if (ask.isNoticed)
        await expect(app.window.locator(NOTICE_MESSAGE), `The pane never said it refused ${ask.title}.`).toHaveText(PERMISSION_NOTICE);
      await expectNothingOpenedAsync(app, before, ask.title);
    });

  test("Bluetooth devices", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    const before = await beforeAsync(app);

    expect(await app.viewPages.runAsync(`window.outcomeAsync(() => ${BLUETOOTH})`), "The page has Web Bluetooth.").toBe("rejected Absent");
    expect(await app.viewPages.bluetoothChoicesAsync(), "The view didn't cancel a Bluetooth device choice.").toEqual([[allowed.url("/"), true, [""]]]);
    await expectNothingOpenedAsync(app, before, "Bluetooth devices");
  });

  test("downloads", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    const name = `denied-${randomUUID()}.txt`;
    allowed.serve("/attachment", "Attachment", { "content-type": "text/plain", "content-disposition": `attachment; filename="${name}"` });
    allowed.serve("/linked", "Linked", { "content-type": "text/plain" });
    const before = await beforeAsync(app);

    await app.viewPages.runAsync(`location.href = "/attachment"; "started"`);
    await expect.poll(() => pathsOf(allowed), { message: "The view never asked for the attachment." }).toContain("/attachment");
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane never said it refused the attachment.").toHaveText(DOWNLOAD_NOTICE);
    await openAgainAsync(app, allowed);

    expect(await app.viewPages.runAsync(`window.clickAsync({ href: "/linked", download: ${JSON.stringify(name)} })`)).toBe("clicked");
    await expect.poll(() => pathsOf(allowed), { message: "The view never asked for the linked download." }).toContain("/linked");
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane never said it refused the linked download.").toHaveText(DOWNLOAD_NOTICE);

    await expectNothingOpenedAsync(app, before, "the downloads");
    expect((await filesAsync(await app.viewPages.downloadsFolderAsync())).filter(t => t.includes(name)), `A refused download wrote ${name} to the downloads folder.`).toEqual([]);
    for (const folder of [app.dataDirectory, app.deviceDirectory])
      expect((await treeAsync(folder)).filter(t => t.includes(name)), `A refused download wrote ${name} under ${folder}.`).toEqual([]);
  });

  test("new windows and pop-ups", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    const before = await beforeAsync(app);

    expect(await app.viewPages.runAsync(`String(window.open("/opened"))`), "window.open gave the page a window.").toBe("null");
    await expect(app.window.locator(POPUP_SIGN), "The address bar never offered the window.open address.").toHaveAccessibleName("Pop-up blocked");
    await expect(app.window.locator(NOTICE_MESSAGE), "A blocked pop-up showed a notice.").toHaveCount(0);
    expect(await app.viewPages.listAsync(), "window.open opened a page.").toEqual([new ViewPage(allowed.url("/"), PAGE_TITLE)]);
    await openAgainAsync(app, allowed);

    expect(await app.viewPages.runAsync(`window.clickAsync({ href: "/targeted", target: "_blank" })`)).toBe("clicked");
    await expect(app.window.locator(POPUP_SIGN), "The address bar never offered the targeted link's address.").toHaveAccessibleName("Pop-up blocked");
    expect(await app.viewPages.listAsync(), "The targeted link opened a page.").toEqual([new ViewPage(allowed.url("/again"), AGAIN_TITLE)]);

    expect(pathsOf(allowed), "A refused window asked for its address.").toEqual(["/", "/again"]);
    await expectNothingOpenedAsync(app, before, "the new windows");
  });

  test("file choosers", async ({ app, servers }) => {
    await openAsync(app, servers, `<input id="file" type="file">`);
    const before = await beforeAsync(app);

    expect(await app.viewPages.runAsync(`document.getElementById("file").click(); "clicked"`)).toBe("clicked");

    await expect(app.window.locator(NOTICE_MESSAGE), "The pane never said it refused the file chooser.").toHaveText(FILE_CHOOSER_NOTICE);
    expect(await app.viewPages.runAsync(`String(document.getElementById("file").files.length)`), "The file chooser gave the page a file.").toBe("0");
    await expectNothingOpenedAsync(app, before, "the file chooser");
  });

  test("authentication prompts", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    allowed.serve("/private", `<!doctype html><title>${PRIVATE_TITLE}</title>`, { "www-authenticate": `Basic realm="Denials"` }, 401);
    const before = await beforeAsync(app);

    await app.viewPages.runAsync(`location.href = "/private"; "started"`);

    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the refused sign-in's page." }).toEqual([new ViewPage(allowed.url("/private"), PRIVATE_TITLE)]);
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane never said it refused the sign-in.").toHaveText(AUTHENTICATION_NOTICE);
    expect(pathsOf(allowed).filter(t => t === "/private"), "The view asked for the private page again, as if it had credentials.").toEqual(["/private"]);
    await expectNothingOpenedAsync(app, before, "the sign-in");
  });

  test("certificate errors", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    const secure = await servers.startAsync("secure.localhost", { "/": page() }, undefined, await TestCertificate.createAsync("secure.localhost"));
    await app.allowLocalSitesAsync([allowed.origin, secure.origin]);
    const before = await beforeAsync(app);

    await app.viewPages.runAsync(`location.href = ${JSON.stringify(secure.url("/"))}; "started"`);

    await expect(app.window.locator(PAGE_STATE_HEADING), "The pane never showed the untrusted certificate's load as failed.").toHaveText(`Can't reach secure.localhost:${secure.port}`);
    await expect(app.window.locator(NOTICE_MESSAGE), "The pane never said it refused the certificate.").toHaveText(CERTIFICATE_NOTICE);
    expect((await app.viewPages.takeCommitsAsync()).filter(t => t.startsWith(secure.origin)), "The view committed the page with the untrusted certificate.").toEqual([]);
    expect(pathsOf(secure), "The page with the untrusted certificate was asked for.").toEqual([]);
    await expectNothingOpenedAsync(app, before, "the certificate error");
  });

  test("embedded <webview> elements", async ({ app, servers }) => {
    const allowed = await openAsync(app, servers);
    allowed.serve("/nested", page("", "Nested"));
    const before = await beforeAsync(app);

    const element = await app.viewPages.runAsync(`(() => {
      const nested = document.createElement("webview");
      nested.setAttribute("src", "/nested");
      document.body.append(nested);
      return [typeof nested.loadURL, typeof nested.getWebContentsId, String(customElements.get("webview"))].join(" ");
    })()`);

    expect(element, "The page's <webview> element is a working view.").toBe("undefined undefined undefined");
    expect(pathsOf(allowed), "The page's <webview> element asked for its page.").toEqual(["/"]);
    await expectNothingOpenedAsync(app, before, "the <webview> element");
  });
});
