/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const TITLE = "Typing";
const FIELD = "input.nol-browser-toolbar-field";
// A page whose field records each key that reaches the page.
const PAGE = `<!doctype html><title>${TITLE}</title><body style="margin:0;height:600px"><p>${TITLE}</p>
<input id="name" aria-label="Name">
<script>window.keys = [];
addEventListener("keydown", t => keys.push(t.key), true);</script>`;

async function openAsync(app: TestApp, docs: FixtureServer): Promise<JsonObject> {
  await app.allowLocalSitesAsync([docs.origin]);
  const bindings: JsonObject = { page: await app.openPageAsync(docs.url("/")), profileKey: TestApp.PROFILE_KEY };
  await expect.poll(() => app.viewPages.listAsync(), { message: "The view never showed the typing page." }).toEqual([new ViewPage(docs.url("/"), TITLE)]);
  // The engine keeps keys from a page until its first contentful paint (Noldova Desktop's documents/WEB-VIEWS.md, "Keys from a view").
  await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "String(performance.getEntriesByName(\"first-contentful-paint\").length)"),
    { message: "The page never painted its content." }).toBe("1");
  return bindings;
}

async function callAsync(app: TestApp, bindings: JsonObject, name: string, input: JsonObject): Promise<JsonValue> {
  const result: JsonValue = await app.requestAsync("agent-double.callTool", { name, input, bindings });
  expect(result, `${name} failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
  return result;
}

// The reference the agent's snapshot gives the page's Name field.
async function fieldAsync(app: TestApp, bindings: JsonObject): Promise<string> {
  const snapshot: string = ToolReply.textsOf(await callAsync(app, bindings, "browser_snapshot", {})).join("\n");
  const reference: string | undefined = snapshot.split("\n").map(t => /- textbox "Name" .*\[(e\d+)\]$/u.exec(t)?.[1]).find(t => !Object.isUndefined(t));
  if (Object.isUndefined(reference))
    throw new Error(`The snapshot has no Name field: ${snapshot}`);
  return reference;
}

// Presses the letter in the window, one key at a time, until the agent's call has settled, so the person's keys overlap the whole call; returns
// what was typed.
async function typeUntilSettledAsync(app: TestApp, call: Promise<JsonValue>, letter: string): Promise<string> {
  let isSettled: boolean = false;
  const settled: Promise<void> = call.then(() => {
    isSettled = true;
  }, () => {
    isSettled = true;
  });
  let typed: string = "";
  do {
    await app.window.keyboard.press(letter);
    typed += letter;
  } while (!isSettled);
  await settled;
  await call;
  return typed;
}

async function isFieldFocusedAsync(app: TestApp): Promise<boolean> {
  return app.window.evaluate((selector: string) => document.activeElement === document.querySelector(selector), FIELD);
}

test.describe("an agent's input while the person types in the window", () => {
  test("an agent's inserted text and key reach the page while the person types in the address field, which keeps the focus and every key", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    const bindings: JsonObject = await openAsync(app, docs);
    const name: string = await fieldAsync(app, bindings);
    const field = app.window.locator(FIELD);
    await field.fill("");
    await app.window.keyboard.type("abc");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });
    await app.requestAsync("agent-double.planAnswer", { action: "browser.pressKey", answer: "allowOnce" });

    const duringText: string = await typeUntilSettledAsync(app, callAsync(app, bindings, "browser_type", { reference: name, text: "Ada" }), "d");
    const afterText: boolean = await isFieldFocusedAsync(app);
    const duringKey: string = await typeUntilSettledAsync(app, callAsync(app, bindings, "browser_press_key", { key: "x" }), "g");

    expect([afterText, await isFieldFocusedAsync(app)], "The agent's input took the focus from the address field.").toEqual([true, true]);
    await expect(field, "A key the person typed didn't reach the address field.").toHaveValue(`abc${duringText}${duringKey}`);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('name').value"), "The agent's input didn't reach the page's field.").toBe("Adax");
    expect(await app.viewPages.runAtAsync(docs.url("/"), "keys.join(',')"), "A key the person typed reached the page.").toBe("x");
  });
});
