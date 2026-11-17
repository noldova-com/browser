/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// A child the walk knows only by its element, from a parent whose children are too many for one answer; its node is read when the walk
// comes to it.
export class UnreadChild {
  public readonly backendNodeId: number;
  public readonly parent: AccessibilityNode;

  public constructor(backendNodeId: number, parent: AccessibilityNode) {
    this.backendNodeId = backendNodeId;
    this.parent = parent;
  }
}
