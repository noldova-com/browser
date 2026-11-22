/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AccessibilityNode } from "../../src/models/accessibility-node.ts";
import { MaskedName } from "../../src/models/masked-name.ts";

describe("MaskedName", () => {
  it("keeps its fields", () => {
    const node: AccessibilityNode = new AccessibilityNode("2", false, "LabelText", "Card 4111", "", ["3"], 12, false);
    const masked: MaskedName = new MaskedName(node, "Card ••••••");

    expect([masked.node, masked.name]).toEqual([node, "Card ••••••"]);
  });
});
