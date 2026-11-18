/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
});
