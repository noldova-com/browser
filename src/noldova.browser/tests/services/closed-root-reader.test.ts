/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import type { ClosedRead } from "../../src/models/closed-read.ts";
import { ClosedRootReader } from "../../src/services/closed-root-reader.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function node(id: string, role: string, name: string, childIds: readonly string[] = [], value: string = "", isIgnored: boolean = false): JsonObject {
  return {
    nodeId: id, ignored: isIgnored, role: { type: "role", value: role }, name: { type: "computedString", value: name }, value: { type: "string", value },
    childIds: [...childIds], backendDOMNodeId: Number(id)
  };
}

const HOST: JsonObject = node("10", "generic", "", ["11", "12", "13", "16"]);
const HEADING: JsonObject = node("11", "heading", "Cart", ["17"]);
const TEXT: JsonObject = node("17", "StaticText", "Cart", ["18"]);
const BOX: JsonObject = node("18", "InlineTextBox", "Cart");
const GROUP: JsonObject = node("12", "generic", "", ["14", "15"]);
const BUY: JsonObject = node("14", "button", "Buy");
const EMAIL: JsonObject = node("15", "textbox", "Email", [], "a@b.test");
const CODE: JsonObject = node("13", "textbox", "Code", [], "1234");
const LIST: JsonObject = node("16", "list", "Items", ["19"]);
const ITEM: JsonObject = node("19", "listitem", "One");
const HEADING_LINE_BYTES: number = "  - heading \"Cart\"\n".length;
const TEXT_LINE_BYTES: number = "    - StaticText \"Cart\"\n".length;

