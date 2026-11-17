/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
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
});
