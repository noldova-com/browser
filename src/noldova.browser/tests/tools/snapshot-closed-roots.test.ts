/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import type { ToolResult } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { JsonShapes } from "../../src/services/json-shapes.ts";
import { SnapshotTool } from "../../src/tools/snapshot.tool.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { CallFailures } from "../fixtures/call-failures.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

const FRAME: JsonObject = { frameTree: { frame: { id: "F1", loaderId: "L1", url: "https://shop.test/cart", securityOrigin: "https://shop.test" } } };

const CUT: string = "The snapshot was cut at its limit; take another with interactive or a depth for less, read an element's part by its reference with part, or scroll and take another.";

// A reply larger than the tree's bound of 4 MiB.
const TOO_LARGE: JsonObject = { node: { backendNodeId: 0, nodeValue: "x".repeat(4 * 1024 * 1024) } };

function element(id: number, localName: string, children: readonly JsonObject[] = [], shadowRoots: readonly JsonObject[] = []): JsonObject {
  return { backendNodeId: id, nodeType: 1, localName, children: [...children], shadowRoots: [...shadowRoots] };
}

// The document: a card whose closed root the page's script can't open, and a link after it.
const DOCUMENT: JsonObject = {
  backendNodeId: 1, nodeType: 9,
  children: [element(2, "html", [element(3, "body", [element(7, "x-card", [], [{ backendNodeId: 6, nodeType: 11, shadowRootType: "closed" }]), element(5, "a")])])]
};

function axNode(id: number, role: string, name: string, childIds: readonly number[] = [], value: string = ""): JsonObject {
  return {
    nodeId: String(id), ignored: false, role: { type: "role", value: role }, name: { type: "computedString", value: name }, value: { type: "string", value },
    childIds: childIds.map(t => String(t)), backendDOMNodeId: id
  };
}

const NODES: ReadonlyMap<string, JsonObject> = new Map([
  axNode(7, "generic", "Card", [8, 9, 10]),
  axNode(8, "button", "Buy"),
  axNode(9, "textbox", "PIN", [], "1234"),
  axNode(10, "list", "Sizes", [11]),
  axNode(11, "listitem", "Small")
].map(t => [String(t["nodeId"]), t]));

function nodesOf(ids: readonly string[]): JsonObject[] {
  return ids.flatMap(t => [NODES.get(t)].filter(n => n !== undefined));
}

const HOST_LINE: JsonValue = [1, "generic", "Card", "", false, 0, 0];
const LINK_LINE: JsonValue = [1, "link", "After", "", false, 1, -1];

