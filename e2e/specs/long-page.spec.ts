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
// A note field above the list has the focus, and the page adds its status line half a second after it loads.
const PAGE = "<!doctype html><title>Long page</title><input aria-label=\"Note\" autofocus><ul>"
  + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`
  + "<script>setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<p>Order <b>placed</b></p>'), 500)</script>";

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
  test("a key goes to the focused field, which the person is asked about, on a page whose accessibility tree passes the reply limit", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);
    await expect.poll(() => app.viewPages.runAtAsync(docs.url("/"), "document.activeElement?.tagName ?? ''")).toBe("INPUT");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.pressKey", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "a" }, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, `The key failed: ${textsOf(result).join(" | ")}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.querySelector('input').value")).toBe("a");
    expect(JSON.stringify(await app.requestAsync("agent-double.takeQuestions", {}))).toContain("\"Field\"");
  });

  test("a wait for a field's value isn't met, and one for text the page adds later is, on a page whose accessibility tree passes the reply limit", async ({ app, servers }) => {
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
