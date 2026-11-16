/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";
import { ViewRequest } from "../fixtures/view-requests.ts";

interface ISubresourceKind {
  readonly name: string;
  readonly isSeenByPage: boolean;
  url(address: string): string;
}

interface IRefusedRow {
  readonly name: string;
  readonly kinds: readonly ISubresourceKind[];
  readonly localSites: (allowed: FixtureServer, other: FixtureServer) => readonly string[];
  readonly addresses: (allowed: FixtureServer, other: FixtureServer) => readonly string[];
}

const ALLOWED_TITLE = "Allowed";
const REFUSED = "net::ERR_BLOCKED_BY_CLIENT";
const CONTROL_FRAME = "/control";

const FETCH: ISubresourceKind = { name: "fetch", isSeenByPage: true, url: address => `http://${address}/fetch` };
const IMAGE: ISubresourceKind = { name: "image", isSeenByPage: true, url: address => `http://${address}/image` };
const SCRIPT: ISubresourceKind = { name: "script", isSeenByPage: true, url: address => `http://${address}/script` };
const FRAME: ISubresourceKind = { name: "iframe", isSeenByPage: false, url: address => `http://${address}/frame` };
const BEACON: ISubresourceKind = { name: "beacon", isSeenByPage: false, url: address => `http://${address}/beacon` };
const SOCKET: ISubresourceKind = { name: "ws", isSeenByPage: true, url: address => `ws://${address}/ws` };
const SECURE_SOCKET: ISubresourceKind = { name: "wss", isSeenByPage: true, url: address => `wss://${address}/wss` };

const EVERY_KIND: readonly ISubresourceKind[] = [FETCH, IMAGE, SCRIPT, FRAME, BEACON, SOCKET, SECURE_SOCKET];
const HTTP_KINDS: readonly ISubresourceKind[] = [FETCH, IMAGE, SCRIPT, FRAME, BEACON];

const REQUEST_SCRIPT = `
  window.requestAsync = async (name, url) => {
    const element = (tag) => new Promise(resolve => {
      const created = document.createElement(tag);
      created.onload = () => resolve("loaded");
      created.onerror = () => resolve("failed");
      created.src = url;
      document.body.append(created);
    });
    const socket = () => new Promise(resolve => {
      const opened = new WebSocket(url);
      opened.onopen = () => { opened.close(); resolve("loaded"); };
      opened.onerror = () => resolve("failed");
    });
    switch (name) {
      case "fetch": return fetch(url, { mode: "no-cors", cache: "no-store" }).then(() => "loaded", () => "failed");
      case "image": return element("img");
      case "script": return element("script");
      case "iframe": document.body.append(Object.assign(document.createElement("iframe"), { src: url })); return "started";
      case "beacon": return String(navigator.sendBeacon(url, "beacon"));
      default: return socket();
    }
  };`;

function page(body: string = ""): string {
  return `<!doctype html><title>${ALLOWED_TITLE}</title><script>${REQUEST_SCRIPT}</script>${body}`;
}

async function openAllowedAsync(app: TestApp, allowed: FixtureServer, localSites: readonly string[]): Promise<void> {
  await app.allowLocalSitesAsync(localSites);
  await app.openPageAsync(allowed.url("/"));
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the allowed page." }).toEqual([new ViewPage(allowed.url("/"), ALLOWED_TITLE)]);
}

async function requestAsync(app: TestApp, kind: ISubresourceKind, url: string): Promise<string> {
  return app.viewPages.runAsync(`window.requestAsync(${JSON.stringify(kind.name)}, ${JSON.stringify(url)})`);
}

