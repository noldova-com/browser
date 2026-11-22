/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISessionReferenceVisitor } from "../interfaces/i-session-reference-visitor.ts";

export class ElementReference {
  public readonly viewId: string;
  public readonly documentId: string;
  public readonly backendNodeId: number;

  public constructor(viewId: string, documentId: string, backendNodeId: number) {
    this.viewId = viewId;
    this.documentId = documentId;
    this.backendNodeId = backendNodeId;
  }

  public accept<T>(visitor: ISessionReferenceVisitor<T>): T {
    return visitor.visitClosedElement(this);
  }
}
