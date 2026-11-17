/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AccessibilityNode } from "../../src/models/accessibility-node.ts";
import { AccessibilityTree } from "../../src/models/accessibility-tree.ts";

describe("AccessibilityTree", () => {
  it("keeps its root, and every node with the root first", () => {
    const root: AccessibilityNode = new AccessibilityNode("1", false, "RootWebArea", "Cart", "", ["2"], 1, false);
    const button: AccessibilityNode = new AccessibilityNode("2", false, "button", "Pay", "", [], 2, true);
    const tree: AccessibilityTree = new AccessibilityTree(root, [button]);

    expect([tree.root, tree.nodes, tree.isWhole]).toEqual([root, [root, button], true]);
  });

  it("says when it holds only part of the page's tree", () => {
    const root: AccessibilityNode = new AccessibilityNode("1", false, "RootWebArea", "Cart", "", ["2"], 1, false);

    expect(new AccessibilityTree(root, [], false).isWhole).toBe(false);
  });
});