async function expectRefusedAsync(app: TestApp, kind: ISubresourceKind, url: string, how: string, since: number, control: string): Promise<void> {
  const href = new URL(url).href;
  if (kind === FRAME) {
    await requestAsync(app, FRAME, control);
    await expect.poll(async () => (await app.viewPages.listAsync()).map(t => t.isLoading), { message: `The view never finished loading after ${how}.` }).toEqual([false]);
    const frameCommits = await app.viewPages.takeFrameCommitsAsync();
    expect(frameCommits, `The allowed control frame didn't commit beside ${how}.`).toContain(control);
    expect(frameCommits, `A subframe committed ${how}.`).not.toContain(href);
    const records = (await app.viewRequests.peekAsync()).slice(since);
    expect(records, `The main process's record doesn't show the control frame loaded beside ${how}.`).toContainEqual(new ViewRequest(control, null));
    expect(records.filter(t => t.url === href && t.error !== REFUSED), `The main process's record shows ${how} not refused.`).toEqual([]);
    return;
  }
  await expect.poll(async () => (await app.viewRequests.peekAsync()).filter(t => t.url === href).map(t => t.error),
    { message: `The main process's record never showed ${how} refused.` }).toEqual([REFUSED]);
}

const ROWS: readonly IRefusedRow[] = [
  {
    name: "Subresource on loopback",
    kinds: EVERY_KIND,
    localSites: allowed => [allowed.origin],
    addresses: (_allowed, other) => [`${other.name}:${other.port}`, `localhost:${other.port}`, `127.0.0.1:${other.port}`, `[::1]:${other.port}`]
  },
  {
    name: "Trailing dot on a refused host",
    kinds: EVERY_KIND,
    localSites: (allowed, other) => [allowed.origin, `http://localhost:${other.port}`],
    addresses: (_allowed, other) => [`localhost.:${other.port}`, `127.0.0.1.:${other.port}`, "169.254.169.254."]
  },
  {
    name: "Subresource on a private address",
    kinds: EVERY_KIND,
    localSites: allowed => [allowed.origin],
    addresses: () => ["192.168.1.1", "10.0.0.1", "[fd00::1]"]
  },
  {
    name: "Subresource on a link-local or unspecified address",
    kinds: EVERY_KIND,
    localSites: (allowed, other) => [allowed.origin, "http://169.254.169.254", `http://0.0.0.0:${other.port}`, `http://[::]:${other.port}`],
    addresses: (_allowed, other) => ["169.254.169.254", "[fe80::1]", `0.0.0.0:${other.port}`, `[::]:${other.port}`]
  }
];

async function expectFailedAsync(app: TestApp, url: string): Promise<void> {
  for (const kind of [FETCH, IMAGE, SCRIPT]) {
    const outcome = await requestAsync(app, kind, url);
    expect(outcome, `The page didn't see ${kind.name} to ${url} fail.`).toBe("failed");
    expect((await app.viewRequests.peekAsync()).filter(t => t.url === url && t.error === null), `The main process's record shows ${kind.name} to ${url} completed.`).toEqual([]);
  }
}

async function startAsync(servers: FixtureServers): Promise<{ allowed: FixtureServer; other: FixtureServer }> {
  const allowed = await servers.startAsync("allowed.localhost", { "/": page(), [CONTROL_FRAME]: page() });
  const other = await servers.startAsync("other.localhost", {});
  return { allowed, other };
}

