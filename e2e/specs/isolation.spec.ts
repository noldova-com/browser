/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage, ViewSession } from "../fixtures/view-pages.ts";

const PAGE_TITLE = "Isolation";
const PROFILE_KEY = "e2e";
const OTHER_KEY = "other";
const MODULE_ID = "browser";
const PARTITIONS_FOLDER = "Partitions";
const COOKIE = "isolation";
const WRITTEN = JSON.stringify([`${COOKIE}=written`, "written", "written"]);
const EMPTY = JSON.stringify(["", null, null]);
const APP_FILE = "desktop-file://0123456789abcdef/";
const PAGE_PATHS: readonly string[] = ["/", "/other", "/cleared", "/kept"];

const APP_GLOBALS: readonly string[] = ["desktop", "require", "process", "module", "exports", "Buffer", "global", "electron", "ipcRenderer", "__dirname", "__filename", "setImmediate"];

const PAGE_SCRIPT = `
  const storeAsync = (mode, act) => new Promise((resolve, reject) => {
    const opening = indexedDB.open("isolation", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("values");
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction("values", mode);
      const request = act(transaction.objectStore("values"));
      transaction.oncomplete = () => { database.close(); resolve(request.result ?? null); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  });
  window.writeAsync = async () => {
    document.cookie = "${COOKIE}=written; Max-Age=3600; path=/";
    localStorage.setItem("${COOKIE}", "written");
    await storeAsync("readwrite", store => store.put("written", "${COOKIE}"));
    return "written";
  };
  window.readAsync = async () => JSON.stringify([document.cookie, localStorage.getItem("${COOKIE}"), await storeAsync("readonly", store => store.get("${COOKIE}"))]);
  window.loadAsync = (url) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve("loaded");
    image.onerror = () => resolve("failed");
    image.src = url;
  });
  window.candidatesAsync = async () => {
    const connection = new RTCPeerConnection();
    const addresses = [];
    const gathered = new Promise(resolve => {
      connection.onicegatheringstatechange = () => {
        if (connection.iceGatheringState === "complete")
          resolve();
      };
    });
    connection.onicecandidate = event => {
      if (event.candidate !== null && event.candidate.candidate !== "")
        addresses.push(event.candidate.candidate.split(" ")[4]);
    };
    connection.createDataChannel("isolation");
    await connection.setLocalDescription(await connection.createOffer());
    await gathered;
    for (const line of connection.localDescription.sdp.split("\\r\\n").filter(t => t.startsWith("a=candidate:")))
      addresses.push(line.split(" ")[4]);
    connection.close();
    return JSON.stringify(addresses);
  };`;

function page(): string {
  return `<!doctype html><title>${PAGE_TITLE}</title><script>${PAGE_SCRIPT}</script>`;
}

async function startAsync(app: TestApp, servers: FixtureServers): Promise<FixtureServer> {
  const allowed = await servers.startAsync("allowed.localhost", Object.fromEntries(PAGE_PATHS.map(t => [t, page()])));
  await app.allowLocalSitesAsync([allowed.origin]);
  return allowed;
}

async function openAsync(app: TestApp, url: string, profileKey: string = PROFILE_KEY): Promise<void> {
  await app.openPageAsync(url, profileKey);
  await expect.poll(() => app.viewPages.listAsync(), { message: `The view never showed ${url}.` }).toContainEqual(new ViewPage(url, PAGE_TITLE));
}

