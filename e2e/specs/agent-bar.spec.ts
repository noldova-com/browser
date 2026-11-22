/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "../fixtures/app-test.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const CALLS = 4;
const AGENT_BAR = "nol-browser-agent-bar";
const PAGE_AREA = ".nol-browser-page-area";

declare global {
  var pageAreaBoxes: string[] | undefined;
}

test.describe("agent bar", () => {
  test("the bar shows from an agent's first call on the page until its session ends, so the page area moves when control starts and ends, never between calls", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": "<!doctype html><title>Docs</title><p>Plans and pricing</p>" });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Docs")]);
    await app.window.locator(PAGE_AREA).filter({ visible: true }).evaluate(area => {
      // Each box the page area takes, from its first, as its top and height.
      globalThis.pageAreaBoxes = [];
      new ResizeObserver(() => {
        const box = area.getBoundingClientRect();
        globalThis.pageAreaBoxes?.push(`${box.top} ${box.height}`);
      }).observe(area);
    });
    const boxes = (): Promise<string[]> => app.window.evaluate(() => [...globalThis.pageAreaBoxes ?? []]);
    await expect.poll(boxes).toHaveLength(1);
    const [free = ""] = await boxes();

    for (let call = 0; call < CALLS; call++) {
      const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: TestApp.PROFILE_KEY } });
      expect(result, `Call ${call + 1} failed.`).toEqual(expect.objectContaining({ isFailure: false }));
      await expect(app.window.locator(AGENT_BAR), `The bar isn't shown after call ${call + 1}.`).toBeVisible();
    }
    await app.requestAsync("agent-double.endSession", null);
    await expect(app.window.locator(AGENT_BAR)).toHaveCount(0);

    // The page area moved twice in all: once as control started and once as it ended, never as a call ended.
    await expect.poll(boxes, { message: "The page area moved between calls." }).toHaveLength(3);
    const recorded = await boxes();
    expect([recorded[0], recorded[2]]).toEqual([free, free]);
    expect(recorded[1]).not.toBe(free);
  });
});
