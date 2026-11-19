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

  test("the app's downloads folder is its own, beside its data folder, after a restart too", async ({ app }) => {
    const own: string = path.join(path.dirname(app.dataDirectory), "downloads");

    expect(await app.viewPages.downloadsFolderAsync(), "The app's downloads folder isn't its own.").toBe(own);
    await app.restartAsync();
    expect(await app.viewPages.downloadsFolderAsync(), "The restarted app's downloads folder isn't its own.").toBe(own);
  });
});