test.describe("isolation", () => {
  test("the page sees none of the app's bridge or preload globals", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));

    expect(await app.window.evaluate(() => "desktop" in globalThis), "The app's window has no desktop bridge, so the page's check proves nothing.").toBe(true);
    expect(await app.viewPages.runAsync(`JSON.stringify(${JSON.stringify(APP_GLOBALS)}.filter(t => t in globalThis))`), "The page sees the app's globals.").toBe("[]");
  });

  test("the app's own protocols refuse a request from the page", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));

    expect(await app.viewPages.runAsync(`fetch(${JSON.stringify(APP_FILE)}).then(() => "loaded", () => "failed")`), "The page fetched the app's shared-file protocol.").toBe("failed");
    expect(await app.viewPages.runAsync(`window.loadAsync(${JSON.stringify(APP_FILE)})`), "The page loaded an image from the app's shared-file protocol.").toBe("failed");
  });

  test("a page that gathers WebRTC ICE candidates learns no local or private address from them", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));

    expect(await app.viewPages.runAsync("window.candidatesAsync()"), "The page gathered ICE candidates, so a host candidate may name this computer.").toBe("[]");
  });

  test("cookies, local storage and IndexedDB written under one profile key are absent under another key and in the app's window", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));
    expect(await app.viewPages.runAtAsync(allowed.url("/"), "window.writeAsync()")).toBe("written");
    expect(await app.viewPages.runAtAsync(allowed.url("/"), "window.readAsync()"), "The page didn't keep what it wrote.").toBe(WRITTEN);

    await openAsync(app, allowed.url("/other"), OTHER_KEY);

    expect(await app.viewPages.runAtAsync(allowed.url("/other"), "window.readAsync()"), "Another profile key's page read the first key's storage.").toBe(EMPTY);
    expect(await app.viewPages.viewCookiesAsync(allowed.url("/"), allowed.origin), "The first key's session lost its cookie.").toEqual([COOKIE]);
    expect(await app.viewPages.viewCookiesAsync(allowed.url("/other"), allowed.origin), "Another key's session holds the first key's cookie.").toEqual([]);
    expect(await app.viewPages.appCookiesAsync(allowed.origin), "The app's window or default session holds the page's cookie.").toEqual([]);
  });

  test("clearing a profile key empties its storage", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));
    expect(await app.viewPages.runAsync("window.writeAsync()")).toBe("written");

    await app.window.getByRole("button", { name: "More" }).click();
    await app.window.getByText("Clear browsing data…").click();
    await app.window.locator(".nol-browser-clear-data-clear").click();

    await expect.poll(() => app.viewPages.viewCookiesAsync(allowed.url("/"), allowed.origin), { message: "Clearing the profile key never removed its cookie." }).toEqual([]);
    await app.viewPages.runAsync(`location.href = "/cleared"; "started"`);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the page after clearing." }).toEqual([new ViewPage(allowed.url("/cleared"), PAGE_TITLE)]);
    expect(await app.viewPages.runAsync("window.readAsync()"), "Clearing the profile key left its storage.").toBe(EMPTY);
  });

  test("a profile key keeps its storage across a restart of the app", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));
    expect(await app.viewPages.runAsync("window.writeAsync()")).toBe("written");

    await app.restartAsync();
    await app.allowLocalSitesAsync([allowed.origin]);
    await openAsync(app, allowed.url("/kept"));

    expect(await app.viewPages.runAtAsync(allowed.url("/kept"), "window.readAsync()"), "The profile key lost its storage across the restart.").toBe(WRITTEN);
  });

  test("the view's session is never the app's default session, and its partition's name holds the module's id and the profile key", async ({ app, servers }) => {
    const allowed = await startAsync(app, servers);
    await openAsync(app, allowed.url("/"));
    await openAsync(app, allowed.url("/other"), OTHER_KEY);

    const sessions = (await app.viewPages.sessionsAsync()).map(t => new ViewSession(t.url, t.storagePath === null ? null : path.basename(path.dirname(t.storagePath)) + "/" + path.basename(t.storagePath),
      t.isDefault, t.isWindows));

    expect(sessions).toEqual(expect.arrayContaining([
      new ViewSession(allowed.url("/"), `${PARTITIONS_FOLDER}/${MODULE_ID}.${PROFILE_KEY}`, false, false),
      new ViewSession(allowed.url("/other"), `${PARTITIONS_FOLDER}/${MODULE_ID}.${OTHER_KEY}`, false, false)
    ]));
  });
});
