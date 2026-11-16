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

export const test = base.extend<{ dataFiles: Readonly<Record<string, string>>; waitsForStart: boolean; servers: FixtureServers; loopbackProxy: RecordingProxy; app: TestApp; guard: LoopbackGuard }>({
  dataFiles: [{}, { option: true }],
  waitsForStart: [true, { option: true }],
  servers: async ({}, use) => {
    const servers = new FixtureServers();
    try {
      await use(servers);
    }
    finally {
      await servers.closeAsync();
    }
  },
  loopbackProxy: async ({}, use) => {
    const proxy = await RecordingProxy.startAsync();
    try {
      await use(proxy);
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
      await app.quitAsync();
    }
  },
  guard: [async ({ servers, loopbackProxy, app }, use) => {
    const guard = new LoopbackGuard(servers, loopbackProxy, app.viewRequests);
    await use(guard);
    expect(await guard.takeViolationsAsync(), "A view's request left loopback.").toEqual([]);
  }, { auto: true }]
});
