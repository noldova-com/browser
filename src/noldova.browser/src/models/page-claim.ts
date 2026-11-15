/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageClaim {
  public readonly isClaimed: boolean;
  public readonly isHere: boolean;

  public constructor(isClaimed: boolean, isHere: boolean) {
    this.isClaimed = isClaimed;
    this.isHere = isHere;
  }
}
