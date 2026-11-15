/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageFrames {
  public readonly origin: string;
  public readonly mainId: string;
  public readonly childIds: readonly string[];

  public constructor(origin: string, mainId: string, childIds: readonly string[]) {
    this.origin = origin;
    this.mainId = mainId;
    this.childIds = childIds;
  }
}
