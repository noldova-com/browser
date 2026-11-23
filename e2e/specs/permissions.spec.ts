/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer, FixtureServers } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const START_TITLE = "Start";
const PUBLIC_TITLE = "Public";
const REFUSED = "net::ERR_BLOCKED_BY_CLIENT";
const PAGE_STATE_HEADING = ".nol-browser-page-state-heading";
const LEAVE_OPTIONS: readonly string[] = ["AllowAlways", "Deny", "DenyAlways"];
// A page that opens a WebSocket to an address and waits for it to close; the fixture servers end each socket at its upgrade, so none stays
// open, and the server's record of the upgrade shows whether the socket reached it.
const START = `<!doctype html><title>${START_TITLE}</title><script>
window.socketAsync = url => new Promise(resolve => {
  const socket = new WebSocket(url);
  socket.onclose = () => resolve("closed");
});</script>`;
const PUBLIC = `<!doctype html><title>${PUBLIC_TITLE}</title><p>Public page</p>`;

// The start page is a local site the workspace allows, and the other is a public origin, a `.test` name, that it doesn't.
class Origins {
  public readonly start: FixtureServer;
  public readonly public: FixtureServer;
  public readonly bindings: JsonObject;

  private constructor(start: FixtureServer, other: FixtureServer, bindings: JsonObject) {
    this.start = start;
    this.public = other;
    this.bindings = bindings;
  }

  public static async openAsync(app: TestApp, servers: FixtureServers): Promise<Origins> {
    const start = await servers.startAsync("start.localhost", { "/": START });
    const other = await servers.startAsync("public.test", { "/": PUBLIC });
    await app.allowLocalSitesAsync([start.origin]);
    const bindings = { page: await app.openPageAsync(start.url("/")), profileKey: TestApp.PROFILE_KEY };
    await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the start page." }).toEqual([new ViewPage(start.url("/"), START_TITLE)]);
    return new Origins(start, other, bindings);
  }
}

class DenyCase {
  public readonly answer: string;
  public readonly decision: string;
  public readonly isKept: boolean;

  public constructor(answer: string, decision: string, isKept: boolean) {
    this.answer = answer;
    this.decision = decision;
    this.isKept = isKept;
  }
}

const DENIALS: readonly DenyCase[] = [new DenyCase("deny", "Denied", false), new DenyCase("denyAlways", "DeniedAlways", true)];

async function navigateAsync(app: TestApp, origins: Origins, answer: string): Promise<JsonValue> {
  await app.requestAsync("agent-double.planAnswer", { action: "browser.navigate", answer });
  return app.requestAsync("agent-double.callTool", { name: "browser_navigate", input: { url: origins.public.url("/") }, bindings: origins.bindings });
}

async function questionsAsync(app: TestApp): Promise<readonly JsonValue[]> {
  const questions = await app.requestAsync("agent-double.takeQuestions", {});
  if (!Array.isArray(questions))
    throw new Error(`The agent double's asked questions aren't a list: ${JSON.stringify(questions)}`);
  return questions;
}

function leaving(origins: Origins, decision: string): JsonObject {
  const host = `${origins.public.name}:${origins.public.port}`;
  return { action: "browser.navigate", subject: origins.public.origin, title: `Open ${host}`, risk: "Medium", options: [...LEAVE_OPTIONS], decision };
}

async function socketAsync(app: TestApp, origins: Origins): Promise<readonly string[]> {
  const url = `ws://${origins.public.name}:${origins.public.port}/ws`;
  await app.viewPages.runAsync(`window.socketAsync(${JSON.stringify(url)})`);
  return origins.public.requests.map(t => t.path).filter(t => t === "/ws");
}

