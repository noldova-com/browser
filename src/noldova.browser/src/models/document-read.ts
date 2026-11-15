/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccessibilityTree } from "./accessibility-tree.ts";
import type { FrameFacts } from "./frame-facts.ts";

export class DocumentRead {
  public readonly frame: FrameFacts;
  public readonly tree: AccessibilityTree;
  public readonly secrets: ReadonlySet<number>;

  public constructor(frame: FrameFacts, tree: AccessibilityTree, secrets: ReadonlySet<number>) {
    this.frame = frame;
    this.tree = tree;
    this.secrets = secrets;
  }
}
