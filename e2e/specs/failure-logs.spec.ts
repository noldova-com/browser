/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PAGE = "<!doctype html><title>Logged</title><p>Logged fixture page</p>";
const TIME = "\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z";

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("a failed test's logs", () => {
  test("views.log names each view's creation and navigation starts, and keeps the lines from before a restart", async ({ app, servers }, testInfo) => {
    const logged = await servers.startAsync("logged.localhost", { "/": PAGE, "/again": PAGE });
    await app.allowLocalSitesAsync([logged.origin]);
    await app.openPageAsync(logged.url("/"));
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the first page." }).toContainEqual(new ViewPage(logged.url("/"), "Logged"));

    await app.restartAsync();
    await app.allowLocalSitesAsync([logged.origin]);
    await app.openPageAsync(logged.url("/again"));
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the page opened after the restart." }).toContainEqual(new ViewPage(logged.url("/again"), "Logged"));
    await app.attachViewLogAsync();

    const bodies = testInfo.attachments.filter(t => t.name === "views.log").map(t => t.body?.toString("utf8") ?? "");
    expect(bodies, "The app didn't attach one views.log.").toHaveLength(1);
    const lines = bodies.join("").split("\n");
    const first = lines.findIndex(t => new RegExp(`^${TIME} view \\d+ starts ${escaped(logged.url("/"))}$`).test(t));
    const again = lines.findIndex(t => new RegExp(`^${TIME} view \\d+ starts ${escaped(logged.url("/again"))}$`).test(t));
    expect(lines.filter(t => new RegExp(`^${TIME} view \\d+ created$`).test(t)).length, `views.log names no view's creation in both runs: ${JSON.stringify(lines)}`).toBeGreaterThanOrEqual(2);
    expect(first, `views.log lost the first run's navigation start: ${JSON.stringify(lines)}`).toBeGreaterThanOrEqual(0);
    expect(again, `views.log lacks the navigation start after the restart, or puts it before the first run's: ${JSON.stringify(lines)}`).toBeGreaterThan(first);
  });

  test("views.log names each commit with its frame's process, a frame's failed load, and the renderer's end", async ({ app, servers }, testInfo) => {
    const gone = await servers.startAsync("gone.localhost", { "/": PAGE });
    const logged = await servers.startAsync("logged.localhost", { "/": `<!doctype html><title>Logged</title><iframe src="${gone.url("/")}"></iframe>` });
    await app.allowLocalSitesAsync([logged.origin, gone.origin]);
    await gone.closeAsync();
    await app.openPageAsync(logged.url("/"));
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the page." }).toContainEqual(new ViewPage(logged.url("/"), "Logged"));
    await app.viewPages.crashAtAsync(logged.url("/"));
    await expect.poll(() => app.viewPages.isCrashedAtAsync(logged.url("/")), { message: "The view's renderer never ended." }).toBe(true);
    await app.attachViewLogAsync();

    const lines = testInfo.attachments.filter(t => t.name === "views.log").map(t => t.body?.toString("utf8") ?? "").join("").split("\n");
    expect([
      lines.some(t => new RegExp(`^${TIME} view \\d+ commits ${escaped(logged.url("/"))} 200 in process \\d+$`).test(t)),
      lines.some(t => new RegExp(`^${TIME} view \\d+ fails ${escaped(gone.url("/"))} -102 ERR_CONNECTION_REFUSED in a frame$`).test(t)),
      lines.some(t => new RegExp(`^${TIME} view \\d+ renderer gone, [a-z-]+$`).test(t))
    ], `views.log lacks the page's commit, the frame's failed load or the renderer's end: ${JSON.stringify(lines)}`).toEqual([true, true, true]);
  });
});
