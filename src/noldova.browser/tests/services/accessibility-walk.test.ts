/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { ToolAbortReason, WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { CallDeadlineReachedException } from "../../src/exceptions/call-deadline-reached.exception.ts";
import { ChildrenChangedException } from "../../src/exceptions/children-changed.exception.ts";
import { ChildrenTooManyException } from "../../src/exceptions/children-too-many.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import type { AccessibilityTree } from "../../src/models/accessibility-tree.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { Resources } from "../../src/resources.ts";
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

  function readAsync(maximumBytes: number = 10_000, signal: AbortSignal = new AbortController().signal, deadline: number = Date.now() + 5_000): Promise<AccessibilityTree> {
    const options: CallOptions = new CallOptions(signal, deadline, 1_000, false, new ActionProgress(() => undefined));
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

  it("stops once the lines it read are sure to pass the limit, at the same node whatever it read ahead, and marks the tree as read in part", async () => {
    children({ 1: [LINK, GROUP], 3: [BUTTON] });

    const whole: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES + BUTTON_LINE_BYTES);
    const cut: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES - 1);

    expect([whole.nodes.length, whole.isWhole, whole.isFromView]).toEqual([4, true, false]);
    expect([cut.nodes.map(t => t.id), cut.isWhole]).toEqual([["1", "2", "3"], false]);
    expect(calls().slice(-4)).toEqual([["Page.getLayoutMetrics", {}], ["Accessibility.getChildAXNodes", { id: "1" }], ["Accessibility.getChildAXNodes", { id: "3" }],
      ["Accessibility.disable", {}]]);
  });

  describe("reading ahead", () => {
    const BRANCHES: readonly JsonObject[] = ["2", "3", "4"].map(t => node(t, "generic", "", [`${t}0`]));
    const LEAVES: Readonly<Record<string, readonly JsonObject[]>> = { 20: [node("20", "link", "A")], 30: [node("30", "link", "B")], 40: [node("40", "link", "C")] };

    function branches(answer: (id: string, leaves: readonly JsonObject[]) => Promise<JsonObject>): void {
      surface.answer("Accessibility.getRootAXNode", { node: node("1", "RootWebArea", "Page", ["2", "3", "4"]) });
      surface.answerWith("Accessibility.getChildAXNodes", t => {
        const id: string = String(t["id"]);
        return id === "1" ? { nodes: [...BRANCHES] } : answer(id, LEAVES[`${id}0`] ?? []);
      });
    }

    it("asks for the next nodes' children together and takes their answers in its own order, whatever order they come in", async () => {
      const held: (() => void)[] = [];
      branches((_id, leaves) => new Promise<JsonObject>(resolve => {
        held.push(() => resolve({ nodes: [...leaves] }));
        if (held.length === BRANCHES.length)
          for (const answer of [...held].reverse())
            answer();
      }));

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "4", "20", "30", "40"], true]);
    });

    it(`has at most ${Resources.treeReadsAhead} reads out at once`, async () => {
      const ids: readonly string[] = Array.from({ length: Resources.treeReadsAhead + 4 }, (_, i) => String(i + 2));
      let out: number = 0;
      let most: number = 0;
      surface.answer("Accessibility.getRootAXNode", { node: node("1", "RootWebArea", "Page", ids) });
      surface.answerWith("Accessibility.getChildAXNodes", async t => {
        out++;
        most = Math.max(most, out);
        await new Promise<void>(resolve => setImmediate(resolve));
        out--;
        const id: string = String(t["id"]);
        return { nodes: id === "1" ? ids.map(c => node(c, "generic", "", [`${c}0`])) : [node(`${id}0`, "link", id)] };
      });

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.length, tree.isWhole, most]).toEqual([1 + ids.length * 2, true, Resources.treeReadsAhead]);
    });

    it("stops the reads still out once it reaches the limit, and turns the tree off after them", async () => {
      branches(id => id === "2" ? Promise.resolve({ nodes: [...LEAVES[20] ?? []] }) : new Promise<JsonObject>(() => undefined));

      const tree: AccessibilityTree = await readAsync(ROOT_LINE_BYTES, new AbortController().signal, Date.now() + 600_000);

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "4", "20"], false]);
      expect(calls().slice(3)).toEqual([...["1", "2", "3", "4"].map(t => ["Accessibility.getChildAXNodes", { id: t }]), ["Accessibility.disable", {}]]);
    });

    it("fails at the deadline with every read still out ended, and turns the tree off after them", async () => {
      const stop: AbortController = new AbortController();
      let asked: number = 0;
      branches(() => {
        if (++asked === BRANCHES.length)
          stop.abort(ToolAbortReason.DeadlineReached);
        return new Promise<JsonObject>(() => undefined);
      });

      await expect(readAsync(10_000, stop.signal, Date.now() + 600_000)).rejects.toBeInstanceOf(CallDeadlineReachedException);

      expect(calls().slice(3)).toEqual([...["1", "2", "3", "4"].map(t => ["Accessibility.getChildAXNodes", { id: t }]), ["Accessibility.disable", {}]]);
    });
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

  describe("on a node whose children are too many for one answer", () => {
    const PAGE: JsonObject = node("1", "RootWebArea", "Page", ["2", "3", "9"]);
    const LIST: JsonObject = { ...node("3", "list", "", ["4", "5", "6"]), backendDOMNodeId: 30 };
    const LAST: JsonObject = node("9", "link", "D");
    const ITEMS: Readonly<Record<number, JsonObject>> = {
      30: LIST,
      40: { ...node("4", "listitem", "One"), backendDOMNodeId: 40 },
      50: { ...node("5", "listitem", "Two"), backendDOMNodeId: 50 },
      60: { ...node("6", "listitem", "Three"), backendDOMNodeId: 60 },
      70: { ...node("7", "generic", "Stray"), backendDOMNodeId: 70 }
    };

    function listed(elements: readonly number[]): void {
      surface.answer("Accessibility.getRootAXNode", { node: PAGE });
      surface.answerWith("Accessibility.getChildAXNodes", t => {
        if (t["id"] === "3")
          throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
        return { nodes: t["id"] === "1" ? [LINK, LIST, LAST] : [] };
      });
      surface.answer("DOM.describeNode", { node: { backendNodeId: 30, nodeName: "UL", children: elements.map(t => ({ backendNodeId: t, nodeName: "LI" })) } });
      surface.answerWith("Accessibility.getPartialAXTree", t => {
        if (t["backendNodeId"] === 80)
          throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
        const item: JsonObject | undefined = ITEMS[Number(t["backendNodeId"])];
        return { nodes: item === undefined ? [] : [item] };
      });
    }

    function partials(): readonly JsonObject[] {
      return surface.calls.filter(t => t.method === "Accessibility.getPartialAXTree").map(t => t.params);
    }

    it("lists the node's elements and reads each child on its own, in order, leaving out one without a node, one the page removed and one the node doesn't name", async () => {
      listed([31, 40, 70, 80, 50, 60]);

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", "4", "5", "6"], true]);
      expect(calls().slice(4, -1)).toEqual([["Accessibility.getChildAXNodes", { id: "3" }], ["DOM.describeNode", { backendNodeId: 30, depth: 1 }],
        ...[31, 40, 70, 80, 50, 60].map(t => ["Accessibility.getPartialAXTree", { backendNodeId: t, fetchRelatives: false }])]);
    });

    it("reads the element's ::before first and its ::after last, as the node names them, though the element lists them apart", async () => {
      listed([50]);
      surface.answer("DOM.describeNode", { node: { backendNodeId: 30, children: [{ backendNodeId: 50 }],
        pseudoElements: [{ backendNodeId: 60, pseudoType: "after" }, { backendNodeId: 40, pseudoType: "before" }] } });

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", "4", "5", "6"], true]);
      expect(partials().map(t => t["backendNodeId"])).toEqual([40, 50, 60]);
    });

    it("reads the children of a child it read on its own", async () => {
      listed([40, 50, 60]);
      surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: [t["backendNodeId"] === 60 ? { ...node("6", "listitem", "Three", ["61"]), backendDOMNodeId: 60 } : ITEMS[Number(t["backendNodeId"])] ?? {}] }));
      surface.answerWith("Accessibility.getChildAXNodes", t => {
        if (t["id"] === "3")
          throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
        return { nodes: t["id"] === "1" ? [LINK, LIST, LAST] : [node("61", "link", "E")] };
      });

      const tree: AccessibilityTree = await readAsync();

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", "4", "5", "6", "61"], true]);
    });

    it("reads no child past the limit", async () => {
      listed([40, 50, 60]);

      const tree: AccessibilityTree = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES + 30);

      expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", "4", "5"], false]);
      expect(partials().map(t => t["backendNodeId"])).toEqual([40, 50, 60]);
    });

    it("starts at a child where the page is scrolled to, and reads only the children after it, or all of them when its element isn't listed", async () => {
      for (const [elements, ids] of [[[40, 50, 60], ["1", "3", "9", "5", "6"]], [[40, 60], ["1", "3", "9", "5", "4", "6"]]] as const) {
        listed(elements);
        surface.answer("Page.getLayoutMetrics", layout(3000));
        surface.answer("DOM.getNodeForLocation", { backendNodeId: 50, frameId: "frame-1" });
        surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: t["fetchRelatives"] === true ? [PAGE, LIST, ITEMS[50] ?? {}] : [ITEMS[Number(t["backendNodeId"])] ?? {}] }));

        const tree: AccessibilityTree = await readAsync();

        expect([tree.nodes.map(t => t.id), tree.isWhole, tree.isFromView]).toEqual([ids, true, true]);
      }
    });

    it("fails as too large, naming the node by its role and its children's count, when its element's children are too many too, or it has no element", async () => {
      listed([40]);
      surface.fail("DOM.describeNode", new WebViewFailure(WebViewFailureKind.TooLarge));
      const wide: unknown = await readAsync().catch((error: unknown) => error);
      surface.answerWith("Accessibility.getChildAXNodes", t => {
        if (t["id"] === "3")
          throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
        return { nodes: [LINK, node("3", "list", "", ["4", "5", "6"]), LAST] };
      });
      const unplaced: unknown = await readAsync().catch((error: unknown) => error);

      for (const failure of [wide, unplaced]) {
        expect(failure).toBeInstanceOf(ChildrenTooManyException);
        expect(failure).toMatchObject({ message: "A list element on the page has 3 children, more than one answer can carry, so the snapshot can't read past it." });
      }
      expect(calls().filter(t => t[0] === "Accessibility.disable")).toHaveLength(2);
    });

    it("reads an element's list that isn't one, or a child without its element, as malformed, and fails on any other failure", async () => {
      listed([40]);
      for (const reply of [{}, { node: { children: "LI" } }, { node: { children: ["LI"] } }, { node: { children: [{ nodeName: "LI" }] } }, { node: { pseudoElements: "after" } },
        { node: { pseudoElements: ["after"] } }]) {
        surface.answer("DOM.describeNode", reply);
        await expect(readAsync()).rejects.toBeInstanceOf(MalformedReplyException);
      }
      surface.fail("DOM.describeNode", new WebViewFailure(WebViewFailureKind.ViewClosed));
      await expect(readAsync()).rejects.toBeInstanceOf(ViewClosedException);
      listed([40]);
      surface.fail("Accessibility.getPartialAXTree", new WebViewFailure(WebViewFailureKind.ViewClosed));
      await expect(readAsync()).rejects.toBeInstanceOf(ViewClosedException);
    });

    it("fails as too large, naming the node, when its element doesn't list every child it names, from the start or from where the page is scrolled to", async () => {
      const shadowHost: () => void = () => {
        listed([]);
        surface.answer("DOM.describeNode", { node: { backendNodeId: 30 } });
      };
      const owner: () => void = () => listed([40, 50]);
      const scrolled: () => void = () => {
        listed([40, 50]);
        surface.answer("Page.getLayoutMetrics", layout(3000));
        surface.answer("DOM.getNodeForLocation", { backendNodeId: 50, frameId: "frame-1" });
        surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: t["fetchRelatives"] === true ? [PAGE, LIST, ITEMS[50] ?? {}] : [ITEMS[Number(t["backendNodeId"])] ?? {}] }));
      };
      for (const page of [shadowHost, owner, scrolled]) {
        page();
        const before: number = partials().length;

        const failure: unknown = await readAsync().catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ChildrenTooManyException);
        expect(failure).toMatchObject({ message: "A list element on the page has 3 children, more than one answer can carry, so the snapshot can't read past it." });
        expect(partials().slice(before).filter(t => t["backendNodeId"] === 30)).toEqual([{ backendNodeId: 30, fetchRelatives: false }]);
      }
    });

    it("leaves out a child the page removed during the walk, at the list's end or ahead of a later child, once the node read again no longer names it", async () => {
      for (const [elements, ids] of [[[40, 50], ["4", "5"]], [[40, 60], ["4", "6"]]] as const) {
        listed(elements);
        surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: [t["backendNodeId"] === 30 ? { ...LIST, childIds: [...ids] } : ITEMS[Number(t["backendNodeId"])] ?? {}] }));
        const before: number = partials().length;

        const tree: AccessibilityTree = await readAsync();

        expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", ...ids], true]);
        expect(partials().slice(before).filter(t => t["backendNodeId"] === 30)).toEqual([{ backendNodeId: 30, fetchRelatives: false }]);
      }
    });

    it("leaves out the missing children when the page removed the node itself, or its element no longer has it", async () => {
      const rereads: readonly (() => JsonObject)[] = [() => {
        throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
      }, () => ({ nodes: [] })];
      for (const reread of rereads) {
        listed([40, 60]);
        surface.answerWith("Accessibility.getPartialAXTree", t => t["backendNodeId"] === 30 ? reread() : { nodes: [ITEMS[Number(t["backendNodeId"])] ?? {}] });

        const tree: AccessibilityTree = await readAsync();

        expect([tree.nodes.map(t => t.id), tree.isWhole]).toEqual([["1", "2", "3", "9", "4", "6"], true]);
      }
    });

    it("fails as changed, not too large, when the node read again still names a missing child but its children changed meanwhile", async () => {
      listed([40, 60]);
      surface.answerWith("Accessibility.getPartialAXTree", t => ({ nodes: [t["backendNodeId"] === 30 ? { ...LIST, childIds: ["4", "5", "6", "7"] } : ITEMS[Number(t["backendNodeId"])] ?? {}] }));

      await expect(readAsync()).rejects.toBeInstanceOf(ChildrenChangedException);
    });

    it("fails as too large ahead of a later child, rather than cut with a gap, when the node read again still names the child missing before it", async () => {
      listed([40, 60]);

      const failure: unknown = await readAsync(ROOT_LINE_BYTES + LINK_LINE_BYTES + 30).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ChildrenTooManyException);
      expect(partials().map(t => t["backendNodeId"])).toEqual([40, 60, 30]);
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
