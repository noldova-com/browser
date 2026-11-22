/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AccessibilityNode } from "../../src/models/accessibility-node.ts";
import { ClosedRootVisit } from "../../src/models/closed-root-visit.ts";

describe("ClosedRootVisit", () => {
  it("keeps its fields", () => {
    const node: AccessibilityNode = new AccessibilityNode("2", false, "group", "", "", [], 12, false, []);
    const visit: ClosedRootVisit = new ClosedRootVisit(node, 3, [0, 2]);

    expect([visit.node, visit.depth, visit.ancestors]).toEqual([node, 3, [0, 2]]);
  });
});
