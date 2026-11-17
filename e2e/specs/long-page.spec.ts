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
const SECTIONS = 400;
const SECTION_NAME_LENGTH = 4_000;

// Each link's name is long, so the page's whole accessibility tree passes Noldova Desktop's 4 MiB reply limit with few nodes to lay out.
// A note field in a form above the list has the focus, and a status line after the list splits its text between two elements.
const PAGE = "<!doctype html><title>Long page</title><form action=\"/sent\"><input aria-label=\"Note\" autofocus></form><ul>"
  + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`
  + "<p>Order <b>placed</b></p>";

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textsOf(result: JsonValue): string[] {
  const content = isObject(result) ? result["content"] : undefined;
  return (Array.isArray(content) ? content : []).map((t: JsonValue) => {
    const text = isObject(t) ? t["text"] : undefined;
    return typeof text === "string" ? text : "";
  });
}

test.describe("keys and waits on a long page", () => {
  test("a key goes to the focused field, and an Enter there is asked about as submitting its form, on a page whose accessibility tree passes the reply limit", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);
    await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "document.activeElement?.tagName ?? ''")).toBe("INPUT");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.pressKey", answer: "allowOnce" });
    await app.requestAsync("agent-double.planAnswer", { action: "browser.pressKey", answer: "deny" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "a" }, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, `The key failed: ${textsOf(result).join(" | ")}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.querySelector('input').value")).toBe("a");
    await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "Enter" }, bindings: { page: instance, profileKey: PROFILE_KEY } });
    // Only a key on a field the tool found focused, in a form, is asked about as submitting it.
    const asked = await app.requestAsync("agent-double.takeQuestions", {});
    const titles = (Array.isArray(asked) ? asked : []).map((t: JsonValue) => isObject(t) ? t["title"] : undefined);
    const host = new URL(docs.origin).host;
    expect(titles).toEqual([`Press a on ${host}`, `Submit a form on ${host}`]);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "location.pathname")).toBe("/");
  });

  test("a wait for a field's value isn't met, and one for text the page shows across two elements is, on a page whose accessibility tree passes the reply limit", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);
    await app.viewPages.runAtAsync(docs.url("/"), "document.querySelector('input').value = 'typed-secret'; 'set'");

    const value = await app.requestAsync("agent-double.callTool", { name: "browser_wait_for", input: { text: "typed-secret", timeoutMilliseconds: 1_000 },
      bindings: { page: instance, profileKey: PROFILE_KEY } });
    const result = await app.requestAsync("agent-double.callTool", { name: "browser_wait_for", input: { text: "Order placed", timeoutMilliseconds: 10_000 },
      bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, `The wait failed: ${textsOf(result).join(" | ")}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(textsOf(result)).toContain("The wait was met.");
    expect(textsOf(value)).toContain("The wait wasn't met in 1000 ms.");
  });
});
