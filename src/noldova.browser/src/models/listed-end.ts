/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// Where a node's listed children end: there the walk checks that it read every child the node names from where it began, since a child
// that isn't one of the element's own, such as one in a shadow root or one the node takes by aria-owns, is never listed.
export class ListedEnd {
  public readonly parent: AccessibilityNode;
  public readonly childIds: readonly string[];

  public constructor(parent: AccessibilityNode, childIds: readonly string[]) {
    this.parent = parent;
    this.childIds = childIds;
  }
}