describe("ClosedRootReader", () => {
  let surface: ScriptedViews;
  let log: FakeModuleLog;

  function readAsync(isHostShown: boolean = true, depth: number = 2, isInteractive: boolean = false, mostDepth: number | null = null,
    maximumBytes: number = 10_000, deadline: number = Date.now() + 5_000): Promise<ClosedRead | null> {
    const options: CallOptions = new CallOptions(new AbortController().signal, deadline, 1_000, false, new ActionProgress(() => undefined));
    return new ClosedRootReader(new ViewCalls(surface.relay), log).readAsync("view-1", 10, isHostShown, depth, isInteractive, mostDepth, maximumBytes, options);
  }

  function children(byParent: Readonly<Record<string, readonly JsonObject[]>>): void {
    surface.answerWith("Accessibility.getChildAXNodes", t => ({ nodes: [...byParent[String(t["id"])] ?? []] }));
  }

  function rows(read: ClosedRead | null): JsonValue[] {
    return (read?.lines ?? []).map(t => [t.depth, t.role, t.name, t.value, t.isMasked, t.backendNodeId]);
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge("Accessibility.enable", "Accessibility.disable");
    surface.answer("Accessibility.getPartialAXTree", { nodes: [HOST] });
    surface.answerWith("DOM.describeNode", t => ({ node: { nodeName: "INPUT", attributes: t["backendNodeId"] === 13 ? ["autocomplete", "one-time-code"] : ["type", "email"] } }));
    children({ 10: [LIST, HEADING, CODE, GROUP], 11: [TEXT], 12: [EMAIL, BUY], 16: [ITEM] });
    log = new FakeModuleLog();
  });

  it("reads the host's subtree in its own order below the host's line, lifts unnamed groups, masks a secret field and references only actionable lines", async () => {
    const read: ClosedRead | null = await readAsync();

    expect([rows(read), read?.isCut, read?.isDeeper]).toEqual([[
      [3, "heading", "Cart", "", false, null],
      [4, "StaticText", "Cart", "", false, null],
      [3, "button", "Buy", "", false, 14],
      [3, "textbox", "Email", "a@b.test", false, 15],
      [3, "textbox", "Code", "", true, 13],
      [3, "list", "Items", "", false, null],
      [4, "listitem", "One", "", false, null]
    ], false, false]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([
      ["Accessibility.enable", {}],
      ["Accessibility.getPartialAXTree", { backendNodeId: 10, fetchRelatives: false }],
      ["Accessibility.getChildAXNodes", { id: "10" }],
      ["Accessibility.getChildAXNodes", { id: "11" }],
      ["Accessibility.getChildAXNodes", { id: "12" }],
      ["DOM.describeNode", { backendNodeId: 15 }],
      ["DOM.describeNode", { backendNodeId: 13 }],
      ["Accessibility.getChildAXNodes", { id: "16" }],
      ["Accessibility.disable", {}]
    ]);
  });

  it("starts with the element's own line for a part, and skips ignored nodes but keeps their children", async () => {
    surface.answer("Accessibility.getPartialAXTree", { nodes: [node("10", "generic", "Card", ["11"], "", true)] });

    expect(rows(await readAsync(false, 0))).toEqual([[0, "heading", "Cart", "", false, null], [1, "StaticText", "Cart", "", false, null]]);
  });

  it("keeps only actionable lines and headings when interactive", async () => {
    expect(rows(await readAsync(true, 0, true))).toEqual([
      [1, "heading", "Cart", "", false, null], [1, "button", "Buy", "", false, 14], [1, "textbox", "Email", "a@b.test", false, 15],
      [1, "textbox", "Code", "", true, 13]]);  });

  it("stops below the most depth at a line with children, referenced by its node, and says so", async () => {
    const read: ClosedRead | null = await readAsync(true, 0, false, 2);

    expect([rows(read), read?.isDeeper]).toEqual([[
      [1, "heading", "Cart", "", false, 11], [1, "button", "Buy", "", false, 14], [1, "textbox", "Email", "a@b.test", false, 15],
      [1, "textbox", "Code", "", true, 13], [1, "list", "Items", "", false, 16]], true]);
  });

  it("never writes a line's text boxes", async () => {
    surface.answer("Accessibility.getPartialAXTree", { nodes: [node("10", "generic", "", ["18"])] });
    children({ 10: [BOX] });

    expect(rows(await readAsync())).toEqual([]);
  });

  it("masks a field that has no element to tell by", async () => {
    children({ 10: [{ nodeId: "13", ignored: false, role: { type: "role", value: "textbox" }, name: { type: "computedString", value: "Code" }, value: { type: "string", value: "1234" } }] });

    expect(rows(await readAsync())).toEqual([[3, "textbox", "Code", "", true, null]]);
    expect(surface.calls.map(t => t.method)).not.toContain("DOM.describeNode");
  });

  it("cuts at a line once the next would pass the bytes it is given", async () => {
    const read: ClosedRead | null = await readAsync(true, 0, false, null, HEADING_LINE_BYTES + TEXT_LINE_BYTES);

    expect([rows(read), read?.isCut]).toEqual([[[1, "heading", "Cart", "", false, null], [2, "StaticText", "Cart", "", false, null]], true]);
    expect(surface.calls.at(-1)?.method).toBe("Accessibility.disable");
  });

  it("stops, cut, once the step's time is nearly over", async () => {
    const read: ClosedRead | null = await readAsync(true, 0, false, null, 10_000, Date.now() + 500);

    expect([rows(read), read?.isCut]).toEqual([[], true]);
  });

  it("gives none for a host the page removed, and leaves out a child removed after its parent was read", async () => {
    surface.fail("Accessibility.getChildAXNodes", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));

    expect(rows(await readAsync())).toEqual([]);

    surface.fail("Accessibility.getPartialAXTree", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));

    expect(await readAsync()).toBeNull();
    surface.answer("Accessibility.getPartialAXTree", { nodes: [node("9", "generic", "")] });
    expect(await readAsync()).toBeNull();
    expect(surface.calls.filter(t => t.method === "Accessibility.disable")).toHaveLength(3);
  });

  it("passes on any other failure, after turning the tree off", async () => {
    surface.answer("Accessibility.getChildAXNodes", { nodes: 5 });

    await expect(readAsync()).rejects.toBeInstanceOf(MalformedReplyException);
    expect(surface.calls.at(-1)?.method).toBe("Accessibility.disable");
  });

  it("logs turning the tree off that fails, but not for a view that closed, crashed or lost its profile", async () => {
    surface.fail("Accessibility.disable", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));
    await readAsync();
    for (const kind of [WebViewFailureKind.ViewClosed, WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared]) {
      surface.fail("Accessibility.disable", new WebViewFailure(kind));
      await readAsync();
    }

    expect(writtenTo(log)).toEqual([expect.stringMatching(/^The view view-1 may keep its accessibility tree on: /v)]);
  });

  it("passes on a failure turning the tree off that isn't a call's, since only a bug makes one", async () => {
    const bug: TypeError = new TypeError("Turning off broke.");
    surface.answerWith("Accessibility.disable", () => {
      throw bug;
    });

    await expect(readAsync()).rejects.toBe(bug);
  });
});
