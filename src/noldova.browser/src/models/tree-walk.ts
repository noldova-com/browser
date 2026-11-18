/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AccessibilitySnapshot } from "../services/accessibility-snapshot.ts";
import type { AccessibilityNode } from "./accessibility-node.ts";
import type { ListedEnd } from "./listed-end.ts";
import type { UnreadChild } from "./unread-child.ts";

// The position of a walk through the accessibility tree: the nodes read, those still to visit, and the bytes their lines take.
export class TreeWalk {
  public readonly nodes: AccessibilityNode[] = [];
  public readonly pending: (AccessibilityNode | UnreadChild | ListedEnd)[] = [];
  private readonly seen: Set<string>;
  private bytes: number = 0;

  public constructor(root: AccessibilityNode) {
    this.seen = new Set([root.id]);
  }

  // Adds the node's line, and says whether the lines read so far still fit the limit.
  public count(node: AccessibilityNode, maximumBytes: number): boolean {
    this.bytes += AccessibilitySnapshot.leastLineBytes(node);
    return this.bytes <= maximumBytes;
  }

  // The children read, in the order their parent names them, each once; a child the parent doesn't name, or one already read, is left out.
  public take(childIds: readonly string[], children: readonly AccessibilityNode[]): readonly AccessibilityNode[] {
    const byId: ReadonlyMap<string, AccessibilityNode> = new Map(children.map(t => [t.id, t]));
    const ordered: AccessibilityNode[] = [];
    for (const id of childIds) {
      const child: AccessibilityNode | undefined = byId.get(id);
      if (child !== undefined && !this.seen.has(id)) {
        this.seen.add(id);
        ordered.push(child);
      }
    }
    this.nodes.push(...ordered);
    return ordered;
  }

  // The ones of these nodes the walk hasn't read.
  public unread(ids: readonly string[]): readonly string[] {
    return ids.filter(t => !this.seen.has(t));
  }

  // Takes one child read on its own, and says whether it was taken: only when its parent names it and it wasn't read already.
  public adopt(parent: AccessibilityNode, child: AccessibilityNode): boolean {
    return this.take(parent.childIds, [child]).length === 1;
  }
}