describe("SnapshotTool with closed shadow roots", () => {
  let bench: ToolBench;
  let tool: SnapshotTool;

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    bench = new ToolBench();
    bench.surface.answer("Page.getFrameTree", FRAME);
    bench.surface.answerWith("DOM.describeNode", t => t["depth"] === undefined ? { node: { nodeName: "INPUT", attributes: ["type", "password"] } } : { node: DOCUMENT });
    bench.surface.answerWith("DOM.resolveNode", t => ({ object: { type: "object", subtype: "node", objectId: `node-${String(t["backendNodeId"])}` } }));
    bench.surface.acknowledge("Accessibility.enable", "Accessibility.disable");
    bench.surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: nodesOf([String(t["backendNodeId"])]) }));
    bench.surface.answerWith("Accessibility.getChildAXNodes", t => {
      const ids: JsonValue | undefined = NODES.get(String(t["id"]))?.["childIds"];
      return { nodes: nodesOf(JsonShapes.isArray(ids) ? ids.map(c => String(c)) : []) };
    });
    bench.surface.snapshot = () => ScriptedViews.snapshotOf("Cart", [HOST_LINE, LINK_LINE]);
    tool = new SnapshotTool(bench.kit);
  });

  it("finds the host, gives it to the function, and reads what its closed root holds from the accessibility tree after the host's line, masked and referenced", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({}));

    expect(String(result.content[1]?.value).split("\n").slice(3)).toEqual([
      "- RootWebArea \"Cart\"",
      "  - generic \"Card\" [e1]",
      "    - button \"Buy\" [e2]",
      "    - textbox \"PIN\" value=\"••••••\" [e3]",
      "    - list \"Sizes\"",
      "      - listitem \"Small\"",
      "  - link \"After\" [e4]"
    ]);
    expect(JSON.stringify(result)).not.toContain("1234");
    expect([bench.surface.snapshotObjects, result.content.length]).toEqual([[["node-7"]], 2]);
    expect(bench.surface.calls.filter(t => t.method === "DOM.describeNode").map(t => t.params)).toEqual([
      { backendNodeId: 1, depth: -1, pierce: true }, { backendNodeId: 9 }]);
    expect([1, 2, 3, 4].map(t => bench.sessions.resolveReference(ToolBench.SESSION, `e${t}`, "view-1", "L1"))).toStrictEqual([
      new SnapshotReference("view-1", "L1", 0), new ElementReference("view-1", "L1", 8), new ElementReference("view-1", "L1", 9),
      new SnapshotReference("view-1", "L1", 1)]);
  });

  it("keeps interactive and the depth inside the closed root, and says when it left out deeper lines", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({ interactive: true, depth: 2 }));

    expect(String(result.content[1]?.value).split("\n").slice(4)).toEqual([
      "  - generic \"Card\" [e1]", "    - button \"Buy\" [e2]", "    - textbox \"PIN\" value=\"••••••\" [e3]", "  - link \"After\" [e4]"]);

    const deeper: ToolResult = await bench.runAsync(tool, bench.call({ depth: 2 }));

    expect(String(deeper.content[1]?.value).split("\n").slice(7, 8)).toEqual(["    - list \"Sizes\" [e8]"]);
    expect(deeper.content.slice(2).map(t => t.value)).toEqual(["Lines deeper than 2 levels were left out; read an element's part by its reference with part."]);
  });

  it("reads a part inside a closed root from the accessibility tree alone, titled by the page", async () => {
    await bench.runAsync(tool, bench.call({}));
    bench.surface.answer("Accessibility.getFullAXTree", { nodes: [axNode(1, "RootWebArea", "Cart")] });

    const result: ToolResult = await bench.runAsync(tool, bench.call({ part: "e2" }));

    expect(String(result.content[1]?.value).split("\n").slice(1)).toEqual(["Title: Cart", "", "- button \"Buy\" [e5]"]);
    expect(bench.surface.snapshotRequests.length).toBe(1);
  });

  it("fails a part inside a closed root that left the page as stale", async () => {
    await bench.runAsync(tool, bench.call({}));
    bench.surface.fail("Accessibility.getPartialAXTree", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));

    await CallFailures.expectAsync(bench.runAsync(tool, bench.call({ part: "e2" })), StaleReferenceException, { reason: "Refused", moduleCode: "browser.staleReference" });
  });

  it("keeps the host's line alone when the page removed the host after the function read it", async () => {
    bench.surface.fail("Accessibility.getPartialAXTree", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));

    const result: ToolResult = await bench.runAsync(tool, bench.call({}));

    expect(String(result.content[1]?.value).split("\n").slice(4)).toEqual(["  - generic \"Card\" [e1]", "  - link \"After\" [e2]"]);
    expect(result.content.length).toBe(2);
  });

  it("leaves a host with its line alone once the step's time is nearly over, and says how many", async () => {
    const result: ToolResult = await bench.runAsync(tool, bench.call({}, new AbortController(), ToolBench.SESSION, 900));

    expect(String(result.content[1]?.value).split("\n").slice(4)).toEqual(["  - generic \"Card\" [e1]", "  - link \"After\" [e2]"]);
    expect(result.content.slice(2).map(t => t.value)).toEqual([
      "1 of the page's closed parts, which its own script hides, went unread within the snapshot's limit or time; each shows only its element's line, and part reads one by its reference."]);
    expect(bench.methods).not.toContain("Accessibility.enable");
  });

  it("cuts a host past the most bytes with its line, reading nothing for it, and reads the closed root of a host within them only up to them", async () => {
    const links: JsonValue[] = Array.from({ length: 2_500 }, (_value: unknown, index: number): JsonValue => [1, "link", `Section ${index} ${"x".repeat(40)}`, "", false, index + 1]);
    bench.surface.snapshot = () => ScriptedViews.snapshotOf("Cart", [...links, HOST_LINE]);

    const past: ToolResult = await bench.runAsync(tool, bench.call({}));

    expect([bench.methods.includes("Accessibility.enable"), past.content.slice(2).map(t => t.value)]).toEqual([false, [CUT]]);

    bench.surface.snapshot = () => ScriptedViews.snapshotOf("Cart", [HOST_LINE, ...links]);
    const many: readonly JsonObject[] = Array.from({ length: 3_000 }, (_value: unknown, index: number) => axNode(100 + index, "button", `Buy ${"y".repeat(40)}`));
    bench.surface.answer("Accessibility.getPartialAXTree", { nodes: [axNode(7, "generic", "Card", many.map(t => Number(t["nodeId"])))] });
    bench.surface.answer("Accessibility.getChildAXNodes", { nodes: [...many] });

    const within: ToolResult = await bench.runAsync(tool, bench.call({}));

    const lines: readonly string[] = String(within.content[1]?.value).split("\n");
    expect([lines.at(-1)?.startsWith("    - button \"Buy "), lines.some(t => t.includes("link")), within.content.slice(2).map(t => t.value)]).toEqual([true, false, [CUT]]);
  });

  it("names an element too large for the browser to describe as not searched, and the page still gives its lines", async () => {
    bench.surface.answerWith("DOM.describeNode", t => {
      if (t["backendNodeId"] === 1)
        return t["depth"] === 1 ? { node: { backendNodeId: 1, nodeType: 9, children: [{ ...element(2, "div"), attributes: ["id", "rows"] }] } } : TOO_LARGE;
      return TOO_LARGE;
    });
    bench.surface.snapshot = () => ScriptedViews.snapshotOf("Cart", [LINK_LINE]);

    const result: ToolResult = await bench.runAsync(tool, bench.call({}));

    expect([bench.surface.snapshotObjects, String(result.content[1]?.value).split("\n").slice(4)]).toEqual([[[]], ["  - link \"After\" [e1]"]]);
    expect(result.content.slice(2).map(t => t.value)).toEqual([
      "Closed parts inside <div id=\"rows\"> were not searched, as there was too much to describe in one answer or in the time for it; a closed part there shows only its element's line."]);
  });
});
