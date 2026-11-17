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
const CUT_NOTE = "The snapshot was cut at its limit; act on what it shows, or scroll and take another.";
const FROM_VIEW_NOTE = "The page is too large to read from its start, so the snapshot starts where it is scrolled to; scroll up and take another for what is above.";

// Each link's name is long, so the page's whole accessibility tree passes Noldova Desktop's 4 MiB reply limit with few nodes to lay out.
const PAGE = "<!doctype html><title>Long page</title><ul>"
  + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`;

// Rows under one element: 4,000 link rows make the page's whole tree pass the 4 MiB reply limit, so the snapshot reads it a node's
// children at a time, thousands of calls within its time limit. 12,000 rows make that element's children alone pass it too; they are
// elements with a button role, a node each that the page reads quickly on its own, as 12,000 link rows make a whole tree whose first read
// alone nearly fills the time limit (#68).
const ROWS = 12_000;
const LINK_ROWS = 4_000;
// With a long attribute on each row, even the list of that element's children passes the limit.
const ROW_PAD_LENGTH = 400;

function rowsPage(title: string, rows: number, row: (i: string) => string): string {
  return `<!doctype html><title>${title}</title><div id="rows">`
    + `<script>document.write(Array.from({ length: ${rows} }, (_, i) => ${row("i")}).join(''))</script></div>`;
}

function linkRow(i: string): string {
  return `'<div><a href="#r' + ${i} + '">Row ' + ${i} + '</a></div>'`;
}

function buttonRow(i: string, pad: number = 0): string {
  return `'<div role="button" aria-label="Row ' + ${i} + '"${pad === 0 ? "" : ` data-pad="' + 'x'.repeat(${pad}) + '"`}></div>'`;
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
  test("a page whose accessibility tree passes the reply limit gives its first lines up to the snapshot's limit, with references and the cut note", async ({ app, servers }) => {
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

  for (const [title, rows, role, row] of [["a page with thousands of link rows under one element", LINK_ROWS, "link", linkRow],
    ["a page with more children under one element than one reply holds", ROWS, "button", buttonRow]] as const)
    test(`${title} gives its first lines, with references and the cut note`, async ({ app, servers }) => {
      const docs = await servers.startAsync("docs.localhost", { "/": rowsPage("Rows page", rows, row) });
      await app.allowLocalSitesAsync([docs.origin]);
      const instance = await app.openPageAsync(docs.url("/"));
      await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Rows page")]);

      const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

      expect(result, `The snapshot failed: ${JSON.stringify(result).slice(0, 2_000)}`).toEqual(expect.objectContaining({ isFailure: false }));
      const notes = textsOf(result);
      const tree = treeOf(notes);
      expect(tree).toMatch(new RegExp(`^ *- ${role} "Row 0" \\[e1\\]$`, "mu"));
      expect(tree).toMatch(new RegExp(`^ *- ${role} "Row 1" \\[e2\\]$`, "mu"));
      expect(tree).not.toMatch(new RegExp(`"Row ${rows - 1}"`, "u"));
      expect(Buffer.byteLength(tree, "utf8")).toBeLessThanOrEqual(SNAPSHOT_LIMIT_BYTES);
      expect(notes).toContain(CUT_NOTE);
    });

  test("a page with an element whose children are too many even to list fails as too large, naming the element", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": rowsPage("Wider page", ROWS, i => buttonRow(i, ROW_PAD_LENGTH)) });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Wider page")]);

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result).toEqual(expect.objectContaining({ isFailure: true, code: "TooLarge",
      message: `A generic element on the page has ${ROWS} children, more than one answer can carry, so the snapshot can't read past it.` }));
  });

  test("on such a page scrolled down, the snapshot starts where it is scrolled to, after the lines that lead there, and says so", async ({ app, servers }) => {
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
});
