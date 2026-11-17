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
});
