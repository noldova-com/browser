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

// Each link's name is long, so the page's whole accessibility tree passes Noldova Desktop's 4 MiB reply limit with few nodes to lay out.
const PAGE = "<!doctype html><title>Long page</title><ul>"
  + `<script>document.write(Array.from({ length: ${SECTIONS} }, (_, i) => '<li><a href="#s' + i + '">Section ' + i + ' ' + 'word '.repeat(${SECTION_NAME_LENGTH / 5}) + '</a></li>').join(''))</script></ul>`;

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

test.describe("a snapshot of a long page", () => {
  test("a page whose accessibility tree passes the reply limit gives its first lines up to the snapshot's limit, with references and the cut note", async ({ app, servers }) => {
    const docs = await servers.startAsync("docs.localhost", { "/": PAGE });
    await app.allowLocalSitesAsync([docs.origin]);
    const instance = await app.openPageAsync(docs.url("/"));
    await expect.poll(() => app.viewPages.listAsync()).toEqual([new ViewPage(docs.url("/"), "Long page")]);

    const result = await app.requestAsync("agent-double.callTool", { name: "browser_snapshot", input: {}, bindings: { page: instance, profileKey: PROFILE_KEY } });

    expect(result, "The snapshot failed.").toEqual(expect.objectContaining({ isFailure: false }));
    const [snapshot = "", ...notes] = textsOf(result);
    const tree = snapshot.slice(snapshot.indexOf("- RootWebArea"));
    expect(tree.split("\n").slice(0, 3).map(t => t.replace(/ "Section 0 .*"/u, " \"Section 0 …\""))).toEqual([
      "- RootWebArea \"Long page\"",
      "  - list",
      "    - listitem"
    ]);
    expect(tree).toMatch(/^ {6}- link "Section 0 (?:word ){800}" \[e1\]$/mu);
    expect(Buffer.byteLength(tree, "utf8")).toBeLessThanOrEqual(SNAPSHOT_LIMIT_BYTES);
    expect(Buffer.byteLength(tree, "utf8")).toBeGreaterThan(SNAPSHOT_LIMIT_BYTES - LONGEST_LINE_BYTES);
    expect(notes).toContain(CUT_NOTE);
  });
});
