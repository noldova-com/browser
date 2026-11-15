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
import { CutText } from "../../src/models/cut-text.ts";
import { AccessibilitySnapshot } from "../../src/services/accessibility-snapshot.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

function node(id: string, role: string, changes: JsonObject = {}): JsonObject {
  return { nodeId: id, ignored: false, role: { type: "role", value: role }, ...changes };
}

function text(value: string | number | boolean): JsonObject {
  return { type: "string", value };
}

const PAGE: JsonObject = { nodes: [
  node("1", "RootWebArea", { name: text("Sign in"), childIds: ["2", "3", "4", "5", "6"], backendDOMNodeId: 1 }),
  node("2", "heading", { name: text("Welcome back"), childIds: ["7"], backendDOMNodeId: 2 }),
  node("3", "link", { name: text("Help"), backendDOMNodeId: 3 }),
  node("4", "searchbox", { name: text("Search"), value: text("shoes"), backendDOMNodeId: 4 }),
  node("5", "textbox", { name: text("Password"), value: text("hunter2"), childIds: ["8"], backendDOMNodeId: 5 }),
  node("6", "generic", { childIds: ["9"] }),
  node("7", "StaticText", { name: text("Welcome back") }),
  node("8", "StaticText", { name: text("hunter2") }),
  node("9", "button", { name: text("Sign in"), backendDOMNodeId: 9 })
] };

function issuer(): [(backendNodeId: number) => string, number[]] {
  const issued: number[] = [];
  return [(backendNodeId: number): string => {
    issued.push(backendNodeId);
    return `e${issued.length}`;
  }, issued];
}

function write(nodes: AccessibilityTree, secrets: readonly number[], maximumBytes: number = 10_000): [CutText, number[]] {
  const [issue, issued]: [(backendNodeId: number) => string, number[]] = issuer();
  return [AccessibilitySnapshot.write(nodes, new Set(secrets), issue, maximumBytes), issued];
}

function expectMalformed(read: () => unknown): void {
  expect(read).toThrow(MalformedReplyException);
}

