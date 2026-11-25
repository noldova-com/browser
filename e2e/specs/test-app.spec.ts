/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { expect, test } from "../fixtures/app-test.ts";
import { LaunchSettings } from "../fixtures/launch-settings.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { DownloadSession } from "../fixtures/view-pages.ts";

test.describe("the test app", () => {
  test("a quit after the app has closed doesn't ask Playwright for the closed app", async ({ loopbackProxy }, testInfo) => {
    const app = await TestApp.launchAsync(testInfo, {}, LaunchSettings.forRun(loopbackProxy.address));
    // The command line's quit finds the app only once its runtime is running, which the start's end shows.
    await app.waitForStartAsync();
    await app.quitAsync();
    await app.closedAsync();

    const failure: unknown = await app.quitAsync().then(() => null, (error: unknown) => error);

    expect(failure, "The second quit asked Playwright for the app it had already closed.").not.toBeInstanceOf(TypeError);
  });

  test("a resize to a size the screen's work area has no room for fails at once on macOS, naming that area", async ({ app }) => {
    test.skip(process.platform !== "darwin", "Windows and Linux let a window grow past the screen's work area.");
    const failure: unknown = await app.resizeAsync(20000, 20000).then(() => null, (error: unknown) => error);

    expect(String(failure), "The resize didn't fail for a size beyond the screen.").toMatch(/has no room for a window whose page is 20000 by 20000[\s\S]*Received: \D*\d+ by \d+/);
  });

  test("the app's downloads folder is its own, beside its data folder, and a page's session downloads there, one the restart restores too", async ({ app, servers }) => {
    const own: string = path.join(path.dirname(app.dataDirectory), "downloads");
    const site = await servers.startAsync("allowed.localhost", { "/": "<!doctype html><title>Kept</title>" });
    await app.allowLocalSitesAsync([site.origin]);
    await app.openPageAsync(site.url("/"));
    await expect.poll(() => app.viewPages.downloadSessionsAsync(), { message: "The page's view never opened." }).toEqual([new DownloadSession(site.url("/"), true)]);
    const folder: string = await app.viewPages.downloadsFolderAsync();

    await app.restartAsync();

    await expect.poll(() => app.viewPages.downloadSessionsAsync(), { message: "The restored page's session doesn't download to the app's own folder." })
      .toEqual([new DownloadSession(site.url("/"), true)]);
    expect([folder, await app.viewPages.downloadsFolderAsync()], "The app's downloads folder isn't its own.").toEqual([own, own]);
  });
});