test.describe("subresources", () => {
  for (const row of ROWS)
    test(row.name, async ({ app, servers }) => {
      const { allowed, other } = await startAsync(servers);
      await openAllowedAsync(app, allowed, row.localSites(allowed, other));

      for (const address of row.addresses(allowed, other))
        for (const kind of row.kinds) {
          const url = kind.url(address);
          const how = `${kind.name} to ${url}`;
          const since = (await app.viewRequests.peekAsync()).length;
          const outcome = await requestAsync(app, kind, url);
          if (kind.isSeenByPage)
            expect(outcome, `The page didn't see ${how} fail.`).toBe("failed");
          await expectRefusedAsync(app, kind, url, how, since, allowed.url(CONTROL_FRAME));
        }

      expect(other.requests, "The other origin's fixture server received a request.").toEqual([]);
    });

  test("Subresource redirected to a private address", async ({ app, servers }) => {
    const { allowed, other } = await startAsync(servers);
    await openAllowedAsync(app, allowed, [allowed.origin]);

    for (const kind of HTTP_KINDS) {
      const target = kind.url("192.168.1.1");
      const path = `/redirect-${kind.name}`;
      allowed.redirect(path, target);
      const how = `${kind.name} redirected to ${target}`;
      const since = (await app.viewRequests.peekAsync()).length;
      const outcome = await requestAsync(app, kind, allowed.url(path));
      if (kind.isSeenByPage)
        expect(outcome, `The page didn't see ${how} fail.`).toBe("failed");
      await expectRefusedAsync(app, kind, target, how, since, allowed.url(CONTROL_FRAME));
      await expect.poll(() => allowed.requests.map(t => t.path), { message: `The allowed server never received the first hop of ${how}.` }).toContain(path);
    }

    expect(other.requests, "The other origin's fixture server received a request.").toEqual([]);
  });

  test("Subresource on a local scheme", async ({ app, servers }) => {
    const { allowed } = await startAsync(servers);
    await openAllowedAsync(app, allowed, [allowed.origin]);

    await expectFailedAsync(app, "file:///a.png");
  });

  test("Subresource on the app's window URL", async ({ app, servers }) => {
    const { allowed } = await startAsync(servers);
    await openAllowedAsync(app, allowed, [allowed.origin]);

    await expectFailedAsync(app, app.window.url());
  });

  test("Local entry on a loopback address", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": page() });
    const local = await servers.startAsync("localhost", {});
    const addresses = [`localhost:${local.port}`, `127.0.0.1:${local.port}`];
    await openAllowedAsync(app, allowed, [allowed.origin, ...addresses.map(t => `http://${t}`)]);

    const expected: string[] = [];
    for (const address of addresses)
      for (const kind of [...HTTP_KINDS, SOCKET]) {
        const url = new URL(kind.url(address));
        await requestAsync(app, kind, url.href);
        expected.push(`${url.host}${url.pathname}`);
      }

    await expect.poll(() => local.requests.map(t => `${t.host}${t.path}`).sort(), { message: "The local entry's fixture server didn't receive each request." })
      .toEqual(expected.sort());
  });

  test("Repeated load", async ({ app, servers }) => {
    const { allowed } = await startAsync(servers);
    allowed.serve("/cached", "cached", { "cache-control": "max-age=600" });
    await openAllowedAsync(app, allowed, [allowed.origin]);

    await app.viewPages.runAsync(`fetch(${JSON.stringify(allowed.url("/cached"))}).then(t => t.text())`);
    await app.viewPages.runAsync(`fetch(${JSON.stringify(allowed.url("/cached"))}).then(t => t.text())`);

    expect(allowed.requests.filter(t => t.path === "/cached"), "The second load came from a cache.").toHaveLength(2);
    await expect.poll(() => app.viewRequests.addressesAsync(allowed.url("/cached")), { message: "The main process's record doesn't show each load's connected address." })
      .toEqual([allowed.address, allowed.address]);
  });

  test("Service worker", async ({ app, servers }) => {
    const { allowed } = await startAsync(servers);
    allowed.serve("/sw.js", "", { "content-type": "text/javascript" });
    await openAllowedAsync(app, allowed, [allowed.origin]);

    const outcome = await app.viewPages.runAsync("navigator.serviceWorker.register(\"/sw.js\").then(() => \"registered\", () => \"failed\")");

    expect(outcome, "The service worker registered.").toBe("failed");
    await expectRefusedAsync(app, FETCH, allowed.url("/sw.js"), "the service worker's script", 0, allowed.url(CONTROL_FRAME));
    expect(allowed.requests.filter(t => t.path === "/sw.js"), "The allowed server received the service worker's script.").toEqual([]);
  });
});
