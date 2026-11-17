/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import type { AccessibilityTree } from "../../src/models/accessibility-tree.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { AccessibilityWalk } from "../../src/services/accessibility-walk.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function node(id: string, role: string, name: string, childIds: readonly string[] = []): JsonObject {
  return { nodeId: id, ignored: false, role: { type: "role", value: role }, name: { type: "computedString", value: name }, childIds: [...childIds] };
}

const ROOT: JsonObject = node("1", "RootWebArea", "Page", ["2", "3"]);
const LINK: JsonObject = node("2", "link", "A");
const GROUP: JsonObject = node("3", "generic", "", ["4"]);
const BUTTON: JsonObject = node("4", "button", "B");
const ROOT_LINE_BYTES: number = "- RootWebArea \"Page\"\n".length;
const LINK_LINE_BYTES: number = "- link \"A\"\n".length;
const BUTTON_LINE_BYTES: number = "- button \"B\"\n".length;

function layout(pageY: number): JsonObject {
  return { cssVisualViewport: { pageX: 0, pageY, clientWidth: 800, clientHeight: 600 }, cssContentSize: { width: 800, height: 9000 }, visualViewport: { clientWidth: 800 } };
}

describe("AccessibilityWalk", () => {
  let surface: ScriptedViews;
  let log: FakeModuleLog;

  function readAsync(maximumBytes: number = 10_000): Promise<AccessibilityTree> {
    const options: CallOptions = new CallOptions(new AbortController().signal, Date.now() + 5_000, 1_000, false, new ActionProgress(() => undefined));
    return new AccessibilityWalk(new ViewCalls(surface.relay), log).readAsync("view-1", options, maximumBytes);
  }

  function children(byParent: Readonly<Record<string, readonly JsonObject[]>>): void {
    surface.answerWith("Accessibility.getChildAXNodes", t => ({ nodes: [...byParent[String(t["id"])] ?? []] }));
  }

  function calls(): [string, JsonObject][] {
    return surface.calls.map(t => [t.method, t.params]);
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.acknowledge("Accessibility.enable", "Accessibility.disable");
    surface.answer("Accessibility.getRootAXNode", { node: ROOT });
    surface.answer("Page.getLayoutMetrics", layout(0));
    log = new FakeModuleLog();
  });

  it("reads a tree a node's children at a time in the snapshot's order, whatever order they come in, asks nothing of a leaf, and turns the tree off after", async () => {
    children({ 1: [GROUP, LINK], 3: [BUTTON] });

    const tree: AccessibilityTree = await readAsync();

    expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "4"], true]);
    expect(calls()).toEqual([["Accessibility.enable", {}], ["Accessibility.getRootAXNode", {}], ["Page.getLayoutMetrics", {}],
      ["Accessibility.getChildAXNodes", { id: "1" }], ["Accessibility.getChildAXNodes", { id: "3" }], ["Accessibility.disable", {}]]);
  });

  it("stops once the lines it read are sure to pass the limit, and marks the tree as read in part", async () => {
    children({ 1: [LINK, GROUP], 3: [BUTTON] });

    const whole: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES + BUTTON_LINE_BYTES);
    const cut: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES - 1);

    expect([whole.nodes.length, whole.isWhole, whole.isFromView]).toEqual([4, true, false]);
    expect([cut.nodes.map(t => t.id), cut.isWhole]).toEqual([["1", "2", "3"], false]);
    expect(calls().slice(-3)).toEqual([["Page.getLayoutMetrics", {}], ["Accessibility.getChildAXNodes", { id: "1" }], ["Accessibility.disable", {}]]);
  });

  describe("on a scrolled page", () => {
    const PAGE: JsonObject = node("1", "RootWebArea", "Page", ["2", "3", "6"]);
    const SECTION: JsonObject = node("3", "generic", "", ["4", "5"]);
    const START: JsonObject = { ...node("4", "button", "B"), backendDOMNodeId: 40 };
    const AFTER: JsonObject = node("5", "link", "C");
    const LAST: JsonObject = node("6", "link", "D");

    function scrolled(relatives: readonly JsonObject[] = [PAGE, SECTION, START, AFTER]): void {
      surface.answer("Accessibility.getRootAXNode", { node: PAGE });
      surface.answer("Page.getLayoutMetrics", layout(3000));
      surface.answer("DOM.getNodeForLocation", { backendNodeId: 40, frameId: "frame-1" });
      surface.answer("Accessibility.getPartialAXTree", { nodes: [...relatives] });
      children({ 1: [LINK, SECTION, LAST], 3: [START, AFTER] });
    }

    it("starts at the element a quarter down the view, after the lines that lead to it, and goes on with what follows it", async () => {
      scrolled();

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.map(t => t.id), tree.isWhole, tree.isFromView]).toEqual([["1", "3", "6", "4", "5"], true, true]);
      expect(calls().slice(2, -1)).toEqual([["Page.getLayoutMetrics", {}], ["DOM.getNodeForLocation", { x: 400, y: 3150, includeUserAgentShadowDOM: false }],
        ["Accessibility.getPartialAXTree", { backendNodeId: 40, fetchRelatives: true }], ["Accessibility.getChildAXNodes", { id: "1" }],
        ["Accessibility.getChildAXNodes", { id: "3" }]]);
    });

    it("stops at the limit on the way to the start or after it, and marks the tree as read in part", async () => {
      scrolled();

      const leading: AccessibilityTree = await readAsync(ROOT_LINE_BYTES - 1);
      const after: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + BUTTON_LINE_BYTES);

      expect([leading.nodes.map(t => t.id), leading.isWhole, leading.isFromView]).toEqual([["1"], false, true]);
      expect([after.nodes.map(t => t.id), after.isWhole, after.isFromView]).toEqual([["1", "3", "6", "4", "5"], false, true]);
    });

    it("starts at the root when the point has no element, the element no node, or the node no line of ancestors up to the root", async () => {
      const cases: readonly (() => void)[] = [
        () => surface.fail("DOM.getNodeForLocation", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node found at given location")),
        () => surface.answer("Accessibility.getPartialAXTree", { nodes: [PAGE, SECTION] }),
        () => surface.answer("Accessibility.getPartialAXTree", { nodes: [START, AFTER] }),
        () => surface.answer("Accessibility.getPartialAXTree", { nodes: [{ ...node("4", "button", "B", ["4"]), backendDOMNodeId: 40 }] })
      ];
      for (const fallBack of cases) {
        scrolled();
        fallBack();

        const tree: AccessibilityTree = await readAsync();

        expect([tree.nodes.map(t => t.id), tree.isWhole, tree.isFromView]).toEqual([["1", "2", "3", "6", "4", "5"], true, false]);
      }
    });

    it("fails on a point it can't read, or any other failure finding it", async () => {
      scrolled();
      surface.answer("DOM.getNodeForLocation", { frameId: "frame-1" });

      await expect(readAsync()).rejects.toBeInstanceOf(MalformedReplyException);

      surface.fail("DOM.getNodeForLocation", new WebViewFailure(WebViewFailureKind.ViewClosed));

      await expect(readAsync()).rejects.toBeInstanceOf(ViewClosedException);
    });
  });

  it("leaves out a child its parent doesn't name, one it names that didn't come, and one already read, so a loop ends", async () => {
    children({ 1: [LINK, node("3", "generic", "", ["4", "2", "8"]), node("9", "button", "Stray")], 3: [BUTTON, LINK] });

    const tree: AccessibilityTree = await readAsync();

    expect(tree.nodes.map(t => t.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("leaves out the children of a node the page removed after its parent was read, and fails on any other failure reading them", async () => {
    const failing = (failure: WebViewFailure): void => surface.answerWith("Accessibility.getChildAXNodes", t => {
      if (t["id"] === "3")
        throw new WebViewFailureException(failure);
      return { nodes: [LINK, GROUP] };
    });
    failing(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Invalid ID"));

    const tree: AccessibilityTree = await readAsync();

    expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3"], true]);
    failing(new WebViewFailure(WebViewFailureKind.ViewClosed));
    await expect(readAsync()).rejects.toBeInstanceOf(ViewClosedException);
  });

  it("reads a root or children that aren't nodes as malformed, and still turns the tree off", async () => {
    surface.answer("Accessibility.getRootAXNode", {});

    await expect(readAsync()).rejects.toBeInstanceOf(MalformedReplyException);

    surface.answer("Accessibility.getRootAXNode", { node: ROOT });
    surface.answer("Accessibility.getChildAXNodes", { nodes: 5 });

    await expect(readAsync()).rejects.toBeInstanceOf(MalformedReplyException);
    expect(calls().filter(t => t[0] === "Accessibility.disable")).toHaveLength(2);
  });

  it("logs turning the tree off that fails, but not for a view that closed, crashed or lost its profile", async () => {
    children({ 1: [LINK, GROUP], 3: [BUTTON] });
    surface.fail("Accessibility.disable", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));
    const read: AccessibilityTree = await readAsync();
    for (const kind of [WebViewFailureKind.ViewClosed, WebViewFailureKind.Crashed, WebViewFailureKind.ProfileCleared]) {
      surface.fail("Accessibility.disable", new WebViewFailure(kind));
      await readAsync();
    }

    expect([read.isWhole, writtenTo(log)]).toEqual([true, [expect.stringMatching(/^The view view-1 may keep its accessibility tree on: /)]]);
  });

  it("passes on a failure turning the tree off that isn't a call's, since only a bug makes one", async () => {
    children({ 1: [LINK, GROUP], 3: [BUTTON] });
    const bug: TypeError = new TypeError("Turning off broke.");
    surface.answerWith("Accessibility.disable", () => {
      throw bug;
    });

    await expect(readAsync()).rejects.toBe(bug);
    expect(writtenTo(log)).toEqual([]);
  });
});
