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
const SNAPSHOT_LIMIT_BYTES = 128 * 1024;
const LONGEST_LINE_BYTES = SECTION_NAME_LENGTH + 64;
const CUT_NOTE = "The snapshot was cut at its limit; take another with interactive or a depth for less, read an element's part by its reference with part, or scroll and take another.";
const FROM_VIEW_NOTE = "The page is too large to read from its start, so the snapshot starts where it is scrolled to; scroll up and take another for what is above.";
// The rows' element lists more than one reply carries, so the search for closed shadow roots skips it, and the page still reads it.
const UNSEARCHED_NOTE = "Closed parts inside <div id=\"rows\"> were not searched, as there was too much to describe in one answer or in the time for it; a closed part there shows only its element's line.";
// The rows' element is split, and whether the search's 2 s describe all its children, the box, the 12,000 rows and the script that writes
// them, depends on the machine; when they don't, the note names the element and how many went unsearched.
const ROWS_UNSEARCHED = /^Closed parts inside <div id="rows">: ([\d,]+) of 12,002 children were not searched,/u;
// The snapshot's step deadline; the time each took is an annotation.
const STEP_MS = 15_000;

// Each link's name is long, so the snapshot's limit comes after a few dozen links; the icon page puts a view-tall svg icon before one
// section's link, which the walk doesn't enter.
const ICON_SECTION = 200;
const ICON = '<svg style="display: block; width: 100%; height: 100vh"><path d="M0 0H4000V4000H0Z"/></svg>';
const PAGE = longPage("");
const ICON_PAGE = longPage(ICON);

function longPage(icon: string): string {
  return "<!doctype html><title>Long page</title><ul>"
    + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li>' + (i === ${ICON_SECTION} ? '${icon}' : '') + '<a href="#s' + i + '">Section ' + i`
    + ` + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`;
}

// Rows under one element: 12,000 link rows, with short or long names, are the page whose whole tree the engine took most of the time limit
// to build (#68); 12,000 rows with a long attribute each make even the list of that element's children larger than one reply could carry.
// The element's ::before is a child its element lists apart from the others.
const ROWS = 12_000;
const ROW_PAD_LENGTH = 400;
const LINK_NAME_WORDS = 30;
const BUTTON_NAME_WORDS = 10;
const ROWS_BEFORE = "Rows begin";
const SPLIT_ROWS = 200;
const SPLIT_PAD_LENGTH = 24_000;
// A box with a closed root, the rows' element's first child, which a search that described every child finds.
const BOX = "<x-box></x-box>";
const BOX_SETUP = "document.querySelector('x-box').attachShadow({ mode: 'closed' }).innerHTML = '<button>Inside</button>';";

function rowsPage(title: string, rows: number, row: (i: string) => string, box: string = ""): string {
  return `<!doctype html><title>${title}</title><style>#rows::before { content: "${ROWS_BEFORE}"; }</style><div id="rows">${box}`
    + `<script>${box === "" ? "" : BOX_SETUP}document.write(Array.from({ length: ${rows} }, (_, i) => ${row("i")}).join(''))</script></div>`;
}

function linkRow(words: number): (i: string) => string {
  return (i: string): string => `'<div><a href="#r' + ${i} + '">Row ' + ${i} + ' word'.repeat(${words}) + '</a></div>'`;
}

