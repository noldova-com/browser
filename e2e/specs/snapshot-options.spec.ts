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

// The options of the page's closed select, which the engine's tree lists and the snapshot leaves out, as the security model says.
const CLOSED_OPTIONS = new Set(["option \"Small\"", "option \"Large\""]);
const ACTIONABLE = new Set(["button", "checkbox", "combobox", "link", "listbox", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "scrollbar",
  "searchbox", "slider", "spinbutton", "switch", "tab", "textbox", "treeitem", "heading"]);

// Elements of most kinds an agent acts on, named in each of the ways the accessible name computation allows, with some the engine leaves out.
const KINDS = `<!doctype html><title>All kinds</title>
<header><nav aria-label="Main"><a href="#a">Home</a> <a href="#b">About <img alt="logo" src="data:,"></a></nav></header>
<main><h1>Store</h1><h2 id="h">Cart <span>items</span></h2>
<form aria-labelledby="h"><label>Email <input type="email" value="buyer@shop.test"></label>
<label for="q">Search</label><input id="q" type="search">
<input type="checkbox" id="c"><label for="c">Gift wrap</label>
<input type="radio" name="r" aria-label="Fast"> <input type="range" aria-label="Volume"> <input type="number" title="Count">
<select aria-label="Size"><option>Small</option><option>Large</option></select>
<select multiple aria-label="Colors"><option>Red</option><option>Blue</option></select>
<textarea placeholder="Notes"></textarea>
<button>Pay <b>now</b></button><button aria-label="Close">×</button>
<input type="submit" value="Send"><input type="button" value="Reset all"><input type="image" alt="Go" src="data:,"><input type="reset">
<label><input type="checkbox"> Remember me</label>
</form>
<div role="switch" aria-checked="false" tabindex="0">Dark mode</div>
<div role="tablist"><div role="tab">One</div><div role="tab" aria-labelledby="h">Two</div></div>
<details><summary>More</summary><p>Inside</p></details>
<ul role="menu"><li role="menuitem">Copy</li><li role="menuitemcheckbox" aria-checked="true">Bold</li><li role="menuitemradio" aria-checked="false">Wide</li></ul>
<div role="listbox" aria-label="Fruits"><div role="option">Apple</div></div>
<div role="tree"><div role="treeitem">Root</div></div>
<a href="#x" title="Titled"></a><button><span style="display:none">gone</span>Visible</button>
<button aria-hidden="true">Hidden button</button>
<table><tr><th>Name</th></tr><tr><td><a href="#c">Cell link</a></td></tr></table>
<div role="slider" aria-label="Zoom" aria-valuenow="5" tabindex="0"></div>
<div role="spinbutton" aria-labelledby="h q" tabindex="0"></div>
<div style="visibility:hidden"><button>Invisible</button></div>
<button style="position:absolute;left:-9999px">Offscreen</button>
<h3><a href="#y">Linked heading</a></h3>
<div id="host"></div>
<script>document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = "<button>Shadow</button>";</script>
</main>`;

const FIELDS = `<!doctype html><title>Fields</title>
<input type="password" aria-label="Password" value="hunter2">
<input aria-label="Card" autocomplete="cc-number" value="4111111111111111">
<input aria-label="Code" autocomplete="one-time-code" value="902614">
<input aria-label="New" autocomplete="section-a new-password" value="opensesame">
<input aria-label="Name" value="Ada">`;

const AROUND = `<!doctype html><title>Around</title>
<label>Password <input type="password" value="hunter2"></label>
<table><tr><td>Card <input autocomplete="cc-number" value="4111111111111111"></td></tr></table>
<div id="code">Code <input autocomplete="one-time-code" value="902614"></div><button aria-labelledby="code">Send</button>
<label>Expiry <select autocomplete="cc-exp"><option>01/27</option><option selected>12/29</option></select></label>
<label>Name <input value="Ada"></label>`;

const NESTED = `<!doctype html><title>Nested</title><h1>Shop</h1><p>Welcome back</p>
<nav aria-label="Menu"><ul><li><a href="#d">Deep link</a></li></ul></nav><button id="pay">Pay</button>`;

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

