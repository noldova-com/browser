/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AppBrowser } from "../fixtures/app-browser.ts";
import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Links";
const VIEW = ".nol-browser-page-view";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";
const FRAME_BOX = "JSON.stringify(document.querySelector(\"iframe\").getBoundingClientRect())";
const PAGE = (frame: string): string => `<!doctype html><title>${TITLE}</title><body style="margin:0">`
  + `<iframe src="${frame}" style="display:block;width:320px;height:160px;border:0"></iframe>`;
const FRAME = (target: string): string => "<!doctype html><title>Frame</title><body style=\"margin:0\">"
  + `<a id="a" href="${target}" style="display:inline-block;width:100px;height:40px" onpointerover="document.getElementById('r').textContent='Over'">Out</a>`
  + "<div id=\"r\"></div>";

test.describe("a refused link in a frame", () => {
  test("the person's click on a link in another site's frame, to a site the workspace doesn't allow, shows the refused page in that frame, sized to it", async ({ app, servers }) => {
    test.skip(process.platform === "darwin", "On macOS a click sent to another site's frame within about 2 s of its load is lost: https://github.com/noldova-com/desktop/issues/459");
    const other = await servers.startAsync("other.localhost", { "/": "<!doctype html><title>Other</title>" });
    const framed = await servers.startAsync("framed.localhost", { "/": FRAME(other.url("/")) });
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE(framed.url("/")) });
    await app.allowLocalSitesAsync([docs.origin, framed.origin]);
    await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
    await expect.poll(() => app.viewPages.frameTextsAsync(docs.url("/")), { message: "The frame never showed its link." }).toEqual(["Out"]);
    const frameBox = await app.viewPages.runAtAsync(docs.url("/"), FRAME_BOX);
    const view = app.window.locator(VIEW).filter({ visible: true });
    const box = await view.boundingBox();
    if (box === null)
      throw new Error("The page's view has no box.");

    let step: number = 0;
    await expect.poll(async () => {
      step = 1 - step;
      await app.window.mouse.move(box.x + 50 + step, box.y + 20);
      return app.viewPages.frameTextsAsync(docs.url("/"));
    }, { message: "The frame never saw the pointer over its link." }).toEqual(["Out\nOver"]);
    await app.window.mouse.click(box.x + 50, box.y + 20);

    await expect.poll(() => app.viewPages.frameTextsAsync(docs.url("/")), { message: "The frame never showed the refusal, as the frames' texts." })
      .toEqual([expect.stringContaining(`${AppBrowser.productName}'s browser doesn't open ${other.origin}`)]);
    expect([await app.viewPages.frameTextsAsync(docs.url("/")), await app.viewPages.runAtAsync(docs.url("/"), FRAME_BOX)], "The frame's refusal lost its text or its box.")
      .toEqual([[expect.stringContaining(`Its address isn't one ${AppBrowser.productName}'s browser opens.`)], frameBox]);
    expect([await app.window.locator(PAGE_STATE_HEADING).allTextContents(), (await app.viewPages.listAsync()).map(t => t.url)], "The pane left the page for the frame's refusal.")
      .toEqual([[], [docs.url("/")]]);
    expect(servers.requests.filter(t => t.host === `${other.name}:${other.port}`), "The refused site got a request.").toEqual([]);
  });
});
