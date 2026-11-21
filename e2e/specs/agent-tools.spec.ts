/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inflateSync } from "node:zlib";

import type { JsonObject, JsonValue } from "@noldova/context.json";

import { expect, test } from "../fixtures/app-test.ts";
import type { FixtureServer } from "../fixtures/fixture-servers.ts";
import type { TestApp } from "../fixtures/test-app.ts";
import { ViewPage } from "../fixtures/view-pages.ts";

const PROFILE_KEY = "e2e";
const START_TITLE = "Tools";
const NEXT_TITLE = "Next";
const AGENT_BAR = "nol-browser-agent-bar";
// The page's background, #2050a0, as the screenshot's pixels give it.
const BACKGROUND: readonly number[] = [0x20, 0x50, 0xa0];

// A page that records each click on its button and each value its field takes, and each press anywhere on it with its target, logs a
// line to the console as it loads, and can lay a banner over its button.
const START = `<!doctype html><title>${START_TITLE}</title><body style="margin:0;background:#2050a0">
<button type="button" id="buy" style="position:absolute;left:40px;top:40px;width:160px;height:40px">Buy</button>
<input id="name" aria-label="Name" style="position:absolute;left:40px;top:120px;width:200px">
<div id="banner" hidden style="position:fixed;inset:0;background:#fff">Banner</div>
<script>window.seen = [];
window.pressed = [];
for (const type of ["pointerdown", "mousedown", "click"])
  addEventListener(type, t => pressed.push(type + " " + (t.target.id || t.target.nodeName)), true);
document.getElementById("buy").addEventListener("click", () => seen.push("click"));
document.getElementById("name").addEventListener("input", t => seen.push("input " + t.target.value));
console.info("tools page ready");</script>`;
const NEXT = `<!doctype html><title>${NEXT_TITLE}</title><p>Next page</p>`;
// A page whose search field replaces itself with a new one, and focuses it, the first time it takes the focus, as some sites' search
// fields do, and records each value a field takes.
const SWAPPING = `<!doctype html><title>${START_TITLE}</title><label for="q">Search</label><input id="q" type="search">
<script>window.seen = [];
addEventListener("input", t => seen.push("input " + t.target.value), true);
document.getElementById("q").addEventListener("focus", t => {
  const fresh = Object.assign(document.createElement("input"), { id: "q", type: "search" });
  t.target.replaceWith(fresh);
  fresh.focus();
}, { once: true });</script>`;
// A page whose fields already hold text, with the caret at each one's start, as a form shows a saved value.
const PREFILLED = `<!doctype html><title>${START_TITLE}</title>
<input id="email" type="text" autocomplete="email" aria-label="Email" value="a@x.com">
<textarea id="notes" aria-label="Notes">old notes</textarea>
<div id="bio" role="textbox" aria-label="Bio" contenteditable="true">old bio</div>
<input id="agree" type="checkbox" aria-label="Agree" checked>
<input id="level" type="range" aria-label="Level" value="30">
<script>for (const id of ["email", "notes"])
  document.getElementById(id).setSelectionRange(0, 0);
window.keys = [];
for (const id of ["agree", "level"])
  document.getElementById(id).addEventListener("keydown", event => window.keys.push(id + " " + event.key));</script>`;

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
function pngSizeOf(bytes: Buffer): readonly [number, number] {
  expect(bytes.subarray(0, 8).toString("hex"), "The image isn't a PNG.").toBe("89504e470d0a1a0a");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

// The red, green and blue of an 8-bit RGB or RGBA PNG's pixel, from its IDAT chunks inflated and its rows unfiltered down to the pixel's.
function pngPixelOf(bytes: Buffer, x: number, y: number): readonly number[] {
  const [width] = pngSizeOf(bytes);
  const [depth = 0, colour = 0] = [bytes[24], bytes[25]];
  expect([depth, [2, 6].includes(colour)], "The PNG isn't 8-bit RGB or RGBA.").toEqual([8, true]);
  const channels = colour === 6 ? 4 : 3;
  const parts: Buffer[] = [];
  for (let at = 8; at < bytes.length; at += 12 + bytes.readUInt32BE(at))
    if (bytes.toString("latin1", at + 4, at + 8) === "IDAT")
      parts.push(bytes.subarray(at + 8, at + 8 + bytes.readUInt32BE(at)));
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  let above = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  for (let line = 0; line <= y; line++) {
    const filter = raw[line * (stride + 1)] ?? 0;
    row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const value = raw[line * (stride + 1) + 1 + i] ?? 0;
      const left = i >= channels ? row[i - channels] ?? 0 : 0;
      const up = above[i] ?? 0;
      const corner = i >= channels ? above[i - channels] ?? 0 : 0;
      const guess = left + up - corner;
      const [toLeft, toUp, toCorner] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)];
      const paeth = toLeft <= toUp && toLeft <= toCorner ? left : toUp <= toCorner ? up : corner;
      const predictor = [0, left, up, (left + up) >> 1, paeth][filter] ?? 0;
      row[i] = (value + predictor) & 0xff;
    }
    above = row;
  }
  return Array.from(row.subarray(x * channels, x * channels + 3));
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
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/next"), NEXT_TITLE)]);
    expect(docs.requests.map(t => t.path).filter(t => t !== "/favicon.ico")).toEqual(["/", "/next"]);
  });

  test("navigate answers at once a move back to an entry the page pushed and a move to a fragment, which fire no load", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    await app.viewPages.runAtAsync(docs.url("/"), "history.pushState({}, '', '/pushed'), location.href");
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/pushed"), START_TITLE)]);
    await app.requestAsync("agent-double.planAnswer", { action: "browser.navigate", answer: "allowOnce" });
    await app.requestAsync("agent-double.planAnswer", { action: "browser.navigate", answer: "allowOnce" });

    const back = textsOf(await callAsync(app, bindings, "browser_navigate", { action: "back" }));
    const fragment = textsOf(await callAsync(app, bindings, "browser_navigate", { url: docs.url("/#setup") }));

    expect(back.join("\n")).toContain(`URL: ${docs.url("/")}\nTitle: ${START_TITLE}`);
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/#setup"), START_TITLE)]);
    expect([...back, ...fragment].filter(t => t.startsWith("The page is still loading"))).toEqual([]);
    expect(docs.requests.map(t => t.path).filter(t => t !== "/favicon.ico")).toEqual(["/"]);
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

  test("typing into a field that replaces itself on focus types nothing and fails as a changed page, and typing again after a new snapshot works", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": SWAPPING });
    const bindings = await openAsync(app, docs);
    const searchOf = async (): Promise<string> => referenceOf(textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n"), /- searchbox "Search" \[(e\d+)\]$/u);
    const first = await searchOf();
    await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_type", input: { reference: first, text: "Ada" }, bindings });

    expect(result).toEqual(expect.objectContaining({ isFailure: true, code: "Stale", message: "The page changed after the action was allowed, so nothing ran; take a new snapshot." }));
    expect([await seenAsync(app, docs), await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('q').value")]).toEqual([[], ""]);
    const again = await searchOf();
    await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });
    await callAsync(app, bindings, "browser_type", { reference: again, text: "Ada" });
    expect([await seenAsync(app, docs), await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('q').value")]).toEqual([["input Ada"], "Ada"]);
  });

  test("typing replaces what a field, a text area and an editable element hold, and an empty text clears a field", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PREFILLED });
    const bindings = await openAsync(app, docs);
    const snapshot = textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n");
    const fields = [/- textbox "Email" .*\[(e\d+)\]$/u, /- textbox "Notes" .*\[(e\d+)\]$/u, /- textbox "Bio" .*\[(e\d+)\]$/u].map(t => referenceOf(snapshot, t));
    const typeAsync = async (reference: string, text: string): Promise<void> => {
      await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });
      await callAsync(app, bindings, "browser_type", { reference, text });
    };
    const values = "JSON.stringify([document.getElementById('email').value, document.getElementById('notes').value, document.getElementById('bio').textContent])";

    for (const [reference, text] of [[fields[0], "b@y.com"], [fields[1], "new notes"], [fields[2], "new bio"]] as const)
      await typeAsync(reference ?? "", text);
    const typed = await app.viewPages.runAtAsync(docs.url("/"), values);
    await typeAsync(fields[0] ?? "", "");

    expect([typed, await app.viewPages.runAtAsync(docs.url("/"), values)]).toEqual([JSON.stringify(["b@y.com", "new notes", "new bio"]), JSON.stringify(["", "new notes", "new bio"])]);
  });

  test("an empty text sends no key to a checkbox or a slider, which hold no text to select", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PREFILLED });
    const bindings = await openAsync(app, docs);
    const snapshot = textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n");

    for (const reference of [/- checkbox "Agree" .*\[(e\d+)\]$/u, /- slider "Level" .*\[(e\d+)\]$/u].map(t => referenceOf(snapshot, t))) {
      await app.requestAsync("agent-double.planAnswer", { action: "browser.type", answer: "allowOnce" });
      await callAsync(app, bindings, "browser_type", { reference, text: "" });
    }

    expect(await app.viewPages.runAtAsync(docs.url("/"), "JSON.stringify([window.keys, document.getElementById('agree').checked, document.getElementById('level').value])"))
      .toBe(JSON.stringify([[], true, "30"]));
  });

  // An element under a cover doesn't show at its centre, so the click scrolls to it first; the scroll can run the page's handlers, so the
  // call ends past its point of no return, as uncertain, with the cover's code.
  test("a click on an element another covers is reported as covered, and the element isn't clicked", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    const buy = referenceOf(textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n"), /- button "Buy" \[(e\d+)\]$/u);
    await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('banner').hidden = false; true");
    const topmost = "const box = document.getElementById('buy').getBoundingClientRect(); document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2).id";
    expect(await app.viewPages.runAtAsync(docs.url("/"), topmost), "The banner isn't on top at the button's centre.").toBe("banner");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: buy }, bindings });

    expect(result).toEqual(expect.objectContaining({ isFailure: true, code: "OutcomeUncertain", nextTool: "browser_snapshot",
      message: "The action ended (browser.covered) after its input may have been sent; take a new snapshot to see the page." }));
    expect(await seenAsync(app, docs)).toEqual([]);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "pressed.join(', ')"), "The page saw a press.").toBe("");
  });

  // The engine refuses to read the box of an element it doesn't lay out, such as one under display: none.
  test("a click on and a screenshot of an element hidden after the snapshot say it isn't visible, and the element isn't clicked", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    const buy = referenceOf(textsOf(await callAsync(app, bindings, "browser_snapshot")).join("\n"), /- button "Buy" \[(e\d+)\]$/u);
    await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('buy').style.display = 'none'; true");
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });

    const clicked = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: buy }, bindings });
    const captured = await app.requestAsync("agent-double.callTool", { name: "browser_screenshot", input: { reference: buy }, bindings });

    expect([clicked, captured]).toEqual([
      expect.objectContaining({ isFailure: true, code: "Refused", moduleCode: "browser.notVisible",
        message: "The element has no box on the page, so it can't be clicked; take a new snapshot." }),
      expect.objectContaining({ isFailure: true, code: "Refused", moduleCode: "browser.notVisible",
        message: "The area has no size on the page, so nothing was captured; take a new snapshot." }),
    ]);
    expect(await app.viewPages.runAtAsync(docs.url("/"), "pressed.join(', ')"), "The page saw a press.").toBe("");
  });

  test("a screenshot gives a PNG of the view's shape and its page, of the size its text says", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);
    // The first call shows the agent's bar, which makes the view shorter, so the size is read once the view is shorter than before the
    // call and two reads agree.
    const sizeAsync = (): Promise<string> => app.viewPages.runAtAsync(docs.url("/"), "innerWidth + ' ' + innerHeight");
    const heightOf = (size: string): number => Number(size.split(" ")[1]);
    const free = heightOf(await sizeAsync());
    await callAsync(app, bindings, "browser_snapshot");
    await expect(app.window.locator(AGENT_BAR)).toBeVisible();
    await expect.poll(async () => heightOf(await sizeAsync()), { message: "The view never got shorter for the agent's bar." }).toBeLessThan(free);
    let last = "";
    await expect.poll(async () => {
      const [earlier, now] = [last, await sizeAsync()];
      last = now;
      return now === earlier;
    }, { message: "The view's size never came to rest." }).toBe(true);
    const [viewWidth = "", viewHeight = ""] = last.split(" ");

    const result = await callAsync(app, bindings, "browser_screenshot");

    expect(await sizeAsync(), "The view's size changed during the screenshot.").toBe(last);
    const images = contentOf(result).filter(t => t["mimeType"] === "image/png");
    expect(images, "The result holds no one PNG image.").toHaveLength(1);
    const data = images[0]?.["data"];
    const bytes = Buffer.from(typeof data === "string" ? data : "", "base64");
    const [width, height] = pngSizeOf(bytes);
    expect(textsOf(result)[0]).toBe(`A screenshot of ${width} by ${height} pixels.`);
    expect(Math.abs(width / height - Number(viewWidth) / Number(viewHeight)), "The image's shape isn't the view's.").toBeLessThan(0.02);
    // Left of the button and above it, so only the page's background is there.
    expect(pngPixelOf(bytes, 4, 4).map((t, i) => Math.abs(t - (BACKGROUND[i] ?? 0)) <= 3), "The image doesn't show the page's background.")
      .toEqual([true, true, true]);
  });

  test("console reading gives the line the page logged, with its level and source", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": START });
    const bindings = await openAsync(app, docs);

    const texts = textsOf(await callAsync(app, bindings, "browser_console"));

    expect(texts[0]).toMatch(/^\d+ console entr(y|ies); the next cursor is \d+\./u);
    expect(texts.some(t => / info console at .+: tools page ready$/u.test(t)), `No entry holds the page's line: ${texts.join("\n")}`).toBe(true);
  });
});
