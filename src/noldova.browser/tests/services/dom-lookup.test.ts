/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { WebViewFailureException } from "@noldova/desktop.runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ViewClosedException } from "../../src/exceptions/view-closed.exception.ts";
import type { AccessibilityNode } from "../../src/models/accessibility-node.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { DomLookup } from "../../src/services/dom-lookup.ts";
import { ViewCalls } from "../../src/services/view-calls.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

const FOCUSED: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };

function node(id: string, name: string, extra: JsonObject = {}): JsonObject {
  return { nodeId: id, ignored: false, role: { type: "role", value: "StaticText" }, name: { type: "computedString", value: name }, ...extra };
}

describe("DomLookup", () => {
  let surface: ScriptedViews;
  let lookup: DomLookup;
  let options: CallOptions;

  function calls(...methods: readonly string[]): [string, JsonObject][] {
    return surface.calls.filter(t => methods.includes(t.method)).map(t => [t.method, t.params]);
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1"]);
    surface.answer("DOM.getDocument", { root: { nodeId: 3, backendNodeId: 1, nodeName: "#document" } });
    surface.acknowledge("DOM.discardSearchResults");
    lookup = new DomLookup(new ViewCalls(surface.relay));
    options = new CallOptions(new AbortController().signal, Date.now() + 5_000, 1_000, false, new ActionProgress(() => undefined));
  });

  describe("findFocusedAsync", () => {
    it("reads the node of the element the document's focus selector finds", async () => {
      surface.answer("DOM.querySelector", { nodeId: 9 });
      surface.answer("Accessibility.getPartialAXTree", { nodes: [node("ax-9", "Search", { backendDOMNodeId: 40, properties: [FOCUSED] })] });

      const focused: AccessibilityNode | null = await lookup.findFocusedAsync("view-1", options);

      expect(focused).toMatchObject({ id: "ax-9", backendNodeId: 40, isFocused: true });
      expect(calls("DOM.getDocument", "DOM.querySelector", "Accessibility.getPartialAXTree")).toEqual([["DOM.getDocument", { depth: 0, pierce: true }],
        ["DOM.querySelector", { nodeId: 3, selector: ":focus" }], ["Accessibility.getPartialAXTree", { nodeId: 9, fetchRelatives: false }]]);
    });

    it("finds nothing when no element has the focus, or the one found isn't focused itself, such as a frame holding it", async () => {
      surface.answer("DOM.querySelector", { nodeId: 0 });
      const none: AccessibilityNode | null = await lookup.findFocusedAsync("view-1", options);
      surface.answer("DOM.querySelector", { nodeId: 9 });
      surface.answer("Accessibility.getPartialAXTree", { nodes: [node("ax-9", "Frame", { backendDOMNodeId: 40 })] });
      const frame: AccessibilityNode | null = await lookup.findFocusedAsync("view-1", options);

      expect([none, frame]).toEqual([null, null]);
      expect(calls("Accessibility.getPartialAXTree")).toHaveLength(1);
    });

    it("reads a document or a selector reply without a node id as malformed", async () => {
      surface.answer("DOM.querySelector", {});
      await expect(lookup.findFocusedAsync("view-1", options)).rejects.toBeInstanceOf(MalformedReplyException);

      surface.answer("DOM.getDocument", { root: { backendNodeId: 1 } });
      await expect(lookup.findFocusedAsync("view-1", options)).rejects.toBeInstanceOf(MalformedReplyException);

      surface.answer("DOM.getDocument", { root: 3 });
      await expect(lookup.findFocusedAsync("view-1", options)).rejects.toBeInstanceOf(MalformedReplyException);
    });
  });

  describe("hasTextAsync", () => {
    function found(count: number, nodeIds: readonly number[]): void {
      surface.answer("DOM.performSearch", { searchId: "s1", resultCount: count });
      surface.answer("DOM.getSearchResults", { nodeIds: [...nodeIds] });
    }

    it("is true once a shown node the search found has the text in its name, reading at most the first hundred, and discards the search", async () => {
      found(150, [7, 8, 9, 10]);
      surface.answerWith("Accessibility.getPartialAXTree", t => {
        if (t["nodeId"] === 7)
          throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found"));
        return { nodes: [t["nodeId"] === 8 ? { ...node("ax-8", "Order placed"), ignored: true } : node("ax-9", "Order placed")] };
      });

      const has: boolean = await lookup.hasTextAsync("view-1", "placed", options);

      expect(has).toBe(true);
      expect(calls("DOM.performSearch", "DOM.getSearchResults", "Accessibility.getPartialAXTree", "DOM.discardSearchResults")).toEqual([
        ["DOM.performSearch", { query: "placed", includeUserAgentShadowDOM: false }], ["DOM.getSearchResults", { searchId: "s1", fromIndex: 0, toIndex: 100 }],
        ["Accessibility.getPartialAXTree", { nodeId: 7, fetchRelatives: false }], ["Accessibility.getPartialAXTree", { nodeId: 8, fetchRelatives: false }],
        ["Accessibility.getPartialAXTree", { nodeId: 9, fetchRelatives: false }], ["DOM.discardSearchResults", { searchId: "s1" }]]);
    });

    it("is false when the search finds nothing, or nothing it found has the text in a shown name", async () => {
      found(0, []);
      const nothing: boolean = await lookup.hasTextAsync("view-1", "placed", options);
      found(1, [9]);
      surface.answer("Accessibility.getPartialAXTree", { nodes: [node("ax-9", "Placed")] });
      const otherCase: boolean = await lookup.hasTextAsync("view-1", "placed", options);

      expect([nothing, otherCase]).toEqual([false, false]);
      expect(calls("DOM.getSearchResults")).toEqual([["DOM.getSearchResults", { searchId: "s1", fromIndex: 0, toIndex: 1 }]]);
      expect(calls("DOM.discardSearchResults")).toHaveLength(2);
    });

    it("fails on any other failure reading a node it found, and still discards the search", async () => {
      found(1, [9]);
      surface.fail("Accessibility.getPartialAXTree", new WebViewFailure(WebViewFailureKind.ViewClosed));

      await expect(lookup.hasTextAsync("view-1", "placed", options)).rejects.toBeInstanceOf(ViewClosedException);
      expect(calls("DOM.discardSearchResults")).toHaveLength(1);
    });

    it("reads a search or its results in another shape as malformed", async () => {
      for (const search of [{ resultCount: 1 }, { searchId: "s1" }]) {
        surface.answer("DOM.performSearch", search);
        await expect(lookup.hasTextAsync("view-1", "placed", options)).rejects.toBeInstanceOf(MalformedReplyException);
      }
      for (const results of [{}, { nodeIds: ["9"] }]) {
        surface.answer("DOM.performSearch", { searchId: "s1", resultCount: 1 });
        surface.answer("DOM.getSearchResults", results);
        await expect(lookup.hasTextAsync("view-1", "placed", options)).rejects.toBeInstanceOf(MalformedReplyException);
      }
      expect(calls("DOM.discardSearchResults")).toHaveLength(2);
    });
  });
});
