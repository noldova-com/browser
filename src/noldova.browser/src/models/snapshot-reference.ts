/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISessionReferenceVisitor } from "../interfaces/i-session-reference-visitor.ts";

// What a session's reference names: the element a snapshot of the view's document gave the index, which the page keeps until the next
// snapshot.
export class SnapshotReference {
  public readonly viewId: string;
  public readonly documentId: string;
  public readonly index: number;

  public constructor(viewId: string, documentId: string, index: number) {
    this.viewId = viewId;
    this.documentId = documentId;
    this.index = index;
  }

  public accept<T>(visitor: ISessionReferenceVisitor<T>): T {
    return visitor.visitSnapshotElement(this);
  }
}