// The page's own navigation to the public origin, which the pane shows as the workspace's refusal, in place of the agent's denied one.
async function expectPageRefusedAsync(app: TestApp, origins: Origins, how: string): Promise<void> {
  const host = `${origins.public.name}:${origins.public.port}`;
  await expect(app.window.locator(PAGE_STATE_HEADING), `The pane didn't show the agent's denied navigation ${how}.`).toHaveText(`A teammate can't open ${host}`);
  await app.viewPages.runAsync(`location.href = ${JSON.stringify(origins.public.url("/"))};`);
  await expect(app.window.locator(PAGE_STATE_HEADING), `The pane didn't show the refusal of the page's own navigation ${how}.`)
    .toHaveText(`This workspace doesn't allow ${origins.public.origin}`);
  const barrier = `After the page's navigation ${how}`;
  await app.viewPages.runAsync(`document.title = ${JSON.stringify(barrier)};`);
  await expect.poll(() => app.viewPages.listAsync(), { message: `The view didn't stay at the start page, done loading, ${how}.` })
    .toEqual([new ViewPage(origins.start.url("/"), barrier)]);
}

test.describe("permissions", () => {
  test("A public origin the person allows for the workspace loads, and the workspace keeps it", async ({ app, servers }) => {
    const origins = await Origins.openAsync(app, servers);
    expect(await socketAsync(app, origins), "The start page's WebSocket reached the public origin before it was allowed.").toEqual([]);

    // The agent's load shows the person's answer; back at the start page, its socket and its own navigation show that the workspace kept the origin.
    const result = await navigateAsync(app, origins, "allowAlways");

    expect(result, `The agent's load of the allowed public origin failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(await questionsAsync(app), "The navigation didn't ask to open the public origin, once.").toEqual([expect.objectContaining(leaving(origins, "AllowedAlways"))]);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The agent's load didn't show the public page." }).toEqual([new ViewPage(origins.public.url("/"), PUBLIC_TITLE)]);
    await app.viewPages.runAsync(`location.href = ${JSON.stringify(origins.start.url("/"))};`);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The page's navigation back to the start page didn't load." }).toEqual([new ViewPage(origins.start.url("/"), START_TITLE)]);
    expect(await socketAsync(app, origins), "The start page's WebSocket didn't reach the allowed public origin.").toEqual(["/ws"]);
    await app.viewPages.runAsync(`location.href = ${JSON.stringify(origins.public.url("/"))};`);
    await expect.poll(() => app.viewPages.listAsync(), { message: "The page's own navigation to the allowed public origin didn't load." })
      .toEqual([new ViewPage(origins.public.url("/"), PUBLIC_TITLE)]);

    expect(origins.public.requests.map(t => t.path), "The public origin's server didn't receive the loads and the WebSocket.").toEqual(expect.arrayContaining(["/", "/ws"]));
    expect((await app.viewRequests.peekAsync()).filter(t => new URL(t.url).host === `${origins.public.name}:${origins.public.port}` && t.error === REFUSED)
      .map(t => t.url), "The main process refused a request to the allowed public origin.").toEqual([`ws://${origins.public.name}:${origins.public.port}/ws`]);
  });

  for (const { answer, decision, isKept } of DENIALS)
    test(`A public origin the person answers with ${answer} stays refused`, async ({ app, servers }) => {
      const origins = await Origins.openAsync(app, servers);

      const result = await navigateAsync(app, origins, answer);

      expect(result, "The navigation didn't fail as denied.").toEqual(expect.objectContaining({ isFailure: true, code: "Denied" }));
      expect(await questionsAsync(app), "The navigation didn't ask to open the public origin, once.").toEqual([expect.objectContaining(leaving(origins, decision))]);
      await expectPageRefusedAsync(app, origins, `after ${answer}`);
      expect(await socketAsync(app, origins), `The start page's WebSocket reached the public origin after ${answer}.`).toEqual([]);

      // A kept denial answers the next request itself, so the answer planned for it is never taken.
      const again = await navigateAsync(app, origins, isKept ? "allowAlways" : "deny");

      expect(again, "The second navigation didn't fail as denied.").toEqual(expect.objectContaining({ isFailure: true, code: "Denied" }));
      expect(await questionsAsync(app), isKept ? "The kept denial asked again." : "The second navigation didn't ask again, once.")
        .toEqual(isKept ? [] : [expect.objectContaining(leaving(origins, "Denied"))]);
      expect(origins.public.requests, `The public origin's server received a request after ${answer}.`).toEqual([]);
    });
});
