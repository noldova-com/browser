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

const CUT_NOTE = "The snapshot was cut at its limit; take another with interactive or a depth for less, read an element's part by its reference with part, or scroll and take another.";

// A custom element whose closed root holds a heading, a button and a password field; the page's own script keeps the root.
const CUSTOM = `<!doctype html><title>Custom</title><h1>Shop</h1><x-card></x-card><a href="#after">After</a>
<script>customElements.define("x-card", class extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "closed" }).innerHTML = '<h2>Card</h2><button>Buy</button><input type="password" aria-label="PIN" value="hunter2">'; }
});</script>`;

// A built-in element with a closed root that shows its light children through a slot, between its own heading and button.
const BUILT_IN = `<!doctype html><title>Built in</title><div id="host"><a href="#light">Light link</a></div>
<script>document.getElementById("host").attachShadow({ mode: "closed" }).innerHTML = "<h2>Inside</h2><slot></slot><button>Done</button>";</script>`;

// Sections whose attributes together pass the 4 MiB a reply may carry, though each section's alone doesn't, so the document is described
// a part at a time; a closed root follows them.
const SECTIONS = 6;
const ROWS_PER_SECTION = 500;
const PAD_LENGTH = 2_000;
const SPLIT = `<!doctype html><title>Split</title><script>document.write(Array.from({ length: ${SECTIONS} }, () => '<section>'
  + Array.from({ length: ${ROWS_PER_SECTION} }, () => '<i data-pad="' + 'x'.repeat(${PAD_LENGTH}) + '"></i>').join('') + '</section>').join(''))</script>
<div id="host"></div><script>document.getElementById("host").attachShadow({ mode: "closed" }).innerHTML = "<button>Deep buy</button>";</script>`;

// Links past the snapshot's limit, with closed roots before and after them.
const LINKS = 3_000;
const CAPPED = `<!doctype html><title>Capped</title><div id="first"></div><ul><script>document.write(Array.from({ length: ${LINKS} },
  (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(8) + '</a></li>').join(''))</script></ul><div id="last"></div>
<script>for (const id of ["first", "last"]) document.getElementById(id).attachShadow({ mode: "closed" }).innerHTML = "<button>" + id + " button</button>";</script>`;

// An element whose children's attributes alone pass the 4 MiB a reply may carry, with a closed root's host among them: the search for
// closed roots skips the element, and the host shows only its own line.
const WIDE_ROWS = 11_000;
const WIDE = `<!doctype html><title>Wide</title><div id="wide"><div id="host" role="group" aria-label="Card"></div><script>document.write(
  Array.from({ length: ${WIDE_ROWS} }, () => '<i data-pad="' + 'x'.repeat(${PAD_LENGTH / 5}) + '"></i>').join(''))</script></div><button>After</button>
<script>document.getElementById("host").attachShadow({ mode: "closed" }).innerHTML = "<button>Hidden buy</button>";</script>`;
const UNSEARCHED_NOTE = "Closed parts inside <div id=\"wide\"> were not searched, as there was too much to describe in one answer or in the time for it; a closed part there shows only its element's line.";

function linesOf(result: JsonValue): string[] {
  const snapshot = ToolReply.textsOf(result).find(t => t.startsWith("URL: ")) ?? "";
  expect(snapshot, `No text holds the snapshot: ${JSON.stringify(result).slice(0, 2_000)}`).not.toBe("");
  return snapshot.split("\n").slice(3);
}

function referenceOf(lines: readonly string[], line: RegExp): string {
  const reference = lines.map(t => line.exec(t)?.[1]).find(t => !Object.isUndefined(t)) ?? "";
  expect(reference, `No line matches ${String(line)}: ${lines.join("\n")}`).not.toBe("");
  return reference;
}

async function openAsync(app: TestApp, url: string, title: string): Promise<JsonObject> {
  await app.allowLocalSitesAsync([new URL(url).origin]);
  const instance = await app.openPageAsync(url);
  await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(url, title)]);
  return { page: instance, profileKey: TestApp.PROFILE_KEY };
}

