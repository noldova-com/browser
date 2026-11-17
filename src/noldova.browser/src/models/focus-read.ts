/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityNode } from "./accessibility-node.ts";

// What the key tool found focused, and whether it looked through the document, where a page in a window without focus shows no focused
// element, so that finding none there doesn't show that nothing has the focus.
export class FocusRead {
  public readonly node: AccessibilityNode | null;
  public readonly isFromDocument: boolean;

  public constructor(node: AccessibilityNode | null, isFromDocument: boolean) {
    this.node = node;
    this.isFromDocument = isFromDocument;
  }
}
