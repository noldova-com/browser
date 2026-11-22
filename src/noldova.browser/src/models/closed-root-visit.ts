/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// A node of a closed shadow root to visit, with its depth and the indexes of its ancestors' lines.
export class ClosedRootVisit {
  public readonly node: AccessibilityNode;
  public readonly depth: number;
  public readonly ancestors: readonly number[];

  public constructor(node: AccessibilityNode, depth: number, ancestors: readonly number[]) {
    this.node = node;
    this.depth = depth;
    this.ancestors = ancestors;
  }
}
