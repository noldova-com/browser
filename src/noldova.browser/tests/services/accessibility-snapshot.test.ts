/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { AccessibilityNode } from "../../src/models/accessibility-node.ts";
import type { AccessibilityTree } from "../../src/models/accessibility-tree.ts";
import { AccessibilitySnapshot } from "../../src/services/accessibility-snapshot.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

function node(id: string, role: string, changes: JsonObject = {}): JsonObject {
  return { nodeId: id, ignored: false, role: { type: "role", value: role }, ...changes };
}

function text(value: string | number | boolean): JsonObject {
  return { type: "string", value };
}

const PAGE: JsonObject = { nodes: [
  node("1", "RootWebArea", { name: text("Sign in"), childIds: ["2", "3"], backendDOMNodeId: 1 }),
  node("2", "heading", { name: text("Welcome back"), backendDOMNodeId: 2 }),
  node("3", "textbox", { name: text("Password"), value: text("hunter2"), backendDOMNodeId: 3 })
] };

function expectMalformed(read: () => unknown): void {
  expect(read).toThrow(MalformedReplyException);
}

describe("AccessibilitySnapshot", () => {
  it("reads every node with the root first, by its id, role, name, value, children and element", () => {
    const tree: AccessibilityTree = AccessibilitySnapshot.readNodes(PAGE);

    expect(tree.nodes).toStrictEqual([
      new AccessibilityNode("1", false, "RootWebArea", "Sign in", "", ["2", "3"], 1, false),
      new AccessibilityNode("2", false, "heading", "Welcome back", "", [], 2, false),
      new AccessibilityNode("3", false, "textbox", "Password", "hunter2", [], 3, false)
    ]);
    expect(tree.root).toBe(tree.nodes[0]);
  });

  it("reads an ignored node, numbers and booleans as text, and other values as none", () => {
    const tree: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "none", { ignored: true, name: text(40), value: text(true) }),
      node("2", "group", { name: { type: "string" }, value: { type: "object", value: { kind: "x" } } }),
      { nodeId: "3", role: "button", name: "Bare" }
    ] });

    expect(tree.nodes).toStrictEqual([
      new AccessibilityNode("1", true, "none", "40", "true", [], null, false),
      new AccessibilityNode("2", false, "group", "", "", [], null, false),
      new AccessibilityNode("3", false, "", "", "", [], null, false)
    ]);
  });

  it("finds the deepest focused element, and none when only nodes with no element are focused", () => {
    const focused: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { properties: [focused], backendDOMNodeId: 1, childIds: ["2", "3"] }),
      node("2", "textbox", { properties: [{ name: "editable", value: text("plaintext") }, focused], backendDOMNodeId: 2 }),
      node("3", "button", { properties: [{ name: "focused", value: text(false) }, "focused"], backendDOMNodeId: 3 })
    ] });

    expect(AccessibilitySnapshot.findFocused(nodes.nodes)?.backendNodeId).toBe(2);
    expect(AccessibilitySnapshot.findFocused(AccessibilitySnapshot.readNodes({ nodes: [node("1", "RootWebArea", { properties: [focused] })] }).nodes)).toBeNull();
  });

  it("masks every field value in the names of its node and of the nodes above it, by the tree's parentage, and in no other node's name", () => {
    const tree: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      { nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Pay 4111" }, childIds: ["2", "5"] },
      { nodeId: "2", role: { value: "LabelText" }, name: { value: "Card number 4111 4111, expires 07" }, childIds: ["3", "4"] },
      { nodeId: "3", role: { value: "textbox" }, name: { value: "" }, value: { value: "4111" }, childIds: [] },
      { nodeId: "4", role: { value: "textbox" }, name: { value: "" }, value: { value: "07" }, childIds: [] },
      { nodeId: "5", role: { value: "paragraph" }, name: { value: "Ends in 4111" }, childIds: [] }
    ] });

    expect(AccessibilitySnapshot.readMaskedNames(tree).map(t => [t.node.id, t.name])).toEqual([
      ["1", "Pay ••••••"], ["2", "Card number •••••• ••••••, expires ••••••"], ["3", ""], ["4", ""], ["5", "Ends in 4111"]
    ]);
  });

  it("masks a value in each name once and stops, when a reply names a node as its own ancestor", () => {
    const tree: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      { nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Code 12" }, childIds: ["2"] },
      { nodeId: "2", role: { value: "group" }, name: { value: "Code 12" }, childIds: ["1"], value: { value: "12" } }
    ] });

    expect(AccessibilitySnapshot.readMaskedNames(tree).map(t => t.name)).toEqual(["Code ••••••", "Code ••••••"]);
  });

  it("reads the page's title from the root's name", () => {
    expect(AccessibilitySnapshot.readTitle(AccessibilitySnapshot.readNodes(PAGE))).toBe("Sign in");
  });

  it("reads a node's children in the order they come", () => {
    const children: readonly AccessibilityNode[] = AccessibilitySnapshot.readChildren({ nodes: [node("3", "link"), node("2", "button")] });

    expect(children.map(t => t.id)).toEqual(["3", "2"]);
  });

  it.each<[string, () => unknown]>([
    ["children that aren't a list", () => AccessibilitySnapshot.readChildren({ nodes: "2" })],
    ["a child that isn't a node", () => AccessibilitySnapshot.readChildren({ nodes: [1] })]
  ])("fails as a malformed reply with %s", (_case: string, reading: () => unknown) => {
    expectMalformed(reading);
  });

  it.each<[string, JsonObject]>([
    ["no nodes", {}],
    ["nodes that aren't a list", { nodes: "1" }],
    ["an empty tree", { nodes: [] }],
    ["a node that isn't an object", { nodes: [1] }],
    ["a node id that isn't text", { nodes: [{ nodeId: 1 }] }],
    ["an ignored flag that isn't a boolean", { nodes: [{ nodeId: "1", ignored: "no" }] }],
    ["a backend node id that isn't a number", { nodes: [{ nodeId: "1", backendDOMNodeId: "1" }] }],
    ["children that aren't a list", { nodes: [{ nodeId: "1", childIds: "2" }] }],
    ["a child id that isn't text", { nodes: [{ nodeId: "1", childIds: [2] }] }],
    ["properties that aren't a list", { nodes: [{ nodeId: "1", properties: {} }] }]
  ])("fails as a malformed reply with %s", (_case: string, reply: JsonObject) => {
    expectMalformed(() => AccessibilitySnapshot.readNodes(reply));
  });
});
