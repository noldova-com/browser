/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { test as base, expect } from "playwright/test";

import { FixtureServers } from "./fixture-servers.ts";
import { LaunchSettings } from "./launch-settings.ts";
import { LoopbackGuard } from "./loopback-guard.ts";
import { RecordingProxy } from "./recording-proxy.ts";
import { TestApp } from "./test-app.ts";

export { expect } from "playwright/test";

export const test = base.extend<{ dataFiles: Readonly<Record<string, string>>; waitsForStart: boolean; expectedViolations: readonly string[]; servers: FixtureServers; loopbackProxy: RecordingProxy; app: TestApp; guard: LoopbackGuard }>({
  dataFiles: [{}, { option: true }],
  waitsForStart: [true, { option: true }],
  expectedViolations: [[], { option: true }],
  servers: async ({}, use, testInfo) => {
    const servers = new FixtureServers();
    try {
      await use(servers);
    }
    finally {
      try {
        if (testInfo.status !== testInfo.expectedStatus)
          await testInfo.attach("requests.log", { body: servers.log.join("\n"), contentType: "text/plain" });
      }
      finally {
        await servers.closeAsync();
      }
    }
  },
  loopbackProxy: async ({}, use) => {
    const proxy = await RecordingProxy.startAsync();
    try {
      await use(proxy);
      expect(proxy.take(), "The recording proxy received a request after the guard read it, while the app quit.").toEqual([]);
    }
    finally {
      await proxy.closeAsync();
    }
  },
  app: async ({ dataFiles, waitsForStart, loopbackProxy }, use, testInfo) => {
    const app = await TestApp.launchAsync(testInfo, dataFiles, LaunchSettings.forRun(loopbackProxy.address));
    try {
      if (waitsForStart)
        await app.waitForStartAsync();
      await use(app);
    }
    finally {
      try {
        if (testInfo.status !== testInfo.expectedStatus)
          await app.attachViewLogAsync();
      }
      finally {
        await app.quitAsync();
      }
    }
  },
  guard: [async ({ servers, loopbackProxy, app, expectedViolations }, use) => {
    const guard = new LoopbackGuard(servers, loopbackProxy, { takeAsync: () => app.viewRequests.takeAsync() });
    await use(guard);
    await expect.poll(() => app.viewRequests.inFlightAsync(), { message: "A view's request was still in flight at the test's end." }).toEqual([]);
    expect(await guard.takeViolationsAsync(), "The guard's violations differ from the ones the test expects.").toEqual(expectedViolations);
  }, { auto: true }]
});
