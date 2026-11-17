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

interface INavigationStart {
  readonly name: string;
  readonly isTopLevel: boolean;
  startAsync(app: TestApp, allowed: FixtureServer, target: string): Promise<string>;
}

interface ITargetContext {
  readonly servers: FixtureServers;
  readonly allowed: FixtureServer;
}

interface IBlockedRow {
  readonly name: string;
  readonly starts: readonly INavigationStart[];
  readonly localSites?: (context: ITargetContext) => readonly string[];
  targetsAsync(context: ITargetContext): Promise<readonly string[]>;
}

const ALLOWED_TITLE = "Allowed";
const CONTROL_FRAME = "/control";
const REFUSED = "net::ERR_BLOCKED_BY_CLIENT";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";

const NAVIGATION_MARK = "<script>window.navigationStarted = false; navigation.addEventListener(\"navigate\", () => { window.navigationStarted = true; });</script>";

function page(body: string): string {
  return `<!doctype html><title>${ALLOWED_TITLE}</title>${NAVIGATION_MARK}${body}`;
}

async function expectNavigationStartedAsync(app: TestApp, how: string): Promise<void> {
  await expect.poll(() => app.viewPages.runAsync("String(window.navigationStarted)"), { message: `The page never started the navigation for ${how}.` }).toBe("true");
}

async function expectPageAsync(app: TestApp, url: string, title: string, message: string): Promise<void> {
  await expect.poll(() => app.viewPages.listAsync(), { message }).toEqual([new ViewPage(url, title)]);
}

async function unrefusedAsync(app: TestApp, target: string, since: number): Promise<readonly string[]> {
  const url = new URL(target);
  const hrefs = [url.href];
  url.username = "";
  url.password = "";
  hrefs.push(url.href);
  return (await app.viewRequests.peekAsync()).slice(since).filter(t => hrefs.includes(t.url) && t.error !== REFUSED).map(t => `${t.url} ${t.error ?? "completed"}`);
}

// A page that navigates as it loads, as a meta refresh does, may have its navigation refused before the load ends, so the pane may show that
// refusal by the time the page is loaded.
async function goAsync(app: TestApp, allowed: FixtureServer, path: string, body: string = "", isNavigatingAsItLoads: boolean = false): Promise<string> {
  const url = allowed.url(path);
  allowed.serve(CONTROL_FRAME, page(""));
  allowed.serve(path, page(`${body}<iframe src="${allowed.url(CONTROL_FRAME)}"></iframe>`));
  await app.viewPages.runAsync(`location.href = ${JSON.stringify(url)};`);
  await expectPageAsync(app, url, ALLOWED_TITLE, `The view never loaded ${url}.`);
  if (!isNavigatingAsItLoads)
    await expect(app.window.locator(PAGE_STATE_HEADING), `The pane kept a refusal after loading ${url}.`).toHaveCount(0);
  expect(await app.viewPages.takeCommitsAsync(), `The view's commits don't show ${url} alone.`).toEqual([url]);
  return url;
}

const LINK: INavigationStart = {
  name: "a link",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    const url = await goAsync(app, allowed, "/link");
    await app.viewPages.runAsync(`{ const link = document.createElement("a"); link.href = ${JSON.stringify(target)}; document.body.append(link); link.click(); }`);
    return url;
  }
};

const FORM: INavigationStart = {
  name: "a form",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    const url = await goAsync(app, allowed, "/form");
    await app.viewPages.runAsync(`{ const form = document.createElement("form"); form.method = "post"; form.action = ${JSON.stringify(target)}; document.body.append(form); form.submit(); }`);
    return url;
  }
};

const LOCATION: INavigationStart = {
  name: "the page's script",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    const url = await goAsync(app, allowed, "/location");
    await app.viewPages.runAsync(`location.href = ${JSON.stringify(target)};`);
    return url;
  }
};

// The meta refresh page shows its own refusal as it loads, so a plain page first shows that no earlier start's refusal is left.
const META_REFRESH: INavigationStart = {
  name: "a meta refresh",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    await goAsync(app, allowed, "/before-meta");
    return goAsync(app, allowed, "/meta", `<meta http-equiv="refresh" content="0;url=${target}">`, true);
  }
};

const REDIRECT: INavigationStart = {
  name: "a server redirect",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    const url = await goAsync(app, allowed, "/before-redirect");
    allowed.redirect("/go", target);
    await app.viewPages.runAsync(`location.href = ${JSON.stringify(allowed.url("/go"))};`);
    return url;
  }
};

const SUBFRAME: INavigationStart = {
  name: "a subframe",
  isTopLevel: false,
  startAsync: async (app, allowed, target) => goAsync(app, allowed, "/frame", `<iframe src="${target}"></iframe>`)
};

