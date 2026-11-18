/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PROFILE_KEY = "e2e";
const TITLE = "Crash";
const BUSY_TITLE = "Busy";
// A read's time limit, `Resources.stepDeadlineMilliseconds`; a call the crash didn't end would fail only then, as timed out.
const STEP_DEADLINE_MILLISECONDS = 15_000;

// A page that, once asked, names itself busy and then runs without end, so a call that needs its answer waits until the crash.
const PAGE = `<!doctype html><title>${TITLE}</title><p>Ready</p>`;
const HOLD = `setTimeout(() => { document.title = "${BUSY_TITLE}"; for (;;); }, 0); true`;

class EndedCall {
  public readonly name: string;
  public readonly result: JsonValue;
  public readonly milliseconds: number;

  public constructor(name: string, result: JsonValue, milliseconds: number) {
    this.name = name;
    this.result = result;
    this.milliseconds = milliseconds;
  }
}

test.describe("a crash while calls are pending", () => {
  test("a crashed view ends every pending call with the crash's error, before its time limit", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const bindings = { page: await app.openPageAsync(docs.url("/")), profileKey: PROFILE_KEY };
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
    await app.viewPages.runAtAsync(docs.url("/"), HOLD);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The page never started to run without end." })
      .toEqual([new ViewPage(docs.url("/"), BUSY_TITLE)]);

    const calls: readonly [string, JsonObject][] = [
      ["browser_snapshot", {}],
      ["browser_screenshot", {}],
      ["browser_wait_for", { text: "Never shown", timeoutMilliseconds: 20_000 }]
    ];
    const ended: Promise<EndedCall>[] = calls.map(async ([name, input]) => {
      const started = Date.now();
      const result = await app.requestAsync("agent-double.callTool", { name, input, bindings });
      return new EndedCall(name, result, Date.now() - started);
    });
    await app.viewPages.crashAtAsync(docs.url("/"));

    for (const call of await Promise.all(ended)) {
      expect(call.result, `${call.name} didn't end with the crash's error.`).toEqual(expect.objectContaining({ isFailure: true, code: "Unavailable",
        moduleCode: "browser.pageCrashed", message: "The page crashed; reload the pane." }));
      expect(call.milliseconds, `${call.name} ended only at its time limit.`).toBeLessThan(STEP_DEADLINE_MILLISECONDS);
    }
  });
});
