/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// One line of the page's snapshot: its depth, role and name, a field's value or whether the page masked it, the index the page gave its
// element when a reference names it, the number of the closed shadow root's host it stands for, and the node of an element read inside
// such a root, which the page can't name, when a reference names it.
export class SnapshotLine {
  public readonly depth: number;
  public readonly role: string;
  public readonly name: string;
  public readonly value: string;
  public readonly isMasked: boolean;
  public readonly index: number | null;
  public readonly host: number | null;
  public readonly backendNodeId: number | null;

  public constructor(depth: number, role: string, name: string, value: string, isMasked: boolean, index: number | null, host: number | null = null,
    backendNodeId: number | null = null) {
    this.depth = depth;
    this.role = role;
    this.name = name;
    this.value = value;
    this.isMasked = isMasked;
    this.index = index;
    this.host = host;
    this.backendNodeId = backendNodeId;
  }
}
