/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ProtocolFailedException } from "../../src/exceptions/protocol-failed.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import type { ClosedRoots } from "../../src/models/closed-roots.ts";
import { ClosedRootFinder } from "../../src/services/closed-root-finder.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

// A reply larger than the tree's bound of 4 MiB.
const TOO_LARGE: JsonObject = { node: { backendNodeId: 0, nodeValue: "x".repeat(4 * 1024 * 1024) } };

function element(id: number, localName: string, children: readonly JsonObject[] = [], shadowRoots: readonly JsonObject[] = []): JsonObject {
  return { backendNodeId: id, nodeType: 1, localName, children: [...children], shadowRoots: [...shadowRoots] };
}

function root(id: number, type: string, children: readonly JsonObject[] = []): JsonObject {
  return { backendNodeId: id, nodeType: 11, shadowRootType: type, children: [...children] };
}

describe("ClosedRootFinder", () => {
  let surface: ScriptedViews;

  function findAsync(): Promise<ClosedRoots> {
    const options: CallOptions = new CallOptions(new AbortController().signal, Date.now() + 5_000, 1_000, false, new ActionProgress(() => undefined));
    return new ClosedRootFinder(new ViewCalls(surface.relay)).findAsync("view-1", options);
  }

  // The answers by node and depth; a node missing at a depth is too large to describe there.
  function describeBy(nodes: Readonly<Record<string, JsonObject>>): void {
    surface.answerWith("DOM.describeNode", t => {
      const found: JsonObject | undefined = nodes[`${String(t["backendNodeId"])}@${String(t["depth"])}`];
      return found === undefined ? TOO_LARGE : { node: found };
    });
  }

  function described(): JsonValue[] {
    return surface.calls.filter(t => t.method === "DOM.describeNode").map(t => [t.params["backendNodeId"] ?? null, t.params["depth"] ?? null]);
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.answer("DOM.getDocument", { root: { backendNodeId: 1, nodeType: 9, nodeName: "#document" } });
  });

  it("finds every closed root's host in one answer, through open roots, and never inside a closed root, a frame, a template or a user agent's root", async () => {
    const inFrame: JsonObject = element(40, "x-framed", [], [root(41, "closed")]);
    describeBy({
      "1@-1": {
        backendNodeId: 1, nodeType: 9, children: [{ backendNodeId: 9, nodeType: 10 }, element(2, "html", [element(3, "body", [
          element(4, "x-card", [], [root(5, "closed", [element(6, "x-nested", [], [root(7, "closed")])])]),
          element(8, "div", [element(12, "span")], [root(10, "open", [element(11, "x-inner", [], [root(13, "closed")])])]),
          element(14, "input", [], [root(15, "user-agent", [element(16, "x-agent", [], [root(17, "closed")])])]),
          { ...element(18, "iframe"), contentDocument: { backendNodeId: 19, nodeType: 9, children: [inFrame] } },
          { ...element(20, "template"), templateContent: { backendNodeId: 21, nodeType: 11, children: [inFrame] } }
        ])])]
      }
    });

    const roots: ClosedRoots = await findAsync();

    expect([roots.hosts, roots.unsearched]).toEqual([[4, 11], []]);
    expect(surface.calls.map(t => [t.method, t.params])).toEqual([
      ["DOM.getDocument", { depth: 0, pierce: true }], ["DOM.describeNode", { backendNodeId: 1, depth: -1, pierce: true }]]);
  });

  it("splits a node whose answer passes the bound into its own level and each child and open root whole, again where needed", async () => {
    describeBy({
      "1@1": { backendNodeId: 1, nodeType: 9, children: [{ backendNodeId: 9, nodeType: 10 }, element(2, "html")] },
      "2@1": element(2, "html", [element(3, "head"), element(4, "body")], [root(5, "closed"), root(6, "open"), root(15, "user-agent")]),
      "6@-1": root(6, "open", [element(7, "x-open", [], [root(8, "closed")])]),
      "3@-1": element(3, "head"),
      "4@1": element(4, "body", [element(10, "main"), element(11, "x-big")]),
      "10@-1": element(10, "main", [element(12, "x-card", [], [root(13, "closed")])]),
      "11@-1": element(11, "x-big", [], [root(14, "closed")])
    });

    const roots: ClosedRoots = await findAsync();

    expect([[...roots.hosts].sort((a, b) => a - b), roots.unsearched]).toEqual([[2, 7, 11, 12], []]);
    expect(described()).toEqual([[1, -1], [1, 1], [2, 1], [6, -1], [3, -1], [4, -1], [4, 1], [10, -1], [11, -1]]);
  });

  it("describes the lone element child of a node too large to describe whole one level deep straight away, down a chain of them", async () => {
    const nodes: Record<string, JsonObject> = {
      "1@1": { backendNodeId: 1, nodeType: 9, children: [{ backendNodeId: 9, nodeType: 10 }, element(2, "html")] },
      "2@1": element(2, "html", [element(3, "body")]),
      "3@1": element(3, "body", [element(4, "x-host")]),
      "4@1": element(4, "x-host", [], [root(5, "open")]),
      "5@1": root(5, "open", [element(6, "section")]),
      "6@1": element(6, "section", [element(10, "p"), element(11, "x-card")]),
      "10@-1": element(10, "p"),
      "11@-1": element(11, "x-card", [], [root(12, "closed")])
    };
    describeBy(nodes);

    const roots: ClosedRoots = await findAsync();

    expect([roots.hosts, roots.unsearched]).toEqual([[11], []]);
    expect(described()).toEqual([[1, -1], [1, 1], [2, 1], [3, 1], [4, 1], [5, -1], [5, 1], [6, 1], [10, -1], [11, -1]]);
    const oversized: readonly string[] = surface.calls.filter(t => t.method === "DOM.describeNode")
      .map(t => `${String(t.params["backendNodeId"])}@${String(t.params["depth"])}`).filter(t => !Object.hasOwn(nodes, t));
    expect(oversized).toEqual(["1@-1", "5@-1"]);
  });

  it("names each node whose own level alone passes the bound as unsearched, by its tag and id, and searches on past it", async () => {
    describeBy({
      "1@1": { backendNodeId: 1, nodeType: 9, children: [element(2, "html")] },
      "2@1": { ...element(2, "html", [{ ...element(3, "table"), attributes: ["class", "id", "id", "rows"] }, element(4, "footer"), element(6, "div")], [root(7, "open")]) },
      "4@-1": element(4, "footer", [], [root(5, "closed")])
    });

    const roots: ClosedRoots = await findAsync();

    expect([roots.hosts, roots.unsearched.toSorted()]).toEqual([[4], ["<div>", "<table id=\"rows\">", "a shadow root"]]);
  });

  it.each([
    ["a tag that isn't text", { backendNodeId: 3, nodeType: 1 }],
    ["attributes that aren't a list", { ...element(3, "table"), attributes: "id" }],
    ["an id that isn't text", { ...element(3, "table"), attributes: ["id", 4] }]
  ])("fails as malformed for an unsearched element with %s", async (_name: string, child: JsonObject) => {
    describeBy({ "1@1": { backendNodeId: 1, nodeType: 9, children: [child] } });

    await expect(findAsync()).rejects.toBeInstanceOf(MalformedReplyException);
  });

  it("describes a level's parts 64 at a time", async () => {
    const children: readonly JsonObject[] = Array.from({ length: 70 }, (_value: unknown, index: number) => element(10 + index, "section"));
    let open: number = 0;
    let most: number = 0;
    surface.answerWith("DOM.describeNode", async t => {
      if (t["backendNodeId"] === 1)
        return t["depth"] === 1 ? { node: { backendNodeId: 1, nodeType: 9, children: [...children] } } : TOO_LARGE;
      open++;
      most = Math.max(most, open);
      await Promise.resolve();
      open--;
      return { node: element(Number(t["backendNodeId"]), "section") };
    });

    await findAsync();

    expect([described().length, most]).toEqual([72, 64]);
  });

  describe("within the search's time", () => {
    const START: number = 1_000_000;

    afterEach(() => {
      vi.useRealTimers();
    });

    // A rows element of 80 children, too large to describe whole, under a document whose whole answer comes once the clock reads the time
    // before, and whose first child's answer comes the time elapsed after that.
    async function findAtAsync(elapsed: number, before: number = 0): Promise<ClosedRoots> {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(START);
      const children: readonly JsonObject[] = Array.from({ length: 80 }, (_value: unknown, index: number) => element(10 + index, "section"));
      surface.answerWith("DOM.describeNode", t => {
        if (t["backendNodeId"] === 1 && t["depth"] === -1)
          vi.setSystemTime(START + before);
        if (t["backendNodeId"] === 10)
          vi.setSystemTime(START + before + elapsed);
        if (t["backendNodeId"] === 1)
          return t["depth"] === 1 ? { node: { backendNodeId: 1, nodeType: 9, children: [{ ...element(2, "div"), attributes: ["id", "rows"] }] } } : TOO_LARGE;
        if (t["backendNodeId"] === 2)
          return t["depth"] === 1 ? { node: element(2, "div", children) } : TOO_LARGE;
        return { node: element(Number(t["backendNodeId"]), "section", [], t["backendNodeId"] === 89 ? [root(90, "closed")] : []) };
      });
      return findAsync();
    }

    it("leaves the parts not yet described once its time is up, named once by their parent with how many", async () => {
      const roots: ClosedRoots = await findAtAsync(2_000);

      expect([roots.hosts, roots.unsearched, described().length]).toEqual([[], ["<div id=\"rows\">: 16 of 80 children"], 67]);
    });

    it("describes every part when the time is up only a millisecond later", async () => {
      const roots: ClosedRoots = await findAtAsync(1_999);

      expect([roots.hosts, roots.unsearched, described().length]).toEqual([[89], [], 83]);
    });

    it("starts its time at the first split, not counting the whole answer before it", async () => {
      const roots: ClosedRoots = await findAtAsync(1_999, 1_500);

      expect([roots.hosts, roots.unsearched, described().length]).toEqual([[89], [], 83]);
    });
  });

  it("names the document as unsearched when even its own level passes the bound", async () => {
    describeBy({});

    expect((await findAsync()).unsearched).toEqual(["the document"]);
  });

  it("passes on a failure that isn't a reply too large", async () => {
    surface.fail("DOM.describeNode", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Engine busy"));

    await expect(findAsync()).rejects.toBeInstanceOf(ProtocolFailedException);
  });

  it.each([
    ["a document without a root's node", { root: { nodeType: 9 } }, { node: element(1, "html") }],
    ["a document without its root", {}, { node: element(1, "html") }],
    ["a describe without its node", { root: { backendNodeId: 1 } }, { nodes: [] }],
    ["children that aren't a list of nodes", { root: { backendNodeId: 1 } }, { node: { backendNodeId: 1, children: [5] } }],
    ["children that aren't a list", { root: { backendNodeId: 1 } }, { node: { backendNodeId: 1, children: 5 } }]
  ])("fails as malformed for %s", async (_name: string, document: JsonObject, reply: JsonObject) => {
    surface.answer("DOM.getDocument", document);
    surface.answer("DOM.describeNode", reply);

    await expect(findAsync()).rejects.toBeInstanceOf(MalformedReplyException);
  });
});
