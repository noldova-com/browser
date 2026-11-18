/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// A node whose children are read by its element's list, and where that list ends: as it goes, and there, the walk checks that it read every
// child the node names from where it began, since a child that isn't one of the element's own, such as one in a shadow root or one the node
// takes by aria-owns, is never listed. Checked counts the named children checked so far.
export class ListedEnd {
  public readonly parent: AccessibilityNode;
  public readonly backendNodeId: number;
  public readonly childIds: readonly string[];
  public checked: number = 0;

  public constructor(parent: AccessibilityNode, backendNodeId: number, childIds: readonly string[]) {
    this.parent = parent;
    this.backendNodeId = backendNodeId;
    this.childIds = childIds;
  }
}
