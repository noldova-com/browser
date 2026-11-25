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

const TITLE = "Frames";
const READING = "/reading";
const HELD = "/held";
const UNREADABLE = /^unreadable: /u;
const PAGE = (frame: string): string => `<!doctype html><title>${TITLE}</title><body style="margin:0">`
  + `<iframe src="${frame}" style="display:block;width:320px;height:160px;border:0"></iframe>`;
const FRAME = "<!doctype html><title>Frame</title><body>Inside</body>";
// Tells the frame's own server that the read reached the frame, and never answers, so only the read's guard can end it.
const NEVER_ANSWERS = `fetch(${JSON.stringify(READING)}); new Promise(() => {})`;
const MOVE_FRAME = (url: string): string => `document.querySelector("iframe").src = ${JSON.stringify(url)}; "moved"`;
const REMOVE_FRAME = "document.querySelector(\"iframe\").remove(); \"removed\"";

class FramedPage {
  public readonly docs: FixtureServer;
  public readonly framed: FixtureServer;

  public constructor(docs: FixtureServer, framed: FixtureServer) {
    this.docs = docs;
    this.framed = framed;
  }

  public get url(): string {
    return this.docs.url("/");
  }

  public static async openAsync(app: TestApp, docs: FixtureServer, framed: FixtureServer, origins: readonly string[]): Promise<FramedPage> {
    await app.allowLocalSitesAsync([docs.origin, framed.origin, ...origins]);
    await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync(), { message: "The page never opened." }).toEqual([new ViewPage(docs.url("/"), TITLE)]);
    await expect.poll(() => app.viewPages.frameTextsAsync(docs.url("/")), { message: "The frame never showed its text." }).toEqual(["Inside"]);
    return new FramedPage(docs, framed);
  }

  // Waits until the frame runs the read that never answers.
  public async readStartedAsync(): Promise<void> {
    await expect.poll(() => this.framed.requests.some(t => t.path === READING), { message: "The read never reached the frame." }).toBe(true);
  }
}

test.describe("a read of a frame", () => {
  test("gives way, as unreadable, when the frame is removed during the read", async ({ app, servers }) => {
    const framed = await servers.startAsync("framed.localhost", { "/": FRAME });
    const page = await FramedPage.openAsync(app, await servers.startAsync("docs.localhost", { "/": PAGE(framed.url("/")) }), framed, []);

    const read = app.viewPages.frameResultsAsync(page.url, NEVER_ANSWERS);
    await page.readStartedAsync();
    await app.viewPages.runAtAsync(page.url, REMOVE_FRAME);

    expect(await read, "The read of the removed frame didn't give way.").toEqual([expect.stringMatching(UNREADABLE)]);
  });

  test("gives way, as unreadable, when a navigation under way in the frame fails during the read", async ({ app, servers }) => {
    const framed = await servers.startAsync("framed.localhost", { "/": FRAME });
    const failing = await servers.startAsync("failing.localhost", { "/": FRAME, [HELD]: FRAME });
    const page = await FramedPage.openAsync(app, await servers.startAsync("docs.localhost", { "/": PAGE(framed.url("/")) }), framed, [failing.origin]);
    failing.hold(HELD);
    await app.viewPages.runAtAsync(page.url, MOVE_FRAME(failing.url(HELD)));
    await expect.poll(() => failing.requests.some(t => t.path === HELD), { message: "The frame never asked for the held page." }).toBe(true);

    const read = app.viewPages.frameResultsAsync(page.url, NEVER_ANSWERS);
    await page.readStartedAsync();
    await failing.closeAsync();

    expect(await read, "The read of the frame whose navigation failed didn't give way.").toEqual([expect.stringMatching(UNREADABLE)]);
  });

  test("gives way, as unreadable, when a navigation under way in the frame commits during the read", async ({ app, servers }) => {
    const framed = await servers.startAsync("framed.localhost", { "/": FRAME });
    const next = await servers.startAsync("next.localhost", { "/": FRAME, [HELD]: FRAME });
    const page = await FramedPage.openAsync(app, await servers.startAsync("docs.localhost", { "/": PAGE(framed.url("/")) }), framed, [next.origin]);
    const release = next.hold(HELD);
    await app.viewPages.runAtAsync(page.url, MOVE_FRAME(next.url(HELD)));
    await expect.poll(() => next.requests.some(t => t.path === HELD), { message: "The frame never asked for the held page." }).toBe(true);

    const read = app.viewPages.frameResultsAsync(page.url, NEVER_ANSWERS);
    await page.readStartedAsync();
    release();

    expect(await read, "The read of the frame whose navigation committed didn't give way.").toEqual([expect.stringMatching(UNREADABLE)]);
  });
});
