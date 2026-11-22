/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Crash";
const BUSY_TITLE = "Busy";
// A read's time limit, `Resources.stepDeadlineMilliseconds`; a call the crash didn't end would fail only then, as timed out.
const STEP_DEADLINE_MILLISECONDS = 15_000;

// A page that, once asked, names itself busy and then runs without end, so a call that needs its answer waits until the crash.
const PAGE = `<!doctype html><title>${TITLE}</title><p>Ready</p>`;
const HOLD = `setTimeout(() => { document.title = "${BUSY_TITLE}"; for (;;); }, 0); true`;
// What the base sends a view of its own accord, so no tool's own command: as it attaches, and the hold of the page's
// focus that an agent's first call on the page waits on until the agent lets the page go.
const BASE_METHODS: readonly string[] = ["Page.enable", "Page.setInterceptFileChooserDialog", "Emulation.setFocusEmulationEnabled"];
const CRASHED = { isFailure: true, code: "Unavailable", moduleCode: "browser.pageCrashed", message: "The page crashed; reload the pane." };

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

// Opens the page and reads it once while it answers, so the base holds its focus, then makes it busy and watches what the
// base sends it.
async function busyAsync(app: TestApp, docs: FixtureServer): Promise<JsonObject> {
  await app.allowLocalSitesAsync([docs.origin]);
  const bindings = { page: await app.openPageAsync(docs.url("/")), profileKey: TestApp.PROFILE_KEY };
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  const read = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings });
  expect(read, "The first read of the page failed.").toEqual(expect.objectContaining({ isFailure: false }));
  await app.viewPages.watchCommandsAtAsync(docs.url("/"));
  await app.viewPages.runAtAsync(docs.url("/"), HOLD);
  await expect.poll(() => app.viewPages.listAsync(), { message: "The page never started to run without end." })
    .toEqual([new ViewPage(docs.url("/"), BUSY_TITLE)]);
  return bindings;
}

function startAsync(app: TestApp, bindings: JsonObject, name: string, input: JsonObject): Promise<EndedCall> {
  const started = Date.now();
  return app.requestAsync("agent-double.callTool", { name, input, bindings }).then(t => new EndedCall(name, t, Date.now() - started));
}

// The commands a tool sent the busy page that have no answer yet, the base's own left out.
async function waitingAsync(app: TestApp, docs: FixtureServer): Promise<readonly string[]> {
  return (await app.viewPages.pendingCommandsAtAsync(docs.url("/"))).filter(t => !BASE_METHODS.includes(t.slice(t.indexOf(" ") + 1)));
}

function expectCrashed(call: EndedCall): void {
  expect(call.result, `${call.name} didn't end with the crash's error.`).toEqual(expect.objectContaining(CRASHED));
  expect(call.milliseconds, `${call.name} ended only at its time limit.`).toBeLessThan(STEP_DEADLINE_MILLISECONDS);
}

// A tool call that waits on the page: the tool's name and its input.
class PendingTool {
  public readonly name: string;
  public readonly input: JsonObject;

  public constructor(name: string, input: JsonObject) {
    this.name = name;
    this.input = input;
  }
}

test.describe("a crash while calls are pending", () => {
  const tools: readonly PendingTool[] = [
    new PendingTool("browser_snapshot", {}),
    new PendingTool("browser_screenshot", {}),
    new PendingTool("browser_wait_for", { text: "Never shown", timeoutMilliseconds: 20_000 })
  ];
  for (const { name, input } of tools)
    test(`a crashed view ends ${name} while its command waits on the page, with the crash's error, before its time limit`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
      const bindings = await busyAsync(app, docs);

      const ended = startAsync(app, bindings, name, input);
      await expect.poll(async () => (await waitingAsync(app, docs)).length, { message: `${name} never sent the page a command of its own that waits for its answer.` })
        .toBeGreaterThan(0);
      await app.viewPages.crashAtAsync(docs.url("/"));

      expectCrashed(await ended);
      await expect(app.viewPages.crashAtAsync(docs.url("/")), "A second kill wasn't refused.").rejects.toThrow("has already crashed");
    });

  test("a crashed view also ends the calls the module holds behind the one that waits on the page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    const bindings = await busyAsync(app, docs);

    // The module runs a page's calls one at a time, so the screenshot waits behind the snapshot until the crash.
    let isEnded = false;
    const ended: Promise<EndedCall>[] = tools.slice(0, 2).map(async ({ name, input }) => {
      const call: EndedCall = await startAsync(app, bindings, name, input);
      isEnded = true;
      return call;
    });
    await expect.poll(async () => (await waitingAsync(app, docs)).length, { message: "The snapshot never sent the page a command of its own that waits for its answer." })
      .toBeGreaterThan(0);
    expect(isEnded, "A call ended before the crash.").toBe(false);
    await app.viewPages.crashAtAsync(docs.url("/"));

    for (const call of await Promise.all(ended))
      expectCrashed(call);
  });
});
