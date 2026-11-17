/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PROFILE_KEY = "e2e";
const PRESS_LINE = /button "Press" \[(e\d+)\]/;

const PAGE = (title: string): string => `<!doctype html><title>${title}</title><body style="margin:0">`
  + "<button type=\"button\" style=\"position:fixed;left:0;top:0;width:300px;height:200px\">Press</button>"
  + "<form id=\"form\" method=\"post\" action=\"/posted\"></form>"
  + "<script>window.seen = []; for (const type of [\"mousedown\", \"mouseup\", \"click\"]) addEventListener(type, () => seen.push(type), true);</script>";

const NAVIGATIONS = [
  { name: "GET", path: "/next", title: "Next", script: "location.href = \"/next\"; true" },
  { name: "POST", path: "/posted", title: "Posted", script: "document.getElementById(\"form\").submit(); true" }
] as const;

async function callToolAsync(app: TestApp, bindings: JsonObject, name: string, input: JsonObject): Promise<JsonValue> {
  const result = await app.requestAsync("agent-double.callTool", { name, input, bindings });
  expect(result, `${name} failed.`).toEqual(expect.objectContaining({ isFailure: false }));
  return result;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(result: JsonValue): string {
  const content = isObject(result) ? result["content"] : undefined;
  return (Array.isArray(content) ? content : []).map((t: JsonValue) => {
    const text = isObject(t) ? t["text"] : undefined;
    return typeof text === "string" ? text : "";
  }).join("\n");
}

test.describe("a press on a hidden page", () => {
  for (const navigation of NAVIGATIONS) {
    test(`an agent's click reaches the document a hidden tab's page loaded by a ${navigation.name} navigation`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": PAGE("One"), [navigation.path]: PAGE(navigation.title) });
      await app.allowLocalSitesAsync([docs.origin]);
      const instance = await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "One")]);
      await app.window.getByRole("button", { name: "New page", exact: true }).click();
      await expect.poll(async () => (await app.viewPages.listAsync()).length).toBe(2);
      const target = docs.url(navigation.path);

      await app.viewPages.runAtAsync(docs.url("/"), navigation.script);
      await expect.poll(async () => (await app.viewPages.listAsync()).some(t => t.url === target && t.title === navigation.title && !t.isLoading)).toBe(true);
      const bindings = { page: instance, profileKey: PROFILE_KEY };
      const snapshot = textOf(await callToolAsync(app, bindings, "browser_snapshot", {}));
      const reference = PRESS_LINE.exec(snapshot)?.[1];
      if (reference === undefined)
        throw new Error(`The snapshot names no Press button: ${snapshot}`);
      await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });
      await callToolAsync(app, bindings, "browser_click", { reference });

      await expect.poll(() => app.viewPages.runAtAsync(target, "seen.join()"), { message: "The click was reported as done, but its press never reached the hidden page's document." })
        .toBe("mousedown,mouseup,click");
    });
  }
});
