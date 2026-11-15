/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

export class AccessibilityTree {
  public readonly root: AccessibilityNode;
  public readonly nodes: readonly AccessibilityNode[];

  public constructor(root: AccessibilityNode, others: readonly AccessibilityNode[]) {
    this.root = root;
    this.nodes = [root, ...others];
  }
}
