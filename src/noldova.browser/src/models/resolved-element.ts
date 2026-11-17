/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// An element resolved as an object in the page changes' world, with the document the frame tree gave just before the world was found.
export class ResolvedElement {
  public readonly objectId: string;
  public readonly documentId: string;

  public constructor(objectId: string, documentId: string) {
    this.objectId = objectId;
    this.documentId = documentId;
  }
}
