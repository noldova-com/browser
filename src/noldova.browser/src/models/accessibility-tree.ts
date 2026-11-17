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
  // Whether it holds every node from where it starts to the page's end.
  public readonly isWhole: boolean;
  // Whether it starts where the page is scrolled to, with only the nodes that lead there before it.
  public readonly isFromView: boolean;

  public constructor(root: AccessibilityNode, others: readonly AccessibilityNode[], isWhole: boolean = true, isFromView: boolean = false) {
    this.root = root;
    this.nodes = [root, ...others];
    this.isWhole = isWhole;
    this.isFromView = isFromView;
  }
}
