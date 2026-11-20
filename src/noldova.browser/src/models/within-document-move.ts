/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WithinDocumentMove {
  public readonly frameId: string;
  public readonly url: string;

  public constructor(frameId: string, url: string) {
    this.frameId = frameId;
    this.url = url;
  }
}
