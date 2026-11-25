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

const TITLE = "Allowed";
const PAGE = `<!doctype html><title>${TITLE}</title><p>Allowed fixture page</p>`;
const REFUSED = { isFailure: true, code: "Refused", moduleCode: "browser.originRefused" };

async function navigateAsync(app: TestApp, page: string, input: JsonObject): Promise<JsonValue> {
  return app.requestAsync("agent-double.callTool", { name: "browser_navigate", input, bindings: { page, profileKey: TestApp.PROFILE_KEY } });
}

async function questionsAsync(app: TestApp): Promise<readonly JsonValue[]> {
  const questions = await app.requestAsync("agent-double.takeQuestions", {});
  if (!Array.isArray(questions))
    throw new Error(`The agent double's asked questions aren't a list: ${JSON.stringify(questions)}`);
  return questions;
}

function pagesOf(server: FixtureServer): readonly string[] {
  return server.requests.map(t => t.path).filter(t => t !== "/favicon.ico");
}

async function expectAtAsync(app: TestApp, server: FixtureServer, message: string): Promise<void> {
  await expect.poll(() => app.viewPages.listAsync(), { message }).toEqual([new ViewPage(server.url("/"), TITLE)]);
}

// The first page, then the second, both allowed, the second loaded by the page's own script, so the view can go back to the first.
async function openBothAsync(app: TestApp, first: FixtureServer, second: FixtureServer): Promise<string> {
  await app.allowLocalSitesAsync([first.origin, second.origin]);
  const page = await app.openPageAsync(first.url("/"));
  await expectAtAsync(app, first, "The view never showed the first page.");
  await app.viewPages.runAsync(`location.href = ${JSON.stringify(second.url("/"))};`);
  await expectAtAsync(app, second, "The view never showed the second page.");
  return page;
}

// The tool refuses before it asks or loads, so the view keeps its page and commits nothing, and the target's server receives nothing.
async function expectRefusedAsync(app: TestApp, result: JsonValue, stays: FixtureServer, target: FixtureServer, before: readonly string[]): Promise<void> {
  expect(result, "The navigation didn't fail as a refused origin.").toEqual(expect.objectContaining(REFUSED));
  expect(await questionsAsync(app), "The refused navigation asked the person.").toEqual([]);
  await expectAtAsync(app, stays, "The view didn't stay at its page after the refused navigation.");
  expect(await app.viewPages.takeCommitsAsync(), "The view committed a navigation after the refusal.").toEqual([]);
  expect(pagesOf(target), "The refused origin's server received a request.").toEqual(before);
}

test.describe("navigation", () => {
  test("an allowed origin loads", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": "<!doctype html><title>Allowed</title><p>Allowed fixture page</p>" });
    await app.allowLocalSitesAsync([allowed.origin]);

    await app.openPageAsync(allowed.url("/"));

    await expect.poll(() => allowed.requests.map(t => `${t.host}${t.path}`), { message: "The allowed fixture server never received the page's request." })
      .toContain(`allowed.localhost:${allowed.port}/`);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the allowed page." }).toEqual([new ViewPage(allowed.url("/"), "Allowed")]);
  });

  test("the bridge's navigate, back, forward and reload load an allowed entry", async ({ app, servers }) => {
    const first = await servers.startAsync("first.localhost", { "/": PAGE });
    const second = await servers.startAsync("second.localhost", { "/": PAGE });
    const page = await openBothAsync(app, first, second);
    for (let i = 0; i < 4; i++)
      await app.requestAsync("agent-double.planAnswer", { action: "browser.navigate", answer: "allowOnce" });

    // Going back or forward may restore the page from the engine's cache, but a reload always asks its server.
    const moves: readonly { readonly input: JsonObject; readonly lands: FixtureServer; readonly isRequested: boolean }[] = [
      { input: { action: "back" }, lands: first, isRequested: false },
      { input: { action: "forward" }, lands: second, isRequested: false },
      { input: { action: "reload" }, lands: second, isRequested: true },
      { input: { url: first.url("/") }, lands: first, isRequested: false }
    ];
    for (const { input, lands, isRequested } of moves) {
      const before = pagesOf(lands).length;

      const result = await navigateAsync(app, page, input);

      expect(result, `${JSON.stringify(input)} failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
      await expectAtAsync(app, lands, `The view didn't show its page after ${JSON.stringify(input)}.`);
      if (isRequested)
        expect(pagesOf(lands).length, "The reload didn't reach the page's server.").toBe(before + 1);
    }
  });

  test("the bridge's navigate refuses an origin the list doesn't hold before it loads", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": PAGE });
    const other = await servers.startAsync("other.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([allowed.origin]);
    const page = await app.openPageAsync(allowed.url("/"));
    await expectAtAsync(app, allowed, "The view never showed the allowed page.");
    await app.viewPages.takeCommitsAsync();

    const result = await navigateAsync(app, page, { url: other.url("/") });

    await expectRefusedAsync(app, result, allowed, other, []);
  });

  test("the bridge's back refuses a history entry whose origin left the list", async ({ app, servers }) => {
    const first = await servers.startAsync("first.localhost", { "/": PAGE });
    const second = await servers.startAsync("second.localhost", { "/": PAGE });
    const page = await openBothAsync(app, first, second);
    const before = pagesOf(first);
    await app.allowLocalSitesAsync([second.origin]);
    await app.viewPages.takeCommitsAsync();

    const result = await navigateAsync(app, page, { action: "back" });

    await expectRefusedAsync(app, result, second, first, before);
  });

  test("the bridge's forward refuses a history entry whose origin left the list", async ({ app, servers }) => {
    const first = await servers.startAsync("first.localhost", { "/": PAGE });
    const second = await servers.startAsync("second.localhost", { "/": PAGE });
    const page = await openBothAsync(app, first, second);
    await app.viewPages.runAsync("history.back();");
    await expectAtAsync(app, first, "The view never went back to the first page.");
    const before = pagesOf(second);
    await app.allowLocalSitesAsync([first.origin]);
    await app.viewPages.takeCommitsAsync();

    const result = await navigateAsync(app, page, { action: "forward" });

    await expectRefusedAsync(app, result, first, second, before);
  });

  test("the bridge's reload refuses a page whose origin left the list", async ({ app, servers }) => {
    const allowed = await servers.startAsync("allowed.localhost", { "/": PAGE });
    const other = await servers.startAsync("other.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([allowed.origin]);
    const page = await app.openPageAsync(allowed.url("/"));
    await expectAtAsync(app, allowed, "The view never showed the page.");
    const before = pagesOf(allowed);
    await app.allowLocalSitesAsync([other.origin]);
    await app.viewPages.takeCommitsAsync();

    const result = await navigateAsync(app, page, { action: "reload" });

    await expectRefusedAsync(app, result, allowed, allowed, before);
  });
});