test.describe("the snapshot's options", () => {
  test("names and roles every element an agent acts on, and every heading, as the engine's own accessibility tree does", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": KINDS });
    const bindings = await openAsync(app, docs.url("/"), "All kinds");

    const result = await snapshotAsync(app, bindings);
    const engine = await app.viewPages.accessibilityNodesAsync(docs.url("/"));

    const ours = linesOf(result).map(t => /^ *- (\S+)(?: "((?:[^"\\]|\\.)*)")?/u.exec(t))
      .filter((t): t is RegExpExecArray => !Object.isNull(t) && ACTIONABLE.has(t[1] ?? "")).map(t => `${t[1]} "${t[2] ?? ""}"`);
    const theirs = engine.filter(t => ACTIONABLE.has(t.role)).map(t => `${t.role} ${JSON.stringify(t.name.replace(/\s+/gu, " ").trim())}`)
      .filter(t => !CLOSED_OPTIONS.has(t));
    expect(ours.toSorted()).toEqual(theirs.toSorted());
    expect(ours.length, "The page should hold most kinds of element.").toBeGreaterThan(30);
  });

  test("masks a password, a card number, a one-time code and a new password inside the page, and shows another field's value", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": FIELDS });
    const bindings = await openAsync(app, docs.url("/"), "Fields");

    const result = await snapshotAsync(app, bindings);

    expect(linesOf(result)).toEqual([
      "- RootWebArea \"Fields\"",
      expect.stringMatching(/^ {2}- textbox "Password" value="••••••" \[e1\]$/u),
      expect.stringMatching(/^ {2}- textbox "Card" value="••••••" \[e2\]$/u),
      expect.stringMatching(/^ {2}- textbox "Code" value="••••••" \[e3\]$/u),
      expect.stringMatching(/^ {2}- textbox "New" value="••••••" \[e4\]$/u),
      expect.stringMatching(/^ {2}- textbox "Name" value="Ada" \[e5\]$/u)
    ]);
    for (const secret of ["hunter2", "4111111111111111", "902614", "opensesame"])
      expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("leaves a secret field's value out of the names of a label, a table cell and an element labelled by what holds the field, and keeps another field's", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": AROUND });
    const bindings = await openAsync(app, docs.url("/"), "Around");

    const result = await snapshotAsync(app, bindings);

    const lines = linesOf(result);
    expect(lines.filter(t => /^ *- (LabelText|cell|button) /u.test(t)).map(t => t.replace(/ \[e\d+\]$/u, "").trim())).toEqual([
      "- LabelText \"Password\"",
      "- cell \"Card\"",
      "- button \"Code\"",
      "- LabelText \"Expiry\"",
      "- LabelText \"Name Ada\""
    ]);
    for (const secret of ["hunter2", "4111111111111111", "902614", "12/29"])
      expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("interactive keeps the elements an agent acts on and the headings, and leaves out the text", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": NESTED });
    const bindings = await openAsync(app, docs.url("/"), "Nested");

    const lines = linesOf(await snapshotAsync(app, bindings, { interactive: true }));

    expect(lines.map(t => t.trim())).toEqual(["- RootWebArea \"Nested\"", "- heading \"Shop\"", "- link \"Deep link\" [e1]", "- button \"Pay\" [e2]"]);
  });

  test("depth leaves out deeper lines and says so, and a part read by its reference gives that element's subtree", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": NESTED });
    const bindings = await openAsync(app, docs.url("/"), "Nested");

    const shallow = await snapshotAsync(app, bindings, { depth: 2 });
    const lines = linesOf(shallow);
    const menu = referenceOf(lines, /^ {2}- navigation "Menu" \[(e\d+)\]$/u);
    const part = linesOf(await snapshotAsync(app, bindings, { part: menu }));

    expect(lines.every(t => /^ {0,2}- /u.test(t)), lines.join("\n")).toBe(true);
    expect(lines).not.toContainEqual(expect.stringContaining("Deep link"));
    expect(ToolReply.textsOf(shallow)).toContain("Lines deeper than 2 levels were left out; read an element's part by its reference with part.");
    expect(part[0]).toMatch(/^- navigation "Menu"/u);
    expect(part).toContainEqual(expect.stringMatching(/^ +- link "Deep link" \[e\d+\]$/u));
    expect(part).not.toContainEqual(expect.stringContaining("Pay"));
  });

  test("a part by a reference no snapshot gave fails as unknown, and one whose element left the page as stale", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": NESTED });
    const bindings = await openAsync(app, docs.url("/"), "Nested");
    const pay = referenceOf(linesOf(await snapshotAsync(app, bindings)), /- button "Pay" \[(e\d+)\]$/u);

    const unknown = await snapshotAsync(app, bindings, { part: "e999" });
    await app.viewPages.runAtAsync(docs.url("/"), "document.getElementById('pay').remove(); 'removed'");
    const stale = await snapshotAsync(app, bindings, { part: pay });

    expect(unknown).toEqual(expect.objectContaining({ isFailure: true, code: "Refused",
      message: "No snapshot gave this element reference; take a snapshot and use a reference from it." }));
    expect(stale).toEqual(expect.objectContaining({ isFailure: true, code: "Refused", message: "The element reference is stale; take a new snapshot." }));
  });
});
