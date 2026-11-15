/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AccessibilityNode } from "../../src/models/accessibility-node.ts";

describe("AccessibilityNode", () => {
  it("keeps its fields", () => {
    const accessibilityNode: AccessibilityNode = new AccessibilityNode("2", false, "textbox", "Email", "a@shop.test", ["3"], 5, true);

    expect([accessibilityNode.id, accessibilityNode.isIgnored, accessibilityNode.role, accessibilityNode.name, accessibilityNode.value, accessibilityNode.childIds, accessibilityNode.backendNodeId, accessibilityNode.isFocused]).toEqual(["2", false, "textbox", "Email", "a@shop.test", ["3"], 5, true]);
  });
});
