/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ElementReference {
  public readonly viewId: string;
  public readonly documentId: string;
  public readonly backendNodeId: number;

  public constructor(viewId: string, documentId: string, backendNodeId: number) {
    this.viewId = viewId;
    this.documentId = documentId;
    this.backendNodeId = backendNodeId;
  }
}
