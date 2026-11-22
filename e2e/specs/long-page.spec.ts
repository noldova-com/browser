/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import { TestApp } from "../fixtures/test-app.ts";
import { ToolReply } from "../fixtures/tool-reply.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const SECTIONS = 400;
const SECTION_NAME_LENGTH = 4_000;

// Each link's name is long, so the page's whole accessibility tree passes Noldova Desktop's 4 MiB reply limit with few nodes to lay out.
// A note field in a form above the list has the focus, and a status line after the list splits its text between two elements.
const PAGE = "<!doctype html><title>Long page</title><form action=\"/sent\"><input aria-label=\"Note\" autofocus></form><ul>"
  + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`
  + "<p>Order <b>placed</b></p>";

const ROWS = 400;
const ROW_DATA_LENGTH = 12_000;

// The document's whole tree passes Noldova Desktop's 4 MiB reply limit through its rows' long data attributes, which the accessibility tree
// leaves out, so a snapshot still reads it.
// The checkout form's PIN field sits in a closed shadow root, so only a read of the form that pierces closed shadow roots finds its secret.
const LONG_DOCUMENT = "<!doctype html><title>Long document</title><h2 id=\"checkout-name\">Checkout</h2>"
  + "<form aria-labelledby=\"checkout-name\" action=\"/sent\"><div id=\"pin\"></div><button>Pay</button></form><a id=\"first\" href=\"#rows\">First link</a>"
  + "<script>document.getElementById('pin').attachShadow({ mode: 'closed' }).innerHTML = '<input type=\"password\" aria-label=\"PIN\">';</script>"
  + `<div id="rows"><script>document.write(Array.from({ length: ${ROWS} }, () => '<div data-row="' + 'x'.repeat(${ROW_DATA_LENGTH}) + '"></div>').join(''))</script></div>`;

function isObject(value: JsonValue | undefined): value is JsonObject {
  return Object.isPlainObject(value);
}

function referenceOf(snapshot: string, line: RegExp): string {
  const reference = line.exec(snapshot)?.[1];
  if (Object.isUndefined(reference))
    throw new Error(`The snapshot names no element for ${String(line)}: ${snapshot.slice(0, 2_000)}`);
  return reference;
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

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "a" }, bindings: { page: instance, profileKey: TestApp.PROFILE_KEY } });

    expect(result, `The key failed: ${ToolReply.textsOf(result).join(" | ")}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.querySelector('input').value")).toBe("a");
    await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "Enter" }, bindings: { page: instance, profileKey: TestApp.PROFILE_KEY } });
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
      bindings: { page: instance, profileKey: TestApp.PROFILE_KEY } });
    const result = await app.requestAsync("agent-double.callTool", { name: "browser_wait_for", input: { text: "Order placed", timeoutMilliseconds: 10_000 },
      bindings: { page: instance, profileKey: TestApp.PROFILE_KEY } });

    expect(result, `The wait failed: ${ToolReply.textsOf(result).join(" | ")}`).toEqual(expect.objectContaining({ isFailure: false }));
    expect(ToolReply.textsOf(result)).toContain("The wait was met.");
    expect(ToolReply.textsOf(value)).toContain("The wait wasn't met in 1000 ms.");
  });

  test("a click on a link, a click that submits a form with a secret field and a key on a focused link are asked about with their risk as on a short page, on a page whose document passes the reply limit", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": LONG_DOCUMENT });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    const bindings = { page: instance, profileKey: TestApp.PROFILE_KEY };
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long document")]);
    for (const action of ["browser.click", "browser.click", "browser.pressKey"])
      await app.requestAsync("agent-double.planAnswer", { action, answer: "deny" });
    const shown = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings });
    expect(shown, `The snapshot failed: ${JSON.stringify(shown).slice(0, 2_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
    const snapshot = ToolReply.textsOf(shown).join("\n");

    await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: referenceOf(snapshot, /link "First link" \[(e\d+)\]/) }, bindings });
    await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: referenceOf(snapshot, /button "Pay" \[(e\d+)\]/) }, bindings });
    await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('first').focus(); 'focused'");
    await app.requestAsync("agent-double.callTool", { name: "browser_press_key", input: { key: "Enter" }, bindings });

    const asked = await app.requestAsync("agent-double.takeQuestions", {});
    const questions = (Array.isArray(asked) ? asked : []).map((t: JsonValue) => isObject(t) ? [t["title"], t["risk"]] : []);
    const host = new URL(docs.origin).host;
    expect(questions).toEqual([[`Click "First link" on ${host}`, "Medium"], [`Submit the form "Checkout" on ${host}`, "High"], [`Press Enter on ${host}`, "Medium"]]);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "location.pathname + location.hash")).toBe("/");
  });
});