async function snapshotAsync(app: TestApp, bindings: JsonObject, input: JsonObject = {}): Promise<JsonValue> {
  return app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input, bindings });
}

test.describe("a snapshot of closed shadow roots", () => {
  test("reads a custom element's closed root after its line, masks its secret field, and acts on its button by reference", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": CUSTOM });
    const bindings = await openAsync(app, docs.url("/"), "Custom");

    const result = await snapshotAsync(app, bindings);
    const lines = linesOf(result);

    expect(lines.map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual([
      "- RootWebArea \"Custom\"",
      "  - heading \"Shop\"",
      "    - StaticText \"Shop\"",
      "  - generic",
      "    - heading \"Card\"",
      "      - StaticText \"Card\"",
      "    - button \"Buy\"",
      "      - StaticText \"Buy\"",
      "    - textbox \"PIN\" value=\"••••••\"",
      "  - link \"After\"",
      "    - StaticText \"After\""
    ]);
    expect(JSON.stringify(result)).not.toContain("hunter2");
    const buy = referenceOf(lines, /^ {4}- button "Buy" \[(e\d+)\]$/u);
    const part = linesOf(await snapshotAsync(app, bindings, { part: buy }));
    expect(part.map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual(["- button \"Buy\"", "  - StaticText \"Buy\""]);
    await app.requestAsync("agent-double.planAnswer", { action: "browser.click", answer: "allowOnce" });
    const click = await app.requestAsync("agent-double.callTool", { name: "browser_click", input: { reference: referenceOf(part, /^- button "Buy" \[(e\d+)\]$/u) }, bindings });
    expect(click, `The click failed: ${JSON.stringify(click).slice(0, 2_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
  });

  test("reads a built-in element's closed root with the light children its slot shows, in the order the page shows them", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": BUILT_IN });
    const bindings = await openAsync(app, docs.url("/"), "Built in");

    const lines = linesOf(await snapshotAsync(app, bindings, { interactive: true }));

    expect(lines.map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual([
      "- RootWebArea \"Built in\"", "  - generic", "    - heading \"Inside\"", "    - link \"Light link\"", "    - button \"Done\""]);
  });

  test("finds a closed root after a document too large to describe in one answer, by describing it a part at a time", async ({ app, servers }, testInfo) => {
    const docs = await servers.startAsync("docs.localhost", { "/": SPLIT });
    const bindings = await openAsync(app, docs.url("/"), "Split");

    const started = performance.now();
    const result = await snapshotAsync(app, bindings, { interactive: true });
    testInfo.annotations.push({ type: "snapshot ms", description: String(Math.round(performance.now() - started)) });

    expect(linesOf(result).map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual(["- RootWebArea \"Split\"", "  - generic", "    - button \"Deep buy\""]);
  });

  test("skips an element too large to describe in its search, names it, and shows a closed root inside it by its host's line alone", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": WIDE });
    const bindings = await openAsync(app, docs.url("/"), "Wide");

    const result = await snapshotAsync(app, bindings);

    expect(linesOf(result).map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual([
      "- RootWebArea \"Wide\"", "  - group \"Card\"", "  - button \"After\"", "    - StaticText \"After\""]);
    expect(ToolReply.textsOf(result)).toContain(UNSEARCHED_NOTE);
  });

  test("reads a closed root within the snapshot's limit, cuts one past it with its line, and adds the cut note", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": CAPPED });
    const bindings = await openAsync(app, docs.url("/"), "Capped");

    const result = await snapshotAsync(app, bindings);
    const lines = linesOf(result);

    expect(lines.slice(0, 3).map(t => t.replace(/ \[e\d+\]$/u, ""))).toEqual(["- RootWebArea \"Capped\"", "  - generic", "    - button \"first button\""]);
    expect(lines.join("\n")).not.toContain("last button");
    expect(ToolReply.textsOf(result)).toContain(CUT_NOTE);
  });
});
