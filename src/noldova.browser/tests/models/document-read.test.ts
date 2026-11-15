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
import { DocumentRead } from "../../src/models/document-read.ts";
import { FrameFacts } from "../../src/models/frame-facts.ts";

describe("DocumentRead", () => {
  it("keeps its fields", () => {
    const frame: FrameFacts = new FrameFacts("https://shop.test/cart", "https://shop.test", "L1");
    const tree: AccessibilityTree = new AccessibilityTree(new AccessibilityNode("1", false, "RootWebArea", "Cart", "", [], 1, false), []);
    const read: DocumentRead = new DocumentRead(frame, tree, new Set([5]));

    expect([read.frame, read.tree, read.secrets]).toEqual([frame, tree, new Set([5])]);
  });
});