describe("AccessibilitySnapshot", () => {
  it("writes the tree indented from its root, lifts a wrapper with no name, and references only the elements an agent may act on", () => {
    const [cut, issued]: [CutText, number[]] = write(AccessibilitySnapshot.readNodes(PAGE), []);

    expect(cut).toStrictEqual(new CutText([
      "- RootWebArea \"Sign in\"",
      "  - heading \"Welcome back\"",
      "    - StaticText \"Welcome back\"",
      "  - link \"Help\" [e1]",
      "  - searchbox \"Search\" value=\"shoes\" [e2]",
      "  - textbox \"Password\" value=\"hunter2\" [e3]",
      "    - StaticText \"hunter2\"",
      "  - button \"Sign in\" [e4]"
    ].join("\n"), false));
    expect(issued).toEqual([3, 4, 5, 9]);
  });

  it("masks a secret field's value and leaves out what is inside it", () => {
    const [cut]: [CutText, number[]] = write(AccessibilitySnapshot.readNodes(PAGE), [5]);

    expect(cut.text).toContain(`  - textbox "Password" value="••••••" [e3]\n  - button`);
    expect(cut.text).not.toContain("hunter2");
  });

  it("masks a typed value with no element behind it, which can't be checked, and gives it no reference", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { childIds: ["2", "3"] }),
      node("2", "textbox", { value: text("123456"), childIds: ["4"] }),
      node("3", "slider", { value: text(40), backendDOMNodeId: 3 }),
      node("4", "StaticText", { name: text("123456") })
    ] });

    expect(write(nodes, [])).toStrictEqual([new CutText(`- RootWebArea\n  - textbox value="••••••"\n  - slider value="40" [e1]`, false), [3]]);
  });

  it("lists as typed fields only the typed roles with a value and an element", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { childIds: ["2", "3", "4", "5", "6"] }),
      node("2", "textbox", { value: text("a"), backendDOMNodeId: 2 }),
      node("3", "combobox", { value: text("b"), backendDOMNodeId: 3 }),
      node("4", "textbox", { backendDOMNodeId: 4 }),
      node("5", "textbox", { value: text("c") }),
      node("6", "slider", { value: text(3), backendDOMNodeId: 6 })
    ] });

    expect(AccessibilitySnapshot.typedFields(nodes)).toEqual([2, 3]);
  });

  it("skips ignored nodes but keeps their children at their depth, and writes numbers and booleans as text", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { childIds: ["2"] }),
      node("2", "none", { ignored: true, name: text("hidden"), childIds: ["3"] }),
      node("3", "checkbox", { name: text("Remember me"), value: text(true), backendDOMNodeId: 3 })
    ] });

    expect(write(nodes, [])[0].text).toBe("- RootWebArea\n  - checkbox \"Remember me\" value=\"true\" [e1]");
  });

  it("writes each node once, skips unknown children, and reads other values as none", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { childIds: ["2", "2", "1", "missing"] }),
      node("2", "group", { name: { type: "string" }, value: { type: "object", value: { kind: "x" } } }),
      { nodeId: "3", role: "button", name: "Bare" }
    ] });

    expect(write(nodes, [])[0].text).toBe("- RootWebArea\n  - group");
    expect(nodes.nodes[2]).toStrictEqual(new AccessibilityNode("3", false, "", "", "", [], null, false));
  });

  it("escapes a name's quotes and line breaks, so each node stays on its line", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [node("1", "RootWebArea", { name: text("Say \"hi\"\nnow") })] });

    expect(write(nodes, [])[0].text).toBe("- RootWebArea \"Say \\\"hi\\\"\\nnow\"");
  });

  it("stops before the line that would pass the limit, marks the cut, and shows no reference past it", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes(PAGE);
    const limit: number = "- RootWebArea \"Sign in\"\n  - heading \"Welcome back\"\n    - StaticText \"Welcome back\"\n".length;

    const [cut]: [CutText, number[]] = write(nodes, [], limit);

    expect(cut).toStrictEqual(new CutText("- RootWebArea \"Sign in\"\n  - heading \"Welcome back\"\n    - StaticText \"Welcome back\"", true));
    expect(write(nodes, [], limit - 1)[0]).toStrictEqual(new CutText("- RootWebArea \"Sign in\"\n  - heading \"Welcome back\"", true));
  });

  it("counts the limit in UTF-8 bytes", () => {
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [node("1", "RootWebArea", { name: text("\u00e9t\u00e9") })] });

    expect(write(nodes, [], "- RootWebArea \"\u00e9t\u00e9\"\n".length)[0].isCut).toBe(true);
    expect(write(nodes, [], "- RootWebArea \"\u00e9t\u00e9\"\n".length + 2)[0].isCut).toBe(false);
  });

  it("finds the deepest focused element, and none when only nodes with no element are focused", () => {
    const focused: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };
    const nodes: AccessibilityTree = AccessibilitySnapshot.readNodes({ nodes: [
      node("1", "RootWebArea", { properties: [focused], backendDOMNodeId: 1, childIds: ["2", "3"] }),
      node("2", "textbox", { properties: [{ name: "editable", value: text("plaintext") }, focused], backendDOMNodeId: 2 }),
      node("3", "button", { properties: [{ name: "focused", value: text(false) }, "focused"], backendDOMNodeId: 3 })
    ] });

    expect(AccessibilitySnapshot.findFocused(nodes)).toBe(2);
    expect(AccessibilitySnapshot.findFocused(AccessibilitySnapshot.readNodes({ nodes: [node("1", "RootWebArea", { properties: [focused] })] }))).toBeNull();
  });

  it("reads the page's title from the root's name", () => {
    expect(AccessibilitySnapshot.readTitle(AccessibilitySnapshot.readNodes(PAGE))).toBe("Sign in");
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
