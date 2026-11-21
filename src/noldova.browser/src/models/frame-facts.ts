/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FrameFacts {
  public readonly url: string;
  public readonly origin: string;
  public readonly documentId: string;
  public readonly frameId: string;

  public constructor(url: string, origin: string, documentId: string, frameId: string) {
    this.url = url;
    this.origin = origin;
    this.documentId = documentId;
    this.frameId = frameId;
  }
}
