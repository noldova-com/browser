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
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PROFILE_KEY = "e2e";
const START_TITLE = "Tools";
const NEXT_TITLE = "Next";

// A page that records each click on its button and each value its field takes, logs a line to the console as it loads, and can lay a
// banner over its button.
const START = `<!doctype html><title>${START_TITLE}</title><body style="margin:0;background:#2050a0">
<button type="button" id="buy" style="position:absolute;left:40px;top:40px;width:160px;height:40px">Buy</button>
<input id="name" aria-label="Name" style="position:absolute;left:40px;top:120px;width:200px">
<div id="banner" hidden style="position:fixed;inset:0;background:#fff">Banner</div>
<script>window.seen = [];
document.getElementById("buy").addEventListener("click", () => seen.push("click"));
document.getElementById("name").addEventListener("input", t => seen.push("input " + t.target.value));
console.info("tools page ready");</script>`;
const NEXT = `<!doctype html><title>${NEXT_TITLE}</title><p>Next page</p>`;

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentOf(result: JsonValue): readonly JsonObject[] {
  const content = isObject(result) ? result["content"] : undefined;
  return (Array.isArray(content) ? content : []).filter(isObject);
}

function textsOf(result: JsonValue): string[] {
  return contentOf(result).map(t => t["text"]).filter((t): t is string => typeof t === "string");
}

function referenceOf(snapshot: string, line: RegExp): string {
  const reference = snapshot.split("\n").map(t => line.exec(t)?.[1]).find(t => t !== undefined) ?? "";
  expect(reference, `No line matches ${String(line)}: ${snapshot}`).not.toBe("");
  return reference;
}

// The width and height a PNG's header holds, which follow its 8-byte signature and the IHDR chunk's length and type.
function pngSizeOf(data: string): readonly [number, number] {
  const bytes = Buffer.from(data, "base64");
  expect(bytes.subarray(0, 8).toString("hex"), "The image isn't a PNG.").toBe("89504e470d0a1a0a");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function callAsync(app: TestApp, bindings: JsonObject, name: string, input: JsonObject = {}): Promise<JsonValue> {
  const result = await app.requestAsync("agent-double.callTool", { name, input, bindings });
  expect(result, `${name} failed: ${JSON.stringify(result).slice(0, 1_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
  return result;
}

async function openAsync(app: TestApp, docs: FixtureServer): Promise<JsonObject> {
  await app.allowLocalSitesAsync([docs.origin]);
  const bindings = { page: await app.openPageAsync(docs.url("/")), profileKey: PROFILE_KEY };
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), START_TITLE)]);
  return bindings;
}

async function seenAsync(app: TestApp, docs: FixtureServer): Promise<readonly string[]> {
  const seen = await app.viewPages.runAtAsync(docs.url("/"), "seen.join('\\n')");
  return seen === "" ? [] : seen.split("\n");
}

test.describe("the agent tools on a real page", () => {
  test("navigate loads the address and reports its URL and title", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START, "/next": NEXT });
    const bindings = await openAsync(app, docs);
    await app.requestAsync("agent-double.planAnswer", { action: "browser.navigate", answer: "allowOnce" });

    const texts = textsOf(await callAsync(app, bindings, "browser_navigate", { url: docs.url("/next") }));

    expect(texts.join("\n")).toContain(`URL: ${docs.url("/next")}\nTitle: ${NEXT_TITLE}`);
    expect(await app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/next"), NEXT_TITLE)]);
    expect(docs.requests.map(t => t.path).filter(t => t !== "/favicon.ico")).toEqual(["/", "/next"]);
  });

  test("a snapshot gives the page's controls with references, and a click and typing by them reach the page", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);

    const snapshot = textsOf(await callAsync(app, bindings, "browser_snapshot")).find(t => t.startsWith("URL: ")) ?? "";
    expect(snapshot.split("\n").slice(0, 2)).toEqual([`URL: ${docs.url("/")}`, `Title: ${START_TITLE}`]);
    const buy = referenceOf(snapshot, /- button "Buy" \[(e\d+)\]$/u);
    const name = referenceOf(snapshot, /- textbox "Name" \[(e\d+)\]$/u);
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });
    await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });

    const clicked = textsOf(await callAsync(app, bindings, "browser_click", { reference: buy }));
    const typed = textsOf(await callAsync(app, bindings, "browser_type", { reference: name, text: "Ada" }));

    expect([clicked, typed].map(t => t.includes(`URL: ${docs.url("/")}`))).toEqual([true, true]);
    expect(await seenAsync(app, docs)).toEqual(["click", "input Ada"]);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('name').value")).toBe("Ada");
  });

  // An element under a cover doesn't show at its centre, so the click scrolls to it first; the scroll can run the page's handlers, so the
  // call ends past its point of no return, as uncertain, with the cover's code.
  test("a click on an element another covers is reported as covered, and the element isn't clicked", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    const buy = referenceOf(textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n"), /- button "Buy" \[(e\d+)\]$/u);
    await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('banner').hidden = false; true");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: buy }, bindings });

    expect(result).toEqual(expect.objectContaining({ isFailure: true, code: "OutcomeUncertain", nextTool: "browser_snapshot",
      message: "The action ended (browser.covered) after its input may have been sent; take a new snapshot to see the page." }));
    expect(await seenAsync(app, docs)).toEqual([]);
  });

  test("a screenshot gives a PNG of the view's shape, of the size its text says", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    const [viewWidth = "", viewHeight = ""] = (await app.viewPages.runAtAsync(docs.url("/"), "innerWidth + ' ' + innerHeight")).split(" ");

    const result = await callAsync(app, bindings, "browser_screenshot");

    const images = contentOf(result).filter(t => t["mimeType"] === "image/png");
    expect(images, "The result holds no one PNG image.").toHaveLength(1);
    const data = images[0]?.["data"];
    const [width, height] = pngSizeOf(typeof data === "string" ? data : "");
    expect(textsOf(result)[0]).toBe(`A screenshot of ${width} by ${height} pixels.`);
    expect(Math.abs(width / height - Number(viewWidth) / Number(viewHeight)), "The image's shape isn't the view's.").toBeLessThan(0.02);
  });

  test("console reading gives the line the page logged, with its level and source", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);

    const texts = textsOf(await callAsync(app, bindings, "browser_console"));

    expect(texts[0]).toMatch(/^\d+ console entr(y|ies); the next cursor is \d+\./u);
    expect(texts.some(t => / info console at .+: tools page ready$/u.test(t)), `No entry holds the page's line: ${texts.join("\n")}`).toBe(true);
  });
});
