/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Links";
const VIEW = ".nol-browser-page-view";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";
// One link at the page's top left, so the person's click lands on it at a known place.
const PAGE = (target: string): string => `<!doctype html><title>${TITLE}</title><body style="margin:0">`
  + `<a id="a" href="${target}" style="display:inline-block;width:100px;height:40px">Out</a>`;

test.describe("a refused link click", () => {
  for (const kind of [{ name: "a public site", host: "public.test" }, { name: "a site on this computer", host: "other.localhost" }])
    test(`the person's click on a link to ${kind.name} the workspace doesn't allow shows the refused state`, async ({ app, servers }) => {
      const other = await servers.startAsync(kind.host, { "/": "<!doctype html><title>Other</title>" });
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE(other.url("/")) });
      await app.allowLocalSitesAsync([docs.origin]);
      await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
      await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "performance.getEntriesByName(\"first-contentful-paint\").length > 0"),
        { message: "The page never painted." }).toBe("true");
      const view = app.window.locator(VIEW).filter({ visible: true });
      const box = await view.boundingBox();
      if (box === null)
        throw new Error("The page's view has no box.");

      await app.window.mouse.click(box.x + 50, box.y + 20);

      await expect.poll(async () => [await app.window.locator(PAGE_STATE_HEADING).allTextContents(), (await app.viewPages.listAsync()).map(t => t.url)],
        { message: "The click's refusal didn't show, as [headings, the view's address]." }).toEqual([[`Browser doesn't open ${other.origin}`], [docs.url("/")]]);
      expect(servers.requests.filter(t => t.host === `${other.name}:${other.port}`), "The refused site got a request.").toEqual([]);
    });
});
