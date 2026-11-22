/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// A node of the page's tree with its name, in which every field value of the node and of the nodes below it is masked.
export class MaskedName {
  public readonly node: AccessibilityNode;
  public readonly name: string;

  public constructor(node: AccessibilityNode, name: string) {
    this.node = node;
    this.name = name;
  }
}