function buttonRow(i: string): string {
  return `'<div role="button" aria-label="Row ' + ${i} + ' word'.repeat(${BUTTON_NAME_WORDS}) + '" data-pad="' + 'x'.repeat(${ROW_PAD_LENGTH}) + '"></div>'`;
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function treeOf(notes: readonly string[]): string {
  const snapshot = notes.find(t => t.includes("\n- RootWebArea")) ?? "";
  expect(snapshot, `No text holds the tree: ${notes.map(t => t.slice(0, 200)).join(" | ")}`).not.toBe("");
  return snapshot.slice(snapshot.indexOf("\n- RootWebArea") + 1);
}

function textsOf(result: JsonValue): string[] {
  const content = isObject(result) ? result["content"] : undefined;
  return (Array.isArray(content) ? content : []).map((t: JsonValue) => {
    const text = isObject(t) ? t["text"] : undefined;
    return typeof text === "string" ? text : "";
  });
}

test.describe("a snapshot of a long page", () => {
  test("a long page gives its first lines up to the snapshot's limit, with references and the cut note", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, "The snapshot failed.").toEqual(expect.objectContaining({ isFailure: false }));
    // The result may carry other texts, such as where its content comes from, beside the snapshot and its notes.
    const notes = textsOf(result);
    const tree = treeOf(notes);
    expect(tree.split("\n").slice(0, 3).map(t => t.replace(/ "Section 0 .*"/u, " \"Section 0 …\""))).toEqual([
      "- RootWebArea \"Long page\"",
      "  - list",
      "    - listitem"
    ]);
    expect(tree).toMatch(/^ {6}- link "Section 0(?: word){800}" \[e1\]$/mu);
    expect(Buffer.byteLength(tree, "utf8")).toBeLessThanOrEqual(SNAPSHOT_LIMIT_BYTES);
    expect(Buffer.byteLength(tree, "utf8")).toBeGreaterThan(SNAPSHOT_LIMIT_BYTES - LONGEST_LINE_BYTES);
    expect(notes).toContain(CUT_NOTE);
    expect(notes).not.toContain(FROM_VIEW_NOTE);
  });

  for (const [title, role, words, row, box] of [
    ["a page with 12,000 short link rows under one element", "link", 0, linkRow(0), BOX],
    ["a page with 12,000 link rows of 30-word names under one element", "link", LINK_NAME_WORDS, linkRow(LINK_NAME_WORDS), BOX],
    ["a page with more children under one element than one reply could list", "button", BUTTON_NAME_WORDS, buttonRow, ""]] as const)
    test(`${title} gives its first lines, with references and the cut note, and a search that is whole or names what it left, within the step's time`, async ({ app, servers }, testInfo) => {
      const docs = await servers.startAsync("docs.localhost", { "/": rowsPage("Rows page", ROWS, row, box) });
      await app.allowLocalSitesAsync([docs.origin]);
      const instance = await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Rows page")]);

      const started = performance.now();
      const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });
      const milliseconds = Math.round(performance.now() - started);
      testInfo.annotations.push({ type: "snapshot ms", description: String(milliseconds) });

      expect(result, `The snapshot failed: ${JSON.stringify(result).slice(0, 2_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
      const notes = textsOf(result);
      const tree = treeOf(notes);
      expect(tree).toMatch(new RegExp(`^ *- StaticText "${ROWS_BEFORE}"$(?:\\n.*)*?\\n *- ${role} "Row 0(?: word){${words}}" \\[e\\d+\\]$`, "mu"));
      expect(tree).toMatch(new RegExp(`^ *- ${role} "Row 1(?: word){${words}}" \\[e\\d+\\]$`, "mu"));
      expect(tree).not.toMatch(new RegExp(`"Row ${ROWS - 1}[ "]`, "u"));
      expect(Buffer.byteLength(tree, "utf8")).toBeLessThanOrEqual(SNAPSHOT_LIMIT_BYTES);
      expect(notes).toContain(CUT_NOTE);
      if (box === "")
        expect(notes).toContain(UNSEARCHED_NOTE);
      else {
        const unsearched = notes.map(t => ROWS_UNSEARCHED.exec(t)?.[1]).filter(t => t !== undefined).map(t => Number(t.replaceAll(",", "")));
        testInfo.annotations.push({ type: "unsearched", description: String(unsearched[0] ?? 0) });
        expect(unsearched.every(t => t >= 1 && t <= 12_002), `Unsearched: ${unsearched.join(", ")}`).toBe(true);
        expect(unsearched.length <= 1 && (unsearched.length === 1 || /^ *- button "Inside" \[e\d+\]$/mu.test(tree)),
          `With no note, the box's closed root should be read: ${notes.filter(t => t.includes("not searched")).join(" | ")}`).toBe(true);
      }
      expect(milliseconds, `The snapshot took ${milliseconds} ms.`).toBeLessThan(STEP_MS);
    });

  // Each row's padded link puts the rows' whole answer past the reply's 4 MiB bound while their own level fits, so the search splits them,
  // and 200 rows are well within what its 2 s describe on the slowest machine measured.
  test("a page of 200 rows that the search must split is searched whole within the search's time", async ({ app, servers }, testInfo) => {
    const row = (i: string): string => `'<div><a href="#r' + ${i} + '" data-pad="' + 'x'.repeat(${SPLIT_PAD_LENGTH}) + '">Row ' + ${i} + '</a></div>'`;
    const docs = await servers.startAsync("docs.localhost", { "/": rowsPage("Rows page", SPLIT_ROWS, row) });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Rows page")]);

    const started = performance.now();
    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });
    const milliseconds = Math.round(performance.now() - started);
    testInfo.annotations.push({ type: "snapshot ms", description: String(milliseconds) });

    expect(result, `The snapshot failed: ${JSON.stringify(result).slice(0, 2_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
    const notes = textsOf(result);
    expect(treeOf(notes)).toMatch(/^ *- link "Row 0" \[e1\]$/mu);
    expect(notes.filter(t => t.includes("were not searched"))).toEqual([]);
    expect(milliseconds, `The snapshot took ${milliseconds} ms.`).toBeLessThan(STEP_MS);
  });

  test("on a long page scrolled down, the snapshot starts where it is scrolled to, after the lines that lead there, and says so", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);
    const scrolled = await app.viewPages.runAtAsync(docs.url("/"), "document.querySelectorAll('li')[200].scrollIntoView(); String(window.scrollY)");
    expect(Number(scrolled), "The page didn't scroll.").toBeGreaterThan(0);

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, "The snapshot failed.").toEqual(expect.objectContaining({ isFailure: false }));
    const notes = textsOf(result);
    const tree = treeOf(notes);
    const sections = [...tree.matchAll(/^ {6}- link "Section (\d+) /gmu)].map(t => Number(t[1]));
    const [first = -1] = sections;
    expect(tree.split("\n").slice(0, 3).map(t => t.replace(/ "Section \d+ .*"/u, " \"Section …\""))).toEqual([
      "- RootWebArea \"Long page\"",
      "  - list",
      "    - listitem"
    ]);
    expect(first, `The snapshot starts at section ${first}.`).toBeGreaterThanOrEqual(200);
    expect(first, `The snapshot starts at section ${first}.`).toBeLessThanOrEqual(202);
    expect(sections.slice(0, 3)).toEqual([first, first + 1, first + 2]);
    expect(tree).toMatch(/^ {6}- link "Section \d+(?: word){800}" \[e1\]$/mu);
    expect(Buffer.byteLength(tree, "utf8")).toBeLessThanOrEqual(SNAPSHOT_LIMIT_BYTES);
    expect(notes).toEqual(expect.arrayContaining([FROM_VIEW_NOTE, CUT_NOTE]));
  });

  test("on a long page scrolled to an svg icon, the snapshot starts at the icon, which it doesn't enter, and gives what follows it", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": ICON_PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);
    const hit = await app.viewPages.runAtAsync(docs.url("/"), "document.querySelector('svg').scrollIntoView(); document.elementFromPoint(innerWidth / 2, innerHeight / 4).localName");
    expect(hit, "The view's point isn't on the icon.").toBe("path");

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, "The snapshot failed.").toEqual(expect.objectContaining({ isFailure: false }));
    const notes = textsOf(result);
    const tree = treeOf(notes);
    const sections = [...tree.matchAll(/^ {6}- link "Section (\d+) /gmu)].map(t => Number(t[1]));
    expect(sections.slice(0, 3)).toEqual([ICON_SECTION, ICON_SECTION + 1, ICON_SECTION + 2]);
    expect(tree).toMatch(/^ {6}- link "Section \d+(?: word){800}" \[e1\]$/mu);
    expect(notes).toEqual(expect.arrayContaining([FROM_VIEW_NOTE, CUT_NOTE]));
  });
});
