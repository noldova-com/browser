/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Keys";
const VIEW = ".nol-browser-page-view";
// The app's shortcut the tests bind: a key no default of Noldova Desktop's and no key of the pane's uses, so its command runs only by it.
const SHORTCUT = "Mod+Shift+Y";
const MODIFIER = process.platform === "darwin" ? "meta" : "control";
const AGENT_MODIFIER = process.platform === "darwin" ? "Meta" : "Control";
// A page whose field has the focus from the start, and which records each key that reaches it and the field's value.
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0;height:600px"><p>${TITLE}</p>
<input id="name" aria-label="Name" autofocus>
<script>window.keys = [];
addEventListener("keydown", t => keys.push(t.key), true);</script>`;

async function openAsync(app: TestApp, docs: FixtureServer): Promise<JsonObject> {
  await app.setSettingAsync("desktop.keyBindings", { "browser.newPage": SHORTCUT });
  await app.allowLocalSitesAsync([docs.origin]);
  const bindings: JsonObject = { page: await app.openPageAsync(docs.url("/")), profileKey: TestApp.PROFILE_KEY };
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the keys page." }).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  await app.window.locator(VIEW).filter({ visible: true }).click();
  await expect.poll(() => app.window.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? ""), { message: "A click in the page didn't focus its view." }).toBe("webview");
  // The engine keeps keys from a page until its first contentful paint (Noldova Desktop's documents/WEB-VIEWS.md, "Keys from a view").
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "String(performance.getEntriesByName(\"first-contentful-paint\").length)"),
    { message: "The page never painted its content." }).toBe("1");
  await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('name').focus(); keys.length = 0; true");
  return bindings;
}

async function keysAsync(app: TestApp, docs: FixtureServer): Promise<readonly string[]> {
  const keys: string = await app.viewPages.runAtAsync(docs.url("/"), "keys.join('\\n')");
  return keys === "" ? [] : keys.split("\n");
}

// The reference the agent's snapshot gives the page's Name field.
async function fieldAsync(app: TestApp, bindings: JsonObject): Promise<string> {
  const snapshot: string = ToolReply.textsOf(await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings })).join("\n");
  const reference: string | undefined = snapshot.split("\n").map(t => /- textbox "Name" .*\[(e\d+)\]$/u.exec(t)?.[1]).find(t => !Object.isUndefined(t));
  if (Object.isUndefined(reference))
    throw new Error(`The snapshot has no Name field: ${snapshot}`);
  return reference;
}

test.describe("the person's and an agent's keys in the page", () => {
  test("the app's shortcut pressed in the page runs its command in the window, and every other key reaches the page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await openAsync(app, docs);
    const tabs = app.window.getByRole("tab");
    const count: number = await tabs.count();

    await app.viewPages.pressAtAsync(docs.url("/"), "A", []);
    await app.viewPages.pressAtAsync(docs.url("/"), "Y", [MODIFIER, "shift"]);
    await app.viewPages.pressAtAsync(docs.url("/"), "B", []);

    await expect(tabs, "The app's shortcut pressed in the page didn't run its command.").toHaveCount(count + 1);
    await expect.poll(() => keysAsync(app, docs), { message: "The page didn't get the other keys, or got the app's shortcut between them." }).toEqual(["a", "b"]);
  });

  test("an agent's key that is the app's shortcut is refused, and the person's own press of it still runs its command", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    const bindings: JsonObject = await openAsync(app, docs);
    const tabs = app.window.getByRole("tab");
    const count: number = await tabs.count();
    await app.requestAsync("agent-double.planAnswer", { action: "browser.pressKey", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "y", modifiers: [AGENT_MODIFIER, "Shift"] }, bindings });

    expect(result, "The agent's shortcut key wasn't refused.").toEqual(expect.objectContaining({ isFailure: true, code: "Refused", moduleCode: "browser.shortcutRefused" }));
    await expect(tabs, "The agent's shortcut key ran the app's command.").toHaveCount(count);
    expect(await keysAsync(app, docs), "The agent's shortcut key reached the page.").toEqual([]);
    await app.viewPages.pressAtAsync(docs.url("/"), "Y", [MODIFIER, "shift"]);
    await expect(tabs, "The person's own press of the shortcut didn't run its command after the agent's was refused.").toHaveCount(count + 1);
  });

  test("an agent's inserted text isn't checked against the app's shortcuts", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    const bindings: JsonObject = await openAsync(app, docs);
    const tabs = app.window.getByRole("tab");
    const count: number = await tabs.count();
    const field: string = await fieldAsync(app, bindings);
    await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_type", input: { reference: field, text: "Y" }, bindings });

    expect(result, `The agent's text failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('name').value"), "The agent's text didn't reach the page's field.").toBe("Y");
    await expect(tabs, "The agent's text ran the app's command.").toHaveCount(count);
  });
});