const TOP_FROM_SUBFRAME: INavigationStart = {
  name: "an allowed subframe's link to the top",
  isTopLevel: true,
  startAsync: async (app, allowed, target) => {
    allowed.serve("/inner", page(`<a target="_top" href="${target}">Out</a>`));
    const url = await goAsync(app, allowed, "/frame-top", `<iframe src="${allowed.url("/inner")}"></iframe>`);
    await expect.poll(() => app.viewPages.runAsync("String(document.querySelector(\"iframe\")?.contentDocument?.querySelector(\"a\") !== null)"),
      { message: "The allowed subframe never showed its link." }).toBe("true");
    await app.viewPages.runAsync("document.querySelector(\"iframe\").contentDocument.querySelector(\"a\").click();");
    return url;
  }
};

const EVERY_START: readonly INavigationStart[] = [LINK, FORM, LOCATION, META_REFRESH, REDIRECT, SUBFRAME, TOP_FROM_SUBFRAME];

async function otherAsync(context: ITargetContext): Promise<string> {
  const other = await context.servers.startAsync("other.localhost", { "/": page("") });
  return other.url("/");
}

const ROWS: readonly IBlockedRow[] = [
  { name: "Origin not allowed", starts: [LINK], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Redirect out of the allowed origins", starts: [REDIRECT], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Meta refresh out", starts: [META_REFRESH], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Script sets the location", starts: [LOCATION], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Form submission out", starts: [FORM], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Subframe out", starts: [SUBFRAME], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Subframe navigates the top", starts: [TOP_FROM_SUBFRAME], targetsAsync: async context => [await otherAsync(context)] },
  { name: "Scheme change", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`https://${allowed.name}:${allowed.port}/`] },
  {
    name: "Port change",
    starts: EVERY_START,
    targetsAsync: async ({ servers, allowed }) => [(await servers.startAsync(allowed.name, { "/": page("") })).url("/")]
  },
  { name: "Subdomain without a wildcard", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://a.${allowed.name}:${allowed.port}/`] },
  {
    name: "Look-alike host",
    starts: EVERY_START,
    targetsAsync: async ({ servers, allowed }) => {
      const other = await servers.startAsync("other.localhost", { "/": page("") });
      return [`http://${allowed.name}.${other.name}:${other.port}/`, `http://bad${allowed.name}:${allowed.port}/`];
    }
  },
  {
    name: "Credentials",
    starts: EVERY_START,
    targetsAsync: async ({ servers, allowed }) => {
      const other = await servers.startAsync("other.localhost", { "/": page("") });
      return [`http://user@${allowed.name}:${allowed.port}/`, `http://${allowed.name}@${other.name}:${other.port}/`];
    }
  },
  { name: "Trailing dot", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://${allowed.name}.:${allowed.port}/`] },
  { name: "Punycode look-alike", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://а${allowed.name.slice(1)}:${allowed.port}/`] },
  {
    name: "IP literal for an allowed name",
    starts: EVERY_START,
    targetsAsync: async ({ allowed }) => [`http://127.0.0.1:${allowed.port}/`, `http://2130706433:${allowed.port}/`]
  },
  {
    name: "Loopback",
    starts: EVERY_START,
    targetsAsync: async ({ allowed }) => [`http://localhost:${allowed.port}/`, `http://127.0.0.1:${allowed.port}/`, `http://[::1]:${allowed.port}/`]
  },
  {
    name: "Loopback, another port",
    starts: EVERY_START,
    localSites: ({ allowed }) => [allowed.origin, `http://localhost:${allowed.port}`],
    targetsAsync: async ({ servers }) => [(await servers.startAsync("localhost", { "/": page("") })).url("/")]
  },
  {
    name: "Loopback range",
    starts: EVERY_START,
    targetsAsync: async ({ servers, allowed }) => process.platform === "darwin"
      ? [`http://127.0.0.2:${allowed.port}/`]
      : [(await servers.startAsync("127.0.0.2", { "/": page("") }, "127.0.0.2")).url("/")]
  },
  { name: "IPv4-mapped loopback", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://[::ffff:127.0.0.1]:${allowed.port}/`] },
  { name: "IPv4-compatible loopback", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://[::127.0.0.1]:${allowed.port}/`] },
  { name: "NAT64 loopback", starts: EVERY_START, targetsAsync: async ({ allowed }) => [`http://[64:ff9b::7f00:1]:${allowed.port}/`] },
  {
    name: "Private range",
    starts: EVERY_START,
    targetsAsync: async () => ["http://10.0.0.1/", "http://172.16.0.1/", "http://192.168.1.1/", "http://[fd00::1]/"]
  },
  { name: "IPv4-mapped private address", starts: EVERY_START, targetsAsync: async () => ["http://[::ffff:192.168.1.1]/"] },
  { name: "Shared address space", starts: EVERY_START, targetsAsync: async () => ["http://100.64.0.1/"] },
  {
    name: "Wildcard and a loopback name",
    starts: EVERY_START,
    localSites: ({ allowed }) => [allowed.origin, `http://*.localhost:${allowed.port}`],
    targetsAsync: async ({ allowed }) => [`http://app.localhost:${allowed.port}/`]
  },
  {
    name: "Unspecified address",
    starts: EVERY_START,
    localSites: ({ allowed }) => [allowed.origin, `http://0.0.0.0:${allowed.port}`, `http://0.1.2.3:${allowed.port}`, `http://[::]:${allowed.port}`],
    targetsAsync: async ({ allowed }) => [`http://0.0.0.0:${allowed.port}/`, `http://0.1.2.3:${allowed.port}/`, `http://[::]:${allowed.port}/`]
  },
  {
    name: "Link-local",
    starts: EVERY_START,
    localSites: ({ allowed }) => [allowed.origin, "http://169.254.169.254", "http://[fe80::1]"],
    targetsAsync: async () => ["http://169.254.169.254/", "http://[fe80::1]/"]
  },
  {
    name: "IPv4-mapped link-local",
    starts: EVERY_START,
    localSites: ({ allowed }) => [allowed.origin, "http://[::ffff:a9fe:a9fe]"],
    targetsAsync: async () => ["http://[::ffff:169.254.169.254]/"]
  }
];

test.describe("blocked origins", () => {
  for (const row of ROWS)
    test(row.name, async ({ app, servers }) => {
      const allowed = await servers.startAsync("allowed.localhost", { "/": page("") });
      const context: ITargetContext = { servers, allowed };
      const targets = await row.targetsAsync(context);
      await app.allowLocalSitesAsync(row.localSites?.(context) ?? [allowed.origin]);
      await app.openPageAsync(allowed.url("/"));
      await expectPageAsync(app, allowed.url("/"), ALLOWED_TITLE, "The view never showed the allowed page.");
      expect(await app.viewPages.takeCommitsAsync(), "The view never committed the allowed page.").toContain(allowed.url("/"));
      const allowedHost = `${allowed.name}:${allowed.port}`;

      for (const target of targets)
        for (const start of row.starts) {
          const href = new URL(target).href;
          const how = `${target} from ${start.name}`;
          await app.viewPages.takeFrameCommitsAsync();
          const since = (await app.viewRequests.peekAsync()).length;
          const stays = await start.startAsync(app, allowed, target);

          if (start.isTopLevel) {
            await expectNavigationStartedAsync(app, how);
            await expect(app.window.locator(PAGE_STATE_HEADING), `The pane didn't show the refusal of ${how}.`)
              .toHaveText(`Browser doesn't open ${new URL(target).origin}`);
          }
          const barrier = `After ${how}`;
          await app.viewPages.runAsync(`document.title = ${JSON.stringify(barrier)};`);

          await expectPageAsync(app, stays, barrier, `The view didn't stay at ${stays}, done loading, after ${how}.`);
          expect(await app.viewPages.takeCommitsAsync(), `The view committed a navigation for ${how}.`).toEqual([]);
          expect(servers.requests.filter(t => t.host !== allowedHost), `A fixture server received a request for ${how}.`).toEqual([]);
          const frameCommits = await app.viewPages.takeFrameCommitsAsync();
          expect(frameCommits, `The allowed control frame didn't commit for ${how}.`).toContain(allowed.url(CONTROL_FRAME));
          expect(frameCommits, `A subframe committed ${how}.`).not.toContain(href);
          const records = (await app.viewRequests.peekAsync()).slice(since);
          expect(records, `The main process's record doesn't show ${stays} loaded for ${how}.`).toContainEqual(new ViewRequest(stays, null));
          expect(await unrefusedAsync(app, target, since), `The main process's record shows a request for ${how} that wasn't refused.`).toEqual([]);
        }
    });

  test("History entry no longer allowed", async ({ app, servers }) => {
    const first = await servers.startAsync("first.localhost", { "/": page("") });
    const second = await servers.startAsync("second.localhost", { "/": page("") });
    await app.allowLocalSitesAsync([first.origin, second.origin]);
    await app.openPageAsync(first.url("/"));
    await expectPageAsync(app, first.url("/"), ALLOWED_TITLE, "The view never showed the first allowed page.");
    await app.viewPages.runAsync(`location.href = ${JSON.stringify(second.url("/"))};`);
    await expectPageAsync(app, second.url("/"), ALLOWED_TITLE, "The view never showed the second allowed page.");
    const firstRequests = first.requests.length;

    await app.allowLocalSitesAsync([second.origin]);
    await app.viewPages.takeCommitsAsync();
    expect(await app.viewPages.canGoBackAsync(), "The view had no history entry to go back to.").toBe(true);
    await app.viewPages.runAsync("history.back();");

    const barrier = "After going back";
    await app.viewPages.runAsync(`document.title = ${JSON.stringify(barrier)};`);
    await expectPageAsync(app, second.url("/"), barrier, "The view didn't stay at the second page, done loading, after going back.");
    expect(await app.viewPages.takeCommitsAsync(), "The view committed the history entry.").toEqual([]);
    expect(first.requests.length, "The first page's server received a request for the history entry.").toBe(firstRequests);
  });
});
